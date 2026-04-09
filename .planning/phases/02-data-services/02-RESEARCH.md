# Phase 2: Data Services - Research

**Researched:** 2026-04-08
**Domain:** External API integration, caching layer, service abstraction
**Confidence:** HIGH

## Summary

Phase 2 builds a DataService abstraction that sits between all downstream code (agents, routes, components) and three external API providers: Rentcast, Census Bureau (Geocoder + ACS), and Walk Score. The core pattern is cache-first with Supabase as the cache store -- every call checks the existing `api_cache` table before making a live request, and every attempt (cached or live) is logged to `api_usage_log`.

The database schema for `api_cache` and `api_usage_log` already exists from the Phase 1 migration. The key architectural challenge is designing a clean provider abstraction that handles: (1) address normalization for consistent cache keys, (2) per-provider TTL policies (30 days for Rentcast, 90 days for Census ACS, permanent for Geocoder and Walk Score), (3) a hard global rate limit for Rentcast (50 calls/month across all users), and (4) a mock provider system toggled by `MOCK_APIS=true` that makes the full test suite run without network calls.

**Primary recommendation:** Build a `DataService` class with a `BaseProvider` interface. Each provider (Rentcast, Census, WalkScore) implements the interface. The DataService orchestrates cache lookup, provider dispatch, cache storage, and usage logging. All writes to `api_cache` and `api_usage_log` use the Supabase service role client (since these tables have no user-scoped RLS for writes). Mock providers implement the same interface with static fixture data.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DATA-01 | DataService abstraction layer -- all external API calls routed through it | BaseProvider interface + DataService orchestrator pattern |
| DATA-02 | Cache-first strategy: check api_cache -> return if fresh -> fetch if stale -> store + return | Cache lookup by normalized cache_key, TTL check via expires_at, Supabase service role writes |
| DATA-03 | api_usage_log tracks every call attempt with provider, user_id, cache_hit | Log entry on every DataService.fetch() call, before returning result |
| DATA-04 | Rentcast call counter exposed in Settings screen (calls used / 50 this month) | Query api_usage_log WHERE provider='rentcast' AND cache_hit=false AND called_at >= month start |
| DATA-05 | Mock provider for all external APIs, dev default MOCK_APIS=true | MockProvider class per provider returning static JSON fixtures |
| RENT-01 | Property details lookup by address -- cached 30 days | Rentcast GET /v1/properties?address= with 30-day TTL |
| RENT-02 | Rent estimate by address -- cached 30 days | Rentcast GET /v1/avm/rent/long-term?address= with 30-day TTL |
| RENT-03 | Rental comparables by address -- cached 30 days | Included in rent estimate response comparables array |
| RENT-04 | Sale comparables by address -- cached 30 days | Rentcast GET /v1/avm/value?address= comparables array |
| RENT-05 | Market trends by city -- cached 30 days | Rentcast GET /v1/markets?zipCode= with 30-day TTL |
| RENT-06 | Hard global 50-call/month limit -- blocks live calls once reached | Count api_usage_log WHERE provider='rentcast' AND cache_hit=false AND called_at >= month start |
| CENSUS-01 | Census Geocoder: address -> lat/long + FIPS -- cached permanently | GET geocoding.geo.census.gov/geocoder/geographies/address with permanent TTL |
| CENSUS-02 | Census ACS: median income, population, vacancy, employment by FIPS -- cached 90 days | GET api.census.gov/data/2023/acs/acs5 with 90-day TTL |
| WALK-01 | Walk Score: walk/transit/bike scores per address -- cached permanently | GET api.walkscore.com/score with permanent TTL |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @supabase/supabase-js | ^2.101.1 | Cache reads/writes, usage logging | Already installed; service role client bypasses RLS for writes to api_cache and api_usage_log |
| zod | ^3.25.76 | Response validation from external APIs | Already installed; validates API responses before caching |
| vitest | ^4.1.2 | Unit and integration testing | Already installed and configured |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Node.js native fetch | built-in | HTTP calls to external APIs | Next.js 14 includes polyfilled fetch -- no axios needed |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Native fetch | axios | axios adds dependency; native fetch is sufficient for GET-only API calls |
| Supabase as cache | Redis/Upstash | Redis adds infra complexity; Supabase is already deployed and api_cache table exists |
| Custom rate limiter | Upstash ratelimit | Only need a simple monthly counter query, not a sliding window -- DB query is sufficient |

