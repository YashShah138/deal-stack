# Requirements: DealStack

**Defined:** 2026-03-30
**Core Value:** A real estate investor should be able to go from address -> full underwriting + market analysis -> professional PDF report without manual data gathering -- every assumption driven by their personal investment profile.

## v1 Requirements

### Authentication & Multi-Tenancy

- [ ] **AUTH-01**: Admin account seeded on first deploy via ADMIN_EMAIL + ADMIN_PASSWORD env vars
- [ ] **AUTH-02**: Auth middleware protects all routes and API endpoints -- unauthenticated requests redirected to login
- [ ] **AUTH-03**: User session persists across browser refresh using Supabase Auth + @supabase/ssr
- [x] **AUTH-04**: Row-Level Security enforced at database level on all user-scoped tables (user_id FK + RLS policy)
- [ ] **AUTH-05**: No public signup UI -- Phase 0 is invite-only via admin-created accounts
- [x] **AUTH-06**: Permission model supports future plan tiers (free/pro/enterprise) via users.plan enum field

### Database Schema

- [x] **DB-01**: Schema includes: users, user_settings, properties, deals, pipeline_stages, offers, comparables, analysis_results, pdf_reports, api_cache, api_usage_log
- [x] **DB-02**: All user-data tables have user_id FK referencing auth.users(id)
- [x] **DB-03**: users table includes Stripe-ready fields: stripe_customer_id (nullable), plan (enum), plan_status, plan_limits (JSONB)
- [x] **DB-04**: users table includes usage tracking fields: deals_analyzed_this_month, properties_tracked
- [x] **DB-05**: api_cache table stores: provider, endpoint/key, response_data (JSONB), created_at, expires_at
- [x] **DB-06**: api_usage_log stores: provider, endpoint, user_id (nullable), timestamp, cache_hit (bool)
- [x] **DB-07**: RLS enabled on every user-scoped table with SELECT/INSERT/UPDATE/DELETE policies
- [x] **DB-08**: Shared/market-level cache data (Census, Walk Score) has no user_id -- globally shared across users

### User Settings

- [ ] **SETTINGS-01**: Per-user settings stored in user_settings table with user_id FK
- [ ] **SETTINGS-02**: Settings include: target_market, target_submarkets (text[]), property_types (text[]), price_ceiling, down_payment_pct
- [ ] **SETTINGS-03**: Settings include underwriting assumptions: property_tax_rate, mgmt_pct, vacancy_pct, maintenance_pct, capex_pct, closing_costs_pct
- [ ] **SETTINGS-04**: Settings include: acquisition_goal_count, acquisition_goal_years, alert_email, mortgage_rate_override (nullable)
- [ ] **SETTINGS-05**: Settings include: finder_cron_interval, notification_preferences (JSONB)
- [ ] **SETTINGS-06**: Settings include branding: logo_url (nullable), accent_color (nullable) for external PDF white-labeling
- [ ] **SETTINGS-07**: Default settings seeded for admin user on first deploy matching the DFW investor profile

### Underwriting Engine

- [ ] **UNDER-01**: Monthly P&I calculation: loan_amount x [r(1+r)^n] / [(1+r)^n - 1] -- unit tested against known amortization table values
- [ ] **UNDER-02**: NOI = (annual_rent x (1 - vacancy_rate)) - operating_expenses -- unit tested
- [ ] **UNDER-03**: Cap Rate = NOI / purchase_price -- unit tested
- [ ] **UNDER-04**: Cash-on-Cash Return = annual_cash_flow / total_cash_invested -- unit tested
- [ ] **UNDER-05**: DSCR = NOI / annual_debt_service -- unit tested
- [ ] **UNDER-06**: GRM = purchase_price / annual_gross_rent -- unit tested
- [ ] **UNDER-07**: Equity Year N = (purchase_price x (1 + appreciation_rate)^N) - remaining_loan_balance_year_N -- unit tested
- [ ] **UNDER-08**: ARV Equity (fixer-upper) = ARV - (loan_amount + renovation_cost) -- unit tested
- [ ] **UNDER-09**: Deal Score = weighted composite: CoC 25%, cap rate 20%, 5yr equity 20%, market score 15%, value-add upside 10%, comp validation 10% -- unit tested
- [ ] **UNDER-10**: All financial math uses decimal.js (not native float) to avoid IEEE 754 precision errors
- [ ] **UNDER-11**: Engine reads all assumptions from user settings -- zero hardcoded values
- [ ] **UNDER-12**: Fixer-upper mode generates both pre-reno and post-reno (ARV) scenarios side by side

