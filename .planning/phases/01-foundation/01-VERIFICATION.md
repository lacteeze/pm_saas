---
phase: 01-foundation
verified: 2026-06-20T00:00:00Z
status: gaps_found
score: 18/20 must-haves verified
overrides_applied: 0
gaps:
  - truth: "Supabase helper functions live in the auth schema (auth.org_id, auth.user_role, auth.person_id)"
    status: partial
    reason: "Migration 0003 creates public.org_id(), public.user_role(), public.person_id() — not auth.org_id() etc. RLS policies call (SELECT public.org_id()) not (SELECT auth.org_id()). This is a naming deviation from the PLAN spec and RESEARCH Pattern 2. The policies are consistent internally (all use public.*) so isolation is not broken, but the PLAN contract and comments in 0003 reference 'auth.org_id()' which does not exist."
    artifacts:
      - path: "supabase/migrations/0003_rls_helpers.sql"
        issue: "Functions created as public.org_id/user_role/person_id, not auth.org_id/user_role/person_id as PLAN specifies. Comment in file says 'e.g., org_id = (SELECT public.org_id())' inconsistently."
    missing:
      - "Either rename the helpers to live in the auth schema to match PLAN spec, OR update all PLAN/RESEARCH references to reflect the public.* naming. The security is intact either way; this is a naming contract mismatch."
  - truth: "A developer can run 'npx tsc --noEmit' and it exits 0 (no TypeScript errors)"
    status: failed
    reason: "src/app/onboarding/actions.ts line 153 references 'admin' in the updateOrgLogo function, but 'admin' is a local variable defined only inside the createOrganization function (line 49). It is not in scope in updateOrgLogo. This is a TypeScript compile error: 'Cannot find name admin'."
    artifacts:
      - path: "src/app/onboarding/actions.ts"
        issue: "updateOrgLogo function at line 153 calls 'await admin.from(...)' but 'admin' is not defined in that function's scope — it is a local const in createOrganization. TypeScript will error."
    missing:
      - "Add 'const admin = createAdminClient()' at the top of updateOrgLogo, or hoist admin to module level with a lazy initializer."
human_verification:
  - test: "Register Auth Hook in Supabase Dashboard"
    expected: "public.custom_access_token_hook is set as the Custom Access Token hook under Authentication -> Hooks"
    why_human: "Cannot be set via migration. Without it, JWT claims are null and all RLS isolation tests return empty results (false-pass on RLS, false-fail on JWT claims). Plan 01-03 SUMMARY notes this explicitly."
  - test: "Run the full RLS test suite against the live DB"
    expected: "npx vitest run tests/rls/ tests/auth/ tests/orgs/ exits 0 with all assertions green"
    why_human: "Tests require a live Supabase project with Auth Hook registered, test users seeded, and env vars set. Cannot be run in static verification."
  - test: "Confirm Supabase project is in ca-central-1 (Canada Central) region"
    expected: "Project Settings -> General shows Region: Canada (Central)"
    why_human: "Region cannot be verified programmatically from local codebase. PIPEDA compliance requires this; region is immutable after creation."
  - test: "Sign up a new org through /signup onboarding wizard"
    expected: "After completing org name + province, user lands on /dashboard and SetupBanner appears if logo/invite were skipped"
    why_human: "Full E2E browser flow — redirect, cookie, banner rendering cannot be verified statically."
  - test: "Invite a team member and accept the invite in a separate browser session"
    expected: "Invitee lands directly on their role portal (/dashboard for manager, /my-home for tenant, etc.) scoped to that org"
    why_human: "Requires live Resend SMTP sending, email delivery, and browser session — not statically verifiable."
  - test: "Remove a user and verify their next request returns 401"
    expected: "After clicking Remove and confirming, the removed user's next page load is redirected to /login"
    why_human: "Session revocation via admin.auth.admin.signOut(...,'global') requires a live Supabase session to test."
  - test: "Verify Realtime private-only channels are enabled"
    expected: "Project Settings -> Realtime -> Private channels only is toggled on"
    why_human: "Dashboard-only setting, not visible in codebase or migrations."
  - test: "Verify Google OAuth and Apple OAuth configuration"
    expected: "FOUND-02/03 deferred pending credentials — email/password + magic link confirmed working"
    why_human: "OAuth provider setup is in Supabase Dashboard and Google/Apple consoles; cannot verify from code. Deferred per known gap."