**Installation:**
```bash
# No new packages needed -- all dependencies already installed
```

## Architecture Patterns

### Recommended Project Structure
```
src/lib/services/
  data-service.ts          # DataService orchestrator (cache-first, logging)
  providers/
    types.ts               # BaseProvider interface, ProviderResponse types
    rentcast.ts            # RentcastProvider implements BaseProvider
    census-geocoder.ts     # CensusGeocoderProvider
    census-acs.ts          # CensusACSProvider
    walkscore.ts           # WalkScoreProvider
    mock/
      rentcast.ts          # MockRentcastProvider
      census-geocoder.ts   # MockCensusGeocoderProvider
      census-acs.ts        # MockCensusACSProvider
      walkscore.ts         # MockWalkScoreProvider
      fixtures/            # Static JSON response fixtures
        rentcast-property.json
        rentcast-rent-estimate.json
        rentcast-value-estimate.json
        rentcast-market.json
        census-geocode.json
        census-acs.json
        walkscore.json
  __tests__/
    data-service.test.ts
    rentcast.test.ts
    census.test.ts
    walkscore.test.ts
    integration.test.ts
```

### Pattern 1: Cache-First DataService
**What:** Every external API call goes through DataService.fetch() which checks cache, calls provider if miss, stores result, logs usage.
**When to use:** Every single external data request.
**Example:**
```typescript
// src/lib/services/data-service.ts
import { createAdminClient } from '@/lib/supabase/admin';

interface CacheEntry {
  provider: string;
  endpoint: string;
  cache_key: string;
  response_data: unknown;
  expires_at: string;
}

export class DataService {
  private supabase = createAdminClient(); // service role for writes

  async fetch<T>(
    provider: BaseProvider,
    endpoint: string,
    params: Record<string, string>,
    options: { userId?: string; ttlDays: number }
  ): Promise<T> {
    const cacheKey = this.buildCacheKey(provider.name, endpoint, params);
    
    // 1. Check cache
    const cached = await this.getCached<T>(cacheKey);
    if (cached) {
      await this.logUsage(provider.name, endpoint, options.userId, true);
      return cached;
    }
    
    // 2. Rate limit check (provider-specific)
    await provider.checkRateLimit(this.supabase);
    
    // 3. Fetch from provider
    const result = await provider.fetch<T>(endpoint, params);
    
    // 4. Store in cache
    await this.setCache(cacheKey, provider.name, endpoint, result, options.ttlDays);
    
    // 5. Log usage
    await this.logUsage(provider.name, endpoint, options.userId, false);
    
    return result;
  }

  private buildCacheKey(
    provider: string, 
    endpoint: string, 
    params: Record<string, string>
  ): string {
    const normalized = this.normalizeParams(params);
    return `${provider}:${endpoint}:${JSON.stringify(normalized)}`;
  }

  private normalizeParams(params: Record<string, string>): Record<string, string> {
    const result: Record<string, string> = {};
    for (const [key, value] of Object.entries(params).sort()) {
      if (key === 'address') {
        result[key] = normalizeAddress(value);
      } else {
        result[key] = value;
      }
    }
    return result;
  }
}
```

### Pattern 2: Provider Interface
**What:** Each external API provider implements a common interface so DataService treats them uniformly.
**When to use:** Adding any new external API.
**Example:**
```typescript
// src/lib/services/providers/types.ts
export interface BaseProvider {
  readonly name: string;
  readonly defaultTtlDays: number;
  
  fetch<T>(endpoint: string, params: Record<string, string>): Promise<T>;
  checkRateLimit(supabase: SupabaseClient): Promise<void>;
}

export class RateLimitExceededError extends Error {
  constructor(provider: string, limit: number) {
    super(`${provider} monthly limit of ${limit} calls exceeded`);
    this.name = 'RateLimitExceededError';
  }
}
```

