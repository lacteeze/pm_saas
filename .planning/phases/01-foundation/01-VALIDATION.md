---
phase: 01
slug: foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-19
---

# Phase 01 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (unit/integration) + Playwright (E2E OAuth flows) |
| **Config file** | `vitest.config.ts` (Wave 0 — created in plan 01-01) |
| **Quick run command** | `node scripts/check-rls.ts && npx vitest run tests/rls/` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~30 seconds (no DB round-trips in unit tests; integration tests use Supabase test client) |

---

## Sampling Rate

- **After every task commit:** Run `node scripts/check-rls.ts && npx vitest run tests/rls/`
- **After every wave merge:** Run `npx vitest run`
- **Phase gate:** Full Vitest suite green + RLS linter passes before `/gsd:verify-work`

---

## Wave 0 Gaps (must exist before tests can run)

- [ ] `vitest.config.ts` — Vitest configuration with Supabase test client setup
- [ ] `tests/helpers/supabase-test-client.ts` — authenticated test client fixture per role
- [ ] `tests/rls/cross-org-isolation.test.ts` — most critical test in Phase 1
- [ ] `tests/auth/jwt-claims.test.ts` — verifies Auth Hook is wired correctly
- [ ] `scripts/check-rls.ts` — CI linter asserting `row_security = on` for every public table
- [ ] `playwright.config.ts` — Playwright for OAuth E2E (Google/Apple conditional on credentials)

---

## Requirements → Test Map

| Req ID | Behavior Under Test | Test Type | Command | File |
|--------|---------------------|-----------|---------|------|
| FOUND-01 | Email/password sign-up creates org + person record | Integration | `vitest run tests/auth/signup.test.ts` | Wave 0 |
| FOUND-02 | Google OAuth redirects to /dashboard for manager role | E2E (conditional) | `playwright test tests/e2e/google-oauth.spec.ts` | Wave 0 |
| FOUND-03 | Apple OAuth redirects correctly by role | E2E (conditional) | `playwright test tests/e2e/apple-oauth.spec.ts` | Wave 0 |
| FOUND-04 | Magic link sends email and confirms sign-in | Integration | `vitest run tests/auth/magic-link.test.ts` | Wave 0 |
| FOUND-05 | Cross-org data isolation (Org A cannot read Org B data) | Integration | `vitest run tests/rls/cross-org-isolation.test.ts` | Wave 0 — **CRITICAL** |
| FOUND-06 | JWT contains role, org_id, person_id after sign-in | Integration | `vitest run tests/auth/jwt-claims.test.ts` | Wave 0 |
| FOUND-07 | Admin sees all orgs; non-admin does not | Integration | `vitest run tests/rls/admin-access.test.ts` | Wave 0 |
| FOUND-08 | Manager can CRUD within own org | Integration | `vitest run tests/rls/manager-permissions.test.ts` | Wave 0 |
| FOUND-09 | Employee scoped CRUD (assigned only) | Integration | `vitest run tests/rls/employee-permissions.test.ts` | Wave 0 |
| FOUND-10 | Tenant cannot read another tenant's data within same org | Integration | `vitest run tests/rls/tenant-isolation.test.ts` | Wave 0 |
| FOUND-11 | Owner (client) sees only their portfolio data | Integration | `vitest run tests/rls/owner-isolation.test.ts` | Wave 0 |
| FOUND-12 | Vendor sees only assigned work orders | Integration | `vitest run tests/rls/vendor-isolation.test.ts` | Wave 0 |
| FOUND-13 | Every public table has RLS enabled | CI linter | `node scripts/check-rls.ts` | Wave 0 — **GATE** |
| FOUND-14 | No public Realtime channel subscriptions in codebase | Grep/lint | `grep -rn "private: false" src/ \| wc -l` (must be 0) | Static check |
| ORGS-01 | Org admin can invite managers/employees by email | Integration | `vitest run tests/orgs/invite-flow.test.ts` | Wave 0 |
| ORGS-02 | Invitee receives email with sign-up link, pre-associated with org+role | Integration | `vitest run tests/orgs/invite-flow.test.ts` | Wave 0 |
| ORGS-03 | Removed user's session revoked immediately | Integration | `vitest run tests/auth/session-revocation.test.ts` | Wave 0 |
| ORGS-04 | Organization profile stores name, logo, province | Integration | `vitest run tests/orgs/org-profile.test.ts` | Wave 0 |
| ORGS-05 | Organization has plan_unit_limit field | Integration | `vitest run tests/orgs/plan-limits.test.ts` | Wave 0 |
| ORGS-06 | System blocks INSERT when unit count >= plan_unit_limit | Integration | `vitest run tests/orgs/plan-limits.test.ts` | Wave 0 — **GATE** |

---

## Critical Gates (must pass before phase considered complete)

1. `node scripts/check-rls.ts` exits 0 (all public tables have RLS)
2. `vitest run tests/rls/cross-org-isolation.test.ts` exits 0
3. `vitest run tests/orgs/plan-limits.test.ts` exits 0 (ORGS-06 enforcement verified)
4. `vitest run tests/auth/jwt-claims.test.ts` exits 0
5. Full `npx vitest run` exits 0

---

## Assumptions

| # | Assumption | Risk if Wrong |
|---|-----------|---------------|
| A1 | Supabase project created in ca-central-1 | PIPEDA non-compliance; region cannot be changed |
| A2 | Refresh token reuse interval = 7 days implements D-10 | Users get logged out unexpectedly |
| A3 | Google/Apple OAuth credentials available for E2E tests | FOUND-02/FOUND-03 E2E tests are skipped; conditional pass |
