# Roadmap: DealStack

## Overview

DealStack goes from zero to a fully functional agentic real estate deal analysis tool in 6 phases. Phase 1 lays the multi-tenant foundation (schema, auth, underwriting math, PDF harness). Phase 2 wires up all external data sources behind a cache-first abstraction. Phase 3 builds the 5-agent AI pipeline with streaming. Phase 4 completes the deal flow end-to-end (finder, PDF templates, email). Phase 5 delivers the primary investor-facing UI. Phase 6 adds secondary screens, admin tooling, and production deployment.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Foundation** - Multi-tenant schema, auth, underwriting engine (TDD), and PDF harness
- [ ] **Phase 2: Data Services** - Cache-first DataService abstraction with all external API providers
- [ ] **Phase 3: Agent Pipeline** - All 5 analysis agents running end-to-end with streaming output
- [ ] **Phase 4: Finder, PDF & Email** - Finder agent, full PDF templates, cron scheduling, email digest
- [ ] **Phase 5: Core UI** - Primary investor screens: dashboard, discovery, pipeline, analysis, deal detail, settings
- [ ] **Phase 6: Secondary UI & Deployment** - Compare, portfolio, admin screens, and production deployment

## Phase Details

### Phase 1: Foundation
**Goal**: Solid multi-tenant foundation with proven underwriting math and validated PDF infrastructure that every subsequent phase builds on
**Depends on**: Nothing (first phase)
**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05, AUTH-06, DB-01, DB-02, DB-03, DB-04, DB-05, DB-06, DB-07, DB-08, SETTINGS-01, SETTINGS-02, SETTINGS-03, SETTINGS-04, SETTINGS-05, SETTINGS-06, SETTINGS-07, UNDER-01, UNDER-02, UNDER-03, UNDER-04, UNDER-05, UNDER-06, UNDER-07, UNDER-08, UNDER-09, UNDER-10, UNDER-11, UNDER-12
**Success Criteria** (what must be TRUE):
  1. Admin user can log in at /login, session persists across browser refresh, and all non-auth routes redirect to login when unauthenticated
  2. Every user-scoped table has RLS enabled with policies referencing auth.uid() — verified by querying pg_tables and pg_policies
  3. Underwriting engine produces P&I, NOI, cap rate, CoC, DSCR, GRM, equity projections, ARV scenarios, and deal score that match known amortization table values to the cent — 100% unit test coverage passing
  4. PDF test harness successfully renders a hardcoded deal to both Internal and External PDF formats on a Vercel preview deployment (not just locally)
  5. User settings are seeded with DFW investor profile defaults on first deploy
**Plans**: 5 plans

Plans:
- [x] 01-01: Project scaffold and Supabase schema — Next.js 14 project init, all database tables with migrations, RLS policies on every user-scoped table, admin user seed script
- [x] 01-02: Auth infrastructure — Supabase Auth with @supabase/ssr (browser/server/middleware clients), middleware protecting all routes, login page
- [x] 01-03: User settings model — user_settings table integration, DFW investor profile defaults, settings CRUD via server client
- [x] 01-04: Underwriting engine (TDD) — all financial formulas with decimal.js, deal score composite, fixer-upper ARV scenarios, 100% unit test coverage with Vitest
- [x] 01-05: PDF test harness — puppeteer-core + @sparticuz/chromium rendering hardcoded deal to Internal and External PDF, Supabase Storage upload, Vercel preview validation

### Phase 2: Data Services
**Goal**: All external data sources wired up behind the DataService abstraction with cache-first strategy and full mock support, so no downstream code ever touches an external API directly
**Depends on**: Phase 1
**Requirements**: DATA-01, DATA-02, DATA-03, DATA-04, DATA-05, RENT-01, RENT-02, RENT-03, RENT-04, RENT-05, RENT-06, CENSUS-01, CENSUS-02, WALK-01
**Success Criteria** (what must be TRUE):
  1. Every external API call routes through DataService — no direct fetch calls exist in any agent, route, or component
  2. Repeated lookups for the same address return cached data without making a new API call (verified via api_usage_log showing cache_hit = true)
  3. Rentcast call counter blocks live API calls when the monthly limit is reached and returns an error instead of exceeding quota
  4. Running the full test suite with MOCK_APIS=true makes zero real network requests and all integration tests pass
  5. api_usage_log records every call attempt with provider, endpoint, user_id, and cache_hit status
**Plans**: 4 plans

Plans:
- [ ] 02-01: DataService abstraction and cache layer — cache-first architecture, api_cache table integration, address normalization, cache key generation, TTL enforcement
- [ ] 02-02: Rentcast provider — property details, rent estimate, sale/rental comps, market trends endpoints with 30-day cache, hard 50-call/month global limit enforcement
- [ ] 02-03: Census and Walk Score providers — Census Geocoder (permanent cache), Census ACS (90-day FIPS cache), Walk Score (permanent address cache)
- [ ] 02-04: Mock provider and integration tests — mock implementations for all providers, MOCK_APIS=true as dev default, integration tests against mock data, api_usage_log verification

