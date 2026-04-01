import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function seedAdmin() {
  const email = process.env.ADMIN_EMAIL!;
  const password = process.env.ADMIN_PASSWORD!;

  if (!email || !password) {
    throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD must be set');
  }

  // Create admin user in auth.users
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { role: 'admin' },
  });

  if (error) {
    if (error.message.includes('already been registered')) {
      console.log('Admin user already exists');
      return;
    }
    throw error;
  }

  console.log('Admin user created:', data.user.id);

  // Insert into public.users profile table
  const { error: profileError } = await supabase.from('users').insert({
    id: data.user.id,
    email,
    full_name: 'Admin',
    role: 'admin',
  });

  if (profileError) {
    console.error('Profile insert failed:', profileError.message);
  }

  // Insert default DFW investor settings
  const { error: settingsError } = await supabase.from('user_settings').insert({
    user_id: data.user.id,
    target_market: 'DFW',
    target_submarkets: ['Arlington', 'Garland', 'Irving', 'Grand Prairie', 'Las Colinas'],
    property_types: ['SFR', 'Small Multifamily'],
    price_ceiling: 400000,
    down_payment_pct: 20,
    property_tax_rate: 1.8,
    mgmt_pct: 9,
    vacancy_pct: 8,
    maintenance_pct: 10,
    capex_pct: 5,
    closing_costs_pct: 2.5,
    acquisition_goal_count: 5,
    acquisition_goal_years: 5,
    alert_email: email,
    mortgage_rate_override: null,
    finder_cron_interval: '1 day',
  });

  if (settingsError) throw settingsError;
  console.log('Default DFW settings seeded');
}

seedAdmin().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