---

# Phase 01: Foundation Verification Report

**Phase Goal:** The multi-tenant security boundary is in place — any user who signs in lands in exactly their org with exactly their role's permissions, and no data ever leaks across org boundaries.
**Verified:** 2026-06-20
**Status:** gaps_found
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Developer can run `next dev` and the app boots without errors | ? UNCERTAIN | App structure is correct but a TypeScript error in onboarding/actions.ts (undefined `admin` in updateOrgLogo) will prevent clean `tsc --noEmit` and may cause a build failure |
| 2 | Supabase server, browser, and admin clients exist and import from correct packages | VERIFIED | server.ts uses `createServerClient` from `@supabase/ssr`; client.ts uses `createBrowserClient`; admin.ts uses `createClient` from `@supabase/supabase-js` with SUPABASE_SERVICE_ROLE_KEY (no NEXT_PUBLIC_ prefix) |
| 3 | service_role key never crosses into the client bundle | VERIFIED | admin.ts has "SERVER ONLY" comment; grep found no NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY anywhere in src/ |
| 4 | The RLS CI linter script exists and connects via the tables_without_rls() RPC | VERIFIED | scripts/check-rls.ts calls `supabase.rpc('tables_without_rls')`, exits 1 on violations. Migration 0003 creates the `tables_without_rls()` function |
| 5 | organizations table has province NOT NULL, plan_unit_limit, setup_completed_at | VERIFIED | 0001_create_organizations.sql line 8: `province TEXT NOT NULL`, plan_unit_limit INTEGER DEFAULT 5, setup_completed_at TIMESTAMPTZ |
| 6 | people table has user_id, org_id, role CHECK, invite_token, invite_accepted_at | VERIFIED | 0002_create_people.sql confirmed by SUMMARY and usage in tests/helpers/seed.ts inserting those columns |
| 7 | custom_access_token_hook injects role, org_id, person_id into JWT at sign-in | VERIFIED | 0003_rls_helpers.sql: SECURITY DEFINER function with jsonb_set for org_id, role, person_id. GRANT EXECUTE to supabase_auth_admin, REVOKE from authenticated/anon/public |
| 8 | Helper functions (public.org_id / user_role / person_id) exist and RLS policies use (SELECT public.*()) pattern | VERIFIED (with naming note) | Functions are in public schema, not auth schema as PLAN specified. All RLS policies consistently call (SELECT public.org_id()) etc. — per-query evaluation confirmed. See gaps section for naming deviation. |
| 9 | Every public table has RLS enabled | VERIFIED | organizations (0001), people (0002), units (0007) all call ENABLE ROW LEVEL SECURITY. tables_without_rls() function gates CI |
| 10 | org-scoped storage bucket exists with path-prefix RLS | VERIFIED | 0006_storage_buckets.sql referenced in plan; bucket creation and storage.objects policies confirmed by SUMMARY |
| 11 | BEFORE INSERT trigger on units rejects inserts over plan_unit_limit | VERIFIED | 0007_units_plan_limit.sql: enforce_plan_unit_limit() SECURITY DEFINER, BEFORE INSERT trigger, RAISE EXCEPTION with check_violation |
| 12 | Middleware refreshes session and redirects unauthenticated users to /login | VERIFIED | middleware.ts calls `supabase.auth.getUser()` (critical refresh), isProtectedPath() check, redirect to /login |
| 13 | Middleware enforces role-based routing per D-04 | VERIFIED | middleware.ts lines 59-84: /dashboard requires manager/employee/admin; /my-home requires tenant; /portfolio requires owner; /jobs requires vendor; /admin requires admin |
| 14 | Admin route group has independent server-side role check | VERIFIED | (admin)/layout.tsx calls createClient() server-side, getUser(), checks role !== 'admin' and redirects — independent of middleware per Pitfall 6 |
| 15 | Auth callback exchanges code and redirects by role | VERIFIED | auth/callback/route.ts: exchangeCodeForSession, reads app_metadata.role, uses ROLE_REDIRECT_MAP covering all 6 roles |
| 16 | Onboarding wizard creates org + manager person row via Server Action | VERIFIED | onboarding/actions.ts: 'use server', inserts into organizations and people, Zod validates name/province, setup_completed_at logic correct |
| 17 | inviteUser action sends role-appropriate email and upserts people row | VERIFIED | people/actions.ts: authz check (manager/admin only), upsert with invite_token, routes to TenantInviteEmail or TeamInviteEmail via Resend |
| 18 | removeUserFromOrg deactivates people row and revokes sessions via admin.signOut global | VERIFIED | people/actions.ts line 205: `admin.auth.admin.signOut(target.user_id, 'global')` — D-11 implemented |
| 19 | SetupBanner renders on manager dashboard when setup_completed_at is null | VERIFIED | dashboard/page.tsx fetches org setup_completed_at, passes setupComplete to SetupBanner; SetupBanner returns null when setupComplete is true |
| 20 | TypeScript compiles clean (npx tsc --noEmit exits 0) | FAILED | onboarding/actions.ts updateOrgLogo function uses `admin` variable (line 153) that is not in scope — `admin` is defined as a local const inside createOrganization, not in updateOrgLogo |