### Phase 3: Agent Pipeline
**Goal**: All 5 analysis agents (Market, Underwriting, Comparables, Verdict) running end-to-end with streaming output persisted to the database, validated on Vercel preview
**Depends on**: Phase 2
**Requirements**: AGENT-01, AGENT-02, AGENT-03, AGENT-04, AGENT-05, AGENT-06, AGENT-07
**Success Criteria** (what must be TRUE):
  1. Submitting an address triggers the sequential agent pipeline (Market -> Underwriting -> Comparables -> Verdict) and each agent's output is persisted to analysis_results as it completes
  2. Streaming output is consumable via ReadableStream from a Route Handler — a client can observe agent-by-agent progress in real time
  3. If the stream drops mid-pipeline, previously completed agent results are preserved in the database and not lost
  4. The full pipeline completes within Vercel's 300-second timeout on a preview deployment (not just locally)
  5. Verdict agent produces a deal score (0-100) with GO/CAUTIOUS GO/NO classification stored in the database
**Plans**: 4 plans

Plans:
- [ ] 03-01: Streaming infrastructure and orchestrator — AsyncGenerator orchestrator, Route Handler with ReadableStream + SSE, maxDuration=300, base agent class with Claude API integration
- [ ] 03-02: Market Analysis and Underwriting agents — Market agent (Census + Walk Score + web_search -> market score + narrative), Underwriting agent (Rentcast data + user settings -> full proforma via UnderwritingEngine, fixer-upper scenarios)
- [ ] 03-03: Comparables and Verdict agents — Comparables agent (reuses Rentcast comps, web_search supplement), Verdict agent (weighted composite deal score, GO/CAUTIOUS GO/NO, stores to DB)
- [ ] 03-04: End-to-end validation — 2-3 real DFW addresses through full pipeline, Vercel preview deployment test, streaming timeout verification, crash-safety verification (partial results survive)

### Phase 4: Finder, PDF & Email
**Goal**: The full deal flow works end-to-end: finder surfaces properties, user approves, analysis runs, PDF generated and stored, email digest sent
**Depends on**: Phase 3
**Requirements**: AGENT-08, AGENT-09, AGENT-10, PDF-01, PDF-02, PDF-03, PDF-04, PDF-05, EMAIL-01, EMAIL-02
**Success Criteria** (what must be TRUE):
  1. Finder agent searches for listings matching user's configured market and criteria, returns a shortlist, and never auto-triggers full analysis
  2. Scheduled cron endpoint iterates users due for a finder run (poll-and-dispatch pattern) and processes them within Vercel function timeout
  3. Internal PDF contains full underwriting memo (all assumptions, agent reasoning, data sources, deal score breakdown, comps, equity projections, red flags) and External PDF contains clean shareable version with disclaimer
  4. Generated PDFs are stored in Supabase Storage with download links persisted to pdf_reports table
  5. Email digest is sent to user's configured alert_email after a scheduled finder run completes
**Plans**: 4 plans

Plans:
- [ ] 04-01: Finder agent — web_search for active listings matching user criteria, shortlist output, manual trigger via Route Handler, user-scoped settings for market/criteria
- [ ] 04-02: Cron scheduling — Vercel Cron endpoint (/api/cron/finder), poll-and-dispatch pattern querying users by last_finder_run + cron_interval, CRON_SECRET auth, service role client
- [ ] 04-03: PDF templates — Internal report (full underwriting memo with all sections) and External report (clean shareable memo with disclaimer and user branding), Supabase Storage upload, pdf_reports table integration
- [ ] 04-04: Email digest — Resend integration, React Email template for finder results digest, alert_email from user settings, fire-and-forget from cron handler

### Phase 5: Core UI
**Goal**: The primary investor-facing screens are built and usable — an investor can discover, analyze, track, and manage deals through a polished dark-themed interface
**Depends on**: Phase 4
**Requirements**: PIPE-01, PIPE-02, PIPE-03, PIPE-04, PIPE-05, PORT-01, PORT-02, PORT-03, PORT-04, UI-01, UI-02, UI-03, UI-04, UI-05, UI-08, UI-10
**Success Criteria** (what must be TRUE):
  1. User can view a dashboard with portfolio snapshot, acquisition goal progress, recent activity, and trigger a manual finder run
  2. User can browse finder shortlist results, approve or skip properties, and see fixer-upper flags on the discovery screen
  3. User can drag deals between pipeline stages (Prospect / Analyzed / Offer Made / Acquired / Pass) on a Kanban board with deal score badges visible
  4. User can watch live streaming agent progress on the analysis screen, seeing output appear stage by stage as each agent completes
  5. User can view full deal details, override renovation estimates for fixer-uppers, and generate Internal or External PDFs from the deal detail screen
**Plans**: 5 plans

