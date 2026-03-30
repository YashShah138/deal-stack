# Research Summary — DealStack

**Synthesized:** 2026-03-30
**Sources:** STACK.md, FEATURES.md, ARCHITECTURE.md, PITFALLS.md, PROJECT.md

---

## Critical Technology Decisions

These are locked. Do not revisit during planning or implementation.

| Decision | Locked Choice | Why Non-Negotiable |
|----------|--------------|-------------------|
| Framework | Next.js 14.2.35 + TypeScript 5.5.x + Tailwind 3.4.x | Project constraint. No upgrade to 15/16, no Tailwind 4.x. |
| Auth | Supabase Auth via `@supabase/ssr@0.9.0` | Native `auth.uid()` in RLS policies. Do NOT add next-auth or Clerk. |
| Database client | `@supabase/supabase-js@2.100.1` | Never use Prisma or Drizzle — both bypass RLS with direct connections. |
| AI | Anthropic Claude (`claude-sonnet-4-5-20250514`) via `@anthropic-ai/sdk@0.80.0` | web_search is a server-side Anthropic-hosted tool — you declare it, Claude calls it. |
| PDF | `puppeteer-core@24` + `@sparticuz/chromium@143` | Only viable Chromium for Vercel serverless. Full `puppeteer` (with bundled Chromium) exceeds the 250MB function limit. |
| Email | Resend + `@react-email/components` | No SMTP config, no deliverability work. Nodemailer is wrong choice here. |
| Cron | Vercel Cron (single job) + poll-and-dispatch pattern in handler | Vercel cron is static config — no per-user cron entries. |
| Financial math | `decimal.js` for all monetary calculations | IEEE 754 float errors in P&I/CoC/DSCR are a correctness bug, not cosmetic. |
| Deployment | Vercel Pro (minimum) | Hobby plan fails: 10s function timeout kills agents + PDF; only 1 daily cron. |

**Version pins that matter most:**
- React 18.x (NOT 19 — requires Next 15+)
- Zod 4.3.6 — LOW confidence on ecosystem compat; fall back to 3.23.x if issues arise
- `puppeteer-core@24` + `@sparticuz/chromium@143` must be used together (tested pair)

---

## Key Architecture Patterns

Every phase must follow these. They are not optional optimizations.

**1. Three Supabase client types — always use the right one:**
- `createBrowserClient` — Client Components only
- `createServerClient` (cookies) — Server Components, Route Handlers, Server Actions
- Service role client — cron endpoints and admin ops ONLY (bypasses RLS)
- Middleware MUST call `getUser()` (not `getSession()`) to refresh the session. Without this, RLS breaks silently.

**2. RLS on every user-scoped table — no exceptions:**
- `ALTER TABLE x ENABLE ROW LEVEL SECURITY` + policy in every migration
- Policy must have both `USING` (SELECT/UPDATE/DELETE) and `WITH CHECK` (INSERT/UPDATE)
- `api_cache` is global (property data is not user-specific) — still enable RLS, restrict writes to service role

**3. DataService as the only path to external APIs:**
- No agent, component, or route handler ever calls Rentcast/Census/Walk Score directly
- DataService checks `api_cache` first, enforces 50-call Rentcast limit, logs all calls
- Address normalization happens here — canonical lowercase form before building cache keys

**4. UnderwritingEngine is pure math — zero I/O:**
- No database calls, no API calls, no side effects
- Receives property data + user settings → returns all metrics
- Claude handles narrative and scenario analysis only; deterministic math stays in TypeScript

**5. AsyncGenerator orchestrator — same code for interactive and batch:**
- `AgentOrchestrator.analyze()` yields events; Route Handler turns them into SSE; cron discards them
- Agents run sequentially (Market → Underwriting → Comparables → Verdict)
- Each agent result persisted to DB as it completes — user never loses partial results

**6. Route Handlers for streaming, Server Actions for mutations:**
- Server Actions CANNOT stream. Use them only for save/update/delete operations
- All streaming agent output goes through `app/api/*/route.ts` with `ReadableStream`
- Never use Edge runtime for agent or PDF routes — need full Node.js for Anthropic SDK + Puppeteer

**7. PDF stored in Supabase Storage, returned as signed URL:**
- Raw PDF response would hit Vercel's 4.5MB response body limit
- Path pattern: `{user_id}/{deal_id}/report.pdf`

---

## Build Order Rationale

Each item blocks the next. Do not reorder.

