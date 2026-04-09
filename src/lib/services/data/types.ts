import { SupabaseClient } from '@supabase/supabase-js';

export interface BaseProvider {
  readonly name: string;       // e.g. 'rentcast', 'census-geocoder', 'census-acs', 'walkscore'
  readonly defaultTtlDays: number;  // 30 for Rentcast, 90 for Census ACS, 36500 for permanent
  fetch<T>(endpoint: string, params: Record<string, string>): Promise<T>;
  checkRateLimit(supabase: SupabaseClient): Promise<void>;  // throws RateLimitExceededError
}

export interface CacheEntry {
  id: string;
  provider: string;
  endpoint: string;
  cache_key: string;
  response_data: unknown;
  created_at: string;
  expires_at: string;
}

export interface UsageLogEntry {
  provider: string;
  endpoint: string;
  user_id: string | null;
  cache_hit: boolean;
}

export class RateLimitExceededError extends Error {
  constructor(provider: string, limit: number) {
    super(`${provider} monthly limit of ${limit} calls exceeded`);
    this.name = 'RateLimitExceededError';
  }
}