Plans:
- [ ] 05-01: Design system and layout shell — dark theme with gold accents (Tailwind config), authenticated layout with sidebar navigation, shared UI primitives (buttons, cards, badges, modals), mobile-responsive base
- [ ] 05-02: Dashboard and Discovery screens — Dashboard (portfolio snapshot, goal progress, recent activity, finder trigger), Discovery (finder shortlist, approve/skip, fixer-upper flags)
- [ ] 05-03: Pipeline screen — Kanban board with @dnd-kit (Prospect/Analyzed/Offer Made/Acquired/Pass), deal cards with score badges and verdict, drag-and-drop stage persistence, offer tracking
- [ ] 05-04: Analysis and Deal Detail screens — Analysis screen (SSE consumer via useAgentStream hook, multi-step progress, error recovery), Deal Detail (full agent outputs, renovation override, PDF generate buttons)
- [ ] 05-05: Settings screen and Rentcast counter — All user preferences (market, assumptions, alert email, mortgage rate override, cron schedule, branding), Rentcast call counter display (used/50), side-by-side comparison of any two deals
**UI hint**: yes

### Phase 6: Secondary UI & Deployment
**Goal**: Complete remaining screens, add admin tooling, and ship to production with full configuration and deployment validation
**Depends on**: Phase 5
**Requirements**: UI-06, UI-07, UI-09, DEPLOY-01, DEPLOY-02, DEPLOY-03, DEPLOY-04, DEPLOY-05
**Success Criteria** (what must be TRUE):
  1. User can compare any two deals side-by-side on the compare screen with underwriting metrics visible
  2. User can view portfolio aggregate metrics (equity curve, net worth projection, cash flow over time) for acquired properties
  3. Admin user can access a hidden admin screen showing user list, API usage across all users, and Rentcast call log
  4. Application is deployed to Vercel production with Supabase production project, all migrations applied, and environment variables documented in .env.example
  5. Full end-to-end smoke test passes on production: login -> finder -> approve -> analyze -> PDF -> download
**Plans**: 4 plans

Plans:
- [ ] 06-01: Compare and Portfolio screens — Compare screen (side-by-side underwriting of two deals), Portfolio screen (aggregate acquired properties, equity curve chart via recharts, net worth projection, cash flow over time)
- [ ] 06-02: Admin screen — Admin-only route (role check), user list, API usage dashboard, Rentcast call log, system health indicators
- [ ] 06-03: Production deployment — Vercel production project config (function timeouts, memory, cron), Supabase production project with migrations, .env.example with all required/optional variables documented
- [ ] 06-04: Final validation — Performance review (N+1 queries, pagination), security review (RLS audit, signed PDF URLs, API key exposure check), E2E smoke test on production
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 0/5 | Not started | - |
| 2. Data Services | 0/4 | Not started | - |
| 3. Agent Pipeline | 0/4 | Not started | - |
| 4. Finder, PDF & Email | 0/4 | Not started | - |
| 5. Core UI | 0/5 | Not started | - |
| 6. Secondary UI & Deployment | 0/4 | Not started | - |

---

## UAT: v1.0 User Acceptance Criteria

When all 6 phases are complete, the following must be true for the v1.0 milestone to be accepted:

### Full Deal Flow (end-to-end)
- [ ] Investor logs in and sees dashboard with portfolio summary and acquisition goal progress
- [ ] Investor triggers finder agent manually from dashboard, receives a shortlist of properties matching their configured DFW market criteria
- [ ] Investor approves a property from the discovery screen, triggering the full analysis pipeline
- [ ] Analysis screen shows live streaming progress as each agent (Market, Underwriting, Comparables, Verdict) completes
- [ ] Completed deal appears in pipeline as "Analyzed" with deal score badge and GO/CAUTIOUS GO/NO verdict
- [ ] Investor views deal detail with full agent outputs, can override renovation estimate for fixer-upper scenario
- [ ] Investor generates Internal PDF (full underwriting memo) and External PDF (clean shareable version) from deal detail
- [ ] PDFs download successfully and contain accurate financial data matching the analysis results

### Pipeline Management
- [ ] Investor drags deal from "Analyzed" to "Offer Made" on Kanban board, stage change persists
- [ ] Investor can track offer details (price, date, outcome) on a deal
- [ ] Investor drags deal to "Acquired", it appears in portfolio view with equity projections
- [ ] Portfolio shows aggregate metrics: combined equity, passive income, acquisition goal progress (X of 5 rentals)

### Scheduled Operations
- [ ] Scheduled cron fires daily, runs finder for users whose interval has elapsed, and sends email digest to configured alert_email
- [ ] Rentcast call counter is visible in settings and accurately reflects usage against the 50-call/month limit

### Settings and Configuration
- [ ] All investor preferences are configurable: target market, submarkets, price ceiling, down payment %, all underwriting assumptions, alert email, cron interval, mortgage rate override
- [ ] Changed settings affect subsequent analysis runs (no hardcoded values)

### Data Integrity
- [ ] No cross-tenant data leakage: User A cannot see User B's deals, properties, or settings (verified by RLS)
- [ ] All financial calculations use decimal.js and match known amortization tables to the cent
- [ ] Cached API data is served correctly within TTL windows; stale data triggers re-fetch

### Admin
- [ ] Admin can view all users, API usage, and Rentcast call log from the admin screen

---
*Roadmap created: 2026-03-30*
*Milestone: v1.0 -- Private Single-User Deployment*
