# DealStack

## What This Is

DealStack is a full-stack agentic real estate deal analysis SaaS for buy-and-hold investors. It automates property discovery, underwriting, market analysis, and report generation — culminating in professional PDF investment memos. Built initially as a private single-user tool (Phase 0), architected as multi-tenant SaaS from day one so Phase 1 (public onboarding, billing) requires zero schema migrations or architectural rewrites.

## Core Value

A real estate investor should be able to go from address → full underwriting + market analysis → professional PDF report without manual data gathering — with every assumption driven by their personal investment profile, not hardcoded defaults.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Multi-tenant database schema with RLS — every user-scoped table has user_id FK; row-level security enforced at DB level
- [ ] Supabase Auth — invite-only Phase 0; admin account seeded via .env; auth middleware protects all routes
- [ ] Per-user settings model — target market, price ceiling, down payment %, underwriting assumptions, acquisition goal, alert email, cron interval
- [ ] Underwriting engine — P&I, NOI, cap rate, CoC, DSCR, GRM, equity projections, deal score — 100% unit test coverage
- [ ] PDF report generation (Puppeteer) — Internal (dense) and External (clean/shareable) modes
- [ ] DataService abstraction layer — cache-first, provider-swappable, all API calls routed through it
- [ ] Rentcast API integration — property details, rent estimate, sale/rental comps, market trends; 50-call global limit enforced with api_cache + api_usage_log
- [ ] Census ACS API integration — median income, population growth, housing vacancy by census tract; 90-day cache
- [ ] Census Geocoder integration — address → lat/long + FIPS; permanent cache
- [ ] Walk Score API integration — walk/transit/bike scores; permanent cache per address
- [ ] Finder Agent — web_search for active listings matching user's configured criteria; outputs shortlist for user approval; supports scheduled cron + manual trigger
- [ ] Market Analysis Agent — Census + Walk Score + web_search → market score 0–100 + narrative
- [ ] Underwriting Agent — Rentcast data + user assumptions → full proforma; fixer-upper renovation + ARV scenarios
- [ ] Comparables Agent — reuses Rentcast comps from underwriting agent; web_search supplemental
- [ ] Verdict Agent — deal score 0–100 (weighted composite), GO/CAUTIOUS GO/NO, stores in DB
- [ ] Deal pipeline — Kanban (Prospect → Analyzed → Offer Made → Acquired → Pass); all user-scoped
- [ ] Full UI — 9 screens: Dashboard, Discovery, Pipeline, Analysis (streaming), Deal Detail, Compare, Portfolio, Settings, Admin
- [ ] Email digest — alert email via Resend/Nodemailer on scheduled finder runs
- [ ] Portfolio model — aggregate Acquired properties; equity curve, cash flow over time, acquisition goal progress

### Out of Scope

- Public signup/onboarding UI — deferred to Phase 1 SaaS launch
- Stripe billing integration — schema-ready (stripe_customer_id, plan, plan_status, plan_limits on users table) but no integration built
- Team/organization accounts — deferred to Phase 1
- White-label external PDFs per user — deferred (logo + accent color settings captured, rendering deferred)
- Public marketing site — deferred to Phase 1
- Paid API tiers — all integrations use free tiers only

## Context

- **Investor profile (owner's defaults):** DFW market, target submarkets Arlington/Garland/Irving/Grand Prairie/Las Colinas, SFR + small multifamily, $400K price ceiling, buy-and-hold, 20% down, appreciation + equity strategy, goal 5 rentals over 5 years
- **Underwriting defaults (all per-user, overridable):** property tax 1.8%, mgmt 9%, vacancy 8%, maintenance 10%, CapEx 5%, closing costs 2.5%
- **API budget:** Rentcast is free tier with hard 50 calls/month global limit — cache-first is non-negotiable, not a nice-to-have
- **Single-user Phase 0:** No public access. Admin account seeded on deploy. All architecture must serve multi-tenant from day one anyway.
- **Deployment target:** Vercel (frontend + API routes) + Supabase (Postgres + Auth + Storage). Local dev via .env switching.
- **AI:** Anthropic Claude API (claude-sonnet-4-5) with web_search tool for all agents

## Constraints

- **Tech Stack**: Next.js 14 App Router + TypeScript + Tailwind CSS + Supabase (Postgres + Auth) — locked
- **Auth**: Supabase Auth — chosen over Clerk for native RLS integration (auth.uid() in policies)
- **PDF**: Puppeteer/Playwright — chosen for full CSS fidelity on professional investment memos
- **APIs**: Free tiers only — Rentcast (50/mo), Census ACS (unlimited), Census Geocoder (no key), Walk Score (free tier), web_search (always available)
- **Multi-tenancy**: Every user-data table must have user_id FK + RLS from day one — no exceptions, no shortcuts
- **TDD**: All underwriting math (P&I, NOI, cap rate, CoC, DSCR, GRM, equity, deal score) must have unit tests before any UI is built

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Supabase Auth over Clerk | Same SDK as DB; RLS policies reference auth.uid() natively; no user ID sync needed | — Pending |
| Puppeteer/Playwright for PDF | Full CSS support required for professional investment memo aesthetic | — Pending |
| Cache-first API strategy | Rentcast 50-call/month global limit is binding; caching is an architectural requirement | — Pending |
| Multi-tenant from Phase 0 | Schema migrations to add RLS/user_id after launch are risky and expensive | — Pending |
| Stripe schema-ready, not integrated | Defers billing complexity while enabling Phase 1 with config-only changes | — Pending |
| All agent assumptions read from user settings | Makes product work for any US market/investor without code changes | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-03-30 after initialization*
