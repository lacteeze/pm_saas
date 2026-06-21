---
phase: 02-core-data-model
plan: "05"
subsystem: dashboard
tags: [dashboard, summary-cards, lease-expiry, RSC]
dependency_graph:
  requires: ["02-01", "02-03", "02-04"]
  provides: ["dashboard-summary-cards", "expiry-alert-callout"]
  affects: ["canary-propos/src/app/(manager)/dashboard/page.tsx"]
tech_stack:
  added: []
  patterns: ["Promise.all aggregate counts", "RSC server-side data fetch", "foreign key hint joins with .returns<T[]>()"]
key_files:
  created:
    - canary-propos/src/components/dashboard/SummaryCards.tsx
    - canary-propos/src/components/leases/ExpiryAlertCallout.tsx
  modified:
    - canary-propos/src/app/(manager)/dashboard/page.tsx
decisions:
  - "Created ExpiryAlertCallout in this plan (not 02-03 as planned) because plan 02-03 runs in parallel and may not have completed before this wave"
  - "Used .returns<ExpiringLeaseRow[]>() to type the Supabase join response cleanly instead of nested Array.isArray casts"
metrics:
  duration: "~15 min"
  completed: "2026-06-21"
  tasks_completed: 1
  files_changed: 3
---

# Phase 02 Plan 05: Dashboard Summary Cards + Lease Expiry Alerts Summary

Dashboard placeholder replaced with live portfolio metrics and 90-day lease expiry alerts, using Promise.all aggregate Supabase count queries and typed foreign key joins in a single RSC.

## Tasks Completed

| Task | Description | Commit |
|------|-------------|--------|
| 1 | SummaryCards component + dashboard page.tsx update + ExpiryAlertCallout | ef8f716 |

## What Was Built

**SummaryCards** (`src/components/dashboard/SummaryCards.tsx`): Pure RSC-compatible functional component with no `'use client'` directive. Renders a `grid-cols-2 md:grid-cols-4` card grid. Each card shows a Lucide icon, metric value (`text-xl font-semibold`), and label (`text-xs uppercase tracking-wide text-stone-500`). Four cards: Total Units (Building2), Occupied (Users), Vacant (DoorOpen), Active Leases (FileText).

**ExpiryAlertCallout** (`src/components/leases/ExpiryAlertCallout.tsx`): Groups expiring leases into three urgency buckets — ≤30 days (red), 31–60 days (amber), 61–90 days (stone). Each bucket only renders if non-empty. Shows tenant name, property/unit label, and days-remaining badge. Returning `null` when no expiring leases means the section is fully absent (not an empty placeholder).

**Dashboard page.tsx** (`src/app/(manager)/dashboard/page.tsx`): Extended with:
- `Promise.all` for 4 parallel count queries (total units, occupied, vacant, active leases), all scoped to `orgId` (T-02-17)
- Expiring-lease query with `people!tenant_id` + `units!unit_id(properties!property_id)` joins, typed via `.returns<ExpiringLeaseRow[]>()` to avoid runtime `Array.isArray` guards
- `daysUntilExpiry` computed server-side from today midnight vs. `end_date`
- SetupBanner retained at top (D-02)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] ExpiryAlertCallout did not exist**
- **Found during:** Task 1 — component was supposed to be created in Plan 02-03 (wave 2), which runs in parallel with this wave 3 plan
- **Fix:** Created `ExpiryAlertCallout.tsx` in this plan to unblock execution
- **Files modified:** `canary-propos/src/components/leases/ExpiryAlertCallout.tsx`
- **Commit:** ef8f716

**2. [Rule 1 - Code quality] Supabase join type casting**
- **Found during:** Implementation review — initial approach used nested `Array.isArray` guards which are fragile
- **Fix:** Used `.returns<ExpiringLeaseRow[]>()` with a typed inline type alias for clean property access
- **Files modified:** `canary-propos/src/app/(manager)/dashboard/page.tsx`
- **Commit:** ef8f716

## Known Stubs

None — all 4 count cards display real database values (`count ?? 0`). Expiry section only renders when real expiring leases exist.

## Self-Check: PASSED

- `canary-propos/src/components/dashboard/SummaryCards.tsx` — created
- `canary-propos/src/components/leases/ExpiryAlertCallout.tsx` — created
- `canary-propos/src/app/(manager)/dashboard/page.tsx` — updated
- Commit ef8f716 — verified in git log