### Data Service & Caching

- [ ] **DATA-01**: DataService abstraction layer -- all external API calls routed through it, zero direct fetch calls in agents or routes
- [ ] **DATA-02**: Cache-first strategy: check api_cache -> return if fresh -> fetch if stale -> store + return
- [ ] **DATA-03**: api_usage_log tracks every call attempt (cached and live) with provider, user_id, cache_hit
- [ ] **DATA-04**: Rentcast call counter exposed in Settings screen: calls used / 50 this month
- [ ] **DATA-05**: Mock provider available for all external APIs -- dev environment runs against mocks by default (MOCK_APIS=true)

### Rentcast Integration

- [ ] **RENT-01**: Property details lookup by address -- cached 30 days
- [ ] **RENT-02**: Rent estimate by address -- cached 30 days
- [ ] **RENT-03**: Rental comparables by address -- cached 30 days
- [ ] **RENT-04**: Sale comparables by address -- cached 30 days
- [ ] **RENT-05**: Market trends by city -- cached 30 days
- [ ] **RENT-06**: Hard global 50-call/month limit enforced -- DataService blocks live calls once limit is reached, serves cache or returns error

### Census & Location Integrations

- [ ] **CENSUS-01**: Census Geocoder: address -> lat/long + census tract FIPS -- cached permanently per address
- [ ] **CENSUS-02**: Census ACS API: median income, population growth, housing vacancy, employment by FIPS tract -- cached 90 days
- [ ] **WALK-01**: Walk Score API: walk/transit/bike scores per address -- cached permanently per address

### Agent Pipeline

- [ ] **AGENT-01**: All agents are user-scoped -- read current user's settings for market, criteria, assumptions
- [ ] **AGENT-02**: Agent streaming output is persisted to analysis_results table at each stage -- crash-safe
- [ ] **AGENT-03**: Streaming agent output is rendered live in the Analysis screen (server-sent events or ReadableStream)
- [ ] **AGENT-04**: Market Analysis Agent -- Census + Walk Score + web_search -> market score 0-100 + narrative
- [ ] **AGENT-05**: Underwriting Agent -- Rentcast data + user assumptions -> full proforma; fixer-upper scenarios
- [ ] **AGENT-06**: Comparables Agent -- Rentcast comps (no new API calls) + web_search supplement -> comp validation
- [ ] **AGENT-07**: Verdict Agent -- deal score 0-100 (weighted composite), GO/CAUTIOUS GO/NO, stores result in DB
- [ ] **AGENT-08**: Finder Agent -- web_search for active listings matching user's criteria -> shortlist for approval; never auto-runs full analysis
- [ ] **AGENT-09**: Finder Agent supports manual trigger from UI and scheduled cron run
- [ ] **AGENT-10**: Scheduled cron uses poll-and-dispatch pattern -- one Vercel Cron endpoint iterates users due for a run

### PDF Reports

- [ ] **PDF-01**: Internal report mode -- full underwriting, all assumptions, agent reasoning, data sources, deal score breakdown, comps table, 5 and 10 year equity projections, portfolio impact, red flags
- [ ] **PDF-02**: External report mode -- property overview, clean financials, market summary, 5yr equity table, deal verdict, disclaimer
- [ ] **PDF-03**: Both modes use Puppeteer (@sparticuz/chromium for Vercel serverless) -- professional investment memo aesthetic
- [ ] **PDF-04**: External reports include user's configured branding (logo + accent color from settings) when set
- [ ] **PDF-05**: PDFs stored in Supabase Storage; download link returned and stored in pdf_reports table

### Deal Pipeline

- [ ] **PIPE-01**: Kanban board: Prospect -> Analyzed -> Offer Made -> Acquired -> Pass -- all user-scoped
- [ ] **PIPE-02**: Deal cards show: address, price, deal score badge, verdict, date, current stage
- [ ] **PIPE-03**: Drag deals between stages -- stage change persisted to DB
- [ ] **PIPE-04**: Offer tracking: price, date, outcome stored per deal
- [ ] **PIPE-05**: Side-by-side comparison of any two deals

### Portfolio Tracking

