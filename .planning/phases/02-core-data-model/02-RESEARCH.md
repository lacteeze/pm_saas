# Phase 2: Core Data Model — Research

**Researched:** 2026-06-21
**Domain:** PostgreSQL schema design, Supabase RLS, Supabase Storage, Next.js RSC data fetching
**Confidence:** HIGH — all findings derived from existing codebase migrations and locked CONTEXT.md decisions

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Two-table hierarchy: `properties` (building-level) → `units` (child records). Leases link to units, not properties.
- **D-02:** Unit fields: `unit_number` (text), `floor` (int, nullable), `bedrooms` (int), `bathrooms` (numeric for 1.5), `sq_footage` (int, nullable), `status` (enum: vacant/occupied/maintenance), `asking_rent` (numeric, nullable), `amenities` (text[], nullable).
- **D-03:** Leases link to units via FK to `units.id`.
- **D-04:** `/people` grows to two tabs: "Team" (existing) + "Contacts" (new). No new nav item.
- **D-05:** Creating a contact record and inviting to portal are separate actions.
- **D-06:** `role` stored as `text[]` on the `people` table (not a junction table).
- **D-07:** `portfolios` table: `id`, `org_id`, `owner_id` (FK → people), `name`. Properties have nullable `portfolio_id` FK.
- **D-08:** `properties.owner_id` FK → `people` (role includes 'client'/'owner').
- **D-09:** Dashboard: summary cards (total/occupied/vacant units, active leases) + lease expiry alerts (90/60/30 days).
- **D-10:** Lease renewal = status flag only. Field: `renewal_status` (pending|sent|accepted|declined).
- Use `createAdminClient()` ONLY for server actions where the caller may lack JWT claims. Regular `createServerClient` is fine for Phase 2 (managers are authenticated).
- RLS pattern: always `(SELECT public.org_id())` wrapper, never bare call.
- `units` table already exists from Phase 1 — extend it with Phase 2 fields.
- `org-assets` storage bucket already exists with RLS — use for property photos and lease PDFs.

### Claude's Discretion
- Unit fields selection (D-02 satisfied above)
- People roles: `role text[]` column on `people` table (not a separate roles junction table for Phase 2)
- Dashboard card layout and metric selection (D-09)
- Property photo storage path pattern in `org-assets` bucket
- RLS policies for new tables — follow `(SELECT public.org_id())` wrapper pattern from Phase 1
- Form UX details (drawer vs. modal vs. inline for property/unit creation)

### Deferred Ideas (OUT OF SCOPE)
- Public listings page for available units (Phase 3)
- Lease document generation from templates (Phase 10)
- Lease renewal document send + e-signature (Phase 10)
- SMS/email notifications for lease expiry (Phase 10)
- Maintenance open count on property dashboard (Phase 5)
- Rent status on property dashboard (Phase 4)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PEOPLE-01 | Manager can create a person record for any role | `people` table migration with `role text[]` change; AddContactForm + Server Action |
| PEOPLE-02 | Person record: name, email, phone, role(s), org, created_at | Existing `people` table covers all; only `role` type changes |
| PEOPLE-03 | Person can hold multiple roles | `role text[]` migration; query patterns change from `=` to `@>` or `ANY()` |
| PEOPLE-04 | Manager can view, edit, deactivate person records | Contacts tab UI + edit/deactivate Server Actions |
| PROP-01 | Manager can create a property record | `properties` table + `add-property` Server Action |
| PROP-02 | Property record includes province field | `properties.province` column; pre-populated from org.province |
| PROP-03 | Manager can associate a property with an owner | `properties.owner_id FK → people` |
| PROP-04 | Manager can group properties into a portfolio | `portfolios` table + `properties.portfolio_id FK` |
| PROP-05 | Manager can view property dashboard | `/properties/[id]` page with unit stats + lease list |
| PROP-06 | Manager can upload and manage property photos | Supabase Storage path + `properties.photo_paths text[]` |
| LEASE-01 | Manager can create a lease linking tenant to unit | `leases` table + `add-lease` Server Action |
| LEASE-02 | Manager can view all active, expiring, expired leases | `/leases` page with status filter; status derived from `end_date` |
| LEASE-03 | System displays alerts at 90/60/30 days before lease expiry | `ExpiryAlertCallout` component + query for leases expiring within 90 days |
| LEASE-04 | Manager can initiate lease renewal workflow (Phase 2: status flag only) | `leases.renewal_status` enum field; mark-as-pending Server Action |
| LEASE-05 | Lease documents (PDF) can be uploaded per lease record | `leases.document_path text` + Supabase Storage upload |
| LEASE-06 | Tenant can view and download their current lease document | `/my-home` page + signed URL Server Action; storage RLS must allow tenant read |
</phase_requirements>

---

## Summary

Phase 2 is fundamentally a schema-and-CRUD phase. The core challenge is not algorithmic — it is getting the schema right on the first pass so Phase 3–11 don't require breaking migrations. Four new tables (`properties`, `portfolios`, `leases`, and a migration extending `units`) plus one altered column (`people.role` from `text` to `text[]`) compose the entire data layer. All UI patterns already exist in the codebase: the desktop-table + mobile-cards pattern from `people/page.tsx` is copied verbatim for Properties and Leases. The form pattern (Dialog + react-hook-form + zod) is identical to InviteUserForm.

The two non-trivial problems are: (1) safely migrating `people.role` from `text` to `text[]` without invalidating the existing CHECK constraint or the Auth Hook query which reads `people.role`, and (2) adding tenant access to lease PDFs in Supabase Storage, where the existing storage RLS policy only allows manager/employee/admin roles — tenants are currently excluded.

