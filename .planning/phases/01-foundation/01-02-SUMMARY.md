---
phase: 01-foundation
plan: 02
subsystem: database
tags: [postgres, supabase, rls, jwt, auth-hook, multi-tenant, storage]

requires:
  - phase: 01-01
    provides: Next.js scaffold, Supabase client factories, RLS CI linter script

provides:
  - organizations table with province NOT NULL, plan_type, plan_unit_limit, setup_completed_at
  - people table with 6-role RBAC CHECK, invite_token UNIQUE, invite_accepted_at
  - custom_access_token_hook SECURITY DEFINER injecting org_id/role/person_id into JWT app_metadata
  - public.org_id(), public.user_role(), public.person_id() stable helper functions
  - Per-role RLS policies on organizations, people, units (SELECT-wrapped pattern)
  - org-assets storage bucket with org_id first-path-segment RLS
  - units table with BEFORE INSERT enforce_plan_unit_limit() trigger (ORGS-06 final gate)
  - Generated TypeScript Database types in src/types/supabase.ts
  - Auth Hook registration checklist in docs/supabase-auth-config.md

affects: [01-03, 01-04, 01-05, 01-06, all subsequent phases]

tech-stack:
  added: []
  patterns:
    - "RLS SELECT-wrapper: (SELECT public.org_id()) on every policy — per-query not per-row evaluation"
    - "JWT custom claims via SECURITY DEFINER Auth Hook — not client-assembled"
    - "public schema for JWT helpers — auth schema write access denied by Supabase"
    - "DB BEFORE INSERT trigger as final gate for plan limits (ORGS-06)"
    - "Migrations only — no Dashboard SQL editor schema changes (Pitfall 7)"

key-files:
  created:
    - supabase/migrations/0001_create_organizations.sql
    - supabase/migrations/0002_create_people.sql
    - supabase/migrations/0003_rls_helpers.sql
    - supabase/migrations/0004_rls_organizations.sql
    - supabase/migrations/0005_rls_people.sql
    - supabase/migrations/0006_storage_buckets.sql
    - supabase/migrations/0007_units_plan_limit.sql
    - src/types/supabase.ts
    - docs/supabase-auth-config.md
  modified: []

key-decisions:
  - "JWT helpers in public schema (public.org_id etc.) — Supabase denies user writes to auth schema"
  - "All RLS policies use (SELECT public.org_id()) wrapper — prevents per-row function re-evaluation"
  - "enforce_plan_unit_limit() BEFORE INSERT trigger is authoritative gate for ORGS-06 — UI pre-check deferred to Phase 2"
  - "Auth Hook registration documented in docs/supabase-auth-config.md — must be done manually in Supabase Dashboard"

patterns-established:
  - "Pattern 1: RLS SELECT-wrapper — wrap every helper call: (SELECT public.org_id()), never bare"
  - "Pattern 2: JWT claims via Auth Hook — role/org_id/person_id from app_metadata, never client-assembled"
  - "Pattern 3: DB trigger as final gate — plan limits enforced at INSERT level, not UI"
  - "Pattern 4: Migrations only — supabase/migrations/ is the only way schema changes happen"

requirements-completed: [FOUND-05, FOUND-06, FOUND-07, FOUND-08, FOUND-09, FOUND-10, FOUND-11, FOUND-12, FOUND-13, ORGS-04, ORGS-05, ORGS-06]

duration: 90min
completed: 2026-06-20
---

# Phase 01 Plan 02: Database Schema and RLS Security Layer Summary

**Seven migrations define organizations/people/units tables, a JWT custom-claims Auth Hook, per-role RLS policies, org-scoped storage bucket, and a plan-limit BEFORE INSERT trigger — all applied to the remote ca-central-1 Supabase project with generated TypeScript types**

## Performance

- **Duration:** ~90 min
- **Started:** 2026-06-19
- **Completed:** 2026-06-20
- **Tasks:** 5 (4 auto + 1 documentation checkpoint)
- **Files modified:** 9

## Accomplishments

- Seven migration files authored and pushed to the remote Supabase project (ca-central-1); RLS linter exits 0
- JWT custom-claims Auth Hook (`custom_access_token_hook`) defined as SECURITY DEFINER; injects `org_id`, `role`, `person_id` into JWT `app_metadata` at every sign-in
- Per-role RLS policies on all three tables using `(SELECT public.org_id())` performance wrapper
- `enforce_plan_unit_limit()` BEFORE INSERT trigger physically rejects unit inserts beyond `plan_unit_limit` (ORGS-06)
- Generated TypeScript Database types replacing the `Database = any` stub

## Task Commits

1. **Task 1: Organizations and people table migrations** — `f0703d3` (feat)
2. **Task 2: Auth Hook, RLS helpers, and per-role RLS policies** — `c1e4ed2`, `2c40d5a` (feat)
3. **Task 3: Units table + plan-limit enforcement trigger** — `55ba5a4` (feat)
4. **Schema push fix — public schema migration** — `d052088` (fix)
5. **Migration authoring checkpoint** — `94c51f1` (docs)
6. **Task 5: Generate Database types** — `a2571cc` (feat)
7. **Task 4: Auth Hook registration docs** — `f1c786f` (docs)

## Files Created/Modified

