import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DataService } from '../data-service';
import { RateLimitExceededError } from '../types';
import type { BaseProvider } from '../types';
import type { SupabaseClient } from '@supabase/supabase-js';

// Mock createAdminClient
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(),
}));

import { createAdminClient } from '@/lib/supabase/admin';

// Helper: build a mock supabase client with chainable query builder
function buildMockSupabase(cacheRow: unknown = null) {
  // Mocks for api_cache SELECT chain
  const singleFn = vi.fn().mockResolvedValue({ data: cacheRow, error: null });
  const eqFn = vi.fn().mockReturnValue({ single: singleFn });
  const selectFn = vi.fn().mockReturnValue({ eq: eqFn });

  // Mocks for api_cache UPSERT
  const upsertFn = vi.fn().mockResolvedValue({ data: null, error: null });

  // Mocks for api_usage_log INSERT
  const insertFn = vi.fn().mockResolvedValue({ data: null, error: null });

  const fromFn = vi.fn((table: string) => {
    if (table === 'api_cache') {
      return { select: selectFn, upsert: upsertFn };
    }
    if (table === 'api_usage_log') {
      return { insert: insertFn };
    }
    return { select: selectFn, upsert: upsertFn, insert: insertFn };
  });

  const mockClient = { from: fromFn } as unknown as SupabaseClient;
  return { mockClient, fromFn, selectFn, eqFn, singleFn, upsertFn, insertFn };
}