**Primary recommendation:** Write migrations in order: extend `units` first (it has an existing trigger that must not break), then `properties`, `portfolios`, `leases`, then alter `people.role`. Each migration ships with its own RLS file matching the 0005-style pattern already established.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Schema / migrations | Database (Supabase) | — | Tables, FKs, indexes, RLS policies live in `.sql` migration files |
| People CRUD (contacts tab) | API / Backend (Server Actions) | Frontend Server (RSC data fetch) | Mutations via Server Actions; list via RSC `.from('people').select()` |
| Properties CRUD | API / Backend (Server Actions) | Frontend Server (RSC data fetch) | Same pattern as people |
| Unit CRUD (child of property) | API / Backend (Server Actions) | Frontend Server (RSC data fetch) | Units are children; always fetched scoped to a property |
| Lease CRUD | API / Backend (Server Actions) | Frontend Server (RSC data fetch) | Add Lease needs property→unit cascade select — client component for the cascade, Server Action for insert |
| Property photo upload | Browser / Client | API / Backend (Storage signed URL) | File picked client-side; upload goes directly to Supabase Storage from browser using `supabase.storage.from('org-assets').upload()` |
| Lease PDF upload | Browser / Client | API / Backend (Storage signed URL) | Same as photo upload |
| Lease PDF download (tenant) | API / Backend (Server Action) | — | Generates 60-second signed URL server-side; opens in new tab |
| Dashboard summary counts | Frontend Server (RSC) | Database (aggregate query) | Single RSC component fetches aggregate counts; no client-side fetch needed |
| Lease expiry alerts | Frontend Server (RSC) | — | Query returns leases ending within 90 days; grouped by urgency in the component |

---

## Standard Stack

No new packages in Phase 2. All required libraries were installed in Phase 1.

### Packages Already Installed (no new installs needed)

| Library | Purpose | Phase 1 install |
|---------|---------|-----------------|
| `@supabase/ssr` | Server and browser Supabase clients | Yes |
| `@supabase/supabase-js` | Storage, queries | Yes |
| `react-hook-form` v7 | Form state | Yes |
| `zod` v4 | Schema validation | Yes |
| `@hookform/resolvers` | zodResolver bridge | Yes |
| `shadcn/ui` (tabs, dialog, badge, select, form, input, label, card, alert) | UI components | Partially — `tabs` may need `npx shadcn add tabs` |

**One shadcn component may need adding:**
```bash
npx shadcn add tabs
```
`Tabs` is used on the `/people` two-tab layout (D-04). Confirm it is present in `src/components/ui/tabs.tsx` before implementation begins.

---

## Package Legitimacy Audit

No new npm packages in this phase. Skip.

---

## Architecture Patterns

### System Architecture Diagram

```
Browser
  │
  ├─ [RSC Page] /properties, /leases, /people, /dashboard
  │     └─ createServerClient() → Supabase DB → RLS filters by org_id JWT claim
  │
  ├─ [Client Component] AddPropertyForm, AddLeaseForm, AddContactForm
  │     └─ react-hook-form + zod → Server Action → supabase.insert() / .update()
  │
  ├─ [Client Component] PhotoUpload, LeaseDocUpload
  │     └─ supabase.storage.from('org-assets').upload(path, file)
  │          RLS: (storage.foldername(name))[1] = org_id
  │
  └─ [Server Action] generateLeaseDownloadUrl (tenant /my-home)
        └─ createServerClient().storage.createSignedUrl(path, 60)
             Storage RLS must permit tenant SELECT on their lease path
```

### Recommended Project Structure (new files for Phase 2)

```
canary-propos/supabase/migrations/
├── 0008_extend_units.sql           # Add Phase 2 columns to existing units table
├── 0009_create_properties.sql      # properties table + RLS
├── 0010_create_portfolios.sql      # portfolios table + RLS
├── 0011_create_leases.sql          # leases table + RLS + renewal_status enum
├── 0012_alter_people_role.sql      # Migrate role text → text[]

canary-propos/src/app/(manager)/
├── people/
│   └── page.tsx                    # UPDATE: add Contacts tab (D-04)
├── properties/
│   ├── page.tsx                    # NEW: building list
│   └── [id]/
│       └── page.tsx                # NEW: property detail (tabs: Info, Units, Leases)
└── leases/
    ├── page.tsx                    # NEW: lease list + expiry alerts
    └── [id]/
        └── page.tsx                # NEW: lease detail

canary-propos/src/app/(tenant)/
└── my-home/
    └── page.tsx                    # UPDATE: add lease card + PDF download

canary-propos/src/components/
├── people/
│   ├── AddContactForm.tsx          # NEW: Dialog + form (PEOPLE-01)
│   ├── EditContactForm.tsx         # NEW: pre-filled Dialog (PEOPLE-04)
│   └── ContactsTab.tsx             # NEW: table + mobile cards for contacts
├── properties/
│   ├── AddPropertyForm.tsx         # NEW
│   ├── AddUnitForm.tsx             # NEW
│   └── PropertyPhotoUpload.tsx     # NEW
├── leases/
│   ├── AddLeaseForm.tsx            # NEW (client component — cascade select)
│   ├── LeaseDocUpload.tsx          # NEW
│   └── ExpiryAlertCallout.tsx      # NEW (reusable across /leases, /properties/[id], /dashboard)
└── dashboard/
    └── SummaryCards.tsx            # NEW: 4-card grid

canary-propos/src/app/actions/
├── contacts.ts                     # createContact, updateContact, deactivateContact
├── properties.ts                   # createProperty, updateProperty
├── units.ts                        # createUnit, updateUnit
├── portfolios.ts                   # createPortfolio
└── leases.ts                       # createLease, updateLeaseRenewal, generateLeaseDownloadUrl
```

---

## Schema Design

### Migration 0008: Extend `units` Table

The existing `units` table has only: `id`, `org_id`, `label`, `created_at`.

The plan-limit trigger (`trg_enforce_plan_unit_limit`) fires BEFORE INSERT and counts existing rows — it is unaffected by adding columns.

```sql
-- 0008_extend_units.sql
-- Adds Phase 2 columns to the minimal units table from Phase 1.
-- The plan-limit trigger (trg_enforce_plan_unit_limit) is unaffected by ALTER TABLE ADD COLUMN.

-- New columns per D-02
ALTER TABLE public.units
  ADD COLUMN IF NOT EXISTS property_id   UUID        REFERENCES public.properties(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS unit_number   TEXT,
  ADD COLUMN IF NOT EXISTS floor         INTEGER,
  ADD COLUMN IF NOT EXISTS bedrooms      INTEGER     NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS bathrooms     NUMERIC(3,1) NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS sq_footage    INTEGER,
  ADD COLUMN IF NOT EXISTS status        TEXT        NOT NULL DEFAULT 'vacant'
                                           CHECK (status IN ('vacant', 'occupied', 'maintenance')),
  ADD COLUMN IF NOT EXISTS asking_rent   NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS amenities     TEXT[],
  ADD COLUMN IF NOT EXISTS updated_at    TIMESTAMPTZ DEFAULT now();

-- Backfill: existing stub units get a null property_id (acceptable — no real units exist yet)

-- Index for property-scoped unit queries
CREATE INDEX IF NOT EXISTS units_property_id_idx ON public.units (property_id);

-- Note: existing RLS policies from 0007 remain valid — they scope by org_id.
-- Phase 2 does NOT add tenant SELECT to units (units are manager/staff read-only in Phase 2).
```