| Step | What | Why It Must Come First |
|------|------|------------------------|
| 1 | Supabase schema + RLS + migrations + auth middleware | Everything else reads/writes the DB. Auth gates every route. |
| 2 | UnderwritingEngine (pure math) + unit tests (TDD) | PROJECT.md mandates 100% unit test coverage before any UI. Every downstream feature depends on accurate math. |
| 3 | DataService + provider modules (Rentcast, Census, Walk Score) + mock provider | Agents need data. Rentcast quota protection must exist before any real API calls. |
| 4 | Streaming infrastructure — one agent end-to-end on Vercel preview | Prove the SSE pattern works in production before building 5 agents. Catch Vercel timeout/streaming issues early. |
| 5 | All 5 agents (Market, Underwriting, Comparables, Verdict, Finder) | Full pipeline. Each is incremental once the base pattern works. |
| 6 | Core UI screens (Dashboard, Pipeline, Analysis streaming, Deal Detail) | Backend is solid. Analysis screen is hardest — streaming consumer + real-time state. |
| 7 | PDF generation — validate `@sparticuz/chromium` on Vercel preview | Depends on analysis data. Must be validated on actual Vercel deployment, not just locally. |
| 8 | Cron + email digest | Finder Agent must work before scheduling it. |
| 9 | Secondary UI (Discovery, Compare, Portfolio, Settings, Admin) | Polish once core flow is validated. |

**The two hard gates that must be proven on Vercel preview before continuing:**
- Step 4: Single streaming agent completes within timeout
- Step 7: PDF generates successfully (not just locally)

---

## Top 5 Risk Items

**Risk 1: Rentcast 50-call/month limit exhausted during development**
- Probability: HIGH if not mitigated from day one
- Impact: Product is dead for the rest of the month
- Mitigation: DataService with hard counter check before every call; mock provider default in dev (`RENTCAST_LIVE=true` env flag required for real calls); address normalization in cache keys
- When: Must be in place before any Rentcast integration code is written

