---
phase: 04-payments
plan: "04"
subsystem: payments
tags: [payments, expenses, etransfer, gmail, manager-ui, server-actions]
dependency_graph:
  requires: [04-02, 04-03]
  provides: [manual-payment-recording, expense-recording, etransfer-confirmation-ui]
  affects: [payments-table, expenses-table]
tech_stack:
  added: []
  patterns: [server-actions, react-hook-form-zod, dialog-trigger-render-span, rsc-data-loading]
key_files:
  created:
    - canary-propos/src/app/(manager)/payments/actions.ts
    - canary-propos/src/components/payments/RecordPaymentDialog.tsx
    - canary-propos/src/components/payments/RecordExpenseDialog.tsx
    - canary-propos/src/components/payments/ETransferSuggestions.tsx
    - canary-propos/src/app/(manager)/payments/page.tsx
  modified: []
decisions:
  - "vendor_cost appears only in server action INSERT — never in any UI response or component prop"
  - "ETransferSuggestions requires explicit lease Select + button click before calling recordPayment — no programmatic auto-confirm path"
  - "recordPayment and recordExpense both verify org ownership of lease/property before insert (T-04-12, T-04-13)"
metrics:
  duration: "~25 minutes"
  completed: "2026-06-22"
  tasks_completed: 3
  files_created: 5
---

# Phase 4 Plan 04: Manual Payment Recording, Expense Recording, E-Transfer Confirmation UI Summary

Manual payment and expense recording forms plus Gmail e-transfer suggestion confirmation UI — manager can record cheques/cash/e-transfers against leases, expenses with dual internal/owner cost fields, and confirm Gmail-parsed e-transfers with explicit lease selection.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | recordPayment + recordExpense server actions | 493331a | src/app/(manager)/payments/actions.ts |
| 2 | RecordPaymentDialog + RecordExpenseDialog components | 25d84a0 | src/components/payments/RecordPaymentDialog.tsx, RecordExpenseDialog.tsx |
| 3 | ETransferSuggestions panel + payments overview page | b383e7d | src/components/payments/ETransferSuggestions.tsx, src/app/(manager)/payments/page.tsx |

## What Was Built

### Server Actions (`actions.ts`)
- `recordPayment`: validates method enum (etransfer/cheque/cash/bank_transfer), verifies lease belongs to caller's org, inserts with `status='recorded'`, `recorded_by=person.id`
- `recordExpense`: dual cost fields `vendor_cost` + `billed_amount`, verifies property org ownership, inserts with `created_by=person.id`
- `getCallerContext` updated to select `id, org_id, role` to support `recorded_by`/`created_by` fields
- Both restricted to `manager` or `admin` roles via `role.includes()` check

### RecordPaymentDialog
- Lease select pre-populates `amount` with `monthly_rent` on change
- Method enum rendered as human labels (Interac e-Transfer, Cheque, Cash, Bank Transfer)
- Date defaults to today; notes optional
- Toast feedback on success/error; dialog closes + form resets on success

### RecordExpenseDialog
- Dual cost inputs in 2-column grid: "Vendor Cost (internal)" + "Billed to Owner"
- Note below cost fields: "Vendor cost is for internal records only — owners see billed amount."
- Both use `Dialog` with `render={<span />}` on `DialogTrigger` per project pattern

### ETransferSuggestions
- Fetches `GET /api/gmail/etransfers` on mount with loading state
- Graceful fallback: connect Gmail message if fetch fails; empty state if no suggestions
- Per-suggestion: sender name, amount (CAD formatted), received date
- Per-suggestion Select to choose matching lease; Confirm button disabled until lease chosen
- On confirm: calls `recordPayment(method='etransfer')` — confirmed suggestions removed from local state
- No programmatic auto-confirm path exists (T-04-15 mitigated)

### Payments Page (`page.tsx`)
- RSC loads active leases with tenant name + property address, properties list, last 30 payments
- Manager/admin role check — redirects to `/dashboard` if unauthorized
- Action buttons: RecordPaymentDialog + RecordExpenseDialog
- ETransferSuggestions panel
- Recent payments table: desktop table + mobile card fallback

## Security / Threat Mitigations

| Threat | Mitigation |
|--------|-----------|
| T-04-12 Tampering: recordPayment lease_id | Server action verifies `lease.org_id = caller.org_id` before insert |
| T-04-13 Tampering: recordExpense property_id | Server action verifies `property.org_id = caller.org_id` before insert |
| T-04-14 Info Disclosure: vendor_cost | Only in server-side INSERT; never in UI responses or props visible to non-managers |
| T-04-15 Spoofing: e-transfer auto-confirm | Requires explicit lease Select + button click; no programmatic path |

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

- `ETransferSuggestions` fetches `/api/gmail/etransfers` which does not yet exist (implemented in a later plan). The component handles the 404/error gracefully by showing "Connect Gmail in Settings" message. This is intentional — the Gmail API route is a Phase 4 dependency tracked separately.

## Self-Check: PASSED

Files verified present:
- canary-propos/src/app/(manager)/payments/actions.ts — FOUND (commit 493331a)
- canary-propos/src/components/payments/RecordPaymentDialog.tsx — FOUND (commit 25d84a0)
- canary-propos/src/components/payments/RecordExpenseDialog.tsx — FOUND (commit 25d84a0)
- canary-propos/src/components/payments/ETransferSuggestions.tsx — FOUND (commit b383e7d)
- canary-propos/src/app/(manager)/payments/page.tsx — FOUND (commit b383e7d)
- TypeScript: `tsc --noEmit` clean for all payment files
- No auto-confirm path in ETransferSuggestions (grep confirmed)
- vendor_cost in INSERT only (grep confirmed)