**Key decision:** `property_id` references `properties` table (created in 0009). In PostgreSQL, forward-referencing FKs in the same migration batch fail — create `properties` first (0009), then add `property_id` FK in 0008 or sequence as 0009 properties first and 0010 extend units. Recommend: rename to 0008_create_properties, 0009_create_portfolios, 0010_extend_units to ensure correct order.

**Revised migration sequence:**
```
0008_create_properties.sql      ← properties (no FK to units yet)
0009_create_portfolios.sql      ← portfolios (FK to properties)
0010_extend_units.sql           ← units gets property_id FK → properties
0011_create_leases.sql          ← leases (FK to units and people)
0012_alter_people_role.sql      ← role text → text[]
```

---

### Migration 0008: `properties` Table

```sql
-- 0008_create_properties.sql

CREATE TYPE public.property_type_enum AS ENUM (
  'house', 'duplex', 'apartment_building', 'condo', 'townhouse', 'other'
);

CREATE TABLE public.properties (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  portfolio_id    UUID,       -- FK added after portfolios table exists (see 0009)
  owner_id        UUID        REFERENCES public.people(id) ON DELETE SET NULL,
  street_address  TEXT        NOT NULL,
  city            TEXT        NOT NULL,
  province        TEXT        NOT NULL,  -- PROP-02; pre-populate from org.province in UI
  postal_code     TEXT,
  property_type   public.property_type_enum NOT NULL DEFAULT 'house',
  photo_paths     TEXT[],     -- array of storage paths: {org_id}/properties/{property_id}/photos/{filename}
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;

CREATE INDEX ON public.properties (org_id);
CREATE INDEX ON public.properties (owner_id);
CREATE INDEX ON public.properties (portfolio_id);

-- RLS policies
-- Managers/employees/admin: full access within org
CREATE POLICY "properties_select_staff"
ON public.properties FOR SELECT TO authenticated
USING (
  org_id = (SELECT public.org_id())
  AND (SELECT public.user_role()) IN ('manager', 'employee', 'admin')
);

CREATE POLICY "properties_select_admin"
ON public.properties FOR SELECT TO authenticated
USING ( (SELECT public.user_role()) = 'admin' );

-- Owners: SELECT only their own properties (FOUND-11)
CREATE POLICY "properties_select_owner"
ON public.properties FOR SELECT TO authenticated
USING (
  org_id = (SELECT public.org_id())
  AND (SELECT public.user_role()) = 'owner'
  AND owner_id = (SELECT public.person_id())
);

CREATE POLICY "properties_insert_manager"
ON public.properties FOR INSERT TO authenticated
WITH CHECK (
  org_id = (SELECT public.org_id())
  AND (SELECT public.user_role()) IN ('manager', 'admin')
);

CREATE POLICY "properties_update_manager"
ON public.properties FOR UPDATE TO authenticated
USING (
  org_id = (SELECT public.org_id())
  AND (SELECT public.user_role()) IN ('manager', 'admin')
)
WITH CHECK (
  org_id = (SELECT public.org_id())
  AND (SELECT public.user_role()) IN ('manager', 'admin')
);

CREATE POLICY "properties_delete_manager"
ON public.properties FOR DELETE TO authenticated
USING (
  org_id = (SELECT public.org_id())
  AND (SELECT public.user_role()) IN ('manager', 'admin')
);
```

---

### Migration 0009: `portfolios` Table

```sql
-- 0009_create_portfolios.sql

CREATE TABLE public.portfolios (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  owner_id    UUID        REFERENCES public.people(id) ON DELETE SET NULL,
  name        TEXT        NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.portfolios ENABLE ROW LEVEL SECURITY;

CREATE INDEX ON public.portfolios (org_id);
CREATE INDEX ON public.portfolios (owner_id);

-- Add portfolio_id FK to properties now that portfolios table exists
ALTER TABLE public.properties
  ADD COLUMN portfolio_id UUID REFERENCES public.portfolios(id) ON DELETE SET NULL;

-- RLS for portfolios
CREATE POLICY "portfolios_select_staff"
ON public.portfolios FOR SELECT TO authenticated
USING (
  org_id = (SELECT public.org_id())
  AND (SELECT public.user_role()) IN ('manager', 'employee', 'admin')
);

CREATE POLICY "portfolios_select_admin"
ON public.portfolios FOR SELECT TO authenticated
USING ( (SELECT public.user_role()) = 'admin' );

CREATE POLICY "portfolios_select_owner"
ON public.portfolios FOR SELECT TO authenticated
USING (
  org_id = (SELECT public.org_id())
  AND (SELECT public.user_role()) = 'owner'
  AND owner_id = (SELECT public.person_id())
);

CREATE POLICY "portfolios_insert_manager"
ON public.portfolios FOR INSERT TO authenticated
WITH CHECK (
  org_id = (SELECT public.org_id())
  AND (SELECT public.user_role()) IN ('manager', 'admin')
);

CREATE POLICY "portfolios_update_manager"
ON public.portfolios FOR UPDATE TO authenticated
USING (
  org_id = (SELECT public.org_id())
  AND (SELECT public.user_role()) IN ('manager', 'admin')
)
WITH CHECK (
  org_id = (SELECT public.org_id())
  AND (SELECT public.user_role()) IN ('manager', 'admin')
);

CREATE POLICY "portfolios_delete_manager"
ON public.portfolios FOR DELETE TO authenticated
USING (
  org_id = (SELECT public.org_id())
  AND (SELECT public.user_role()) IN ('manager', 'admin')
);
```

---