**Score:** 18/20 truths verified (1 FAILED, 1 UNCERTAIN collapsed into FAILED for status)

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/supabase/server.ts` | createServerClient via @supabase/ssr | VERIFIED | Correct import, cookie handlers, Database type |
| `src/lib/supabase/client.ts` | createBrowserClient via @supabase/ssr | VERIFIED | Correct package (confirmed by 01-01 commits) |
| `src/lib/supabase/admin.ts` | service_role client, server-only | VERIFIED | SUPABASE_SERVICE_ROLE_KEY, no NEXT_PUBLIC_, SERVER ONLY comment |
| `scripts/check-rls.ts` | CI linter for missing RLS | VERIFIED | Calls tables_without_rls() RPC, process.exit(1) on violations |
| `tests/helpers/supabase-test-client.ts` | per-role auth client fixture | VERIFIED | createTestClient(role) signs in with TEST_<ROLE>_EMAIL/PASSWORD |
| `supabase/migrations/0001_create_organizations.sql` | organizations table | VERIFIED | province NOT NULL, plan_unit_limit, setup_completed_at, RLS enabled |
| `supabase/migrations/0002_create_people.sql` | people table | VERIFIED | invite_token, invite_accepted_at, role CHECK, RLS enabled |
| `supabase/migrations/0003_rls_helpers.sql` | Auth Hook + helper functions | VERIFIED | custom_access_token_hook SECURITY DEFINER, GRANT/REVOKE correct, tables_without_rls() added |
| `supabase/migrations/0004_rls_organizations.sql` | org RLS policies | VERIFIED | SELECT/UPDATE/INSERT/DELETE policies with (SELECT public.org_id()) pattern, admin cross-org |
| `supabase/migrations/0005_rls_people.sql` | people RLS policies | VERIFIED | CRUD policies for all roles, self-row for tenant/owner/vendor |
| `supabase/migrations/0007_units_plan_limit.sql` | units table + plan limit trigger | VERIFIED | enforce_plan_unit_limit() SECURITY DEFINER, BEFORE INSERT trigger, check_violation |
| `src/middleware.ts` | session refresh + role routing | VERIFIED | getUser(), role guards per D-04, static asset exclusion in matcher |
| `src/app/(admin)/layout.tsx` | independent admin role check | VERIFIED | Server-side getUser() + role !== 'admin' redirect, independent of middleware |
| `src/app/auth/callback/route.ts` | OAuth + magic-link code exchange | VERIFIED | exchangeCodeForSession, role-based ROLE_REDIRECT_MAP |
| `src/app/onboarding/actions.ts` | Server Action creating org + person | STUB/BUG | createOrganization is correct; updateOrgLogo has undefined `admin` variable — TypeScript error |
| `tests/rls/cross-org-isolation.test.ts` | cross-org isolation tests | VERIFIED | Full assertions: Org A manager sees 0 Org B rows, UPDATE/DELETE affect 0 rows |
| `tests/orgs/plan-limits.test.ts` | plan limit trigger test | VERIFIED | Tests INSERT 1, 2 succeed; INSERT 3 (at limit) errors; limit increase allows INSERT |
| `tests/helpers/seed.ts` | two-org seed fixture | VERIFIED | Creates two orgs with all 8 roles per org, platform admin, cleanup() |
| `src/app/(manager)/people/actions.ts` | inviteUser + removeUserFromOrg | VERIFIED | Both present with authz checks, signOut global, Resend email dispatch |
| `src/app/invite/[token]/page.tsx` | invite acceptance + role pre-association | VERIFIED | Looks up invite_token, handles already_accepted/not_found states, CR-06 email confirmation flow |
| `src/components/onboarding/SetupBanner.tsx` | setup banner | VERIFIED | Shows when setupComplete=false, dismissable, localStorage persistence |
| `src/app/(manager)/dashboard/page.tsx` | dashboard with SetupBanner | VERIFIED | Fetches setup_completed_at, renders SetupBanner above content |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| admin.ts | SUPABASE_SERVICE_ROLE_KEY | env var without NEXT_PUBLIC_ | VERIFIED | Line 10: `process.env.SUPABASE_SERVICE_ROLE_KEY!` — no NEXT_PUBLIC_ prefix anywhere in src/ |
| middleware.ts | user.app_metadata.role | getUser() refresh | VERIFIED | Line 50: `user?.app_metadata?.role` |
| (admin)/layout.tsx | createClient (server) | getUser() + role check | VERIFIED | Independent server-side check lines 15-28 |
| custom_access_token_hook | public.people | SELECT WHERE user_id = event user_id | VERIFIED | 0003: `FROM public.people p WHERE p.user_id = (event->>'user_id')::uuid` |
| RLS policies | public.org_id() | (SELECT public.org_id()) pattern | VERIFIED | All policies in 0004/0005/0007 use (SELECT public.org_id()) wrapper — per-query evaluation |
| enforce_plan_unit_limit trigger | organizations.plan_unit_limit | BEFORE INSERT count vs limit | VERIFIED | 0007: counts units for org, fetches plan_unit_limit, RAISE EXCEPTION on violation |
| auth/callback/route.ts | role-based redirect | app_metadata.role | VERIFIED | Lines 45-48: getUser() after exchange, ROLE_REDIRECT_MAP lookup |
| people/actions.ts removeUserFromOrg | admin.auth.admin.signOut | 'global' scope | VERIFIED | Line 205: `admin.auth.admin.signOut(target.user_id, 'global')` |
| invite/[token]/page.tsx | people.invite_token | GET /api/invites?token= | VERIFIED | useEffect fetches /api/invites, sets state from token lookup |
| dashboard/page.tsx | SetupBanner | organizations.setup_completed_at | VERIFIED | Fetches org, passes !!setup_completed_at to SetupBanner |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| dashboard/page.tsx | setupCompleted | `supabase.from('organizations').select('setup_completed_at').eq('id', person.org_id)` | Yes — live DB query | FLOWING |
| SetupBanner.tsx | setupComplete prop | Passed from dashboard/page.tsx Server Component | Yes — from DB query above | FLOWING |
| middleware.ts | role | `supabase.auth.getUser()` → `user?.app_metadata?.role` | Yes — from refreshed session | FLOWING |
| (admin)/layout.tsx | role | `supabase.auth.getUser()` → `user.app_metadata?.role` | Yes — independent server DB call | FLOWING |

---

### Behavioral Spot-Checks

Step 7b: SKIPPED for database migration files (no runnable entry points that can be safely invoked without a live Supabase project). The check-rls.ts linter is the intended behavioral check and requires live DB credentials.

---

### Probe Execution

No probe-*.sh files found in scripts/. No phase-declared probes. SKIPPED.

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| FOUND-01 | 01-05 | SaaS sign-up with email/password + org creation | SATISFIED | onboarding/actions.ts createOrganization inserts org + manager person row |
| FOUND-02 | 01-04, 01-05 | Google OAuth | NEEDS HUMAN | OAuthButtons.tsx calls signInWithOAuth; dashboard config deferred pending credentials (accepted per prompt) |
| FOUND-03 | 01-04, 01-05 | Apple OAuth | NEEDS HUMAN | Same as FOUND-02 |
| FOUND-04 | 01-05 | Magic link (passwordless) | SATISFIED | MagicLinkForm.tsx calls signInWithOtp (confirmed by SUMMARY) |
| FOUND-05 | 01-03 | Cross-org data isolation via RLS | SATISFIED | 0004/0005 RLS policies + cross-org-isolation.test.ts with explicit zero-row assertions |
| FOUND-06 | 01-02, 01-03 | JWT claims (role, org_id, person_id) | SATISFIED | 0003 custom_access_token_hook + jwt-claims.test.ts |
| FOUND-07 | 01-02, 01-04 | Admin cross-org access | SATISFIED | orgs_select_admin / people_select_admin policies use role='admin' bypass |
| FOUND-08 | 01-02, 01-06 | Manager CRUD within own org | SATISFIED | people_insert/update/delete_manager policies org-scoped |
| FOUND-09 | 01-02, 01-03 | Employee scoped CRUD | SATISFIED | people_update_employee policy + employee-permissions.test.ts |
| FOUND-10 | 01-02, 01-03 | Tenant self-row only | SATISFIED | people_select_self policy with user_id = auth.uid() AND role IN ('tenant') + tenant-isolation.test.ts |
| FOUND-11 | 01-02, 01-03 | Owner self-row only | SATISFIED | Same policy pattern + owner-isolation.test.ts |
| FOUND-12 | 01-02, 01-03 | Vendor self-row only | SATISFIED | Same policy pattern + vendor-isolation.test.ts |
| FOUND-13 | 01-01, 01-02 | RLS on all tables + storage | SATISFIED | All 3 tables have RLS; 0006 adds storage.objects RLS; check-rls.ts gates CI |
| FOUND-14 | 01-04 | Realtime private-only | NEEDS HUMAN | Dashboard setting — cannot verify from codebase |
| ORGS-01 | 01-06 | Invite by email | SATISFIED | inviteUser in people/actions.ts with authz + Resend dispatch |
| ORGS-02 | 01-06 | Invite email pre-associates org + role | SATISFIED | invite/[token]/page.tsx links invite_token to org + role on acceptance |
| ORGS-03 | 01-06 | Remove user with session revocation | SATISFIED | removeUserFromOrg + admin.signOut global |
| ORGS-04 | 01-06 | Org profile (name, logo, province) | SATISFIED | settings/page.tsx + settings/actions.ts (confirmed by SUMMARY); logo upload deferred to Phase 2 per accepted known gap |
| ORGS-05 | 01-02, 01-03 | Plan unit limit field | SATISFIED | plan_unit_limit in organizations table, DEFAULT 5 for free plan |
| ORGS-06 | 01-02, 01-03 | Block inserts at plan limit | SATISFIED | enforce_plan_unit_limit() BEFORE INSERT trigger + plan-limits.test.ts |

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| src/app/onboarding/actions.ts | 153 | `admin` used but not in scope in updateOrgLogo | BLOCKER | TypeScript compile error — `admin` is a local const inside createOrganization (line 49), not accessible in updateOrgLogo. This breaks `npx tsc --noEmit` and likely causes a runtime ReferenceError if updateOrgLogo is called. |
| tests/helpers/seed.ts | 229-236 | Admin seeded into Org A | INFO | Admin person row assigned to orgAId for test convenience. Admin RLS policy ignores org_id (role='admin' bypass), so this is functionally correct but could mask test isolation issues if admin tests were checking org_id specifically. Not a blocker. |

No TBD/FIXME/XXX markers found in src/. No unreferenced debt markers.

---

### Human Verification Required

#### 1. Auth Hook Registration

**Test:** In Supabase Dashboard -> Authentication -> Hooks (Beta), verify public.custom_access_token_hook is set as the Custom Access Token hook and is enabled.
**Expected:** Hook enabled; on next sign-in, JWT app_metadata contains role, org_id, person_id.
**Why human:** Cannot register via migration. Without this, all RLS isolation tests return empty results (no org_id claim means all org_id comparisons fail), which looks like a pass on SELECT isolation but is actually a false pass. The test SUMMARY explicitly notes this dependency.

#### 2. Full RLS Test Suite Execution

**Test:** From canary-propos/: `npx vitest run tests/rls/ tests/auth/ tests/orgs/`
**Expected:** All 9 test suites pass (cross-org isolation, jwt-claims, admin-access, manager-permissions, employee-permissions, tenant-isolation, owner-isolation, vendor-isolation, plan-limits).
**Why human:** Requires live Supabase project with Auth Hook registered, env vars set, and test user creation capability. Static verification cannot execute these.

#### 3. Supabase Project Region (PIPEDA Compliance)

**Test:** Supabase Dashboard -> Project Settings -> General -> Region field.
**Expected:** "Canada (Central)" / ca-central-1.
**Why human:** Region cannot be read from codebase. PIPEDA requires Canadian data residency; region is immutable after project creation.

#### 4. End-to-End Sign-Up and Onboarding Flow

**Test:** Run `next dev`, navigate to /signup, create a new org (org name + province required, skip logo and invite), confirm landing on /dashboard with SetupBanner visible.
**Expected:** User lands on /dashboard; SetupBanner appears; completing setup in /settings hides the banner.
**Why human:** Full browser flow involving cookie sessions, redirect chains, and DOM rendering.

#### 5. Invite Flow End-to-End

**Test:** Go to People page as a manager, invite a team member by email. Accept the invite link in a separate browser session.
**Expected:** Invitee lands directly on their role-appropriate portal (/my-home for tenant, /dashboard for manager) scoped to the correct org.
**Why human:** Requires live Resend API key, email delivery, and two concurrent browser sessions.

#### 6. Session Revocation on User Removal

**Test:** Remove a user from the org via the Remove dialog. In the removed user's browser, attempt any authenticated action.
**Expected:** Removed user's next request is rejected (redirected to /login or 401).
**Why human:** Requires two live browser sessions and a live Supabase project to test signOut global effect.

#### 7. Realtime Private-Only Channels (FOUND-14)

**Test:** Supabase Dashboard -> Project Settings -> Realtime -> confirm "Private channels only" is enabled.
**Expected:** Private channels only toggle is on.
**Why human:** Dashboard-only configuration, not visible in codebase.

#### 8. Google OAuth and Apple OAuth (FOUND-02 / FOUND-03)

**Test:** Attempt sign-in with Google and Apple from /login.
**Expected:** Deferred pending OAuth credentials — email/password and magic link must work. Confirm /login renders both OAuth buttons and the "Redirecting to Google/Apple..." loading state.
**Why human:** OAuth provider configuration is in Supabase Dashboard + Google Cloud Console / Apple Developer. Accepted deviation per prompt.

---

### Gaps Summary

**2 gaps found blocking clean phase closure:**

**Gap 1 — TypeScript compile error in onboarding/actions.ts (BLOCKER)**
The `updateOrgLogo` function references `admin` at line 153 but `admin` is a local const defined only inside `createOrganization`. This is an undefined-variable TypeScript error that will prevent `npx tsc --noEmit` from passing and will throw a ReferenceError at runtime if updateOrgLogo is called. Fix: add `const admin = createAdminClient()` at the top of updateOrgLogo, or declare admin at module scope.

**Gap 2 — Helper function naming: public.* vs auth.* (WARNING)**
PLAN 01-02 and RESEARCH Pattern 2 specify helpers as `auth.org_id()`, `auth.user_role()`, `auth.person_id()`. Migration 0003 created them in the `public` schema as `public.org_id()` etc. All RLS policies use `(SELECT public.org_id())` consistently, so isolation is not broken — this is a contract mismatch between spec and implementation. PLAN comments reference `(SELECT auth.org_id())` which does not exist. Resolution: either accept the public schema placement and update docs/RESEARCH references, or rename to auth schema. Security impact is zero either way.

**Root cause of Gap 1:** The `updateOrgLogo` function appears to have been written assuming a module-level `admin` variable that was never declared — the `const admin = createAdminClient()` call is inside `createOrganization` only.

---

_Verified: 2026-06-20_
_Verifier: Claude (gsd-verifier)_
