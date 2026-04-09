import { createAdminClient } from '@/lib/supabase/admin';
import { normalizeAddress } from './normalize';
import type { BaseProvider } from './types';

export class DataService {
  private supabase;

  constructor() {
    this.supabase = createAdminClient();
  }

  async fetch<T>(
    provider: BaseProvider,
    endpoint: string,
    params: Record<string, string>,
    options: { userId?: string; ttlDays?: number }
  ): Promise<T> {
    const ttl = options.ttlDays ?? provider.defaultTtlDays;
    const cacheKey = this.buildCacheKey(provider.name, endpoint, params);

    // 1. Check cache
    const cached = await this.getCached<T>(cacheKey);
    if (cached !== null) {
      await this.logUsage(provider.name, endpoint, options.userId ?? null, true);
      return cached;
    }

    // 2. Rate limit check (throws RateLimitExceededError if exceeded)
    await provider.checkRateLimit(this.supabase);

    // 3. Fetch from provider
    const result = await provider.fetch<T>(endpoint, params);

    // 4. Store in cache (upsert on cache_key)
    const expiresAt = new Date(Date.now() + ttl * 86400000).toISOString();
    await this.supabase.from('api_cache').upsert(
      {
        provider: provider.name,
        endpoint,
        cache_key: cacheKey,
        response_data: result,
        expires_at: expiresAt,
      },
      { onConflict: 'cache_key' }
    );

    // 5. Log usage
    await this.logUsage(provider.name, endpoint, options.userId ?? null, false);

    return result;
  }

  buildCacheKey(
    provider: string,
    endpoint: string,
    params: Record<string, string>
  ): string {
    const normalized: Record<string, string> = {};
    for (const key of Object.keys(params).sort()) {
      normalized[key] = key === 'address' ? normalizeAddress(params[key]) : params[key];
    }
    return `${provider}:${endpoint}:${JSON.stringify(normalized)}`;
  }

  private async getCached<T>(cacheKey: string): Promise<T | null> {
    const { data } = await this.supabase
      .from('api_cache')
      .select('response_data, expires_at')
      .eq('cache_key', cacheKey)
      .single();

    if (!data) return null;
    if (new Date(data.expires_at) <= new Date()) return null; // expired
    return data.response_data as T;
  }

  private async logUsage(
    provider: string,
    endpoint: string,
    userId: string | null,
    cacheHit: boolean
  ): Promise<void> {
    await this.supabase.from('api_usage_log').insert({
      provider,
      endpoint,
      user_id: userId,
      cache_hit: cacheHit,
    });
  }
}