**Risk 2: RLS missing on a table after Phase 1 adds real users**
- Probability: MEDIUM (new tables added during feature work, policy forgotten)
- Impact: Financial data leaks between users — critical trust failure
- Mitigation: CI lint script querying `pg_tables` + `pg_policies` catches tables without RLS; migration template includes RLS + policy by default; cross-tenant integration test (User A cannot read User B's deals)
- When: CI script must exist before first non-admin user is created

**Risk 3: Puppeteer/Chromium failing on Vercel**
- Probability: MEDIUM (environment differences between local and serverless)
- Impact: PDF generation broken in production; not caught until deployment
- Mitigation: Validate `@sparticuz/chromium` on Vercel preview deployment as an explicit milestone gate; configure function with `memory: 1024` and `maxDuration: 60` in `vercel.json`; fallback path is Browserless.io
- When: Phase that builds PDF must include a Vercel preview validation step before building full templates

**Risk 4: Floating point errors in financial calculations**
- Probability: CERTAIN without explicit mitigation
- Impact: Incorrect CoC, DSCR, deal scores — silent wrong answers that erode user trust; deal score thresholds flip incorrectly
- Mitigation: `decimal.js` for all monetary math; Postgres `NUMERIC(12,2)` or `BIGINT` (cents) columns, never `FLOAT`; unit tests assert cent-level precision against known amortization tables (Bankrate/Freddie Mac)
- When: Before any underwriting code is written

**Risk 5: AI streaming failures or timeouts on Vercel**
- Probability: MEDIUM without proper configuration
- Impact: Analysis screen hangs or shows blank after 60-120s of user waiting
- Mitigation: `export const maxDuration = 300` on all streaming routes; Node.js runtime (not Edge); chunked sequential agents (not one long chain); intermediate results persisted to DB so partial results survive if stream drops; client shows agent-by-agent progress, not a single spinner
- When: Must be proven on Vercel preview before building the full 5-agent pipeline

---

## Phase-by-Phase Implications

### Phase 0a — Foundation (Schema + Auth + Engine)
- Multi-tenant schema with RLS must be established before any feature work; retrofitting later is a painful migration with live data risk
- UnderwritingEngine must be TDD'd first — all financial formulas tested against known values before any UI touches them; this is a PROJECT.md hard requirement
- DataService + mock provider pattern enables all subsequent development without burning Rentcast quota

### Phase 0b — Agent Infrastructure + Streaming
- Prove the full streaming pattern (Route Handler → SSE → client hook) on Vercel preview with a single agent before building 5; the streaming pattern is the highest-complexity integration and must be validated early
- AsyncGenerator orchestrator pattern allows the same code to serve both interactive analysis and scheduled cron — build it once correctly
- Store intermediate results to DB as each agent completes — this is required for both UX (show progress) and resilience (retry doesn't lose work)

### Phase 0c — Full Agent Pipeline
- Market Analysis Agent can use Census + Walk Score + web_search independently of Rentcast; good first agent to prove the pattern before adding Rentcast dependencies
- Underwriting Agent calls UnderwritingEngine for math, then Claude for narrative only — never let the LLM compute P&I
- Comparables Agent reuses Rentcast data already fetched by Underwriting Agent (no extra API calls); wire this dependency explicitly
- Verdict Agent's deal score weighting IS a product opinion — document the formula (market weight, underwriting weight, comps weight) before implementation

### Phase 0d — Core UI
- Analysis streaming screen is the hardest UI component — SSE consumer, multi-step progress, error recovery, persistence of results on navigation
- Kanban pipeline needs `@dnd-kit` (not react-beautiful-dnd, which is abandoned); use zustand for UI state (filter/sort state), Supabase for persistence
- Dashboard should load via Server Components (no loading state, data fetched before render); only interactive sub-components need client-side hydration

### Phase 0e — PDF + Cron + Email
- PDF route must run on Node.js runtime, never Edge; configure `vercel.json` memory (1024MB+) and maxDuration before testing on Vercel
- PDF response must be stored in Supabase Storage and returned as signed URL — raw binary response exceeds Vercel's 4.5MB response limit
- Cron handler uses poll-and-dispatch: query `user_settings` for users whose `last_finder_run + cron_interval <= now`, process each sequentially; on Hobby plan this fires once/day with up to 59-minute drift — acceptable for Phase 0

### Phase 0f — Secondary UI + Polish
- Side-by-side comparison, ARV/renovation scenario, sensitivity analysis, and portfolio aggregate metrics are all P2 features — they depend on core flow being validated first
- Settings page must pre-populate with the owner's DFW defaults (1.8% property tax, 9% mgmt, 8% vacancy, 10% maintenance, 5% CapEx, 2.5% closing costs) — these are per-user overridable, not hardcoded

---

## Unresolved Questions

These do not block planning. Verify at implementation time.

| Question | Where to Verify | Risk if Wrong |
|----------|----------------|---------------|
| Exact `web_search` tool schema for Claude API | Anthropic docs at implementation time | LOW — if schema differs, Finder Agent needs prompt adjustment, not architecture change |
| Zod 4.x ecosystem compatibility (especially with form libraries) | npm at implementation time; fall back to zod@3.23.x | LOW — pinning is easy |
| `@sparticuz/chromium@143` + `puppeteer-core@24` compatibility on current Vercel runtime | First Vercel preview deployment | HIGH — if broken, need Browserless.io fallback |
| Vercel function timeout limits (source says 300s Hobby, 800s Pro with "fluid compute") | Vercel docs at implementation time — limits may have changed | MEDIUM — affects whether Hobby is viable for agent pipeline |
| Walk Score free tier rate limits | Walk Score API docs | LOW — cache is permanent, so rate limits only matter on first-time lookups |
| Census ACS tract-level data availability for DFW submarkets | Test API calls during DataService implementation | LOW — fallback to county-level data if tract data missing |
| Whether `api_cache` should be global (property data is not user-specific) or user-scoped | Architecture decision to confirm | MEDIUM — global cache is more efficient (10 users analyzing the same property = 1 Rentcast call); but requires explicit justification in schema docs |

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|-----------|-------|
| Stack versions | HIGH | npm registry verified 2026-03-30 |
| Supabase RLS + auth pattern | MEDIUM-HIGH | Well-documented community pattern; `@supabase/ssr` is the current official package |
| Vercel constraints (timeouts, cron, bundle size) | HIGH | Verified against official Vercel docs |
| Puppeteer + @sparticuz/chromium on Vercel | MEDIUM | Established serverless pattern but must be validated on actual deployment |
| Claude web_search tool schema | LOW | Newer feature; exact field names need doc verification |
| Competitor feature landscape | MEDIUM | Training data through early 2025; verify before final product decisions |
| Financial math correctness (decimal.js approach) | HIGH | Standard financial computing pattern |
| Agent pipeline architecture | MEDIUM-HIGH | AsyncGenerator + SSE pattern is well-established for Next.js App Router |

**Overall: MEDIUM-HIGH.** The stack choices and architectural patterns are well-grounded. The two things to validate earliest in implementation are: (1) `@sparticuz/chromium` on Vercel preview, and (2) Claude `web_search` exact schema.

---

*Summary synthesized from 4 research files — DealStack agentic real estate SaaS*
*Date: 2026-03-30*