### Pattern 3: Address Normalization
**What:** All addresses are normalized before being used as cache keys to prevent cache misses for the same physical address.
**When to use:** Every address-based lookup.
**Example:**
```typescript
// src/lib/services/data-service.ts
export function normalizeAddress(address: string): string {
  return address
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .replace(/\./g, '')
    .replace(/,\s*/g, ', ')
    // Common abbreviations
    .replace(/\bSTREET\b/g, 'ST')
    .replace(/\bAVENUE\b/g, 'AVE')
    .replace(/\bBOULEVARD\b/g, 'BLVD')
    .replace(/\bDRIVE\b/g, 'DR')
    .replace(/\bLANE\b/g, 'LN')
    .replace(/\bROAD\b/g, 'RD')
    .replace(/\bCOURT\b/g, 'CT')
    .replace(/\bCIRCLE\b/g, 'CIR')
    .replace(/\bPLACE\b/g, 'PL')
    .replace(/\bAPARTMENT\b/g, 'APT')
    .replace(/\bSUITE\b/g, 'STE')
    .replace(/\bNORTH\b/g, 'N')
    .replace(/\bSOUTH\b/g, 'S')
    .replace(/\bEAST\b/g, 'E')
    .replace(/\bWEST\b/g, 'W');
}
```

### Pattern 4: Mock Provider Toggle
**What:** When `MOCK_APIS=true`, DataService injects mock providers instead of real ones. Mock providers return static fixture data with no network calls.
**When to use:** Dev environment (default), all tests.
**Example:**
```typescript
// src/lib/services/data-service.ts
function getProvider(providerName: string): BaseProvider {
  const useMocks = process.env.MOCK_APIS === 'true';
  
  switch (providerName) {
    case 'rentcast':
      return useMocks ? new MockRentcastProvider() : new RentcastProvider();
    case 'census-geocoder':
      return useMocks ? new MockCensusGeocoderProvider() : new CensusGeocoderProvider();
    case 'census-acs':
      return useMocks ? new MockCensusACSProvider() : new CensusACSProvider();
    case 'walkscore':
      return useMocks ? new MockWalkScoreProvider() : new WalkScoreProvider();
    default:
      throw new Error(`Unknown provider: ${providerName}`);
  }
}
```

### Anti-Patterns to Avoid
- **Direct fetch in agents/routes:** Never import fetch and call an external API directly. Always go through DataService.
- **User-scoped cache writes:** The `api_cache` table has no user_id column and RLS only allows authenticated reads. All writes must use the service role client.
- **Floating-point cache TTL math:** Use integer day counts for TTL, compute `expires_at` as `new Date(Date.now() + ttlDays * 86400000).toISOString()`. For "permanent" cache, use a far-future date (e.g., 100 years).
- **Storing raw API responses without validation:** Always validate with Zod before caching. Corrupt cached data propagates errors indefinitely.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Address normalization | Full USPS address parser | Simple uppercase + abbreviation replacement | Full parser is overkill for cache key purposes; only need consistency, not postal correctness |
| Rate limiting | Redis-based sliding window | Simple COUNT query on api_usage_log | Only Rentcast needs limits, only monthly granularity, query is fast with the existing index |
| HTTP client | Custom retry/timeout wrapper | Native fetch with simple try/catch | All APIs are simple GET requests; no complex retry logic needed for v1 |
| Cache invalidation | TTL-based eviction daemon | Query-time stale check | Check `expires_at` on read; stale entries are overwritten on next fetch; periodic cleanup is a future concern |

## Common Pitfalls

### Pitfall 1: Rentcast Rate Limit Race Condition
**What goes wrong:** Two concurrent requests both check the counter, both see 49/50, both make a live call, exceeding the limit.
**Why it happens:** Counter check and API call are not atomic.
**How to avoid:** For v1 (single-user app), this is extremely unlikely. Use a simple check-then-call pattern. If concerned, use Supabase RPC with a `SELECT ... FOR UPDATE` on a counter row. But for 50 calls/month with a single user, sequential checking is sufficient.
**Warning signs:** api_usage_log shows more than 50 non-cached Rentcast calls in a month.