### Migration 0010: Extend `units` Table

```sql
-- 0010_extend_units.sql
-- properties table now exists; safe to add property_id FK.

ALTER TABLE public.units
  ADD COLUMN IF NOT EXISTS property_id   UUID        REFERENCES public.properties(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS unit_number   TEXT,
  ADD COLUMN IF NOT EXISTS floor         INTEGER,
  ADD COLUMN IF NOT EXISTS bedrooms      INTEGER     NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS bathrooms     NUMERIC(3,1) NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS sq_footage    INTEGER,
  ADD COLUMN IF NOT EXISTS status        TEXT        NOT NULL DEFAULT 'vacant'
                                           CHECK (status IN ('vacant', 'occupied', 'maintenance')),
  ADD COLUMN IF NOT EXISTS asking_rent   NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS amenities     TEXT[],
  ADD COLUMN IF NOT EXISTS updated_at    TIMESTAMPTZ DEFAULT now();

-- Drop the old generic label column (was a stub; no production data yet)
-- Only safe because schema has not been pushed to production.
-- Comment out if data exists in the column.
ALTER TABLE public.units DROP COLUMN IF EXISTS label;

CREATE INDEX IF NOT EXISTS units_property_id_idx ON public.units (property_id);
CREATE INDEX IF NOT EXISTS units_status_idx ON public.units (org_id, status);
```

---

### Migration 0011: `leases` Table

```sql
-- 0011_create_leases.sql

CREATE TYPE public.renewal_status_enum AS ENUM (
  'pending', 'sent', 'accepted', 'declined'
);

CREATE TABLE public.leases (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           UUID        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  unit_id          UUID        NOT NULL REFERENCES public.units(id) ON DELETE RESTRICT,
  tenant_id        UUID        NOT NULL REFERENCES public.people(id) ON DELETE RESTRICT,
  start_date       DATE        NOT NULL,
  end_date         DATE        NOT NULL,
  monthly_rent     NUMERIC(10,2) NOT NULL,
  deposit_amount   NUMERIC(10,2) NOT NULL,
  rent_due_day     SMALLINT    NOT NULL DEFAULT 1 CHECK (rent_due_day BETWEEN 1 AND 28),
  status           TEXT        NOT NULL DEFAULT 'active'
                                 CHECK (status IN ('active', 'expired', 'terminated')),
  renewal_status   public.renewal_status_enum,   -- D-10; null means not yet initiated
  proposed_rent    NUMERIC(10,2),                -- nullable; set when renewal_status = 'pending'
  document_path    TEXT,                          -- storage path: {org_id}/leases/{lease_id}/{filename}
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.leases ENABLE ROW LEVEL SECURITY;

CREATE INDEX ON public.leases (org_id);
CREATE INDEX ON public.leases (unit_id);
CREATE INDEX ON public.leases (tenant_id);
CREATE INDEX ON public.leases (org_id, end_date) WHERE status = 'active';  -- expiry alert queries

-- RLS policies
CREATE POLICY "leases_select_staff"
ON public.leases FOR SELECT TO authenticated
USING (
  org_id = (SELECT public.org_id())
  AND (SELECT public.user_role()) IN ('manager', 'employee', 'admin')
);

CREATE POLICY "leases_select_admin"
ON public.leases FOR SELECT TO authenticated
USING ( (SELECT public.user_role()) = 'admin' );

-- Tenant: SELECT only their own lease (LEASE-06, FOUND-10)
CREATE POLICY "leases_select_tenant"
ON public.leases FOR SELECT TO authenticated
USING (
  org_id = (SELECT public.org_id())
  AND (SELECT public.user_role()) = 'tenant'
  AND tenant_id = (SELECT public.person_id())
);

-- Owner: SELECT leases on their properties (via unit → property → owner_id)
CREATE POLICY "leases_select_owner"
ON public.leases FOR SELECT TO authenticated
USING (
  org_id = (SELECT public.org_id())
  AND (SELECT public.user_role()) = 'owner'
  AND EXISTS (
    SELECT 1
    FROM public.units u
    JOIN public.properties p ON p.id = u.property_id
    WHERE u.id = leases.unit_id
      AND p.owner_id = (SELECT public.person_id())
  )
);

CREATE POLICY "leases_insert_manager"
ON public.leases FOR INSERT TO authenticated
WITH CHECK (
  org_id = (SELECT public.org_id())
  AND (SELECT public.user_role()) IN ('manager', 'admin')
);

CREATE POLICY "leases_update_manager"
ON public.leases FOR UPDATE TO authenticated
USING (
  org_id = (SELECT public.org_id())
  AND (SELECT public.user_role()) IN ('manager', 'admin')
)
WITH CHECK (
  org_id = (SELECT public.org_id())
  AND (SELECT public.user_role()) IN ('manager', 'admin')
);

CREATE POLICY "leases_delete_manager"
ON public.leases FOR DELETE TO authenticated
USING (
  org_id = (SELECT public.org_id())
  AND (SELECT public.user_role()) IN ('manager', 'admin')
);
```

---

### Migration 0012: Alter `people.role` from `text` to `text[]`

This is the most delicate migration. The existing schema has:
- `role TEXT NOT NULL CHECK (role IN ('admin', 'manager', 'employee', 'tenant', 'owner', 'vendor'))`
- The Auth Hook reads `p.role` and sets it as `to_jsonb(person_record.role)` (currently a string)
- RLS policies on `people` use `(SELECT public.user_role()) = 'manager'` (reading from JWT, not the DB column directly)
- The JWT helper `public.user_role()` reads from `auth.jwt() -> 'app_metadata' ->> 'role'` — currently a string claim

**Migration strategy:**
1. Drop the existing CHECK constraint on `role`
2. Cast `role` column from `text` to `text[]` using `USING ARRAY[role]`
3. Add new CHECK constraint: `CHECK (role && ARRAY['admin','manager','employee','tenant','owner','vendor']::text[])` (array overlap — at least one valid role)
4. Update the Auth Hook to handle both old (string) and new (array) format for role claim

**Critical: Auth Hook must be updated simultaneously.** The hook currently does:
```sql
claims := jsonb_set(claims, '{app_metadata,role}', to_jsonb(person_record.role));
```
After migration, `person_record.role` is `text[]`. The JWT will now emit `["manager"]` (a JSON array) instead of `"manager"` (a string).

