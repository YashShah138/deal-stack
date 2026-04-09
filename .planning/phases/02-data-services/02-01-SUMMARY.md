---
phase: 02-data-services
plan: "01"
subsystem: data-services
tags: [data-service, cache-first, provider-abstraction, address-normalization, tdd]
dependency_graph:
  requires:
    - "src/lib/supabase/admin.ts (createAdminClient)"
    - "supabase/migrations/00001_initial_schema.sql (api_cache, api_usage_log tables)"
  provides:
    - "DataService class — cache-first orchestrator for all external API calls"
    - "BaseProvider interface — contract for all provider implementations"
    - "normalizeAddress utility — USPS-standard address normalization"
    - "RateLimitExceededError — thrown when provider monthly limit is exceeded"
  affects:
    - "All future provider implementations (Rentcast, Census, WalkScore) must implement BaseProvider"
    - "All agents and routes must call DataService.fetch() — never external APIs directly"
tech_stack:
  added: []
  patterns:
    - "Cache-first: check api_cache -> return if fresh -> rate-limit -> fetch -> store -> log"
    - "Provider interface abstraction: name, defaultTtlDays, fetch(), checkRateLimit()"
    - "Deterministic cache keys: provider:endpoint:JSON(sorted+normalized params)"
    - "Service role writes to api_cache and api_usage_log (bypasses RLS)"
    - "USPS address abbreviation normalization for consistent cache keys"
key_files:
  created:
    - src/lib/services/data/types.ts
    - src/lib/services/data/normalize.ts
    - src/lib/services/data/data-service.ts
    - src/lib/services/data/__tests__/normalize.test.ts
    - src/lib/services/data/__tests__/data-service.test.ts
  modified:
    - .env.local.example
decisions:
  - "buildCacheKey sorts params alphabetically before JSON.stringify for order-independent determinism"
  - "Expired cache entries (expires_at <= now) are treated as misses — provider.fetch() is called"
  - "provider.checkRateLimit() is called before provider.fetch() on every cache miss — if it throws, fetch is skipped"
  - "UserId passed as null when not provided (background/server-side calls with no user context)"
metrics:
  duration: "2 minutes"
  completed_date: "2026-04-09"
  tasks_completed: 2
  files_created: 5
  files_modified: 1
---

# Phase 2 Plan 1: DataService Abstraction Layer Summary

**One-liner:** Cache-first DataService orchestrator with BaseProvider interface, USPS address normalization, and usage logging via Supabase service role client.

## What Was Built

The DataService abstraction layer — the single mandatory gateway through which all external API calls in DealStack must flow. No downstream code (agents, routes, components) is permitted to call external APIs directly; they must go through `DataService.fetch()`.

### Core Components

**`src/lib/services/data/types.ts`**
- `BaseProvider` interface: `name`, `defaultTtlDays`, `fetch<T>()`, `checkRateLimit()`
- `CacheEntry` interface matching the `api_cache` table schema
- `UsageLogEntry` interface matching the `api_usage_log` table schema
- `RateLimitExceededError` class with provider name and limit in the message

**`src/lib/services/data/normalize.ts`**
- `normalizeAddress()`: uppercase, trim, collapse whitespace, remove periods, normalize comma spacing, apply 15 USPS abbreviation replacements (STREET→ST, AVENUE→AVE, BOULEVARD→BLVD, DRIVE→DR, LANE→LN, ROAD→RD, COURT→CT, CIRCLE→CIR, PLACE→PL, APARTMENT→APT, SUITE→STE, NORTH→N, SOUTH→S, EAST→E, WEST→W)

**`src/lib/services/data/data-service.ts`**
- `DataService.fetch<T>()`: cache-first orchestration with full audit trail
  1. Build deterministic cache key (`provider:endpoint:JSON(sorted+normalized params)`)
  2. Check `api_cache` — if hit and not expired, log `cache_hit=true` and return
  3. Call `provider.checkRateLimit()` — throws `RateLimitExceededError` if exceeded
  4. Call `provider.fetch()` — get live data
  5. Upsert result into `api_cache` with computed `expires_at`
  6. Log `cache_hit=false` to `api_usage_log`
- `buildCacheKey()`: public method for deterministic keys, normalizes `address` param

## Test Coverage

- **normalize.test.ts**: 23 tests — case, whitespace, periods, all 15 abbreviations, comma normalization, end-to-end equivalence
- **data-service.test.ts**: 12 tests — cache hit (no provider.fetch), cache miss (fetch+upsert+log), expired cache (refetch), rate limit (error propagation, fetch blocked), buildCacheKey (determinism, address normalization, key structure)
- **Total: 35 tests, all passing**

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — no UI components, no data sources wired to placeholders.

## Self-Check: PASSED

### Files exist:
- src/lib/services/data/types.ts: FOUND
- src/lib/services/data/normalize.ts: FOUND
- src/lib/services/data/data-service.ts: FOUND
- src/lib/services/data/__tests__/normalize.test.ts: FOUND
- src/lib/services/data/__tests__/data-service.test.ts: FOUND

### Commits exist:
- 8561fce: feat(02-01): BaseProvider interface, types, and normalizeAddress with tests
- 03311bb: feat(02-01): DataService cache-first orchestration with usage logging
