---
phase: 02-core-data-model
plan: "03"
subsystem: properties-ui
tags: [properties, units, portfolios, server-actions, photo-upload, tabs, rsc]
dependency_graph:
  requires: ["02-01"]
  provides: [properties-list-page, property-detail-page, add-property-action, add-unit-action, photo-upload, expiry-alert-callout]
  affects: ["02-04", "02-05"]
tech_stack:
  added: []
  patterns:
    - RSC page with session+caller pattern (role as text[].includes())
    - Supabase FK hint disambiguation (people!owner_id, portfolios!portfolio_id)
    - Browser-side Supabase storage upload via createBrowserClient
    - Plan-limit pre-check in createUnit server action
    - Native tabs component (no external primitive, avoids @radix-ui dependency)
    - Dialog pattern from InviteUserForm (render={<span />} + onClick)
key_files:
  created:
    - canary-propos/src/app/actions/properties.ts
    - canary-propos/src/app/actions/units.ts
    - canary-propos/src/app/actions/portfolios.ts
    - canary-propos/src/app/(manager)/properties/page.tsx
    - canary-propos/src/app/(manager)/properties/[id]/page.tsx
    - canary-propos/src/components/properties/AddPropertyForm.tsx
    - canary-propos/src/components/properties/AddUnitForm.tsx
    - canary-propos/src/components/properties/PropertyPhotoUpload.tsx
    - canary-propos/src/components/leases/ExpiryAlertCallout.tsx
    - canary-propos/src/components/ui/tabs.tsx
  modified: []
decisions:
  - "Native tabs component (no @radix-ui/react-tabs) — project uses @base-ui/react and radix-ui unified package; tabs primitive not available, native implementation sufficient"
  - "ActionResult defined per-file (not shared from properties.ts) to avoid circular import patterns"
  - "Property unit counts computed from all-units fetch grouped by property_id rather than per-property subqueries — simpler and avoids N+1"
metrics:
  duration: "~45 minutes"
  completed: "2026-06-21"
  tasks_completed: 2
  files_created: 10
  files_modified: 0
---

# Phase 2 Plan 03: Properties Pages Summary

Properties section implemented with server actions, list page, detail page, all forms, photo upload, and lease expiry callout.

## What Was Built

### Server Actions (Task 1)

**`src/app/actions/properties.ts`** — `createProperty`, `updateProperty`, `updatePropertyPhotos`
- Zod validation with `property_type_enum` values
- Role check via `role?.includes('manager') || role?.includes('admin')` (text[] pattern)
- `org_id` derived from JWT via `getCallerContext()`, never from form data (T-02-09)
- `updatePropertyPhotos` updates `photo_paths[]` without validating paths (Storage RLS enforces)

**`src/app/actions/units.ts`** — `createUnit`, `updateUnit`
- Plan-limit pre-check: parallel fetch of `org.plan_unit_limit` + current unit count
- Friendly error if `count >= limit` before DB insert
- DB-level trigger handles authoritative enforcement (pre-check is UX only)
- Handles trigger error code `P0001` as plan limit error

**`src/app/actions/portfolios.ts`** — `createPortfolio`
- Simple name + optional owner_id insert

### Pages and Components (Task 2)

**`/properties` list page**
- RSC with session+caller pattern; `role?.includes()` check
- Fetches properties with FK-hint joins: `people!owner_id(...)`, `portfolios!portfolio_id(...)`
- All units fetched once, grouped by `property_id` in component — avoids N+1
- Desktop table: Address, Portfolio, Owner, Units, Occupancy, Actions
- Mobile cards: address, owner, portfolio, unit count + occupancy, View link
- Empty state with AddPropertyForm inline

**`/properties/[id]` detail page**
- `params` received as `Promise<{ id: string }>` (Next.js 15 async params)
- Org-scoped property fetch with redirect to `/properties` if not found
- Three tabs: Building Info, Units, Leases
- Building Info: address/type/owner/portfolio card + PropertyPhotoUpload
- Units: desktop table + mobile cards, status badges (green/amber/red)
- Leases: ExpiryAlertCallout + lease rows with tenant name, period, rent