The `public.user_role()` helper reads `auth.jwt() -> 'app_metadata' ->> 'role'` — `->>` operator on a JSON array returns a stringified array like `["manager"]`, NOT `"manager"`. **This breaks all existing RLS policies.**

**Two safe options:**

**Option A (Recommended): Keep JWT role claim as text — emit primary role only.**
Update the Auth Hook to emit the first element of the array as the JWT role claim. This is safe because for staff (manager/employee/admin), a person holds exactly one staff role. Contacts (tenant/owner/vendor) may have multiple but their JWT role is their primary portal access role.

```sql
-- Updated Auth Hook section in 0012:
-- Emit the first role as the JWT claim (primary role for portal access)
claims := jsonb_set(claims, '{app_metadata,role}', to_jsonb(person_record.role[1]));
```

RLS policies remain unchanged. The `role text[]` column is used by UI queries (display all roles, filter contacts by role) but the JWT claim stays a single string. This is the cleanest approach.

**Option B:** Emit full array in JWT and update all `user_role()` usages — too broad, touches all 5 migration files.

```sql
-- 0012_alter_people_role.sql

-- Step 1: Drop the old single-value check constraint
-- (constraint name may vary — check with \d people in psql)
ALTER TABLE public.people DROP CONSTRAINT IF EXISTS people_role_check;

-- Step 2: Cast column to array type
ALTER TABLE public.people
  ALTER COLUMN role TYPE TEXT[]
  USING ARRAY[role];

-- Step 3: Add new constraint — must contain at least one valid role
ALTER TABLE public.people
  ADD CONSTRAINT people_role_valid CHECK (
    role && ARRAY['admin', 'manager', 'employee', 'tenant', 'owner', 'vendor']::text[]
  );

-- Step 4: Update Auth Hook to emit primary role (first element) as JWT claim
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  claims        jsonb;
  person_record record;
BEGIN
  SELECT p.id, p.org_id, p.role
  INTO person_record
  FROM public.people p
  WHERE p.user_id = (event->>'user_id')::uuid
  LIMIT 1;

  claims := event->'claims';

  IF person_record IS NOT NULL THEN
    -- Emit first element of role array as JWT role claim (string, not array).
    -- All existing RLS policies read this as text via public.user_role() — no policy changes needed.
    claims := jsonb_set(claims, '{app_metadata,org_id}',    to_jsonb(person_record.org_id::text));
    claims := jsonb_set(claims, '{app_metadata,role}',      to_jsonb(person_record.role[1]));
    claims := jsonb_set(claims, '{app_metadata,person_id}', to_jsonb(person_record.id::text));
  END IF;

  RETURN jsonb_set(event, '{claims}', claims);
END;
$$;
```

**Downstream code changes for `role text[]`:**

1. `people/page.tsx` line 43: `callerPerson.role === 'manager'` → `callerPerson.role?.includes('manager')`
2. `people/page.tsx` line 94: `{person.role}` (renders string) → `{person.role?.join(', ')}`
3. `RemoveUserDialog`, `InviteUserForm` — check for `'manager'` in array, not equality
4. TypeScript types: regenerate `src/types/supabase.ts` after migration push

---

## RLS Policies Summary

All four new tables follow the established pattern. Quick reference:

| Table | Staff (mgr/emp) | Admin | Owner | Tenant | Vendor |
|-------|----------------|-------|-------|--------|--------|
| `properties` | Full CRUD | Full CRUD | SELECT own properties | — | — |
| `portfolios` | Full CRUD | Full CRUD | SELECT own portfolios | — | — |
| `units` (existing) | Full CRUD | Full CRUD | — | — | — |
| `leases` | Full CRUD | Full CRUD | SELECT via property ownership | SELECT own lease | — |

Units do NOT get a tenant SELECT policy in Phase 2. Tenants access unit info only through their lease query (`leases JOIN units JOIN properties`). Owners access unit info through their lease SELECT policy in later phases.

---

## Supabase Storage

### Existing Bucket: `org-assets`

Already created in `0006_storage_buckets.sql`. Current configuration:
- `public: false` — private bucket, all access via signed URLs
- `file_size_limit: 5242880` (5 MB) — adequate for logos, **too small for lease PDFs**
- `allowed_mime_types: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml']` — **does not allow `application/pdf`**

**Required bucket update for Phase 2:**

```sql
-- In 0011 or a separate 0013_update_storage_bucket.sql
UPDATE storage.buckets
SET
  file_size_limit = 20971520,  -- 20 MB (lease PDFs can be several MB)
  allowed_mime_types = ARRAY[
    'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml',
    'application/pdf'
  ]
WHERE id = 'org-assets';
```

### Path Conventions

| Asset Type | Storage Path |
|-----------|-------------|
| Property photo | `{org_id}/properties/{property_id}/photos/{filename}` |
| Lease document | `{org_id}/leases/{lease_id}/{filename}` |

**Why path-based scoping matters:** The existing storage RLS policy uses `(storage.foldername(name))[1] = (SELECT public.org_id())::text` — only the first path segment (org_id) is enforced at the policy level. Sub-paths are not restricted by RLS but are enforced by the application storing the correct path.

### Property Photos (PROP-06)

Store as `text[]` array of storage paths on `properties.photo_paths`. Simple, no extra table needed for Phase 2. UI shows a 4-up photo grid.

**Upload pattern (client component):**
```typescript
// [ASSUMED] - standard Supabase Storage upload pattern
const path = `${orgId}/properties/${propertyId}/photos/${Date.now()}-${file.name}`
const { error } = await supabase.storage
  .from('org-assets')
  .upload(path, file, { upsert: false })

if (!error) {
  // Append to properties.photo_paths array via Server Action
  await updatePropertyPhotos(propertyId, [...existingPaths, path])
}
```

**View pattern (signed URL):**
```typescript
// Server-side (RSC or Server Action)
const { data } = await supabase.storage
  .from('org-assets')
  .createSignedUrl(path, 3600)  // 1 hour for property photos (not sensitive)
```

### Lease PDF Storage and Tenant Access (LEASE-05, LEASE-06)

