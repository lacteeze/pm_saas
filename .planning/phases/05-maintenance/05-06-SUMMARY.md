---
phase: 05-maintenance
plan: "06"
subsystem: tenant-portal
tags: [maintenance, work-orders, tenant-portal, forms]
dependency_graph:
  requires: [05-02, 05-04, 05-05]
  provides: [tenant-work-order-list, tenant-create-work-order]
  affects: [my-home, work_orders-table]
tech_stack:
  added: []
  patterns: [RSC-with-client-form-split, safe-column-selection, server-action-org-resolution]
key_files:
  created:
    - canary-propos/src/app/actions/work-orders.ts
    - canary-propos/src/app/(tenant)/my-home/maintenance/page.tsx
    - canary-propos/src/app/(tenant)/my-home/maintenance/new/page.tsx
    - canary-propos/src/app/(tenant)/my-home/maintenance/new/NewMaintenanceRequestForm.tsx
  modified:
    - canary-propos/src/components/layout/TenantShell.tsx
decisions:
  - "Split client form from RSC page wrapper to correctly separate server/client boundary"
  - "org_id always resolved from session in createWorkOrder (never from form input) — T-05-21"
  - "Maintenance nav updated from /maintenance-requests to /my-home/maintenance"
metrics:
  duration: ~15 minutes
  completed: 2026-06-23
---

# Phase 05 Plan 06: Tenant Maintenance Request Form + Work Order List Summary

Tenant-facing maintenance surfaces added to the tenant portal: a work order list at `/my-home/maintenance` and a create form at `/my-home/maintenance/new`. Reuses the `createWorkOrder` server action created in this plan (no prior Phase 5 actions existed yet).

## What Was Built

### `createWorkOrder` Server Action (`src/app/actions/work-orders.ts`)
- Accepts `{ property_id, unit_id?, title, description, priority }` from both managers and tenants
- Resolves `org_id` from the caller's session (never from form input) — mitigates T-05-21
- Validates role includes `manager`, `admin`, or `tenant`
- Creates work order with `status: 'draft'` and `created_by: person.id`
- Revalidates both `/maintenance` and `/my-home/maintenance` paths

### `/my-home/maintenance` — Tenant Work Order List (RSC)
- Role-guards to `tenant` only
- Queries `work_orders` with explicit safe column list: `id, title, description, priority, status, created_at, updated_at, properties(street_address, city)`
- **Never selects**: `vendor_cost`, `billed_amount`, `estimated_cost`, `vendor_token`, `owner_approve_token`, `owner_decline_token`, `assigned_vendor_id` — mitigates T-05-20
- RLS `tenants_select_own` policy automatically scopes to `created_by = person.id`
- Desktop: table with Title, Property, Priority badge, Status badge, Submitted date
- Mobile: card list with same data
- Empty state with "Submit your first request" link

### `/my-home/maintenance/new` — Tenant Create Form
- RSC wrapper (`page.tsx`) resolves `property_id` and `unit_id` from tenant's active lease server-side before rendering client form
- Client form (`NewMaintenanceRequestForm.tsx`) uses `react-hook-form` + `zod` validation
- Fields: title (min 3 chars), description (min 10 chars), priority select (default medium)
- On success: redirects to `/my-home/maintenance?submitted=1`
- Graceful fallback if tenant has no active lease

### `TenantShell.tsx` Nav Update
- Updated "Maintenance" nav item from `/maintenance-requests` → `/my-home/maintenance`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Split `'use client'` + server imports into separate files**
- **Found during:** Writing `new/page.tsx`
- **Issue:** Initial draft mixed `'use client'` directive with server-only imports (`redirect`, `createClient`) in one file — invalid in Next.js App Router
- **Fix:** Split into `page.tsx` (RSC, no 'use client') that renders `NewMaintenanceRequestForm.tsx` (client component)
- **Files modified:** `new/page.tsx`, new file `new/NewMaintenanceRequestForm.tsx`
- **Commit:** f5792b0

**2. [Rule 2 - Missing] createWorkOrder action created in this plan**
- **Found during:** Plan execution
- **Issue:** Plan referenced `createWorkOrder` from 05-02 but no work-orders action file existed
- **Fix:** Created `src/app/actions/work-orders.ts` with `createWorkOrder` following existing action patterns

## Security Notes (Threat Model Compliance)

| Threat | Mitigation Applied |
|--------|--------------------|
| T-05-20: Cost/token column disclosure | Explicit safe column list in RSC — no SELECT * anywhere |
| T-05-21: Cross-org work order creation | `org_id` resolved from `ctx.person.org_id` (session), not form input |
| T-05-22: Vendor contact info exposure | `assigned_vendor_id` excluded from tenant queries |

## Self-Check: PASSED

Files created:
- canary-propos/src/app/actions/work-orders.ts ✓
- canary-propos/src/app/(tenant)/my-home/maintenance/page.tsx ✓
- canary-propos/src/app/(tenant)/my-home/maintenance/new/page.tsx ✓
- canary-propos/src/app/(tenant)/my-home/maintenance/new/NewMaintenanceRequestForm.tsx ✓

Commit f5792b0 exists ✓