### Pitfall 2: Cache Key Inconsistency
**What goes wrong:** Same address cached twice under different keys because of formatting differences ("123 Main St" vs "123 Main Street" vs "123 main st").
**Why it happens:** No address normalization before key generation.
**How to avoid:** Always normalize address before building cache key. Unit test the normalizer with common variations.
**Warning signs:** api_cache has multiple entries for what appears to be the same address.

### Pitfall 3: Census Geocoder Returns No Match
**What goes wrong:** The Census Geocoder cannot match an address and returns an empty result set. Code crashes on null access.
**Why it happens:** Some addresses (especially new construction) are not in the Census database.
**How to avoid:** Always check for empty `addressMatches` array in the response. Return a typed error, not null. Let the caller decide whether to proceed without geocoding data.
**Warning signs:** Errors in the agent pipeline when processing new-construction addresses.

### Pitfall 4: Walk Score Requires Lat/Lon
**What goes wrong:** Walk Score API requires latitude and longitude in addition to address, but the caller only has an address.
**Why it happens:** Walk Score API requires coordinates as mandatory parameters.
**How to avoid:** Census Geocoder must run first to obtain lat/lon. Design the data flow so geocoding always precedes Walk Score lookup. DataService should expose a convenience method that chains these.
**Warning signs:** Walk Score requests failing with invalid parameters.

### Pitfall 5: Service Role Key Exposure
**What goes wrong:** Service role key used in client-side code, giving browser access to bypass RLS.
**Why it happens:** Importing the admin client in a component or client-side module.
**How to avoid:** DataService and all providers must only be imported in server-side code (route handlers, server actions, server components). Never export the admin client from a barrel file that could be imported client-side.
**Warning signs:** `SUPABASE_SERVICE_ROLE_KEY` appearing in browser network tab or build output.

### Pitfall 6: Census ACS Variable Codes Change Between Vintages
**What goes wrong:** Hardcoded variable codes (B19013_001E) stop working when a new ACS vintage is released.
**Why it happens:** Census occasionally renames or restructures tables between releases.
**How to avoid:** Use the most recent stable 5-year dataset (currently 2020-2024). Pin the vintage year in config. Add error handling that detects "variable not found" responses.
**Warning signs:** Census ACS calls returning 400 errors after a new vintage release.

## External API Reference

### Rentcast API
- **Base URL:** `https://api.rentcast.io/v1`
- **Auth:** `X-Api-Key` header
- **Free tier:** 50 calls/month
- **Endpoints used:**

| Endpoint | Method | Key Params | Purpose | Requirement |
|----------|--------|------------|---------|-------------|
| `/properties` | GET | `address` | Property details | RENT-01 |
| `/avm/rent/long-term` | GET | `address` | Rent estimate + rental comps | RENT-02, RENT-03 |
| `/avm/value` | GET | `address` | Value estimate + sale comps | RENT-04 |
| `/markets` | GET | `zipCode` | Market trends | RENT-05 |

**Note on comps:** The `/avm/rent/long-term` response includes `comparables` array (rental comps). The `/avm/value` response includes `comparables` array (sale comps). These are NOT separate API calls -- comps come bundled with the estimate responses. This means RENT-02+RENT-03 is one call, and RENT-04 is already covered by the value estimate call.

### Census Geocoder API
- **Base URL:** `https://geocoding.geo.census.gov/geocoder`
- **Auth:** None (free, no API key)
- **Rate limits:** Not documented; generous for single-user
- **Endpoint:**

```
GET /geographies/address?street={street}&city={city}&state={state}&benchmark=Public_AR_Current&vintage=Current_Current&format=json
```

**Response path to FIPS:** `result.addressMatches[0].geographies["Census Tracts"][0].TRACT` and `result.addressMatches[0].geographies["Census Tracts"][0].GEOID` (11-digit state+county+tract). Lat/lon at `result.addressMatches[0].coordinates.x` (lon) and `.y` (lat).

### Census ACS API
- **Base URL:** `https://api.census.gov/data`
- **Auth:** API key as `key` query parameter (free, register at census.gov)
- **Rate limits:** 500 requests/day without key, unlimited with key
- **Endpoint:**

