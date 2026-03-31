---
phase: 1
slug: foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-30
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 3.x |
| **Config file** | `vitest.config.ts` — Wave 0 installs |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run --coverage` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run --coverage`
- **Before `/gsd:verify-work`:** Full suite must be green, coverage 100% on `src/lib/underwriting/`
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| scaffold | 01-01 | 1 | DB-01–DB-08 | migration | `npx supabase db push && npx supabase db diff` | ❌ W0 | ⬜ pending |
| rls-policies | 01-01 | 1 | AUTH-04, DB-07 | sql query | `npx supabase db execute "SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename NOT IN (SELECT tablename FROM pg_tables t JOIN pg_policies p ON t.tablename = p.tablename)"` | ❌ W0 | ⬜ pending |
| auth-middleware | 01-02 | 2 | AUTH-02, AUTH-03 | manual | Navigate to `/` unauthenticated → redirects to `/login` | — | ⬜ pending |
| auth-session | 01-02 | 2 | AUTH-03 | manual | Log in, refresh browser → session persists | — | ⬜ pending |
| settings-seed | 01-03 | 3 | SETTINGS-07 | sql query | `npx supabase db execute "SELECT COUNT(*) FROM user_settings WHERE user_id = (SELECT id FROM auth.users WHERE email = $ADMIN_EMAIL)"` | ❌ W0 | ⬜ pending |
| pi-formula | 01-04 | 4 | UNDER-01 | unit | `npx vitest run src/lib/underwriting/__tests__/mortgage.test.ts` | ❌ W0 | ⬜ pending |
| noi-formula | 01-04 | 4 | UNDER-02 | unit | `npx vitest run src/lib/underwriting/__tests__/income.test.ts` | ❌ W0 | ⬜ pending |
| cap-rate | 01-04 | 4 | UNDER-03 | unit | `npx vitest run src/lib/underwriting/__tests__/metrics.test.ts` | ❌ W0 | ⬜ pending |
| coc-return | 01-04 | 4 | UNDER-04 | unit | `npx vitest run src/lib/underwriting/__tests__/metrics.test.ts` | ❌ W0 | ⬜ pending |
| dscr | 01-04 | 4 | UNDER-05 | unit | `npx vitest run src/lib/underwriting/__tests__/metrics.test.ts` | ❌ W0 | ⬜ pending |
| grm | 01-04 | 4 | UNDER-06 | unit | `npx vitest run src/lib/underwriting/__tests__/metrics.test.ts` | ❌ W0 | ⬜ pending |
| equity-projection | 01-04 | 4 | UNDER-07 | unit | `npx vitest run src/lib/underwriting/__tests__/equity.test.ts` | ❌ W0 | ⬜ pending |
| arv-equity | 01-04 | 4 | UNDER-08 | unit | `npx vitest run src/lib/underwriting/__tests__/equity.test.ts` | ❌ W0 | ⬜ pending |
| deal-score | 01-04 | 4 | UNDER-09 | unit | `npx vitest run src/lib/underwriting/__tests__/scoring.test.ts` | ❌ W0 | ⬜ pending |
| decimal-usage | 01-04 | 4 | UNDER-10 | grep | `grep -r "new Decimal\|Decimal(" src/lib/underwriting/ --include="*.ts" | grep -v test` | — | ⬜ pending |
| no-hardcoded-values | 01-04 | 4 | UNDER-11 | grep | `grep -rn "0\.18\|0\.09\|0\.08\|0\.10\|0\.05\|0\.025" src/lib/underwriting/ --include="*.ts" | grep -v test | grep -v comment` | — | ⬜ pending |
| pdf-render-local | 01-05 | 5 | PDF-03 | manual | Run `node scripts/test-pdf.js` → generates Internal + External PDF locally | — | ⬜ pending |
| pdf-render-vercel | 01-05 | 5 | PDF-03 | manual | Deploy to Vercel preview → POST /api/pdf/test → 200 with PDF URL | — | ⬜ pending |
| pdf-storage | 01-05 | 5 | PDF-05 | manual | PDF URL accessible from Supabase Storage, record in pdf_reports table | — | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/lib/underwriting/__tests__/mortgage.test.ts` — P&I test stubs (UNDER-01)
- [ ] `src/lib/underwriting/__tests__/income.test.ts` — NOI test stubs (UNDER-02)
- [ ] `src/lib/underwriting/__tests__/metrics.test.ts` — Cap rate, CoC, DSCR, GRM stubs (UNDER-03–06)
- [ ] `src/lib/underwriting/__tests__/equity.test.ts` — Equity Year N, ARV stubs (UNDER-07–08)
- [ ] `src/lib/underwriting/__tests__/scoring.test.ts` — Deal score composite stub (UNDER-09)
- [ ] `vitest.config.ts` — Vitest + coverage config
- [ ] `package.json` scripts: `"test": "vitest run"`, `"test:coverage": "vitest run --coverage"`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Auth redirect on unauthenticated access | AUTH-02 | Requires browser session state | Navigate to `/dashboard` without login → must redirect to `/login` |
| Session persistence across refresh | AUTH-03 | Browser state | Log in, hard-refresh → still authenticated |
| No public signup UI | AUTH-05 | UI behavior | Navigate to `/signup` → must 404 or redirect |
| Puppeteer PDF renders on Vercel preview | PDF-03 | Requires deployed environment | POST to preview URL `/api/pdf/test` → 200 with PDF bytes |
| DFW defaults seeded | SETTINGS-07 | Requires running DB | Query user_settings for admin user → property_tax_rate=0.018, mgmt_pct=0.09, etc. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