**`AddPropertyForm`**
- Province select pre-populated from `orgProvince` prop (org.province)
- All 13 Canadian provinces/territories via `CANADIAN_PROVINCES` constant
- Owner select from `owners` prop (people with 'owner' role)
- Portfolio select from `portfolios` prop
- `toast.success('Property created')` on success

**`AddUnitForm`**
- Amenities as checkboxes (not text input): Parking, Laundry, Dishwasher, AC, Balcony, Storage
- Status select defaulting to 'vacant'
- Plan-limit error shown inline below form
- `bathrooms` uses step=0.5 input

**`PropertyPhotoUpload`**
- `createBrowserClient` from `@supabase/ssr` — correct for browser-side upload (not `createClient`)
- Upload path: `{orgId}/properties/{propertyId}/photos/{Date.now()}-{filename}`
- Calls `updatePropertyPhotos` server action after successful upload
- Creates signed URLs (3600s) for display in photo grid

**`ExpiryAlertCallout`**
- Props: `leases: Array<{ id, tenantName, propertyUnit, endDate, daysUntilExpiry }>`
- Three buckets: <=30d (red-50/red-200/red-700), 31-60d (amber), 61-90d (stone)
- Each bucket renders only if non-empty; null if no expiring leases

**`Tabs` component** (`src/components/ui/tabs.tsx`)
- Native React implementation using Context (no @radix-ui dependency)
- API matches shadcn/ui pattern: `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent`
- `defaultValue` + controlled `value`/`onValueChange` both supported

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Tabs primitive not available**
- **Found during:** Task 2 setup
- **Issue:** Plan referenced `shadcn Tabs` but project uses `@base-ui/react` (not `@radix-ui/react-tabs`), and `@base-ui/react` does not expose a tabs primitive in v1.6. No `tabs.tsx` existed in `src/components/ui/`.
- **Fix:** Implemented native React tabs component with Context API. API matches shadcn/ui convention exactly so the detail page code doesn't deviate from plan.
- **Files modified:** `canary-propos/src/components/ui/tabs.tsx` (created)
- **Commit:** e4b45f9

**2. [Rule 2 - Missing Critical] `ActionResult` defined per-file**
- **Found during:** Task 1 refactoring
- **Issue:** Initially imported `ActionResult` from `properties.ts` into `units.ts` and `portfolios.ts`. This creates coupling and a re-export that could cause circular type issues.
- **Fix:** Each action file defines its own `ActionResult` type (2 lines). Correct pattern for isolated server action modules.
- **Files modified:** `units.ts`, `portfolios.ts`

## Security Notes

- T-02-09 (Elevation of Privilege): `org_id` always derived from authenticated `people` row, never from form body
- T-02-10 (Information Disclosure): property detail fetch includes `.eq('org_id', callerPerson.org_id)` guard
- T-02-11 (Storage path tampering): `PropertyPhotoUpload` uses browser client with auth session; Storage RLS enforces org_id path prefix
- T-02-12 (Photo size DoS): Bucket file_size_limit enforced by Supabase (20MB) at storage layer

## Known Stubs

- Units tab Actions column shows a static "Edit" text — full `AddUnitForm` in edit mode deferred (not in plan scope for Phase 2)
- Leases tab links to `/leases/[id]` which does not exist yet (Plan 02-04 will build it)

## Threat Flags

None — no new security surface beyond what the plan's threat model covers.

## Self-Check: PASSED

Files confirmed created:
- canary-propos/src/app/actions/properties.ts
- canary-propos/src/app/actions/units.ts
- canary-propos/src/app/actions/portfolios.ts
- canary-propos/src/app/(manager)/properties/page.tsx
- canary-propos/src/app/(manager)/properties/[id]/page.tsx
- canary-propos/src/components/properties/AddPropertyForm.tsx
- canary-propos/src/components/properties/AddUnitForm.tsx
- canary-propos/src/components/properties/PropertyPhotoUpload.tsx
- canary-propos/src/components/leases/ExpiryAlertCallout.tsx
- canary-propos/src/components/ui/tabs.tsx

Commits:
- 0c842a7 feat(02-03): server actions for properties, units, portfolios
- e4b45f9 feat(02-03): properties list page, detail page, components, ExpiryAlertCallout