```
GET /2023/acs/acs5?get=B19013_001E,B25002_001E,B25002_002E,B25002_003E,B23025_002E,B23025_005E&for=tract:{tract}&in=state:{state}%20county:{county}&key={key}
```

**Key variables:**
| Variable | Description |
|----------|-------------|
| B19013_001E | Median household income |
| B25002_001E | Total housing units |
| B25002_002E | Occupied housing units |
| B25002_003E | Vacant housing units |
| B23025_002E | In labor force |
| B23025_005E | Unemployed |
| B01003_001E | Total population |

**Note:** ACS 5-year is tract-level. Requires state FIPS, county FIPS, and tract number -- all obtained from Census Geocoder response.

### Walk Score API
- **Base URL:** `https://api.walkscore.com`
- **Auth:** `wsapikey` query parameter
- **Rate limits:** Daily quota (exact number not publicly documented; status code 41 = quota exceeded)
- **Endpoint:**

```
GET /score?format=json&address={address}&lat={lat}&lon={lon}&transit=1&bike=1&wsapikey={key}
```

**Requires lat/lon:** Must run Census Geocoder first. The lat/lon are mandatory parameters.

## Environment Variables Required

The following env vars must be added to `.env.local` and `.env.example`:

```bash
# External API Keys (Phase 2)
RENTCAST_API_KEY=your-rentcast-api-key
CENSUS_API_KEY=your-census-api-key
WALKSCORE_API_KEY=your-walkscore-api-key

# Mock mode (defaults to true in development)
MOCK_APIS=true
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Separate comps endpoints | Comps bundled in AVM responses | Rentcast 2024 | Fewer API calls needed -- rent estimate includes rental comps, value estimate includes sale comps |
| Census ACS 2018-2022 | Census ACS 2020-2024 (5-year) | Late 2025 | Use latest vintage for most current data |

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.2 |
| Config file | vitest.config.ts |
| Quick run command | `npx vitest run` |
| Full suite command | `npx vitest run --coverage` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DATA-01 | All API calls route through DataService | unit | `npx vitest run src/lib/services/__tests__/data-service.test.ts -x` | Wave 0 |
| DATA-02 | Cache-first: cache hit returns cached, miss fetches + stores | unit | `npx vitest run src/lib/services/__tests__/data-service.test.ts -x` | Wave 0 |
| DATA-03 | api_usage_log tracks every call | unit | `npx vitest run src/lib/services/__tests__/data-service.test.ts -x` | Wave 0 |
| DATA-04 | Rentcast counter query | unit | `npx vitest run src/lib/services/__tests__/rentcast.test.ts -x` | Wave 0 |
| DATA-05 | Mock provider returns fixture data | unit | `npx vitest run src/lib/services/__tests__/integration.test.ts -x` | Wave 0 |
| RENT-01 | Property details via Rentcast | unit | `npx vitest run src/lib/services/__tests__/rentcast.test.ts -x` | Wave 0 |
| RENT-02 | Rent estimate via Rentcast | unit | `npx vitest run src/lib/services/__tests__/rentcast.test.ts -x` | Wave 0 |
| RENT-03 | Rental comps from rent estimate response | unit | `npx vitest run src/lib/services/__tests__/rentcast.test.ts -x` | Wave 0 |
| RENT-04 | Sale comps from value estimate response | unit | `npx vitest run src/lib/services/__tests__/rentcast.test.ts -x` | Wave 0 |
| RENT-05 | Market trends via Rentcast | unit | `npx vitest run src/lib/services/__tests__/rentcast.test.ts -x` | Wave 0 |
| RENT-06 | 50-call/month hard limit blocks live calls | unit | `npx vitest run src/lib/services/__tests__/rentcast.test.ts -x` | Wave 0 |
| CENSUS-01 | Geocoder returns lat/lon + FIPS | unit | `npx vitest run src/lib/services/__tests__/census.test.ts -x` | Wave 0 |
| CENSUS-02 | ACS returns demographics by FIPS | unit | `npx vitest run src/lib/services/__tests__/census.test.ts -x` | Wave 0 |
| WALK-01 | Walk Score returns scores for address | unit | `npx vitest run src/lib/services/__tests__/walkscore.test.ts -x` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run`
- **Per wave merge:** `npx vitest run --coverage`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/lib/services/__tests__/data-service.test.ts` -- covers DATA-01, DATA-02, DATA-03
- [ ] `src/lib/services/__tests__/rentcast.test.ts` -- covers RENT-01 through RENT-06, DATA-04
- [ ] `src/lib/services/__tests__/census.test.ts` -- covers CENSUS-01, CENSUS-02
- [ ] `src/lib/services/__tests__/walkscore.test.ts` -- covers WALK-01
- [ ] `src/lib/services/__tests__/integration.test.ts` -- covers DATA-05, end-to-end mock flow
- [ ] Mock fixtures in `src/lib/services/providers/mock/fixtures/` -- static JSON responses

### Testing Strategy Notes
- All tests mock the Supabase client (both admin and server) -- no real DB calls in unit tests
- Integration tests use `MOCK_APIS=true` and verify zero real network requests via a global fetch spy
- The existing vitest config has `passWithNoTests: true` so new test files can be added incrementally
- Coverage thresholds currently only apply to `src/lib/engine/` -- extend to `src/lib/services/` in vitest.config.ts

## Open Questions

1. **Rentcast comps vs. separate endpoints**
   - What we know: AVM endpoints (`/avm/value`, `/avm/rent/long-term`) return comparables bundled in the response. There appear to be no separate `/comparables` endpoints in the current API.
   - What's unclear: Whether the comps returned by AVM endpoints are sufficient or if there are dedicated comps endpoints with richer data.
   - Recommendation: Use AVM endpoint comps for v1. This saves API calls against the 50/month limit. If richer comps are needed later, investigate dedicated endpoints.

2. **Walk Score daily quota exact number**
   - What we know: Walk Score has a daily quota (status 41 = exceeded) but the exact limit is not publicly documented.
   - What's unclear: The exact number of daily calls allowed on a free API key.
   - Recommendation: With permanent caching per address, the daily limit is unlikely to be hit. Add error handling for status 41 and cache aggressively.

3. **Census ACS vintage pinning**
   - What we know: Latest available is 2020-2024 5-year estimates. Variable codes are generally stable across vintages.
   - What's unclear: Whether the app should auto-upgrade to newer vintages or stay pinned.
   - Recommendation: Pin to `2023/acs/acs5` (the 2020-2024 5-year dataset) as a config constant. Manual update when new vintages are verified.

## Sources

### Primary (HIGH confidence)
- Rentcast Developer Portal (https://developers.rentcast.io/) -- API base URL, endpoints, auth method, free tier limits
- Rentcast rent estimate reference (https://developers.rentcast.io/reference/rent-estimate-long-term) -- full endpoint documentation
- Rentcast value estimate reference (https://developers.rentcast.io/reference/value-estimate) -- full endpoint documentation
- Rentcast market statistics reference (https://developers.rentcast.io/reference/market-statistics) -- market data endpoint
- Rentcast property data reference (https://developers.rentcast.io/reference/property-data) -- property lookup endpoint
- Census Geocoding Services API (https://geocoding.geo.census.gov/geocoder/Geocoding_Services_API.html) -- geocoder endpoint format
- Walk Score API documentation (https://www.walkscore.com/professional/api.php) -- endpoint, parameters, response format

### Secondary (MEDIUM confidence)
- Census ACS 5-Year data (https://www.census.gov/data/developers/data-sets/acs-5year.html) -- available variables and vintages
- Census API example queries (https://www.census.gov/data/developers/guidance/api-user-guide.Example_API_Queries.html) -- URL format

### Tertiary (LOW confidence)
- Walk Score daily rate limit -- not publicly documented; only known from error code 41

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all libraries already installed; no new deps needed
- Architecture: HIGH - cache-first pattern is well-established; database schema already exists
- External APIs: HIGH for Rentcast (documented thoroughly), HIGH for Census (government API, stable), MEDIUM for Walk Score (limited rate limit info)
- Pitfalls: HIGH - common failure modes are well-understood from API documentation

**Research date:** 2026-04-08
**Valid until:** 2026-05-08 (stable APIs, 30-day validity)