- [ ] **PORT-01**: Portfolio model aggregates Acquired-stage deals only
- [ ] **PORT-02**: Portfolio view shows: combined equity, passive income, total cash invested, portfolio value at years 1/3/5/10
- [ ] **PORT-03**: Acquisition goal progress: X of user's goal acquired (e.g., 1 of 5 rentals)
- [ ] **PORT-04**: Equity curve chart over time across all acquired properties

### Email & Notifications

- [ ] **EMAIL-01**: Finder Agent scheduled run sends email digest to user's configured alert_email
- [ ] **EMAIL-02**: Email provider configurable via .env (Resend or Nodemailer/SMTP)

### UI Screens

- [ ] **UI-01**: Dashboard -- portfolio snapshot, acquisition goal progress, recent activity, manual Finder trigger
- [ ] **UI-02**: Discovery -- Finder Agent shortlist, approve/skip per property, fixer-upper flags
- [ ] **UI-03**: Pipeline -- Kanban deal tracker with score badges, drag-and-drop stage changes
- [ ] **UI-04**: Analysis -- live streaming agent progress per property, stage-by-stage output
- [ ] **UI-05**: Deal Detail -- full agent outputs, renovation estimate override (fixer-uppers), PDF generate buttons (Internal + External)
- [ ] **UI-06**: Compare -- side-by-side underwriting of any two deals
- [ ] **UI-07**: Portfolio -- aggregate acquired properties, equity curve, net worth projection, cash flow over time
- [ ] **UI-08**: Settings -- all user preferences: market, assumptions, alert email, SMTP config, mortgage rate override, cron schedule, Rentcast call counter, branding (logo + accent color)
- [ ] **UI-09**: Admin -- hidden screen (admin role only): user list, API usage across all users, Rentcast call log, system health
- [ ] **UI-10**: All screens mobile-responsive with dark theme and gold accents

### Deployment & Configuration

- [ ] **DEPLOY-01**: Local dev and production environments fully configured via .env switching
- [ ] **DEPLOY-02**: All API keys and secrets in .env -- no hardcoded credentials
- [ ] **DEPLOY-03**: .env.example documents all required and optional variables
- [ ] **DEPLOY-04**: Vercel Pro deployment with configured function timeouts (maxDuration = 300 for agent routes)
- [ ] **DEPLOY-05**: Supabase production project with migrations applied via migration files

## v2 Requirements

These are deferred to Phase 1 SaaS launch.

### Billing & Subscriptions
- **BILLING-01**: Stripe subscription integration (free/pro/enterprise tiers)
- **BILLING-02**: Usage-based limits per plan (deals/month, properties tracked, PDF exports) enforced via plan_limits JSONB
- **BILLING-03**: Public billing management portal

### Public Onboarding
- **ONBOARD-01**: Public signup flow with email verification
- **ONBOARD-02**: User onboarding wizard (configure market, set assumptions, connect alerts)
- **ONBOARD-03**: Public marketing site and landing page

### Team Features
- **TEAM-01**: Organization accounts -- multiple users share a pipeline
- **TEAM-02**: Team roles (owner, member, viewer)

### Advanced Features
- **ADV-01**: Multi-Rentcast-key rotation for higher call volume
- **ADV-02**: White-label external PDF reports per user (custom domain, logo, colors -- full)
- **ADV-03**: Referral and affiliate tracking

## Out of Scope

