# Pitfalls Research

**Domain:** Real Estate Investment SaaS (agentic deal analysis)
**Researched:** 2026-03-30
**Confidence:** HIGH (stack-specific constraints well-documented; financial math pitfalls well-known; Vercel limits verified from official docs)

## Critical Pitfalls

### Pitfall 1: Rentcast API Budget Exhaustion from Cache Misses

**What goes wrong:**
50 calls/month GLOBAL limit gets burned in a single development session or test run. A forgotten integration test hitting the real API, a cache key typo causing misses, or a retry loop on transient failures can consume the entire monthly budget in minutes. Once exhausted, the product is dead for the rest of the month -- no property lookups, no rent estimates, no comps.

**Why it happens:**
Developers test against real APIs during development. Cache key construction is error-prone (address normalization: "123 Main St" vs "123 Main Street" vs "123 main st"). Retry logic on 429/500 errors counts against the quota. No circuit breaker means a bug can loop through calls.

**How to avoid:**
1. Build a `DataService` abstraction layer that ALL Rentcast calls route through -- no direct API calls anywhere else in the codebase.
2. Implement a hard counter in `api_usage_log` table checked BEFORE every call. If count >= threshold (e.g., 45), refuse the call and return cached/mock data.
3. Normalize all cache keys: lowercase, strip punctuation, standardize abbreviations (St/Street/Str -> st), trim whitespace. Use a dedicated `normalizeAddress()` function.
4. In development/test, use a mock provider by default. Real API calls require an explicit `RENTCAST_LIVE=true` env flag.
5. Log every API call with timestamp, endpoint, cache hit/miss, and remaining quota.
6. Set up a Supabase database trigger or check that alerts (console + email) at 30, 40, and 45 calls.

**Warning signs:**
- No mock/fixture mode for tests
- Address strings used directly as cache keys without normalization
- Multiple code paths calling Rentcast directly instead of through DataService
- No usage counter or quota check before API calls
- Test suite making network requests

**Phase to address:**
Phase 0 foundation -- DataService + cache layer must exist before ANY Rentcast integration code. This is architectural, not a feature.

---

### Pitfall 2: Supabase RLS Policies Missing or Bypassed

**What goes wrong:**
Data leaks between tenants. User A sees User B's deals, properties, or settings. This happens because RLS policies are missing on one or more tables, or because the application uses the `service_role` key (which bypasses RLS) in client-facing code paths. Even with application-level `WHERE user_id = ?` filters, a missing RLS policy means a SQL injection, a Supabase client misconfiguration, or a forgotten filter exposes all rows.

**Why it happens:**
RLS is opt-in per table in Supabase -- creating a table does NOT enable RLS by default. Developers add tables during feature work and forget the policy. The `service_role` key bypasses RLS entirely, and it is tempting to use it for convenience. Application-level filtering gives a false sense of security. Supabase's PostgREST layer respects RLS, but only if policies exist.

**How to avoid:**
1. Enable RLS on EVERY table at creation time -- make it part of every migration template.
2. Use a migration checklist: new table = `ALTER TABLE x ENABLE ROW LEVEL SECURITY` + policy + `user_id` FK.
3. Write a database lint script (run in CI) that queries `pg_tables` and `pg_policies` to verify every user-scoped table has RLS enabled and at least one policy referencing `auth.uid()`.
4. NEVER use the `service_role` key in API routes that serve user requests. Reserve it exclusively for admin operations and cron jobs. Use the `anon` key + user JWT for all client-facing paths.
5. Create a standard policy template:
   ```sql
   CREATE POLICY "Users can only access own rows"
   ON table_name FOR ALL
   USING (user_id = auth.uid())
   WITH CHECK (user_id = auth.uid());
   ```
6. Test RLS explicitly: write integration tests that authenticate as User A and attempt to read User B's data -- they must return empty results.

**Warning signs:**
- Tables without `ENABLE ROW LEVEL SECURITY` in migrations
- `service_role` key imported in API route handlers (not just admin/cron)
- No integration tests for cross-tenant data isolation
- Relying solely on `WHERE user_id = ?` in application code
- New table added without accompanying RLS policy migration

**Phase to address:**
Phase 0 schema design. RLS must be enforced from the first migration. The CI lint script should be in place before any feature work begins.

---

### Pitfall 3: Multi-Tenant Schema Gaps (Missing user_id FK)

