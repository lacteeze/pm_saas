---
phase: 04-payments
plan: "06"
subsystem: payments
tags: [tenant-portal, receipts, csv-export, payments]
dependency_graph:
  requires: [04-04, 04-05]
  provides: [tenant-payment-history, receipt-page, csv-export]
  affects: [tenant-portal, manager-portal]
tech_stack:
  added: []
  patterns: [RSC-data-fetch, RLS-notFound-guard, csv-generation, role-check]
key_files:
  created:
    - canary-propos/src/app/(tenant)/my-home/payments/page.tsx
    - canary-propos/src/app/(tenant)/receipts/[paymentId]/page.tsx
    - canary-propos/src/app/(tenant)/receipts/[paymentId]/PrintButton.tsx
    - canary-propos/src/app/(manager)/payments/page.tsx
    - canary-propos/src/app/(manager)/payments/export/route.ts
  modified: []
decisions:
  - Manager payments page created in 04-06 (was expected from 04-04 but absent) — Rule 3 auto-fix to unblock Export CSV button
metrics:
  duration: ~20min
  completed: 2026-06-22
  tasks_completed: 2
  tasks_total: 2
---

# Phase 04 Plan 06: Tenant Payment History, Receipts, and Manager CSV Export Summary

Tenant payment history at /my-home/payments with per-payment receipt pages, plus manager-only CSV export of all org payments — no vendor_cost exposed, RLS guards cross-tenant access.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Tenant payment history + receipt page | 2727cc7 | my-home/payments/page.tsx, receipts/[paymentId]/page.tsx, PrintButton.tsx |
| 2 | Manager CSV export route | fad2173 | (manager)/payments/page.tsx, payments/export/route.ts |

## What Was Built

**Tenant payment history (`/my-home/payments`):** Server Component that loads all payments for the tenant's active lease(s). Desktop table with Date/Amount/Method/Status/Receipt columns. Mobile card layout (date+amount first row, method+status second, View link). Status badges: green=cleared, amber=pending_clearance, red=failed. Each row links to `/receipts/[id]`.

**Receipt page (`/receipts/[paymentId]`):** Server Component with full join (payments → leases → units → properties → people). Calls `notFound()` if payment not found — RLS returns null for cross-tenant access. Two-column detail layout: Payment Reference (last 8 chars of UUID, uppercase), date, tenant name, property/unit, amount, method, status, notes. Print-friendly via `@media print` CSS hiding `.no-print` elements. `PrintButton` is a separate `'use client'` component calling `window.print()`.

**Manager payments page (`/payments`):** Server Component listing all org payments with tenant/property join. "Export CSV" button with `download` attribute linking to `/payments/export`. Manager role guard redirects non-managers to /login.

**CSV export route (`/payments/export`):** GET route handler. Auth check (401), person lookup (401), role check — requires `manager` or `admin` (403). Queries payments with tenant+property join scoped by `org_id`. Builds CSV with `csvEscape()` helper (quotes fields containing commas/quotes). Headers: Date, Tenant, Property, Unit, Amount, Method, Status, Notes. Returns `text/csv; charset=utf-8` with `Content-Disposition: attachment; filename="payments-export-YYYY-MM-DD.csv"`.

## Security Verification

- `notFound()` called when payment row not returned (T-04-20: cross-tenant receipt access)
- `org_id` WHERE clause on CSV query (T-04-21: CSV data scope)
- `role.includes('manager')` role check before CSV query (T-04-22: tenant elevation)
- `vendor_cost` absent from all SELECT statements

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Manager payments page missing from 04-04**
- **Found during:** Task 2
- **Issue:** Plan 04-06 task 2 specified adding "Export CSV" button to existing `/payments` page from 04-04, but that page was never created.
- **Fix:** Created the full manager payments page as part of this plan, including the Export CSV button.
- **Files modified:** canary-propos/src/app/(manager)/payments/page.tsx (created)
- **Commit:** fad2173

## Known Stubs

None — payment data flows from live DB queries.

## Threat Flags

None — all new surface covered by existing threat model entries T-04-20 through T-04-22.

## Self-Check: PASSED

- canary-propos/src/app/(tenant)/my-home/payments/page.tsx — FOUND
- canary-propos/src/app/(tenant)/receipts/[paymentId]/page.tsx — FOUND
- canary-propos/src/app/(tenant)/receipts/[paymentId]/PrintButton.tsx — FOUND
- canary-propos/src/app/(manager)/payments/page.tsx — FOUND
- canary-propos/src/app/(manager)/payments/export/route.ts — FOUND
- Commit 2727cc7 — FOUND
- Commit fad2173 — FOUND