- `supabase/migrations/0001_create_organizations.sql` — organizations table; province NOT NULL, plan_type CHECK, plan_unit_limit, setup_completed_at; RLS enabled
- `supabase/migrations/0002_create_people.sql` — people table; 6-role CHECK, invite_token UNIQUE, invite_accepted_at, indexes on org_id/user_id/invite_token; RLS enabled
- `supabase/migrations/0003_rls_helpers.sql` — custom_access_token_hook SECURITY DEFINER; public.org_id/user_role/person_id helpers; tables_without_rls() CI RPC
- `supabase/migrations/0004_rls_organizations.sql` — per-role SELECT/UPDATE on organizations; admin cross-org
- `supabase/migrations/0005_rls_people.sql` — per-role CRUD on people; non-staff self-read only
- `supabase/migrations/0006_storage_buckets.sql` — org-assets bucket; storage.objects gated on first path segment matching org_id
- `supabase/migrations/0007_units_plan_limit.sql` — units table with RLS; enforce_plan_unit_limit() BEFORE INSERT trigger
- `src/types/supabase.ts` — generated Database types (organizations, people, units, storage)
- `docs/supabase-auth-config.md` — Auth Hook registration checklist for Supabase Dashboard

## Decisions Made

- **JWT helpers in public schema:** Supabase denies user-defined function writes to the `auth` schema. All three helpers (`org_id`, `user_role`, `person_id`) are under `public`; all RLS policies reference `public.*`.
- **SELECT-wrapper pattern mandatory:** Every RLS policy wraps helper calls in `(SELECT ...)` to prevent per-row re-evaluation.
- **Auth Hook registration is manual:** Step cannot be automated via migration. Documented in `docs/supabase-auth-config.md`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] JWT helper functions moved from auth schema to public schema**
- **Found during:** Task 5 (schema push to remote)
- **Issue:** Migrations originally defined helpers as `auth.org_id()` etc. Supabase returned "permission denied for schema auth" on push.
- **Fix:** Rewrote all three helpers under `public` schema. Updated all RLS policy migrations (0003-0006) to reference `public.*`.
- **Files modified:** supabase/migrations/0003_rls_helpers.sql through 0006_storage_buckets.sql
- **Committed in:** `d052088`

**2. [Rule 2 - Missing Critical] Added tables_without_rls() RPC to 0003**
- **Found during:** Task 2 preparation
- **Issue:** `scripts/check-rls.ts` calls `supabase.rpc('tables_without_rls')` but no migration created this function — linter would always fail with "function does not exist"
- **Fix:** Added `public.tables_without_rls()` SECURITY DEFINER function to 0003_rls_helpers.sql
- **Files modified:** supabase/migrations/0003_rls_helpers.sql
- **Committed in:** `2c40d5a`

---

**Total deviations:** 2 auto-fixed (1 Rule 1 bug, 1 Rule 2 missing critical)
**Impact on plan:** Both required for correctness. No scope creep.

## Issues Encountered

- Supabase `auth` schema write restriction was undocumented in the research phase. Discovered at push time. Fixed inline as deviation.

## User Setup Required

The Auth Hook must be registered manually in the Supabase Dashboard before any sign-in injects JWT claims.

See [`docs/supabase-auth-config.md`](../../docs/supabase-auth-config.md) for:
- Step-by-step navigation: Authentication → Hooks (Beta) → Custom Access Token
- JWT verification command to confirm claims inject correctly post-registration
- Notes on why `public` schema is used

**This is blocking for all sign-in flows in Phase 1 plans 03-06.** Without the hook registered, `public.org_id()` returns NULL inside every RLS policy and all authenticated queries return zero rows.

## Threat Coverage

| Threat ID | Mitigated By |
|-----------|-------------|
| T-02-01 | `org_id = (SELECT public.org_id())` on every table; admin cross-org explicit |
| T-02-02 | `custom_access_token_hook` SECURITY DEFINER — claims set server-side only |
| T-02-03 | All helper calls wrapped in `(SELECT ...)` — per-query not per-row |
| T-02-04 | `(storage.foldername(name))[1] = (SELECT public.org_id())::text` |
| T-02-05 | Accept — migrations-only team rule; single-developer project |
| T-02-06 | `enforce_plan_unit_limit()` BEFORE INSERT trigger — physical DB gate |

## Next Phase Readiness

- Database security boundary complete: all tables have RLS enabled and correct per-role policies (CI linter confirms)
- Auth Hook function in DB — one manual Dashboard step to activate
- Generated types in `src/types/supabase.ts` ready for Server Components and Server Actions
- Phase 2 migrations should follow the same RLS patterns established here: enable RLS, use `(SELECT public.org_id())`, include admin cross-org policy

## Self-Check

Files created:
- `supabase/migrations/0001_create_organizations.sql` — FOUND
- `supabase/migrations/0002_create_people.sql` — FOUND
- `supabase/migrations/0003_rls_helpers.sql` — FOUND
- `supabase/migrations/0004_rls_organizations.sql` — FOUND
- `supabase/migrations/0005_rls_people.sql` — FOUND
- `supabase/migrations/0006_storage_buckets.sql` — FOUND
- `supabase/migrations/0007_units_plan_limit.sql` — FOUND
- `src/types/supabase.ts` — FOUND
- `docs/supabase-auth-config.md` — FOUND

Commits: f0703d3, c1e4ed2, 2c40d5a, 55ba5a4, d052088, 94c51f1, a2571cc, f1c786f — all present in git log

## Self-Check: PASSED

---
*Phase: 01-foundation*
*Completed: 2026-06-20*
