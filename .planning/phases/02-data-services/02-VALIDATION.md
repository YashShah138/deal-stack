---
phase: 2
slug: data-services
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-08
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `MOCK_APIS=true npx vitest run --reporter=verbose` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `MOCK_APIS=true npx vitest run --reporter=verbose`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 2-01-01 | 01 | 1 | DATA-01 | unit | `npx vitest run src/lib/data/__tests__/data-service.test.ts` | ❌ W0 | ⬜ pending |
| 2-01-02 | 01 | 1 | DATA-02 | unit | `npx vitest run src/lib/data/__tests__/cache.test.ts` | ❌ W0 | ⬜ pending |
| 2-01-03 | 01 | 1 | DATA-03 | unit | `npx vitest run src/lib/data/__tests__/address-normalize.test.ts` | ❌ W0 | ⬜ pending |
| 2-02-01 | 02 | 1 | RENT-01 | unit | `npx vitest run src/lib/data/__tests__/rentcast.test.ts` | ❌ W0 | ⬜ pending |
| 2-02-02 | 02 | 1 | RENT-05 | unit | `npx vitest run src/lib/data/__tests__/rentcast-quota.test.ts` | ❌ W0 | ⬜ pending |
| 2-03-01 | 03 | 2 | CENSUS-01 | unit | `npx vitest run src/lib/data/__tests__/census.test.ts` | ❌ W0 | ⬜ pending |
| 2-03-02 | 03 | 2 | WALK-01 | unit | `npx vitest run src/lib/data/__tests__/walkscore.test.ts` | ❌ W0 | ⬜ pending |
| 2-04-01 | 04 | 2 | DATA-04 | integration | `MOCK_APIS=true npx vitest run src/lib/data/__tests__/integration.test.ts` | ❌ W0 | ⬜ pending |
| 2-04-02 | 04 | 2 | DATA-05 | integration | `MOCK_APIS=true npx vitest run src/lib/data/__tests__/usage-log.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/lib/data/__tests__/data-service.test.ts` — stubs for DATA-01 (DataService interface enforcement)
- [ ] `src/lib/data/__tests__/cache.test.ts` — stubs for DATA-02 (cache hit/miss verification)
- [ ] `src/lib/data/__tests__/address-normalize.test.ts` — stubs for DATA-03 (normalization correctness)
- [ ] `src/lib/data/__tests__/rentcast.test.ts` — stubs for RENT-01 through RENT-04
- [ ] `src/lib/data/__tests__/rentcast-quota.test.ts` — stubs for RENT-05, RENT-06 (50-call monthly limit)
- [ ] `src/lib/data/__tests__/census.test.ts` — stubs for CENSUS-01, CENSUS-02
- [ ] `src/lib/data/__tests__/walkscore.test.ts` — stubs for WALK-01
- [ ] `src/lib/data/__tests__/integration.test.ts` — stubs for DATA-04 (zero real network with MOCK_APIS=true)
- [ ] `src/lib/data/__tests__/usage-log.test.ts` — stubs for DATA-05 (api_usage_log recording)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Rentcast quota resets on calendar month boundary | RENT-05 | Requires time manipulation or live API | Manually set quota count to 50, observe blocked response, advance clock |
| Walk Score results match expected walkability for known DFW addresses | WALK-01 | Requires live Walk Score API call | Call with 3 known DFW addresses, verify scores are non-zero and plausible |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