| Feature | Reason |
|---------|--------|
| MLS / IDX integration | Requires broker license/agreements; separate product dimension |
| Skip tracing / owner contact data | Wholesaling feature; not relevant to buy-and-hold |
| Short-term rental (STR/Airbnb) analysis | Separate underwriting model; different market dynamics |
| Property management features | PM software is a separate product category |
| Paid API tiers | All integrations use free tiers only in Phase 0 |
| Stripe billing (now) | Schema-ready but deferred to Phase 1 |
| Public signup/marketing site | Deferred to Phase 1 |
| Team/org accounts | Deferred to Phase 1 |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | Phase 1 | Pending |
| AUTH-02 | Phase 1 | Pending |
| AUTH-03 | Phase 1 | Pending |
| AUTH-04 | Phase 1 | Complete |
| AUTH-05 | Phase 1 | Pending |
| AUTH-06 | Phase 1 | Complete |
| DB-01 | Phase 1 | Complete |
| DB-02 | Phase 1 | Complete |
| DB-03 | Phase 1 | Complete |
| DB-04 | Phase 1 | Complete |
| DB-05 | Phase 1 | Complete |
| DB-06 | Phase 1 | Complete |
| DB-07 | Phase 1 | Complete |
| DB-08 | Phase 1 | Complete |
| SETTINGS-01 | Phase 1 | Pending |
| SETTINGS-02 | Phase 1 | Pending |
| SETTINGS-03 | Phase 1 | Pending |
| SETTINGS-04 | Phase 1 | Pending |
| SETTINGS-05 | Phase 1 | Pending |
| SETTINGS-06 | Phase 1 | Pending |
| SETTINGS-07 | Phase 1 | Pending |
| UNDER-01 | Phase 1 | Pending |
| UNDER-02 | Phase 1 | Pending |
| UNDER-03 | Phase 1 | Pending |
| UNDER-04 | Phase 1 | Pending |
| UNDER-05 | Phase 1 | Pending |
| UNDER-06 | Phase 1 | Pending |
| UNDER-07 | Phase 1 | Pending |
| UNDER-08 | Phase 1 | Pending |
| UNDER-09 | Phase 1 | Pending |
| UNDER-10 | Phase 1 | Pending |
| UNDER-11 | Phase 1 | Pending |
| UNDER-12 | Phase 1 | Pending |
| DATA-01 | Phase 2 | Pending |
| DATA-02 | Phase 2 | Pending |
| DATA-03 | Phase 2 | Pending |
| DATA-04 | Phase 2 | Pending |
| DATA-05 | Phase 2 | Pending |
| RENT-01 | Phase 2 | Pending |
| RENT-02 | Phase 2 | Pending |
| RENT-03 | Phase 2 | Pending |
| RENT-04 | Phase 2 | Pending |
| RENT-05 | Phase 2 | Pending |
| RENT-06 | Phase 2 | Pending |
| CENSUS-01 | Phase 2 | Pending |
| CENSUS-02 | Phase 2 | Pending |
| WALK-01 | Phase 2 | Pending |
| AGENT-01 | Phase 3 | Pending |
| AGENT-02 | Phase 3 | Pending |
| AGENT-03 | Phase 3 | Pending |
| AGENT-04 | Phase 3 | Pending |
| AGENT-05 | Phase 3 | Pending |
| AGENT-06 | Phase 3 | Pending |
| AGENT-07 | Phase 3 | Pending |
| AGENT-08 | Phase 4 | Pending |
| AGENT-09 | Phase 4 | Pending |
| AGENT-10 | Phase 4 | Pending |
| PDF-01 | Phase 4 | Pending |
| PDF-02 | Phase 4 | Pending |
| PDF-03 | Phase 4 | Pending |
| PDF-04 | Phase 4 | Pending |
| PDF-05 | Phase 4 | Pending |
| EMAIL-01 | Phase 4 | Pending |
| EMAIL-02 | Phase 4 | Pending |
| PIPE-01 | Phase 5 | Pending |
| PIPE-02 | Phase 5 | Pending |
| PIPE-03 | Phase 5 | Pending |
| PIPE-04 | Phase 5 | Pending |
| PIPE-05 | Phase 5 | Pending |
| PORT-01 | Phase 5 | Pending |
| PORT-02 | Phase 5 | Pending |
| PORT-03 | Phase 5 | Pending |
| PORT-04 | Phase 5 | Pending |
| UI-01 | Phase 5 | Pending |
| UI-02 | Phase 5 | Pending |
| UI-03 | Phase 5 | Pending |
| UI-04 | Phase 5 | Pending |
| UI-05 | Phase 5 | Pending |
| UI-06 | Phase 6 | Pending |
| UI-07 | Phase 6 | Pending |
| UI-08 | Phase 5 | Pending |
| UI-09 | Phase 6 | Pending |
| UI-10 | Phase 5 | Pending |
| DEPLOY-01 | Phase 6 | Pending |
| DEPLOY-02 | Phase 6 | Pending |
| DEPLOY-03 | Phase 6 | Pending |
| DEPLOY-04 | Phase 6 | Pending |
| DEPLOY-05 | Phase 6 | Pending |

**Coverage:**
- v1 requirements: 72 total
- Mapped to phases: 72
- Unmapped: 0

---
*Requirements defined: 2026-03-30*
*Last updated: 2026-03-30 after roadmap creation*