The existing storage RLS policy (`storage_select_staff`) only allows `manager`, `employee`, `admin`. Tenants cannot currently read any storage objects.

**Required: Add tenant storage SELECT policy** scoped to their lease document path.

```sql
-- Add to 0011_create_leases.sql or 0013_update_storage_bucket.sql

-- Tenant can read their own lease document
-- Path structure: {org_id}/leases/{lease_id}/{filename}
-- We verify the lease_id in the path belongs to the tenant via a subquery.
CREATE POLICY "storage_select_tenant_lease"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'org-assets'
  AND (storage.foldername(name))[1] = (SELECT public.org_id())::text
  AND (SELECT public.user_role()) = 'tenant'
  AND (storage.foldername(name))[2] = 'leases'
  AND EXISTS (
    SELECT 1 FROM public.leases l
    WHERE l.id::text = (storage.foldername(name))[3]
      AND l.tenant_id = (SELECT public.person_id())
      AND l.org_id = (SELECT public.org_id())
  )
);
```

**Signed URL generation for tenant download (LEASE-06):**
```typescript
// src/app/actions/leases.ts
'use server'
export async function generateLeaseDownloadUrl(leaseId: string): Promise<string | null> {
  const supabase = await createClient()

  // Verify the caller owns this lease (RLS will enforce, but explicit check is clearer)
  const { data: lease } = await supabase
    .from('leases')
    .select('document_path')
    .eq('id', leaseId)
    .single()

  if (!lease?.document_path) return null

  const { data } = await supabase.storage
    .from('org-assets')
    .createSignedUrl(lease.document_path, 60)  // 60-second expiry per UI-SPEC

  return data?.signedUrl ?? null
}
```

---

## Dashboard Data Fetching

### Summary Card Query (PROP-05, D-09)

Use a single aggregate query per metric rather than a COUNT(*) across a joined view. Simpler to read, fast with the existing org_id index.

```typescript
// In dashboard/page.tsx RSC
const [
  { count: totalUnits },
  { count: occupiedUnits },
  { count: vacantUnits },
  { count: activeLeases },
] = await Promise.all([
  supabase.from('units').select('*', { count: 'exact', head: true })
    .eq('org_id', orgId),
  supabase.from('units').select('*', { count: 'exact', head: true })
    .eq('org_id', orgId).eq('status', 'occupied'),
  supabase.from('units').select('*', { count: 'exact', head: true })
    .eq('org_id', orgId).eq('status', 'vacant'),
  supabase.from('leases').select('*', { count: 'exact', head: true })
    .eq('org_id', orgId).eq('status', 'active'),
])
```

**Note:** `org_id` is available in the RSC from the person row (same pattern as dashboard/page.tsx already uses). Do NOT rely on the JWT claim for the org_id in RSC data fetches — read from `people` row as the current page already does.

### Lease Expiry Alert Query (LEASE-03)

```typescript
// Returns leases expiring within 90 days with tenant and unit info
const ninetyDaysFromNow = new Date()
ninetyDaysFromNow.setDate(ninetyDaysFromNow.getDate() + 90)

const { data: expiringLeases } = await supabase
  .from('leases')
  .select(`
    id,
    end_date,
    tenant_id,
    people!tenant_id ( first_name, last_name ),
    units!unit_id (
      unit_number,
      properties!property_id ( street_address, city )
    )
  `)
  .eq('org_id', orgId)
  .eq('status', 'active')
  .lte('end_date', ninetyDaysFromNow.toISOString().split('T')[0])
  .order('end_date', { ascending: true })
```

**Group in component (not in query):**
```typescript
const today = new Date()
const urgencyGroups = {
  within30: expiringLeases.filter(l => diffDays(l.end_date, today) <= 30),
  within60: expiringLeases.filter(l => diffDays(l.end_date, today) <= 60 && diffDays(l.end_date, today) > 30),
  within90: expiringLeases.filter(l => diffDays(l.end_date, today) <= 90 && diffDays(l.end_date, today) > 60),
}
```

---

## People Migration: `role text` → `role text[]`

### Impact on Existing Queries

| Location | Current | After migration |
|----------|---------|----------------|
| `people/page.tsx:43` | `callerPerson.role === 'manager'` | `callerPerson.role?.includes('manager')` |
| `people/page.tsx:94` | `{person.role}` | `{person.role?.join(', ')}` |
| `people/page.tsx:141` | `callerPerson.role === 'manager'` | `callerPerson.role?.includes('manager')` |
| Auth Hook | `to_jsonb(person_record.role)` | `to_jsonb(person_record.role[1])` — emit first element |
| RLS policies | read JWT claim (unchanged) | unchanged — JWT still emits string |
| TypeScript types | `role: string` | `role: string[]` |

### Contact Role Queries

Contacts tab shows people with roles `tenant`, `owner`, or `vendor`. After migration:

```typescript
// Filter contacts (non-staff) from people table
const { data: contacts } = await supabase
  .from('people')
  .select('id, email, first_name, last_name, phone, role, active')
  .eq('org_id', orgId)
  .overlaps('role', ['tenant', 'owner', 'vendor'])  // PostgREST: &&= operator
  .eq('active', true)
```

The PostgREST `overlaps` filter maps to the `&&` PostgreSQL array operator — returns rows where `role && ARRAY['tenant', 'owner', 'vendor']`.

---

## Form Patterns

### Add Lease — Cascade Property → Unit Select

The Add Lease form requires a cascade: selecting a property populates the unit dropdown with only that property's units. This requires a **client component** (not a server form).

```typescript
// src/components/leases/AddLeaseForm.tsx
'use client'
const [selectedPropertyId, setSelectedPropertyId] = useState<string>('')
const [units, setUnits] = useState<Unit[]>([])

// When property changes, fetch units for that property
useEffect(() => {
  if (!selectedPropertyId) return
  supabase
    .from('units')
    .select('id, unit_number, status')
    .eq('property_id', selectedPropertyId)
    .eq('status', 'vacant')  // only vacant units can receive a new lease
    .then(({ data }) => setUnits(data ?? []))
}, [selectedPropertyId])
```

**Note:** The browser Supabase client is needed here (`createBrowserClient` from `@supabase/ssr`). The existing pattern can be followed from any existing client component that uses Supabase.

