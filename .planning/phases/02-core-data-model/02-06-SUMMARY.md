---
phase: 02-core-data-model
plan: "06"
subsystem: tenant-portal
tags: [tenant, lease, pdf-download, signed-url, rls]
dependency_graph:
  requires: ["02-01", "02-04"]
  provides: [tenant-lease-view, lease-pdf-download]
  affects: [tenant-portal]
tech_stack:
  added: []
  patterns: [RSC-data-fetch, server-action-signed-url, client-component-download]
key_files:
  created:
    - canary-propos/src/app/(tenant)/my-home/LeaseDownloadButton.tsx
    - canary-propos/src/app/actions/leases.ts
  modified:
    - canary-propos/src/app/(tenant)/my-home/page.tsx
decisions:
  - "LeaseDownloadButton extracted as a co-located client component (same route folder) instead of src/components/leases/ since Plan 02-04 was not yet executed"
  - "generateLeaseDownloadUrl server action created here (normally Plan 02-04's artifact) — auto-deviation Rule 3 (blocking dependency missing)"
metrics:
  duration: "~10 minutes"
  completed: "2026-06-21"
  tasks_completed: 1
  tasks_total: 2
  files_changed: 3
---

# Phase 2 Plan 06: Tenant /my-home Lease Card + PDF Download Summary

Tenant-facing lease view at /my-home showing the active lease card (property address, unit, term, rent) with a 60-second signed URL PDF download via server action.

## What Was Built

### Task 1: Tenant /my-home lease card (COMPLETED)
- **`src/app/(tenant)/my-home/page.tsx`** — RSC page: auth guard → person row → active lease query (maybeSingle) → lease card with property/unit/term/rent rows → empty state when no lease
- **`src/app/(tenant)/my-home/LeaseDownloadButton.tsx`** — 'use client' component; calls `generateLeaseDownloadUrl` server action in `startTransition`, opens signed URL in new tab. Disabled with tooltip when `hasDocument=false`. Error message on failed URL generation.
- **`src/app/actions/leases.ts`** — `generateLeaseDownloadUrl(leaseId)` server action; fetches `document_path` via RLS-scoped query (only tenant's own lease returned), calls `storage.createSignedUrl` with 60s TTL.

### Task 2: Human verification checkpoint (PENDING)
Requires end-to-end tenant sign-in and PDF download verification.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] generateLeaseDownloadUrl server action created in this plan**
- **Found during:** Task 1 setup
- **Issue:** Plan 02-04 (leases list/detail pages) was not executed in this worktree; `src/app/actions/leases.ts` did not exist.
- **Fix:** Created `src/app/actions/leases.ts` with `generateLeaseDownloadUrl` as specified by the 02-04 plan interface. Identical signature and behavior.
- **Files modified:** `canary-propos/src/app/actions/leases.ts`
- **Commit:** 50c4f98

**2. [Rule 3 - Blocking] LeaseDownloadButton co-located in route folder**
- **Found during:** Task 1
- **Issue:** `src/components/leases/LeaseDownloadButton.tsx` referenced in plan doesn't exist (Plan 02-04 not executed). Rather than create it in the components folder (Plan 02-04's responsibility), co-located as a route-adjacent client component.
- **Fix:** Created `src/app/(tenant)/my-home/LeaseDownloadButton.tsx` — functionally equivalent.
- **Commit:** 50c4f98

## Known Stubs

None — lease data is fetched live from the database.

## Threat Flags

None — no new trust boundaries introduced beyond those documented in the plan's threat model (T-02-19, T-02-20, T-02-21).

## Self-Check: PASSED

- `canary-propos/src/app/(tenant)/my-home/page.tsx` — exists, verified
- `canary-propos/src/app/(tenant)/my-home/LeaseDownloadButton.tsx` — exists, verified
- `canary-propos/src/app/actions/leases.ts` — exists, verified
- Commit 50c4f98 — confirmed via git log
