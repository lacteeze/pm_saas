---
phase: 05-maintenance
plan: "02"
subsystem: maintenance
tags: [state-machine, server-actions, work-orders, tdd]
dependency_graph:
  requires: [05-01]
  provides: [TRANSITIONS map, validateTransition, createWorkOrder, updateWorkOrderStatus, updateViaVendorToken, notifyOwnerPendingApproval]
  affects: [05-03, 05-04, 05-05]
tech_stack:
  added: []
  patterns: [server-action-pattern, getCallerContext, TDD-red-green, $500-approval-gate, admin-client-vendor-token]
key_files:
  created:
    - canary-propos/src/lib/work-orders/transitions.ts
    - canary-propos/src/lib/work-orders/notifications.ts
    - canary-propos/src/app/actions/work-orders.ts
    - canary-propos/tests/work-orders/transitions.test.ts
  modified: []
decisions:
  - "TRANSITIONS map is keyed on target state (not source), making it easy to look up all predecessors and allowed roles for any state"
  - "Owner notification is fire-and-forget (Promise.catch) — email failure does not roll back the status update"
  - "Expense creation on completed only fires when both vendor_cost and billed_amount are present — prevents incomplete expense records in the vendor-only flow"
  - "notifications.ts uses createElement() not JSX to avoid requiring tsconfig JSX settings in a lib file"
  - "In-app notification record deferred to Phase 5 v2 — notifications table not yet created in this phase"
metrics:
  duration: "~25 minutes"
  completed_date: "2026-06-23"
  tasks_completed: 2
  files_created: 4
---

# Phase 05 Plan 02: State Machine + Server Actions Summary

Work order state machine library (TRANSITIONS constant + validateTransition) and all server actions that drive the work order lifecycle. Tested with TDD — unit tests written first, then implementation.

## What Was Built

### Task 1: State Machine Transitions Library (TDD)

`src/lib/work-orders/transitions.ts` exports:

- `WorkOrderStatus` — union type of 8 valid states: draft | submitted | assigned | in_progress | pending_approval | approved | completed | closed
- `TransitionRule` — `{ allowedFrom, allowedRoles, requiredFields? }`
- `TRANSITIONS` — 8-entry Record mapping each target state to its TransitionRule
- `validateTransition(from, to, callerRoles)` — returns `{valid: true}` or `{valid: false, error: string}`

Tests in `tests/work-orders/transitions.test.ts` cover all behavior cases from the plan spec. TypeScript compiles cleanly.

### Task 2: Server Actions + Owner Notification Helper

**`src/lib/work-orders/notifications.ts`:**
- `notifyOwnerPendingApproval(workOrderId, orgId, propertyId, estimatedCost, approveToken, declineToken)` — looks up property owner email via admin client, sends Resend email with approve/decline buttons. Skips gracefully if no owner found.

**`src/app/actions/work-orders.ts`:**
- `createWorkOrder(data)` — inserts work_order in draft status, scoped to ctx.person.org_id
- `updateWorkOrderStatus(workOrderId, newStatus, extraData?)` — validates transition via TRANSITIONS map, applies $500 gate (substitutes pending_approval when estimated_cost > 500), generates owner tokens for pending_approval, auto-inserts expense on completed
- `updateViaVendorToken(vendorToken, newStatus, invoiceAmount?)` — admin client, token-based auth for vendor no-login flow

## Security Notes (Threat Model Coverage)

- **T-05-04 (Tampering — $500 gate bypass):** All mutations go through `updateWorkOrderStatus` which always calls `validateTransition` before any write.
- **T-05-05 (Owner token reuse):** Tokens generated fresh on each pending_approval entry; nullified atomically in same DB write as status change.
- **T-05-07 (vendor token arbitrary status):** `updateViaVendorToken` restricts newStatus param type to `'in_progress' | 'completed'` and calls validateTransition internally.
- **T-05-06 (billed_amount/vendor_cost exposure):** createWorkOrder does not SELECT * — this enforcement belongs in the RSC query layer (05-03+).

## Deviations from Plan

**1. [Rule 2 - Missing Critical Functionality] notifications.ts uses createElement instead of JSX**
- **Found during:** Task 2
- **Issue:** The lib directory has no JSX tsconfig pragma and using JSX syntax in a non-component lib file would require additional tsconfig settings.
- **Fix:** Used `createElement()` directly, producing identical output without requiring tsconfig changes.
- **Files modified:** `src/lib/work-orders/notifications.ts`

**2. [Rule 2 - Missing Critical Functionality] In-app notification record deferred**
- **Found during:** Task 2 implementation review
- **Issue:** Plan specifies creating an in-app notification record "if a notifications table exists". The notifications table was not created in Phase 5 migrations.
- **Fix:** Deferred with a code comment explaining which Phase 5 plan will implement it.
- **Files modified:** `src/lib/work-orders/notifications.ts`

## Known Stubs

None — all exported functions are fully implemented. The notifications.ts in-app record is explicitly deferred (not stubbed), with a comment documenting when it will be wired.

## Self-Check: PASSED

- [x] `canary-propos/src/lib/work-orders/transitions.ts` — exists
- [x] `canary-propos/src/lib/work-orders/notifications.ts` — exists
- [x] `canary-propos/src/app/actions/work-orders.ts` — exists
- [x] `canary-propos/tests/work-orders/transitions.test.ts` — exists
- [x] `npx tsc --noEmit` — no errors in new files
- [x] Commits: 8929779 (test RED), b06266e (feat GREEN), 478dbbe (feat task 2)