**What goes wrong:**
One table lacks a `user_id` foreign key. In single-user Phase 0 this is invisible -- everything works. When Phase 1 adds more users, that table's data is either globally shared (wrong) or requires a painful schema migration with data backfill on a live database.

**Why it happens:**
Some tables feel "global" during initial development: `api_cache`, `api_usage_log`, lookup tables. Developers think "this is just caching, it doesn't need user scoping." But in multi-tenant SaaS, even cache entries may need user scoping (different users may have different data for the same property if API responses vary by account).

**How to avoid:**
1. Maintain a canonical list of ALL tables with their scoping designation: `user-scoped` (needs user_id + RLS) or `global` (no user_id, but needs explicit justification).
2. Default to user-scoped. A table is global ONLY if you can articulate why in writing.
3. For `api_cache`: scope by `user_id` OR make it truly global with a shared cache (acceptable for Rentcast since data is property-level, not user-level). Document the decision.
4. For `api_usage_log`: MUST be user-scoped in multi-tenant. Each user's API consumption must be tracked separately for future per-user rate limiting.
5. Run a schema audit script that lists all tables and their foreign keys, flagging any table without `user_id` that is not on the explicit "global" allowlist.

**Warning signs:**
- No documentation of which tables are user-scoped vs global
- Tables added without `user_id` column and no written justification
- `api_cache` or `api_usage_log` lacking `user_id` column
- Schema review not part of PR checklist

**Phase to address:**
Phase 0 schema design. Every table in the initial migration must have its scoping documented. The audit script catches drift in later phases.

---

### Pitfall 4: Puppeteer PDF Generation Failing on Vercel

**What goes wrong:**
Puppeteer requires a Chromium binary (~280MB uncompressed). Vercel's serverless function bundle size limit is 250MB (compressed). Standard Puppeteer installation exceeds this limit, causing deployment failures or runtime crashes. Even if bundled correctly, Chromium launch requires ~300-500MB memory, and Hobby plan caps at 2GB (shared with Node.js runtime). Cold starts for Chromium-heavy functions can exceed 10 seconds, causing timeouts on the first request.

**Why it happens:**
Puppeteer's default installation downloads full Chromium. Developers test locally where there are no size/memory constraints, then discover the issue at deployment. The 250MB limit is after gzip compression of the bundle, but Chromium binaries don't compress well.

**How to avoid:**
1. Use `@sparticuz/chromium` (the maintained fork for serverless) -- it provides a compressed Chromium binary optimized for Lambda/serverless (~50MB compressed). This is the standard solution for Puppeteer on Vercel/AWS Lambda.
2. Use `puppeteer-core` (not `puppeteer`) to avoid downloading bundled Chromium.
3. Configure the function with maximum memory: `export const maxDuration = 300;` and set memory to 2GB+ (Pro plan: up to 4GB).
4. Implement a dedicated API route for PDF generation (`/api/generate-pdf`) with its own resource configuration -- do not bundle it with other functions.
5. Pre-warm the function if cold starts are unacceptable: a lightweight cron job that hits the endpoint every few minutes.
6. Consider an alternative architecture for Phase 1+: offload PDF generation to a dedicated service (Railway, Fly.io, or a persistent container) if Vercel's constraints become too limiting.
7. Use `/tmp` directory (500MB writable space on Vercel) for Chromium extraction at runtime.

**Warning signs:**
- `puppeteer` (not `puppeteer-core`) in package.json
- No `@sparticuz/chromium` dependency
- PDF generation works locally but fails on Vercel preview deployments
- Function bundle size warnings during `vercel build`
- Timeout errors on first PDF generation after idle period

**Phase to address:**
Phase 0 when building PDF report generation. Must be validated on Vercel preview deployment BEFORE building out full report templates. Proof-of-concept deployment should be an early milestone gate.

---

### Pitfall 5: Floating Point Errors in Financial Calculations

**What goes wrong:**
JavaScript's IEEE 754 floating point math produces incorrect results for financial calculations. `0.1 + 0.2 = 0.30000000000000004`. In mortgage calculations, this compounds: a P&I calculation over 360 months accumulates rounding errors. A monthly payment off by $0.01 becomes $3.60 over the loan term. Cap rate, CoC return, and DSCR calculations displayed to 2 decimal places can show incorrect values. Deal scores that threshold on specific values (e.g., "GO if CoC > 8.00%") can flip incorrectly.

