export interface UserSettings {
  id: string;
  user_id: string;
  // Market targeting
  target_market: string;
  target_submarkets: string[];
  property_types: string[];
  price_ceiling: number;
  down_payment_pct: number;
  // Underwriting assumptions
  property_tax_rate: number;
  mgmt_pct: number;
  vacancy_pct: number;
  maintenance_pct: number;
  capex_pct: number;
  closing_costs_pct: number;
  // Goals and alerts
  acquisition_goal_count: number;
  acquisition_goal_years: number;
  alert_email: string | null;
  mortgage_rate_override: number | null;
  // Scheduling
  finder_cron_interval: string;
  last_finder_run: string | null;
  notification_preferences: Record<string, unknown>;
  // Branding
  logo_url: string | null;
  accent_color: string | null;
  // Timestamps
  created_at: string;
  updated_at: string;
}

// All fields except id, user_id, created_at, updated_at are updatable
export type UserSettingsUpdate = Partial<
  Omit<UserSettings, 'id' | 'user_id' | 'created_at' | 'updated_at'>
>;

// DFW investor profile defaults (used in seed script and as reference)
export const DFW_DEFAULTS: UserSettingsUpdate = {
  target_market: 'DFW',
  target_submarkets: [
    'Arlington',
    'Garland',
    'Irving',
    'Grand Prairie',
    'Las Colinas',
  ],
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
  finder_cron_interval: '1 day',
};
