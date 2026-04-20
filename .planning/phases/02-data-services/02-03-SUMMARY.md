---
phase: 02-data-services
plan: "03"
subsystem: api
tags: [census, walkscore, geocoding, demographics, walkability, zod, provider, cache]

# Dependency graph
requires:
  - phase: 02-01
    provides: BaseProvider interface, DataService cache orchestration, types.ts

provides:
  - CensusGeocoderProvider: address -> lat/lon + 11-digit FIPS with permanent cache TTL (36500 days)
  - CensusACSProvider: FIPS -> demographics (income, housing, employment, population) with 90-day TTL
  - WalkScoreProvider: address+lat/lon -> walk/transit/bike scores with permanent cache TTL (36500 days)
  - GeocodeNoMatchError: typed error for unmatched Census Geocoder addresses
  - WalkScoreQuotaError: typed error for status=41 daily quota exceeded
  - Zod schemas for Census and WalkScore API responses
  - 28 unit tests covering all providers, edge cases, and error paths

affects: [02-04, Market Analysis Agent, Underwriting Agent]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "BaseProvider pattern: no-op checkRateLimit for unlimited APIs, typed fetch<T> generic return"
    - "Sentinel value pattern: Census -666666666 -> null in all ACS numeric fields"
    - "Quota error pattern: WalkScoreQuotaError for status=41 (graceful degradation, not crash)"
    - "Permanent TTL pattern: 36500-day TTL for geocoordinates and walkability (stable data)"

key-files:
  created:
    - src/lib/services/data/providers/schemas/census.ts
    - src/lib/services/data/providers/schemas/walkscore.ts
    - src/lib/services/data/providers/census-geocoder.ts
    - src/lib/services/data/providers/census-acs.ts
    - src/lib/services/data/providers/walkscore.ts
    - src/lib/services/data/__tests__/census.test.ts
    - src/lib/services/data/__tests__/walkscore.test.ts
  modified: []

key-decisions:
  - "Census ACS vintage pinned to 2023/acs/acs5 as a literal string — changing it requires explicit review of variable compatibility"
  - "CensusACSProvider throws at construction (not at call time) when CENSUS_API_KEY missing — fail-fast pattern"
  - "WalkScoreProvider throws at construction when WALKSCORE_API_KEY missing — consistent fail-fast with ACS pattern"
  - "GeocodeNoMatchError thrown (not null/undefined) for empty addressMatches — forces callers to handle the no-match case explicitly"

patterns-established:
  - "No-op checkRateLimit: Census and WalkScore have no hard limits; method returns immediately"
  - "Typed error classes over generic Error for API-specific failure modes (GeocodeNoMatchError, WalkScoreQuotaError)"
  - "Zod .passthrough() on raw API response schemas to tolerate undocumented fields"

requirements-completed: [CENSUS-01, CENSUS-02, WALK-01]

# Metrics
duration: 3min
completed: 2026-04-09
---

# Phase 02 Plan 03: Census and Walk Score Providers Summary

**Census Geocoder (permanent TTL), Census ACS (90-day TTL), and Walk Score (permanent TTL) providers with Zod validation, typed error classes, and 28 unit tests covering edge cases including no-match addresses, sentinel -666666666, and quota exhaustion**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-04-09T18:43:58Z
- **Completed:** 2026-04-09T18:46:58Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments

- Three BaseProvider implementations covering the full location-intelligence stack (geocoding → demographics → walkability)
- Typed error classes (GeocodeNoMatchError, WalkScoreQuotaError) for API-specific failure modes, preventing silent nulls
- Census ACS sentinel value -666666666 normalized to null for all 7 demographic fields
- 28 unit tests with mocked fetch — no real network calls, no flaky tests

## Task Commits

1. **Task 1: Census Geocoder and ACS providers + schemas + tests** - `e7d2685` (feat)
2. **Task 2: Walk Score provider, schema, walkscore tests** - `854e819` (feat)

## Files Created/Modified

- `src/lib/services/data/providers/schemas/census.ts` — Zod schemas: CensusGeocodeResponseSchema, GeocodeResultSchema, CensusACSResultSchema
- `src/lib/services/data/providers/schemas/walkscore.ts` — Zod schemas: WalkScoreResponseSchema, WalkScoreResultSchema
- `src/lib/services/data/providers/census-geocoder.ts` — CensusGeocoderProvider, GeocodeNoMatchError; permanent 36500-day TTL
- `src/lib/services/data/providers/census-acs.ts` — CensusACSProvider; 90-day TTL; pins to 2023/acs/acs5; sentinel handling
- `src/lib/services/data/providers/walkscore.ts` — WalkScoreProvider, WalkScoreQuotaError; permanent 36500-day TTL
- `src/lib/services/data/__tests__/census.test.ts` — 18 tests: match, no-match, sentinel, URL structure, HTTP errors
- `src/lib/services/data/__tests__/walkscore.test.ts` — 10 tests: valid scores, partial scores, quota error, URL params, HTTP errors

## Decisions Made

- Census ACS vintage pinned to `2023/acs/acs5` as a literal string — changing it requires explicit review to ensure the 7 variable codes remain valid for the new vintage
- Both CensusACSProvider and WalkScoreProvider throw at construction time when API keys are missing (fail-fast), not at first call
- GeocodeNoMatchError thrown (not null/undefined) when Census Geocoder returns empty addressMatches — callers must explicitly handle the no-match case

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Vitest v4 does not support the `-x` flag (bail-on-first-failure) — removed the flag from verify commands; all tests ran and passed anyway.

## Known Stubs

None — all three providers are fully wired with real API URLs, response parsing, and typed return values.

## User Setup Required

Two environment variables required before providers can be called in production:

- `CENSUS_API_KEY` — free from https://api.census.gov/data/key_signup.html
- `WALKSCORE_API_KEY` — free from https://www.walkscore.com/professional/api.php

Census Geocoder has no API key requirement.

## Next Phase Readiness

- All three providers implement BaseProvider and are ready to be registered with DataService
- Wave 2 parallel plans (02-02 Rentcast, 02-04 DataService integration) can use these providers immediately
- Downstream agents (Market Analysis, Underwriting) depend on CensusGeocoderProvider output (lat/lon + FIPS) to call CensusACSProvider and WalkScoreProvider in sequence

---
*Phase: 02-data-services*
*Completed: 2026-04-09*
