# DealStack — Work Summary

**Last updated:** 2026-04-03
**Current milestone:** v1.0 — Private Single-User Deployment
**Overall progress:** Phase 1 of 6 complete (pending one human UAT item)

---

## What Is DealStack

A full-stack agentic real estate deal analysis SaaS for buy-and-hold investors. Core value proposition: go from an address → full underwriting + market analysis → professional PDF investment memo without any manual data gathering. Every assumption is driven by the investor's personal profile, not hardcoded defaults.

**Deployment target:** Vercel (frontend + API routes) + Supabase (Postgres + Auth + Storage)
**Stack:** Next.js 14 App Router · TypeScript · Tailwind CSS · Supabase · Puppeteer · Anthropic Claude API

---

## Completed Work

### Phase 1: Foundation — COMPLETE (4/5 success criteria verified, 1 pending human)

All 5 plans executed. 32 requirements satisfied. 43 unit tests passing at 100% coverage.

#### Plan 01-01 — Project Scaffold & Database Schema

- Initialized Next.js 14 App Router project with TypeScript and Tailwind
- Wrote `supabase/migrations/00001_initial_schema.sql` (346 lines):
  - 11 tables: `users`, `user_settings`, `properties`, `deals`, `pipeline_stages`, `offers`, `comparables`, `analysis_results`, `pdf_reports`, `api_cache`, `api_usage_log`
  - 3 custom enums: `plan_tier`, `plan_status`, `deal_status`
  - Row Level Security enabled on every user-scoped table (11 `ENABLE ROW LEVEL SECURITY`, 33 `CREATE POLICY` statements)
  - Stripe-ready fields on `users` (`stripe_customer_id`, `plan`, `plan_status`, `plan_limits`)
  - Cache infrastructure tables (`api_cache`, `api_usage_log`) for Rentcast 50-call/month budget enforcement
  - `NUMERIC(12,2)` for all monetary columns, `update_updated_at` triggers on all tables
- Configured Vitest with 100% coverage thresholds targeting `src/lib/engine/**/*.ts`

#### Plan 01-02 — Auth Infrastructure

- `src/lib/supabase/client.ts` — browser client factory (`createBrowserClient`)
- `src/lib/supabase/server.ts` — server client factory (`createServerClient` + cookie-based session)
- `src/lib/supabase/admin.ts` — service role client for admin operations (bypasses RLS)
- `src/middleware.ts` — Next.js middleware that refreshes session and redirects unauthenticated users to `/login`; no public routes except `/login`
- `src/app/login/page.tsx` — login page with `signInWithPassword`; no signup link
- `scripts/seed-admin.ts` — idempotent admin user creation via `auth.admin.createUser`, inserts DFW defaults into `user_settings`

**Key decision:** Chose Supabase Auth over Clerk — RLS policies reference `auth.uid()` natively; no user ID sync required.

#### Plan 01-03 — User Settings Model

- `src/lib/types/settings.ts` — `UserSettings` interface (22 fields), `UserSettingsUpdate`, `DFW_DEFAULTS` constant
  - Fields include: `target_market`, `target_submarkets`, `property_types`, `price_ceiling`, `down_payment_pct`, underwriting assumptions (`property_tax_rate` 1.8%, `mgmt_pct` 9%, `vacancy_pct` 8%, `maintenance_pct` 10%, `capex_pct` 5%, `closing_costs_pct` 2.5%), `acquisition_goal_count`, `acquisition_goal_years`, `alert_email`, `mortgage_rate_override`, `finder_cron_interval`, `notification_preferences`, `logo_url`, `accent_color`
- `src/lib/services/settings-service.ts` — `getUserSettings` and `updateUserSettings` using server client; all reads filtered by `auth.uid()` for RLS enforcement

#### Plan 01-04 — Underwriting Engine (TDD)

Built with decimal.js precision 20 + `ROUND_HALF_UP`; zero native float arithmetic anywhere.

- `src/lib/engine/types.ts` — `UnderwritingInput`, `UnderwritingResult`, `FixerUpperResult`, `DealScoreInput`, `DealScoreResult`
- `src/lib/engine/underwriting.ts` (361 lines, 54 `new Decimal` usages) — exports:
  - `calculateMonthlyPI` — verified: $300K at 7% 30yr = **$1,995.91**
  - `calculateNOI` — verified: $24K gross, 8% vacancy, $8K expenses = **$14,080**
  - `calculateCapRate`, `calculateCashOnCash`, `calculateDSCR`, `calculateGRM`
  - `calculateEquityYearN` — year 0, 5, 10 equity projections
  - `calculateARVEquity` — fixer-upper: $350K ARV − $240K balance − $40K reno = **$70K**
  - `runUnderwriting` — full proforma; returns `FixerUpperResult` (pre_reno + post_reno) when renovation cost + ARV provided