### Add Unit — Plan Limit Pre-Check

Before inserting a unit, check the org's plan limit (friendly error, not just the DB trigger error):

```typescript
// In createUnit Server Action
const { count } = await supabase
  .from('units')
  .select('*', { count: 'exact', head: true })
  .eq('org_id', orgId)

const { data: org } = await supabase
  .from('organizations')
  .select('plan_unit_limit')
  .eq('id', orgId)
  .single()

if ((count ?? 0) >= (org?.plan_unit_limit ?? 5)) {
  return { error: 'You have reached your plan unit limit. Upgrade to add more units.' }
}
```

---

## Tenant Lease View (/my-home)

Query path: `auth.uid()` → `people.user_id` → `people.id` (person_id) → `leases.tenant_id` → lease → unit → property.

```typescript
// src/app/(tenant)/my-home/page.tsx
const { data: person } = await supabase
  .from('people')
  .select('id, org_id')
  .eq('user_id', user.id)
  .single()

const { data: lease } = await supabase
  .from('leases')
  .select(`
    id,
    start_date,
    end_date,
    monthly_rent,
    document_path,
    units!unit_id (
      unit_number,
      properties!property_id ( street_address, city, province )
    )
  `)
  .eq('tenant_id', person.id)
  .eq('status', 'active')
  .maybeSingle()
```

The `leases_select_tenant` RLS policy ensures only the tenant's own lease is returned regardless of what tenant_id is passed.

---

## ManagerShell — Navigation

**Confirmed:** ManagerShell.tsx already includes all required nav items for Phase 2 (Dashboard, Properties, People, Leases, Maintenance, Payments, Settings). No changes needed. Source: `ManagerShell.tsx` lines 19–26 confirmed in codebase read.

Mobile bottom tab bar shows first 5: Dashboard, Properties, People, Leases, Maintenance — correct for Phase 2 (Properties and Leases are included).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Lease PDF access control | Custom token system | Supabase Storage signed URLs | Built-in, RLS-enforced, 60s expiry |
| Role-based data filter | Manual WHERE clauses in every query | RLS policies on tables | Enforced at DB layer, applies to all access paths |
| Unit count for plan limit | Custom counting logic in UI | DB trigger (`trg_enforce_plan_unit_limit`) already exists | Trigger is the authoritative gate; UI pre-check is just UX |
| Date arithmetic for expiry | Custom date library | JavaScript `Date` arithmetic + `.lte()` PostgREST filter | No library needed for simple day diff |
| Property photo gallery | Custom image component | CSS grid on `<img>` tags with signed URLs | Phase 2 is management-only; no viewer sophistication needed yet |

---

## Common Pitfalls

### Pitfall 1: Forward FK Reference in Migrations
**What goes wrong:** Writing 0008 (units extend) before 0009 (properties) causes `ERROR: relation "public.properties" does not exist` when adding the `property_id FK`.
**Prevention:** Migration order must be: properties → portfolios → extend units → leases → alter people.role. Final file numbers: 0008 through 0012.

### Pitfall 2: Bare Auth Hook Role Claim After `role text[]` Migration
**What goes wrong:** After migrating `people.role` to `text[]`, the Auth Hook emits `["manager"]` (JSON array string) as the role claim. `public.user_role()` returns `["manager"]` and `=` comparison with `'manager'` fails — all RLS policies silently deny access.
**Prevention:** Update Auth Hook in the same migration (0012) to emit `person_record.role[1]` (first array element as text). RLS policies remain unchanged.
**Warning signs:** After migration, all authenticated requests return empty results or 403 errors despite correct credentials.

### Pitfall 3: Storage Bucket MIME Type and Size Limits
**What goes wrong:** Uploading a lease PDF to `org-assets` fails silently or with a 413 error because the bucket only allows image MIME types (5 MB limit) — no `application/pdf`.
**Prevention:** Update bucket in migration (UPDATE storage.buckets SET allowed_mime_types..., file_size_limit = 20971520).
**Warning signs:** `supabase.storage.upload()` returns `{ error: { message: 'mime type ... not allowed' } }`.

### Pitfall 4: Tenant Cannot Read Lease PDF from Storage
**What goes wrong:** Tenant calls `createSignedUrl()` and gets a valid URL, but accessing the URL returns 403 because no storage SELECT policy allows tenant role.
**Prevention:** Add `storage_select_tenant_lease` policy (documented above) in the lease migration.
**Warning signs:** Signed URL generates successfully (server-side signed URL generation bypasses RLS), but the URL itself 403s when the browser fetches it. Actually — Supabase Storage signed URLs bypass RLS on access. This is fine for security because the signed URL is generated server-side after the tenant's lease record is verified via RLS on the `leases` table. The storage policy is defense-in-depth. Clarify: `createSignedUrl` is called server-side; the resulting URL is time-limited and effectively access-controlled by the server action. The storage policy is still good practice but the main security gate is the `leases_select_tenant` RLS policy + server action logic.

### Pitfall 5: `overlaps` Filter vs. `contains` for Role Queries
**What goes wrong:** Using `.contains('role', ['manager'])` when you want "person who is at least a manager" — `contains` requires ALL elements to be present. For "person who has AT LEAST ONE of these roles", use `.overlaps()`.
**Prevention:** Contacts filter uses `.overlaps('role', ['tenant', 'owner', 'vendor'])`. Staff check uses `.overlaps('role', ['manager', 'admin'])`.

### Pitfall 6: Supabase Join Syntax with Multiple FKs
**What goes wrong:** `leases` has both `tenant_id` and `unit_id` FK columns referencing `people` and `units`. PostgREST disambiguates FK joins using the hint syntax `table!column_name`.
**Prevention:** Always use the FK column hint in select strings: `people!tenant_id(...)`, `units!unit_id(...)`, `properties!property_id(...)`.

---

## Code Examples