**Why it happens:**
JavaScript has no native decimal type. All numbers are 64-bit floating point. Developers use standard arithmetic (`price * 0.018` for property tax) without considering precision. Intermediate calculations compound errors. Comparison operators on floats are unreliable near thresholds.

**How to avoid:**
1. Use integer arithmetic for all monetary values: store cents (or tenths of cents), not dollars. `$250,000` becomes `25000000` cents. Perform all math in integers, convert to display format only at the final step.
2. Alternatively, use a decimal library like `decimal.js` or `big.js` for all financial math. `decimal.js` is preferred for its configurability and rounding mode support.
3. Define explicit rounding rules: mortgage payments round to nearest cent (HALF_UP), percentages display to 2 decimal places, deal scores to 1 decimal place.
4. The standard P&I formula is: `M = P * [r(1+r)^n] / [(1+r)^n - 1]`. Implement it with `decimal.js` and test against known amortization tables.
5. Write unit tests comparing against authoritative sources (Bankrate, Freddie Mac amortization schedules) for specific loan scenarios. Tests should assert exact cent-level precision.
6. For deal score thresholds, use epsilon comparison: `if (coc >= 8.0 - EPSILON)` rather than `if (coc >= 8.0)`.

**Warning signs:**
- Raw `*`, `/`, `+`, `-` operators on dollar amounts in underwriting code
- No decimal library in package.json
- Unit tests using `toBeCloseTo()` instead of exact equality for financial values
- Financial values stored as `FLOAT` instead of `NUMERIC`/`DECIMAL` in Postgres
- Display formatting applied before calculation completion

**Phase to address:**
Phase 0 underwriting engine. This is the FIRST thing to get right because every downstream feature (deal scoring, reporting, portfolio tracking) depends on accurate math. TDD mandate: write the unit tests against known values BEFORE implementing formulas.

---

### Pitfall 6: AI Streaming Response Failures with Next.js App Router

**What goes wrong:**
Claude API streaming responses drop, hang, or produce garbled output when piped through Next.js App Router route handlers. Common failure modes: (a) the response stream terminates early on Vercel due to function timeout, (b) buffering middleware (compression, logging) breaks streaming, (c) error handling mid-stream causes partial UI state, (d) Vercel's Edge runtime does not support all Node.js APIs needed for streaming, (e) the client-side state becomes inconsistent when a stream errors partway through.

**Why it happens:**
Next.js App Router's streaming support uses Web Streams API, but Claude's SDK may use Node.js streams. Bridging these is error-prone. Vercel's function timeout (300s Hobby, 800s Pro) kills long-running agent chains silently. Multi-agent workflows (Finder -> Market -> Underwriting -> Comps -> Verdict) can exceed timeout limits. Error boundaries in React don't catch streaming errors cleanly.

**How to avoid:**
1. Use the Vercel AI SDK (`ai` package) which provides `streamText()` and `streamObject()` helpers designed for Next.js App Router + Claude. It handles the Web Streams bridging correctly.
2. Set `maxDuration` explicitly on streaming route handlers: `export const maxDuration = 300;` (Hobby) or higher on Pro.
3. Use the Node.js runtime (not Edge) for AI streaming routes -- Edge has a 25-second initial response requirement.
4. Implement chunked agent architecture: each agent (Finder, Market, Underwriting, etc.) is a separate API call, not one long chain. The client orchestrates the sequence, so each call stays within timeout limits.
5. Build client-side error recovery: if a stream drops, the UI shows the partial result with a "Resume" or "Retry" button, not a blank screen.
6. Disable response compression on streaming routes (Next.js config or route-level).
7. Store intermediate agent results in the database. If the Verdict agent fails, the user doesn't lose the Underwriting results.

**Warning signs:**
- Using Edge runtime for AI routes
- Single API call that chains all 5 agents sequentially
- No `maxDuration` export on streaming route handlers
- No error handling for partial streams on the client
- Using raw `fetch()` instead of Vercel AI SDK for streaming

**Phase to address:**
Phase 0 agent infrastructure. Build and test a single streaming agent end-to-end on Vercel before building out all 5 agents. Validate timeout behavior on preview deployments.

---

### Pitfall 7: Vercel Cron Job Constraints Breaking Scheduled Workflows

**What goes wrong:**
Per-user scheduled Finder Agent runs cannot use per-user cron frequencies on Vercel Hobby plan. Hobby plan restricts cron jobs to once-per-day with hourly precision (your 1 AM cron may fire anytime between 1:00-1:59 AM). Even on Pro, you cannot dynamically create cron jobs per user -- they are statically defined in `vercel.json`. A user wanting "check every 6 hours" cannot be accommodated with Vercel Cron alone.

