---
phase: 01-foundation
plan: 02
subsystem: database
tags: [supabase, rls, migrations, auth-hook, jwt-claims, multi-tenant, storage]
dependency_graph:
  requires: [01-01]
  provides: [organizations-table, people-table, auth-hook, rls-policies, storage-buckets, plan-limit-trigger]
  affects: [all-subsequent-plans]
tech_stack:
  added: []
  patterns:
    - custom_access_token_hook SECURITY DEFINER Auth Hook for JWT claims injection
    - (SELECT auth.org_id()) wrapped RLS pattern for per-query evaluation
    - BEFORE INSERT trigger as DB-layer plan limit gate (ORGS-06)
    - org-assets bucket with first-path-segment org_id isolation
key_files:
  created:
    - canary-propos/supabase/migrations/0001_create_organizations.sql
    - canary-propos/supabase/migrations/0002_create_people.sql
    - canary-propos/supabase/migrations/0003_rls_helpers.sql
    - canary-propos/supabase/migrations/0004_rls_organizations.sql
    - canary-propos/supabase/migrations/0005_rls_people.sql
    - canary-propos/supabase/migrations/0006_storage_buckets.sql
    - canary-propos/supabase/migrations/0007_units_plan_limit.sql
  modified:
    - canary-propos/src/types/supabase.ts  [PENDING — awaiting db push]
decisions:
  - Auth Hook set search_path = '' + SECURITY DEFINER prevents privilege escalation
  - All RLS helper calls wrapped in (SELECT ...) per Pitfall 2
  - tables_without_rls() CI linter RPC added to 0003 (required by scripts/check-rls.ts)
  - units table is minimal for plan-limit enforcement; full schema defers to Phase 2
metrics:
  duration: ~35 minutes
  completed_date: "2026-06-20"
  tasks_total: 5
  tasks_completed: 3
  files_created: 7
  files_modified: 0
---

# Phase 1 Plan 02: Database Schema + RLS Summary

**One-liner:** Seven migration files define organizations/people/units tables with per-role RLS, JWT Auth Hook, org-scoped storage bucket, and plan-limit BEFORE INSERT trigger for the ca-central-1 Supabase project.

---

## Completed Tasks

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create organizations and people table migrations | f0703d3 | 0001_create_organizations.sql, 0002_create_people.sql |
| 2 | Auth Hook, RLS helper functions, and per-role RLS policies | c1e4ed2 + 2c40d5a | 0003_rls_helpers.sql, 0004_rls_organizations.sql, 0005_rls_people.sql, 0006_storage_buckets.sql |
| 3 | Units table + plan-limit enforcement trigger (ORGS-06) | 55ba5a4 | 0007_units_plan_limit.sql |

---

## Pending Tasks (awaiting human action)

| Task | Name | Blocker |
|------|------|---------|
| 4 | Register Auth Hook in Supabase Dashboard | Manual dashboard action — cannot be done via migration |
| 5 | Push schema to remote Supabase + generate types | Requires SUPABASE_ACCESS_TOKEN and SUPABASE_DB_PASSWORD in .env.local |

---

## What Was Built

### organizations table (0001)
- `id` UUID PK, `name` TEXT CHECK 2..80, `slug` TEXT UNIQUE NOT NULL
- `province TEXT NOT NULL` — required per D-01, Canadian compliance
- `plan_type` CHECK ('free','starter','growth'), `plan_unit_limit` INTEGER DEFAULT 5 (ORGS-05)
- `stripe_customer_id`, `setup_completed_at` (onboarding wizard completion, D-02)
- RLS enabled, index on id

### people table (0002)
- `user_id` UUID nullable (null until invite accepted), `org_id` FK to organizations
- `role` CHECK ('admin','manager','employee','tenant','owner','vendor')
- `invite_token` UUID UNIQUE, `invite_sent_at`, `invite_accepted_at` (D-09)
- `active` BOOLEAN, `deactivated_at` (ORGS-03, D-11)
- RLS enabled, indexes on org_id / user_id / invite_token

### RLS helpers + Auth Hook (0003)
- `public.custom_access_token_hook(event jsonb)` — SECURITY DEFINER, SET search_path = ''
  - Reads id/org_id/role from public.people WHERE user_id = event user_id
  - jsonb_sets org_id, role, person_id into app_metadata
  - GRANT EXECUTE to supabase_auth_admin; REVOKE from authenticated/anon/public
- `auth.org_id()`, `auth.user_role()`, `auth.person_id()` — STABLE SQL helpers reading JWT app_metadata
- `public.tables_without_rls()` — CI linter RPC called by scripts/check-rls.ts