### Server Action Pattern (create property)
```typescript
// src/app/actions/properties.ts
'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

const CreatePropertySchema = z.object({
  street_address: z.string().min(1),
  city: z.string().min(1),
  province: z.string().min(2),
  postal_code: z.string().optional(),
  property_type: z.enum(['house', 'duplex', 'apartment_building', 'condo', 'townhouse', 'other']),
  owner_id: z.string().uuid().optional(),
  portfolio_id: z.string().uuid().optional(),
})

export async function createProperty(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const parsed = CreatePropertySchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: parsed.error.flatten() }

  const { data: person } = await supabase
    .from('people').select('org_id').eq('user_id', user.id).single()
  if (!person) return { error: 'Unauthorized' }

  const { error } = await supabase
    .from('properties')
    .insert({ ...parsed.data, org_id: person.org_id })

  if (error) return { error: error.message }

  revalidatePath('/properties')
  return { success: true }
}
```

### RSC Data Fetch with Join (lease list)
```typescript
// In leases/page.tsx
const { data: leases } = await supabase
  .from('leases')
  .select(`
    id, start_date, end_date, monthly_rent, status, renewal_status,
    people!tenant_id ( first_name, last_name ),
    units!unit_id (
      unit_number,
      properties!property_id ( street_address, city )
    )
  `)
  .eq('org_id', person.org_id)
  .order('end_date', { ascending: true })
```

---

## Environment Availability

Step 2.6: SKIPPED — this phase has no new external tool dependencies. Supabase is already configured, storage bucket already exists. The only "new" capability is PDF MIME type in the bucket, handled by a SQL migration.

---

## Validation Architecture

No automated test framework is configured in this project. Manual validation per task completion is the current approach. Phase 2 plan should include explicit verification steps at the end of each wave:

| Req ID | Behavior | Verification |
|--------|----------|-------------|
| PEOPLE-01/02/04 | Create, edit, deactivate contact | Manual: Create contact in UI, verify in Supabase table |
| PEOPLE-03 | Multi-role person | Manual: Assign two roles, verify `role` array in DB |
| PROP-01/02/03/04 | Create property with owner + portfolio | Manual: Create flow in UI |
| PROP-06 | Upload photo | Manual: Upload JPEG, verify signed URL displays |
| LEASE-01 | Create lease | Manual: Select tenant + unit + dates |
| LEASE-03 | Expiry alerts | Manual: Create lease with end_date 20 days out, verify alert appears |
| LEASE-05 | Upload PDF | Manual: Upload PDF, verify it stores and links |
| LEASE-06 | Tenant download | Manual: Sign in as tenant, verify download button works |

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V4 Access Control | Yes | RLS policies per table + per storage path |
| V5 Input Validation | Yes | zod schemas in all Server Actions |
| V2 Authentication | Inherited | Supabase Auth from Phase 1 — no new auth in Phase 2 |
| V6 Cryptography | N/A | Storage signed URLs handled by Supabase SDK |

### Known Threat Patterns

| Pattern | STRIDE | Mitigation |
|---------|--------|-----------|
| Tenant reads another tenant's lease PDF | Information Disclosure | `leases_select_tenant` RLS + Server Action verifies tenant_id before generating signed URL |
| Manager uploads file to another org's storage path | Elevation of Privilege | Storage RLS: `(storage.foldername(name))[1] = (SELECT public.org_id())::text` |
| Contact created with role='admin' | Elevation of Privilege | `people_insert_manager` policy only allows org-scoped insert; role array value `admin` is blocked in Server Action — validate that no contact form allows admin role |
| Lease created for unit in different org | Tampering | `leases_insert_manager` WITH CHECK includes `org_id = (SELECT public.org_id())` |

**Important:** The AddContactForm must NOT include 'admin' in the role multi-select options. The role `admin` is a platform superuser role, not a contact role. Contacts can only be: tenant, owner, vendor.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `supabase.storage.createSignedUrl()` for PRIVATE buckets generates URLs accessible without further auth (the URL itself is the access token) | Lease PDF download | If wrong, tenant download would fail silently despite URL generation succeeding |
| A2 | PostgREST `.overlaps()` filter maps to PostgreSQL `&&` array operator | People queries | If wrong, contacts tab filter would fail or return wrong results |
| A3 | `storage.foldername(name)[3]` extracts the third path segment (lease_id) for tenant storage policy | Storage RLS | Path segment indexing may be 1-based — verify with Supabase docs |

**A3 clarification:** Supabase `storage.foldername()` returns a 1-indexed array in PostgreSQL. For path `{org_id}/leases/{lease_id}/filename.pdf`:
- `[1]` = org_id
- `[2]` = 'leases'
- `[3]` = lease_id
- `[4]` = filename

This is consistent with the existing `(storage.foldername(name))[1]` usage in 0006_storage_buckets.sql. [VERIFIED: existing codebase pattern]

---

## Sources

### Primary (HIGH confidence — codebase verified)
- `canary-propos/supabase/migrations/0002_create_people.sql` — current `people` table schema (role TEXT)
- `canary-propos/supabase/migrations/0003_rls_helpers.sql` — Auth Hook, `org_id()`, `user_role()`, `person_id()` helper functions
- `canary-propos/supabase/migrations/0005_rls_people.sql` — RLS policy pattern to replicate
- `canary-propos/supabase/migrations/0006_storage_buckets.sql` — storage bucket config and RLS
- `canary-propos/supabase/migrations/0007_units_plan_limit.sql` — existing units table and plan-limit trigger
- `canary-propos/src/app/(manager)/people/page.tsx` — RSC + client component pattern
- `canary-propos/src/components/layout/ManagerShell.tsx` — confirmed nav items

### Secondary (MEDIUM confidence)
- CONTEXT.md locked decisions D-01 through D-10 — all schema design decisions derive from these
- UI-SPEC.md — form fields, page layouts, path conventions confirmed

### Tertiary (LOW confidence — [ASSUMED])
- A1, A2, A3 as documented in Assumptions Log

---

## Metadata

**Confidence breakdown:**
- Schema design: HIGH — directly derived from existing migrations and locked decisions
- RLS policies: HIGH — copied from established pattern with table-specific adaptations
- Storage patterns: HIGH — existing bucket code is the canonical reference; MIME update is straightforward SQL
- Auth Hook migration strategy: HIGH — code is present, risk is analyzed, Option A is clearly safe
- Data fetch queries: MEDIUM — PostgREST join syntax and `overlaps` filter are [ASSUMED] correct but not verified against live DB in this session

**Research date:** 2026-06-21
**Valid until:** 2026-09-21 (stable stack; schema decisions are locked)
