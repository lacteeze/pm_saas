---
phase: 02-core-data-model
plan: 01
subsystem: database/schema
tags: [migrations, rls, schema, supabase, postgresql]
dependency_graph:
  requires: [01-foundation]
  provides: [properties-table, portfolios-table, leases-table, units-extended, people-role-array, storage-pdf-support]
  affects: [02-02, 02-03, 02-04, 02-05, 02-06]
tech_stack:
  added: []
  patterns: [rls-helper-wrapper, array-overlap-constraint, partial-index, auth-hook-role-emit]
key_files:
  created:
    - canary-propos/supabase/migrations/0008_create_properties.sql
    - canary-propos/supabase/migrations/0009_create_portfolios.sql
    - canary-propos/supabase/migrations/0010_extend_units.sql
    - canary-propos/supabase/migrations/0011_create_leases.sql
    - canary-propos/supabase/migrations/0012_alter_people_role.sql
    - canary-propos/supabase/migrations/0013_update_storage_bucket.sql
  modified: []
decisions:
  - "Migration order: properties (0008) → portfolios (0009) → extend units (0010) → leases (0011) — forward FK dependency chain"
  - "portfolio_id added via ALTER in 0009 (not in CREATE TABLE in 0008) to avoid forward reference"
  - "Auth Hook emits role[1] (first array element as string) — preserves JWT text claim, all RLS policies unchanged"
  - "Tenant storage policy uses EXISTS subquery on leases table to verify lease ownership before granting read access"
metrics:
  duration: "~20 minutes"
  completed_date: "2026-06-21"
  tasks_completed: 2
  tasks_total: 3
  files_created: 6
  files_modified: 0
---

# Phase 2 Plan 01: Core Data Model Migrations Summary

**One-liner:** Six SQL migrations establishing properties/portfolios/leases schema with multi-role people support, RLS policies, and tenant lease PDF storage access.

---

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Write migrations 0008–0011 | 1d7bef7 | 0008, 0009, 0010, 0011 |
| 2 | Write migrations 0012–0013 | e35ec31 | 0012, 0013 |

---

## What Was Built

### Migration 0008: `properties` table
- `property_type_enum`: house, duplex, apartment_building, condo, townhouse, other
- Columns: id, org_id, owner_id (FK→people), street_address, city, province, postal_code, property_type, photo_paths (text[]), timestamps
- NO `portfolio_id` column — added via ALTER in 0009 after portfolios table exists
- RLS: staff/admin SELECT, owner SELECT own properties, manager/admin INSERT/UPDATE/DELETE

### Migration 0009: `portfolios` table + properties FK
- Columns: id, org_id, owner_id (FK→people), name, timestamps
- ALTER TABLE properties ADD COLUMN portfolio_id UUID REFERENCES portfolios(id) ON DELETE SET NULL
- RLS: same pattern as properties (staff/admin/owner SELECT, manager/admin write)

### Migration 0010: Extend `units` table
- Added: property_id (FK→properties), unit_number, floor, bedrooms, bathrooms, sq_footage, status (check constraint), asking_rent, amenities (text[]), updated_at
- Dropped: label column (stub with no production data)
- Indexes: units_property_id_idx, units_status_idx (composite org_id + status)
- Existing RLS from 0007 unchanged

### Migration 0011: `leases` table
- `renewal_status_enum`: pending, sent, accepted, declined
- Full lease schema per LEASE-01/04/05/06 requirements
- RLS: staff/admin SELECT, tenant SELECT own lease only, owner SELECT via property ownership EXISTS subquery, manager/admin write
- Partial index on (org_id, end_date) WHERE status='active' for expiry alert queries

### Migration 0012: `people.role` text → text[]
- Drop old CHECK constraint
- ALTER COLUMN role TYPE TEXT[] USING ARRAY[role]
- New CHECK: role && ARRAY['admin','manager','employee','tenant','owner','vendor'] (overlap)
- Auth Hook updated: emits `person_record.role[1]` (first element as string) — JWT remains a text string, all RLS policies unchanged

### Migration 0013: Storage bucket update
- UPDATE org-assets: file_size_limit 5MB→20MB, allowed_mime_types adds application/pdf
- New storage_select_tenant_lease policy: tenant can SELECT their lease document path, verified via EXISTS subquery on leases table

---

## Deviations from Plan

None — plan executed exactly as written.

---

## Known Stubs

None — this plan is pure DDL migrations with no UI stubs.

---

## Threat Flags

No new security surface beyond what the plan's threat model covers. All mitigations in the STRIDE register (T-02-01 through T-02-05) are implemented:
- T-02-01: ARRAY[role] cast + overlap CHECK preserves valid roles
- T-02-02: leases_select_tenant binds to person_id() 
- T-02-03: storage_select_tenant_lease + EXISTS subquery
- T-02-04: leases_insert_manager WITH CHECK enforces manager/admin only
- T-02-05: Auth Hook emits role[1] — second role cannot escalate JWT claim

---

## Checkpoint Status

Task 3 (DB push) is a blocking checkpoint requiring human action. Migration files are committed locally and ready to push.

**Pending after checkpoint:**
1. `cd canary-propos && npx supabase link --project-ref mdzegkaymdsmgspdgkko`
2. `SUPABASE_ACCESS_TOKEN=<token> npx supabase db push`
3. `npx supabase gen types typescript --linked > src/types/supabase.ts`
4. `npx tsx scripts/check-rls.ts` — must exit 0

---

## Self-Check

### Files created:
- canary-propos/supabase/migrations/0008_create_properties.sql: FOUND
- canary-propos/supabase/migrations/0009_create_portfolios.sql: FOUND
- canary-propos/supabase/migrations/0010_extend_units.sql: FOUND
- canary-propos/supabase/migrations/0011_create_leases.sql: FOUND
- canary-propos/supabase/migrations/0012_alter_people_role.sql: FOUND
- canary-propos/supabase/migrations/0013_update_storage_bucket.sql: FOUND

### Commits:
- 1d7bef7: feat(02-01): write migrations 0008-0011
- e35ec31: feat(02-01): write migrations 0012-0013

## Self-Check: PASSED