- `src/lib/engine/deal-score.ts` — weighted composite score: CoC 25%, cap rate 20%, 5yr equity 20%, market 15%, value-add 10%, comps 10%; verdict GO / CAUTIOUS GO / NO
- `src/lib/engine/__tests__/underwriting.test.ts` — 277 lines, 27 tests
- `src/lib/engine/__tests__/deal-score.test.ts` — 125 lines, 8 tests
- **Result: 43 tests pass, 100% statement/branch/function/line coverage**

#### Plan 01-05 — PDF Test Harness

- `src/lib/services/pdf-service.ts` — `generatePDF()` using `puppeteer-core` + `@sparticuz/chromium`; environment-aware Chrome selection (`VERCEL_ENV` check); `networkidle0` wait
- `src/app/api/reports/generate/route.ts` — POST handler, `runtime = 'nodejs'`, `maxDuration = 60`; auth-gated (`getUser()`, 401 on failure); uploads to Supabase Storage `reports` bucket; inserts into `pdf_reports`; returns signed URL
- `src/lib/templates/internal-report.ts` — Internal Investment Memo HTML (Deal Score, Equity Projections, Assumptions, CONFIDENTIAL watermark)
- `src/lib/templates/external-report.ts` — External shareable Investment Summary HTML (clean format, Disclaimer)
- `vercel.json` — `maxDuration: 60`, `memory: 1024` for the generate route

**Key decision:** `@sparticuz/chromium` for Vercel serverless; used `headless: true` + static viewport (removed `defaultViewport`/`headless` properties incompatible with v143 API).

---

### Infrastructure & Backend

- **Supabase project provisioned** (ID: `wmkerggoqtceoqjwyotr`, region: us-east-1, PostgreSQL 17.6)
- Initial schema migration applied — all 11 tables live with RLS and policies active
- `.env.local` configured with Supabase project URL and anon key
- Service role key retrieved and configured

---

## Outstanding Items

| Item | Status | Blocker |
|------|--------|---------|
| SC-4: PDF rendering on Vercel preview | Needs human | Deploy to Vercel preview, POST `/api/reports/generate` with `reportType: 'internal'` and `'external'`; confirm HTTP 200 + signed URL + PDF renders with correct branding |
| Service role key in `.env.local` | Done | Was manual step; completed |

---

## Phase Roadmap (Remaining)

| Phase | Goal | Plans |
|-------|------|-------|
| **2: Data Services** | Cache-first DataService with all external APIs (Rentcast, Census, Walk Score) | 4 |
| **3: Agent Pipeline** | 5 AI agents (Market, Underwriting, Comparables, Verdict) with streaming | 4 |
| **4: Finder, PDF & Email** | Finder agent, full PDF templates, cron scheduling, email digest | 4 |
| **5: Core UI** | 9 investor screens (dashboard, discovery, pipeline, analysis, deal detail, settings) | 5 |
| **6: Secondary UI & Deployment** | Compare, portfolio, admin screens + production deployment | 4 |

---

## Key Architectural Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Auth | Supabase Auth | Native `auth.uid()` in RLS policies; no user ID sync |
| PDF | Puppeteer + `@sparticuz/chromium` | Full CSS fidelity on professional investment memos |
| Financial math | decimal.js (precision 20) | IEEE 754 float ops cannot represent money accurately |
| API strategy | Cache-first DataService | Rentcast hard 50-call/month limit is a binding constraint |
| Multi-tenancy | RLS from day one | Retrofitting RLS/`user_id` post-launch is risky and expensive |
| AI | Anthropic Claude API (`claude-sonnet-4-5`) + `web_search` | All 5 agents |

---

## File Layout (Phase 1 artifacts)

```
src/
  app/
    api/reports/generate/route.ts   # PDF generation endpoint
    login/page.tsx                  # Login UI
  lib/
    engine/
      types.ts                      # Input/output types
      underwriting.ts               # All financial formulas
      deal-score.ts                 # Weighted deal score
      __tests__/
        underwriting.test.ts        # 27 tests
        deal-score.test.ts          # 8 tests
    services/
      settings-service.ts           # User settings CRUD
      pdf-service.ts                # Puppeteer PDF generation
    supabase/
      client.ts / server.ts / admin.ts / middleware.ts
    templates/
      internal-report.ts            # Internal memo HTML
      external-report.ts            # External shareable HTML
    types/
      settings.ts                   # UserSettings interface + DFW_DEFAULTS
      database.ts                   # Placeholder (pending gen types)
  middleware.ts                     # Auth + session middleware
scripts/
  seed-admin.ts                     # Idempotent admin user creation
supabase/
  migrations/
    00001_initial_schema.sql        # 11 tables, RLS, enums, triggers
vercel.json                         # Function memory/timeout config
vitest.config.ts                    # 100% coverage thresholds
```