### organizations RLS (0004)
- Staff (manager/employee): SELECT/UPDATE own org via `id = (SELECT auth.org_id())`
- Admin: SELECT/UPDATE/INSERT/DELETE all orgs (cross-org, FOUND-07)
- Non-staff (tenant/owner/vendor): SELECT own org row only

### people RLS (0005)
- Manager: full CRUD within org (FOUND-08)
- Employee: SELECT + UPDATE within org (FOUND-09)
- Admin: full CRUD cross-org (FOUND-07)
- Non-staff: SELECT + UPDATE own row via `user_id = auth.uid() AND org_id = (SELECT auth.org_id())`

### Storage bucket (0006)
- `org-assets` private bucket, 5 MB limit, image MIME types only
- RLS on storage.objects: `(storage.foldername(name))[1] = (SELECT auth.org_id())::text`
- SELECT: manager/employee/admin; INSERT/UPDATE/DELETE: manager/admin only (FOUND-13, ORGS-04)

### units + plan-limit trigger (0007)
- Minimal `public.units` table (id, org_id FK, label, created_at) with RLS + policies
- `public.enforce_plan_unit_limit()` SECURITY DEFINER trigger function:
  - Counts existing units for NEW.org_id
  - SELECTs plan_unit_limit from organizations
  - RAISE EXCEPTION 'plan_unit_limit_exceeded' with ERRCODE='check_violation' when count >= limit
- `BEFORE INSERT` trigger `trg_enforce_plan_unit_limit` — physical DB gate for ORGS-06

---

## Deviations from Plan

### Auto-added: tables_without_rls() RPC function
- **Rule:** Rule 2 — missing critical functionality
- **Found during:** Task 5 preparation
- **Issue:** scripts/check-rls.ts calls `supabase.rpc('tables_without_rls')` but no migration created this function. Without it, `node scripts/check-rls.ts` would always fail with "function does not exist" even after a successful push.
- **Fix:** Added `public.tables_without_rls()` SECURITY DEFINER function to 0003_rls_helpers.sql with GRANT to service_role.
- **Files modified:** supabase/migrations/0003_rls_helpers.sql
- **Commit:** 2c40d5a

---

## Auth Gates (Tasks 4 and 5)

**Task 5 — Schema Push:** Blocked by missing credentials.
- `SUPABASE_ACCESS_TOKEN` in canary-propos/.env.local is a placeholder
- `SUPABASE_DB_PASSWORD` in canary-propos/.env.local is a placeholder
- These are needed for `npx supabase db push` to authenticate

**Task 4 — Auth Hook Registration:** Manual dashboard step.
- The `custom_access_token_hook` function exists in migration 0003
- Must be registered at Supabase Dashboard → Authentication → Hooks → Custom Access Token
- Cannot be done via CLI or migration

**Resolution path:** See CHECKPOINT section below — credentials must be added before Tasks 4/5 can complete.

---

## Threat Coverage (from threat_model)

| Threat ID | Mitigated By |
|-----------|-------------|
| T-02-01 | org_id = (SELECT auth.org_id()) on every table's RLS; admin cross-org explicit |
| T-02-02 | custom_access_token_hook SECURITY DEFINER — claims server-side only |
| T-02-03 | All helper calls wrapped in (SELECT ...) — per-query, not per-row |
| T-02-04 | storage.foldername(name)[1] = (SELECT auth.org_id())::text |
| T-02-05 | Accept — migrations-only team rule; single-developer project |
| T-02-06 | enforce_plan_unit_limit() BEFORE INSERT trigger — DB-layer gate |

---

## Self-Check

### Files created:
- canary-propos/supabase/migrations/0001_create_organizations.sql — FOUND
- canary-propos/supabase/migrations/0002_create_people.sql — FOUND
- canary-propos/supabase/migrations/0003_rls_helpers.sql — FOUND
- canary-propos/supabase/migrations/0004_rls_organizations.sql — FOUND
- canary-propos/supabase/migrations/0005_rls_people.sql — FOUND
- canary-propos/supabase/migrations/0006_storage_buckets.sql — FOUND
- canary-propos/supabase/migrations/0007_units_plan_limit.sql — FOUND

### Commits:
- f0703d3 — feat(01-02): create organizations and people table migrations
- c1e4ed2 — feat(01-02): Auth Hook, RLS helper functions, and per-role RLS policies
- 55ba5a4 — feat(01-02): units table and plan-limit enforcement trigger (ORGS-06)
- 2c40d5a — feat(01-02): add tables_without_rls() CI linter function

## Self-Check: PASSED (Tasks 1-3 artifacts verified; Tasks 4-5 pending human action)