**Why it happens:**
Developers assume cron jobs can be dynamically scheduled per user, like a traditional server. Vercel Cron is static configuration, not a runtime scheduler. The Hobby plan's daily-only restriction is discovered at deployment time, not during local development.

**How to avoid:**
1. Use a single cron endpoint (`/api/cron/finder`) that runs on a fixed schedule (daily on Hobby, more frequent on Pro).
2. The cron handler queries ALL users whose `cron_interval` has elapsed since their last run, then processes them in sequence or parallel batches.
3. Store `last_finder_run` timestamp per user. The cron handler computes: `if (now - last_finder_run >= user.cron_interval) { runFinder(user) }`.
4. This "poll-and-dispatch" pattern works within Vercel's static cron model while supporting per-user schedules.
5. On Hobby, set the cron to daily. On Pro, set it to every 15 or 30 minutes, and the handler checks which users are due.
6. Ensure the cron handler completes within function timeout (300s Hobby). If processing all users takes longer, implement a queue: process N users per invocation, track progress in DB.
7. Secure the cron endpoint: verify `Authorization: Bearer <CRON_SECRET>` header to prevent unauthorized triggers.

**Warning signs:**
- `vercel.json` with per-user cron entries (won't scale)
- Cron handler that processes only one hardcoded user
- No `last_finder_run` timestamp in user settings schema
- Testing only on Pro plan, deploying to Hobby
- No timeout protection in cron handler for multi-user processing

**Phase to address:**
Phase 0 Finder Agent implementation. The cron architecture must be designed for the poll-and-dispatch pattern from the start. Validate on Hobby plan constraints.

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Skip RLS, use app-level filtering only | Faster development, simpler migrations | Data leak vulnerability, requires rewrite for multi-tenant | Never -- RLS is a project constraint |
| Use `FLOAT` for financial columns in Postgres | No schema thought needed | Rounding errors in stored values, incorrect aggregations | Never -- use `NUMERIC(12,2)` or `BIGINT` (cents) |
| Call Rentcast API directly (skip DataService) | Faster to prototype a feature | No cache control, no quota tracking, budget exhaustion | Never -- all calls must route through DataService |
| Store full Chromium in function bundle | Simple Puppeteer setup | Exceeds Vercel 250MB limit, blocks deployment | Never on Vercel -- use `@sparticuz/chromium` |
| Hardcode underwriting assumptions | Faster initial build | Breaks multi-tenant (every user has different assumptions) | Only for throwaway prototyping, never in committed code |
| Skip address normalization in cache keys | Cache "works" in happy path | Cache misses on equivalent addresses, burns API quota | Never -- normalization is cheap, misses are expensive |
| Single long-running agent chain | Simpler server code | Hits timeout limits, no partial results on failure, poor UX | Never on Vercel -- use chunked agent pattern |
| Use `service_role` key in API routes | Bypasses RLS, "just works" | Security vulnerability, tenant data leaks | Only in admin-only endpoints and cron handlers |

## Integration Gotchas

Common mistakes when connecting to external services.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Rentcast API | Using address string directly as cache key | Normalize address (lowercase, standardize abbreviations, trim) before hashing as cache key |
| Rentcast API | No distinction between "API returned no data" and "cache miss" | Cache negative results (property not found) separately to avoid re-calling API for non-existent properties |
| Supabase Auth | Using `getSession()` on the server without revalidation | Use `getUser()` on the server side -- `getSession()` reads from cookie without verifying JWT, `getUser()` calls Supabase Auth to verify |
| Supabase Auth | Creating client with `service_role` key in middleware | Middleware should use `anon` key + user's JWT. `service_role` bypasses RLS |
| Census ACS API | Assuming all census tracts have data | Some tracts return null/missing values for certain metrics. Handle gracefully with fallback to county-level data |
| Census Geocoder | Not handling batch geocoding rate limits | Census Geocoder has no API key but has undocumented rate limits. Add delays between batch requests |
| Walk Score API | Hardcoding API key in client-side code | Walk Score API key must stay server-side. Create a proxy API route |
| Claude API | Not setting `max_tokens` appropriately | Claude will generate until `max_tokens`. For structured agent output, set a reasonable limit (4096) to avoid runaway token costs |
| Claude API | Ignoring `overloaded` errors | Claude returns 529 when overloaded. Implement exponential backoff with jitter, not immediate retry |
| Resend/Email | Sending emails synchronously in cron handler | Use fire-and-forget pattern or queue. Email delivery should not block the next user's Finder run |

## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| N+1 queries in deal pipeline | Dashboard loads slowly as deals accumulate | Use Supabase `.select()` with joins, not sequential queries per deal | 50+ deals per user |
| Unbounded agent web_search results | Agent responses become slow and expensive | Limit web_search results, summarize before processing | Every call (cost grows linearly) |
| No pagination on pipeline/portfolio views | UI freezes, API responses grow | Implement cursor-based pagination from day one | 100+ items |
| PDF generation blocking API route | Request timeout, user sees spinner forever | Return immediately with job ID, poll for completion, or use streaming progress | Any PDF generation (Chromium launch = 3-10s) |
| Loading all comps into memory for comparison | Memory spikes on properties with many comps | Limit comps to top 10, paginate the rest | 50+ comps per property |
| Supabase realtime subscriptions without cleanup | Memory leaks, connection pool exhaustion | Unsubscribe on component unmount, use connection limits | 10+ concurrent users |
| Cache entries without TTL | Stale data served indefinitely, cache table grows unbounded | Set TTL per cache type: Rentcast 30 days, Census 90 days, Geocoder permanent | After months of operation |

## Security Mistakes

Domain-specific security issues beyond general web security.

| Mistake | Risk | Prevention |
|---------|------|------------|
| Exposing Rentcast API key to client | Key theft, quota exhaustion by third parties | All API calls server-side only. Never import API keys in client components |
| RLS disabled on `deals` or `properties` table | User A sees User B's investment deals -- financial data exposure | CI script that verifies RLS on all user-scoped tables |
| PDF report URLs guessable/unauthenticated | Anyone with URL can view investment analysis | Use signed URLs with expiration for PDF downloads, verify auth on report API |
| Storing investment data without encryption at rest | Regulatory/privacy risk for financial data | Supabase encrypts at rest by default, but verify for any external storage |
| Admin seed credentials in version control | Production admin account compromised | Admin credentials via environment variables only, rotate after first login |
| Cron endpoint accessible without authentication | Anyone can trigger Finder runs, burn API quota | Verify `CRON_SECRET` header on all cron endpoints |
| Claude API key exposed in error messages | Key leaked via stack traces in production | Sanitize error responses, never include API keys or headers in client-facing errors |

## UX Pitfalls

Common user experience mistakes in this domain.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Showing raw floating point numbers | "CoC Return: 8.340000000000001%" erodes trust | Format all financial numbers at display layer: `toFixed(2)` after decimal.js calculation |
| No loading state during agent analysis | User thinks app is broken during 30-60s agent run | Stream agent progress: "Fetching property data...", "Running underwriting...", "Generating verdict..." |
| Losing agent results on navigation | User accidentally navigates away, loses 2-minute analysis | Persist intermediate results to DB as each agent completes |
| Deal score without explanation | User sees "72/100" but doesn't know why | Show score breakdown: which factors contributed, which dragged it down |
| Overwhelming settings page | User doesn't know which defaults matter | Group settings by frequency of change. Show sensible defaults. Mark advanced settings as collapsible |
| No undo on pipeline stage changes | User accidentally moves deal to "Pass", loses context | Implement stage change history with undo, or confirmation modal for destructive moves |
| PDF generation with no preview | User downloads PDF, finds formatting issues, regenerates (wasting time) | Show HTML preview before PDF generation. Same template renders in-browser |

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **Underwriting Engine:** Often missing edge cases -- verify handles: $0 rent estimate (vacant/unknown), 0% down payment (division by zero in CoC), negative NOI (expenses > income), $0 purchase price
- [ ] **RLS Policies:** Often missing INSERT/UPDATE policies -- verify that `WITH CHECK` clause exists alongside `USING` clause on all policies
- [ ] **Cache Layer:** Often missing cache invalidation -- verify TTL enforcement, stale entry cleanup, and manual cache bust capability
- [ ] **PDF Generation:** Often missing error handling -- verify behavior when: Chromium fails to launch, page render times out, template has missing data fields
- [ ] **Auth Middleware:** Often missing protection on API routes -- verify EVERY `/api/*` route checks auth, not just page routes
- [ ] **Agent Error Handling:** Often missing retry/fallback -- verify behavior when Claude API returns 429/500/529, when web_search returns no results
- [ ] **Email Digest:** Often missing unsubscribe -- verify user can disable email alerts in settings, and that preference is checked before sending
- [ ] **Address Normalization:** Often missing unit/apt handling -- verify "123 Main St #4" and "123 Main St Unit 4" resolve to same cache key
- [ ] **Database Migrations:** Often missing rollback scripts -- verify every UP migration has a corresponding DOWN migration
- [ ] **Deal Pipeline:** Often missing data integrity -- verify a deal cannot be in two pipeline stages simultaneously, and stage transitions are logged

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Rentcast budget exhausted | LOW (wait) / MEDIUM (switch provider) | Wait for monthly reset. Serve cached data only. Consider Zillow/Redfin scraping as emergency fallback (Terms of Service risk). For future: implement provider abstraction in DataService |
| Missing RLS on a table | HIGH | Immediate: enable RLS + add policies. Audit all existing data for cross-tenant contamination. Notify affected users if data was exposed. Add CI check to prevent recurrence |
| Missing user_id on a table | HIGH | Add column with migration. Backfill: assign all existing rows to admin user (Phase 0 single-user). Add FK constraint + RLS policy. Update all queries. Risk: data loss if table had multi-user data |
| Puppeteer fails on Vercel | MEDIUM | Switch to `@sparticuz/chromium`. If still failing: offload to external service (Railway/Fly.io) with a simple HTTP API that accepts HTML and returns PDF |
| Floating point errors in production data | HIGH | Recalculate all stored financial values with corrected formulas. Compare old vs new values. Flag deals where score/verdict changed. Notify users if any deal recommendations changed |
| AI streaming timeouts | LOW | Implement chunked agent pattern. Store intermediate results. Add retry logic. Increase `maxDuration` if on Pro plan |
| Cron jobs not firing (Hobby) | LOW | Verify `vercel.json` cron syntax. Check Vercel dashboard for cron logs. Hobby = daily only, upgrade to Pro if more frequency needed |

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Rentcast budget exhaustion | Phase 0: DataService + cache foundation | Integration test with mock provider; usage counter verified at 0 calls after full test suite |
| RLS missing/bypassed | Phase 0: Schema + migrations | CI script queries `pg_tables` and `pg_policies`; cross-tenant integration test |
| Missing user_id FK | Phase 0: Schema design | Schema audit script; canonical table scoping document |
| Puppeteer on Vercel | Phase 0: PDF generation | Successful PDF generation on Vercel preview deployment (not just local) |
| Floating point errors | Phase 0: Underwriting engine | Unit tests match Bankrate/known amortization tables to the cent |
| AI streaming failures | Phase 0: Agent infrastructure | Single agent streams successfully on Vercel preview with timeout test |
| Cron job constraints | Phase 0: Finder Agent scheduling | Cron fires on Hobby plan; poll-and-dispatch pattern verified with 2+ test users |
| Supabase Auth getSession vs getUser | Phase 0: Auth middleware | Server-side auth always calls `getUser()`, verified in code review |
| Cache key collisions | Phase 0: DataService cache layer | Unit tests for address normalization covering abbreviation variants |
| PDF report URL security | Phase 0: PDF generation | Signed URL generation + auth check verified; unsigned URL returns 403 |

## Sources

- Vercel Functions Limits (official docs): Bundle size 250MB, Memory 2-4GB, Duration 300-800s, Request body 4.5MB, /tmp 500MB writable
- Vercel Cron Jobs (official docs): Hobby = daily only with hourly precision, Pro = per-minute, 100 cron jobs per project, static config in vercel.json
- Vercel Function Duration (official docs): Hobby max 300s, Pro/Enterprise max 800s with fluid compute
- IEEE 754 floating point limitations: well-documented in JavaScript specification and financial computing literature
- `@sparticuz/chromium`: standard community solution for Puppeteer in serverless (AWS Lambda, Vercel), actively maintained fork of `chrome-aws-lambda`
- Supabase RLS: RLS is opt-in per table; `service_role` key bypasses all policies; `getSession()` vs `getUser()` distinction documented in Supabase auth guides
- Vercel AI SDK: provides `streamText()`/`streamObject()` for Next.js App Router + LLM streaming integration

---
*Pitfalls research for: Real Estate Investment SaaS (DealStack)*
*Researched: 2026-03-30*
