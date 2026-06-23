---
phase: 05-maintenance
plan: "01"
subsystem: maintenance
tags: [migration, rls, middleware, pingram, work-orders]
dependency_graph:
  requires: []
  provides: [work_orders-table, maintenance-no-login-passthrough, pingram-installed]
  affects: [05-02, 05-03, 05-04, 05-05]
tech_stack:
  added: [pingram@1.0.14]
  patterns: [enum-types, rls-array-role-check, middleware-passthrough]
key_files:
  created:
    - canary-propos/supabase/migrations/20260623000000_create_work_orders.sql
  modified:
    - canary-propos/src/middleware.ts
    - canary-propos/package.json
    - canary-propos/package-lock.json
decisions:
  - "owner_approve_token and owner_decline_token are nullable (set only when entering pending_approval state)"
  - "vendor_token pre-generated at INSERT via DEFAULT gen_random_uuid()"
  - "RLS role check uses unnest(role) pattern to handle array type"
metrics:
  duration: "~5 minutes"
  completed: "2026-06-23"
  tasks_completed: 2
  tasks_total: 3
---

# Phase 05 Plan 01: Work Orders Schema Migration Summary

work_orders table DDL with two enum types, five indexes, and three RLS policies; middleware passthrough for no-login vendor/owner routes; pingram installed.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create work_orders migration | f78304c | supabase/migrations/20260623000000_create_work_orders.sql |
| 2 | Middleware passthrough + install pingram | 37afc55 | src/middleware.ts, package.json, package-lock.json |

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None.

## Threat Flags

None beyond those documented in the plan threat model.

## Self-Check: PASSED

- `canary-propos/supabase/migrations/20260623000000_create_work_orders.sql` — exists
- `canary-propos/src/middleware.ts` contains `vendor/jobs` — confirmed (grep count: 1)
- `pingram@^1.0.14` in package.json — confirmed
- Commits f78304c and 37afc55 exist in git log
