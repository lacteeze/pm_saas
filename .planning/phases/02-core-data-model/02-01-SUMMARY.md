---
plan: 02-01
phase: 02
status: complete
completed: 2026-06-21
---

# Plan 02-01: Schema Migrations + DB Push

## What Was Built

Six Supabase migrations establishing the full Phase 2 data model, pushed to production and verified with the RLS linter.

## Migrations Applied

| Migration | What It Creates |
|-----------|----------------|
| 0008_create_properties.sql | properties table (building-level: address, type, province, owner_id FK, portfolio_id FK, photos text[], org_id, RLS) |
| 0009_create_portfolios.sql | portfolios table (id, org_id, owner_id FK to people, name, RLS) |
| 0010_extend_units.sql | Extends existing units table with unit_number, floor, bedrooms, bathrooms, sq_footage, status enum, asking_rent, amenities text[] |
| 0011_create_leases.sql | leases table (tenant_id FK to people, unit_id FK to units, dates, rent, deposit, renewal_status enum, document_path, RLS) |
| 0012_alter_people_role.sql | Alters people.role from text to text[]; updates Auth Hook to emit role[1] to keep JWT as single string |
| 0013_update_storage_bucket.sql | Adds application/pdf to org-assets allowed MIME types; raises limit to 20 MB |

## Verification

- supabase db push: all 6 migrations applied with no errors
- supabase gen types: src/types/supabase.ts updated (250 new lines)
- check-rls.ts: PASS — all public tables have Row Level Security enabled

## Key Files

- canary-propos/supabase/migrations/0008_create_properties.sql
- canary-propos/supabase/migrations/0009_create_portfolios.sql
- canary-propos/supabase/migrations/0010_extend_units.sql
- canary-propos/supabase/migrations/0011_create_leases.sql
- canary-propos/supabase/migrations/0012_alter_people_role.sql
- canary-propos/supabase/migrations/0013_update_storage_bucket.sql
- canary-propos/src/types/supabase.ts

## Self-Check: PASSED

All RLS policies verified. Auth Hook role[] migration applied. Storage bucket updated for PDF uploads.