// Fake provider implementing BaseProvider
function buildFakeProvider(overrides: Partial<BaseProvider> = {}): BaseProvider {
  return {
    name: 'test-provider',
    defaultTtlDays: 30,
    fetch: vi.fn().mockResolvedValue({ data: 'provider-result' }),
    checkRateLimit: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

const FUTURE_DATE = new Date(Date.now() + 86400000 * 30).toISOString();
const PAST_DATE = new Date(Date.now() - 86400000).toISOString();

describe('DataService', () => {
  let ds: DataService;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('cache HIT path', () => {
    it('returns cached response_data without calling provider.fetch()', async () => {
      const { mockClient, insertFn } = buildMockSupabase({
        response_data: { cached: true },
        expires_at: FUTURE_DATE,
      });
      vi.mocked(createAdminClient).mockReturnValue(mockClient);
      ds = new DataService();

      const provider = buildFakeProvider();
      const result = await ds.fetch(provider, 'test-endpoint', { zip: '75201' }, { userId: 'user-1' });

      expect(result).toEqual({ cached: true });
      expect(provider.fetch).not.toHaveBeenCalled();
      expect(provider.checkRateLimit).not.toHaveBeenCalled();
    });

    it('logs usage with cache_hit=true on cache hit', async () => {
      const { mockClient, insertFn } = buildMockSupabase({
        response_data: { cached: true },
        expires_at: FUTURE_DATE,
      });
      vi.mocked(createAdminClient).mockReturnValue(mockClient);
      ds = new DataService();

      const provider = buildFakeProvider();
      await ds.fetch(provider, 'test-endpoint', { zip: '75201' }, { userId: 'user-1' });

      expect(insertFn).toHaveBeenCalledWith(expect.objectContaining({
        provider: 'test-provider',
        endpoint: 'test-endpoint',
        user_id: 'user-1',
        cache_hit: true,
      }));
    });
  });

  describe('cache MISS path', () => {
    it('calls provider.fetch() when no cache entry exists', async () => {
      const { mockClient } = buildMockSupabase(null);
      vi.mocked(createAdminClient).mockReturnValue(mockClient);
      ds = new DataService();

      const provider = buildFakeProvider();
      const result = await ds.fetch(provider, 'test-endpoint', { zip: '75201' }, {});

      expect(provider.fetch).toHaveBeenCalledWith('test-endpoint', { zip: '75201' });
      expect(result).toEqual({ data: 'provider-result' });
    });

    it('upserts result into api_cache on cache miss', async () => {
      const { mockClient, upsertFn } = buildMockSupabase(null);
      vi.mocked(createAdminClient).mockReturnValue(mockClient);
      ds = new DataService();

      const provider = buildFakeProvider();
      await ds.fetch(provider, 'test-endpoint', { zip: '75201' }, { userId: 'user-1' });

      expect(upsertFn).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: 'test-provider',
          endpoint: 'test-endpoint',
          response_data: { data: 'provider-result' },
        }),
        expect.objectContaining({ onConflict: 'cache_key' })
      );
    });

    it('logs usage with cache_hit=false on cache miss', async () => {
      const { mockClient, insertFn } = buildMockSupabase(null);
      vi.mocked(createAdminClient).mockReturnValue(mockClient);
      ds = new DataService();

      const provider = buildFakeProvider();
      await ds.fetch(provider, 'test-endpoint', { zip: '75201' }, { userId: 'user-2' });

      expect(insertFn).toHaveBeenCalledWith(expect.objectContaining({
        cache_hit: false,
        user_id: 'user-2',
      }));
    });

    it('calls checkRateLimit before provider.fetch() on cache miss', async () => {
      const callOrder: string[] = [];
      const { mockClient } = buildMockSupabase(null);
      vi.mocked(createAdminClient).mockReturnValue(mockClient);
      ds = new DataService();

      const provider = buildFakeProvider({
        checkRateLimit: vi.fn().mockImplementation(() => {
          callOrder.push('checkRateLimit');
          return Promise.resolve();
        }),
        fetch: vi.fn().mockImplementation(() => {
          callOrder.push('fetch');
          return Promise.resolve({ data: 'result' });
        }),
      });

      await ds.fetch(provider, 'test-endpoint', {}, {});
      expect(callOrder).toEqual(['checkRateLimit', 'fetch']);
    });
  });

  describe('cache EXPIRED path', () => {
    it('calls provider.fetch() when cached entry is expired', async () => {
      const { mockClient } = buildMockSupabase({
        response_data: { stale: true },
        expires_at: PAST_DATE,
      });
      vi.mocked(createAdminClient).mockReturnValue(mockClient);
      ds = new DataService();

      const provider = buildFakeProvider();
      const result = await ds.fetch(provider, 'test-endpoint', {}, {});

      expect(provider.fetch).toHaveBeenCalled();
      expect(result).toEqual({ data: 'provider-result' });
    });
  });

  describe('rate limit handling', () => {
    it('rejects with RateLimitExceededError when provider.checkRateLimit throws', async () => {
      const { mockClient } = buildMockSupabase(null);
      vi.mocked(createAdminClient).mockReturnValue(mockClient);
      ds = new DataService();

      const error = new RateLimitExceededError('test-provider', 50);
      const provider = buildFakeProvider({
        checkRateLimit: vi.fn().mockRejectedValue(error),
      });

      await expect(ds.fetch(provider, 'test-endpoint', {}, {})).rejects.toThrow(
        RateLimitExceededError
      );
    });

    it('does not call provider.fetch() when rate limit exceeded', async () => {
      const { mockClient } = buildMockSupabase(null);
      vi.mocked(createAdminClient).mockReturnValue(mockClient);
      ds = new DataService();

      const error = new RateLimitExceededError('test-provider', 50);
      const provider = buildFakeProvider({
        checkRateLimit: vi.fn().mockRejectedValue(error),
      });

      await expect(ds.fetch(provider, 'test-endpoint', {}, {})).rejects.toThrow();
      expect(provider.fetch).not.toHaveBeenCalled();
    });
  });

  describe('buildCacheKey', () => {
    it('produces the same key regardless of param insertion order', () => {
      const { mockClient } = buildMockSupabase(null);
      vi.mocked(createAdminClient).mockReturnValue(mockClient);
      ds = new DataService();

      const key1 = ds.buildCacheKey('rentcast', 'property', { zip: '75201', city: 'Arlington' });
      const key2 = ds.buildCacheKey('rentcast', 'property', { city: 'Arlington', zip: '75201' });
      expect(key1).toBe(key2);
    });

    it('normalizes address param using normalizeAddress', () => {
      const { mockClient } = buildMockSupabase(null);
      vi.mocked(createAdminClient).mockReturnValue(mockClient);
      ds = new DataService();

      const key1 = ds.buildCacheKey('geocoder', 'geocode', { address: '123 Main Street' });
      const key2 = ds.buildCacheKey('geocoder', 'geocode', { address: '123 main street' });
      expect(key1).toBe(key2);
    });

    it('includes provider and endpoint in the key', () => {
      const { mockClient } = buildMockSupabase(null);
      vi.mocked(createAdminClient).mockReturnValue(mockClient);
      ds = new DataService();

      const key = ds.buildCacheKey('rentcast', 'property', { zip: '75201' });
      expect(key).toContain('rentcast');
      expect(key).toContain('property');
    });
  });
});
