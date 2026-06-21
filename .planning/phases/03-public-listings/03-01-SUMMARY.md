---
phase: 03-public-listings
plan: "01"
subsystem: database
tags: [migrations, rls, listings, inquiries, schema]
dependency_graph:
  requires: [02-01]
  provides: [listings-table, inquiries-table]
  affects: [03-02, 03-03, 03-04]
tech_stack:
  added: []
  patterns: [rls-org-scoped, rls-anon-insert, enum-types, updated-at-trigger]
key_files:
  created:
    - canary-propos/supabase/migrations/0014_create_listings.sql
    - canary-propos/supabase/migrations/0015_create_inquiries.sql
  modified: []
decisions:
  - "Used (SELECT public.org_id()) subquery pattern matching existing 0008 migrations rather than jwt_org_id() referenced in plan — actual helper is org_id() not jwt_org_id()"
  - "set_updated_at() trigger function defined inline in 0014 (not previously defined in schema)"
  - "anon INSERT on inquiries uses WITH CHECK (true) — org_id integrity delegated to Server Action per T-03-02 design"
  - "Added employee role to staff SELECT policies for both tables — matches 0008 pattern"
metrics:
  duration: "~10 minutes"
  completed: "2026-06-21"
  tasks_completed: 2
  tasks_total: 3
  files_created: 2
  files_modified: 0
---

# Phase 03 Plan 01: Listings and Inquiries Schema Migrations Summary

Two Supabase migration files written for listings table (status enum, RLS for managers + anon published-only SELECT) and inquiries table (dual enums, RLS for managers + anon INSERT-only), following established 0008 patterns.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Write 0014_create_listings.sql | eb48350 | canary-propos/supabase/migrations/0014_create_listings.sql |
| 2 | Write 0015_create_inquiries.sql | c63e34d | canary-propos/supabase/migrations/0015_create_inquiries.sql |

## Task 3: Pending — DB Push (checkpoint)

Task 3 requires running `supabase db push` against the linked project, regenerating TypeScript types, and running the RLS linter. This is a human checkpoint — see Checkpoint Details below.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected RLS helper function name**
- **Found during:** Task 1
- **Issue:** Plan referenced `jwt_org_id()` but the actual helper defined in 0003_rls_helpers.sql (and used consistently in 0008) is `public.org_id()`. Using the wrong name would cause migration failure.
- **Fix:** Used `(SELECT public.org_id())` and `(SELECT public.user_role())` matching the 0008 pattern exactly.
- **Files modified:** 0014_create_listings.sql, 0015_create_inquiries.sql

## Known Stubs

None — migration files are complete DDL. No UI or data-wiring stubs present.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: anon-insert | 0015_create_inquiries.sql | anon INSERT on inquiries with WITH CHECK (true) — org_id integrity delegated to Server Action; must be enforced in 03-03 plan |

## Self-Check: PASSED

- [x] 0014_create_listings.sql exists at canary-propos/supabase/migrations/0014_create_listings.sql
- [x] 0015_create_inquiries.sql exists at canary-propos/supabase/migrations/0015_create_inquiries.sql
- [x] Commit eb48350 exists (0014)
- [x] Commit c63e34d exists (0015)
