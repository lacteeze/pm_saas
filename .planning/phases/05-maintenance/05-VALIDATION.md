---
phase: 5
slug: 05-maintenance
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-06-22
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (existing in canary-propos) |
| **Config file** | canary-propos/vitest.config.ts or package.json |
| **Quick run command** | `npm test -- --testPathPattern=work-orders` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- --testPathPattern=work-orders`
- **After every plan wave:** Run `npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 05-02-01 | 02 | 2 | MAINT-02 | T-05-01 | State machine rejects invalid transitions | unit | `npm test -- transitions` | ❌ W0 | ⬜ pending |
| 05-02-02 | 02 | 2 | MAINT-06 | T-05-02 | $500 gate routes to pending_approval | unit | `npm test -- work-orders-gate` | ❌ W0 | ⬜ pending |
| 05-05-01 | 05 | 3 | MAINT-07 | T-05-03 | Owner approval token is single-use (nullified after use) | unit | `npm test -- owner-approval` | ❌ W0 | ⬜ pending |
| 05-06-01 | 06 | 4 | MAINT-09 | T-05-04 | Expense created on work order completion | unit | `npm test -- expense-creation` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `canary-propos/src/lib/work-orders/transitions.test.ts` — unit tests for TRANSITIONS map (invalid state skips, role enforcement)
- [ ] `canary-propos/src/lib/work-orders/gate.test.ts` — $500 gate logic tests
- [ ] `canary-propos/src/lib/work-orders/owner-approval.test.ts` — token single-use + nullification

*05-02 Plan Task 1 (TDD) creates these test stubs before implementation.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Pingram SMS delivered to vendor phone | MAINT-04 | Requires real Pingram account + live Canadian number | Assign work order to non-portal vendor with valid phone; verify SMS received |
| Owner approve/decline email link works end-to-end | MAINT-07 | Email delivery + link navigation | Enter pending_approval state; verify email received; click approve link; verify status → assigned |
| Vendor no-login page updates status | MAINT-04 | Requires browser session without auth cookies | Open vendor_token URL in incognito; verify status can be updated |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-06-22
