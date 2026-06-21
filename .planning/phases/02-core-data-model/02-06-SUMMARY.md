---
phase: 02-core-data-model
plan: "06"
subsystem: tenant-portal
tags: [tenant, lease, pdf-download, rls, server-actions]
dependency_graph:
  requires: ["02-04"]
  provides: ["LEASE-06"]
  affects: []
tech_stack:
  added: []
  patterns:
    - RSC lease card with maybeSingle RLS-scoped query
    - Client component (LeaseDownloadButton) calling server action via startTransition
    - 60-second signed URL via Supabase Storage createSignedUrl
key_files:
  created:
    - canary-propos/src/app/(tenant)/my-home/LeaseDownloadButton.tsx
  modified:
    - canary-propos/src/app/(tenant)/my-home/page.tsx
    - canary-propos/src/app/actions/leases.ts
decisions:
  - Signed URL expiry set to 60 seconds — enough for tab open, not persistent link
  - Download button disabled (not hidden) when no document_path, with tooltip
  - generateLeaseDownloadUrl added to existing leases.ts server actions file
metrics:
  duration: "~2 hours"
  completed: "2026-06-21"
  tasks_completed: 1
  tasks_total: 1
  files_changed: 3
---

# Phase 2 Plan 06: Tenant /my-home Lease Card Summary

Replaced the /my-home placeholder with a tenant-facing lease view. Tenant sees their active lease details (property address, unit, term, rent) and can download their lease PDF via a 60-second signed URL generated server-side.

## What Was Built

- **`/my-home` RSC page** — queries `leases` joined to `units` and `properties` via `maybeSingle()` scoped to `tenant_id`. Renders a lease card with property address, unit number, lease term dates, and monthly rent.
- **`LeaseDownloadButton` client component** — calls `generateLeaseDownloadUrl` server action via `startTransition`, then opens the signed URL in a new tab. Disabled with tooltip when no `document_path` on the lease.
- **`generateLeaseDownloadUrl` server action** — added to `canary-propos/src/app/actions/leases.ts`. Uses Supabase Storage `createSignedUrl` with 60-second expiry. RLS on the `leases` table ensures tenants can only reach their own lease record.
- **Empty state** — shown when no active lease found, with contact message.

## Verification Results

All 6 human verification checks approved:
1. Tenant sees lease card with property address, unit, term dates, and rent
2. Download PDF button present when document exists
3. Clicking Download opens signed URL in new tab
4. Download button disabled with tooltip when no document uploaded
5. Empty state shown when no active lease found
6. Tenant cannot access another tenant's lease (RLS enforced)

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — lease data is live from the database via RLS-scoped query.

## Threat Surface Scan

No new network endpoints or auth paths introduced. `generateLeaseDownloadUrl` is a server action gated by Supabase Auth session and `leases_select_tenant` RLS policy — tenant can only generate a signed URL for their own lease document.

## Self-Check: PASSED

- `canary-propos/src/app/(tenant)/my-home/LeaseDownloadButton.tsx` — created in commit 50c4f98
- `canary-propos/src/app/(tenant)/my-home/page.tsx` — modified in commit 50c4f98
- `canary-propos/src/app/actions/leases.ts` — modified in commit 50c4f98
