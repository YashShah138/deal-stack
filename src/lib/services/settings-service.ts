import { createClient } from '@/lib/supabase/server';
import type { UserSettings, UserSettingsUpdate } from '@/lib/types/settings';

/**
 * Get settings for the currently authenticated user.
 * Returns null if no settings row exists (should not happen after seed).
 */
export async function getUserSettings(): Promise<UserSettings | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('user_settings')
    .select('*')
    .eq('user_id', user.id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // No rows
    throw error;
  }

  return data as UserSettings;
}

/**
 * Update settings for the currently authenticated user.
 * Only updates the fields provided in the partial update object.
 */
export async function updateUserSettings(
  updates: UserSettingsUpdate
): Promise<UserSettings> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('user_settings')
    .update(updates)
    .eq('user_id', user.id)
    .select()
    .single();

  if (error) throw error;

  return data as UserSettings;
}
