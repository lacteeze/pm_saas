---
phase: 05-maintenance
plan: "05"
subsystem: maintenance
tags: [email, owner-approval, no-login, work-orders]
dependency_graph:
  requires: [05-02, 05-03]
  provides: [owner-approval-email, owner-approve-page, owner-decline-page]
  affects: [work_orders]
tech_stack:
  added: []
  patterns: [react-email-template, no-login-route-group, server-action-admin-client]
key_files:
  created:
    - canary-propos/src/lib/email/templates/OwnerApprovalEmail.tsx
    - canary-propos/src/app/(owner-nologin)/layout.tsx
    - canary-propos/src/app/(owner-nologin)/owner/approve/[token]/page.tsx
    - canary-propos/src/app/(owner-nologin)/owner/decline/[token]/page.tsx
    - canary-propos/src/app/(owner-nologin)/owner/decline/[token]/DeclineForm.tsx
  modified:
    - canary-propos/src/lib/work-orders/notifications.ts
    - canary-propos/src/app/actions/work-orders.ts
decisions:
  - "Approve page performs DB update server-side in RSC before rendering (no separate action needed for approve path)"
  - "Decline page uses client DeclineForm component with useTransition to handle optional note + server action"
  - "Both tokens nullified atomically with status change; .eq('status','pending_approval') guard prevents double-fire"
  - "notifications.ts inline createElement replaced with proper OwnerApprovalEmail React Email component"
  - "worktree merged from main before starting work (plans 05-01 through 05-03 were missing)"
metrics:
  duration: "~20 minutes"
  completed: "2026-06-23"
  tasks_completed: 2
  files_changed: 7
---

# Phase 05 Plan 05: OwnerApprovalEmail Template + Owner Approve/Decline No-Login Pages Summary

**One-liner:** React Email approval template with branded Approve/Decline buttons, plus two no-login pages that close the $500 gate loop by atomically transitioning work orders on owner action.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | OwnerApprovalEmail template + notifications update | 71ede1a | OwnerApprovalEmail.tsx, notifications.ts |
| 2 | Owner approve + decline no-login pages | 62bf850 | layout.tsx, approve/page.tsx, decline/page.tsx, DeclineForm.tsx, work-orders.ts |

## What Was Built

### OwnerApprovalEmail React Email Template
`src/lib/email/templates/OwnerApprovalEmail.tsx` — Matches the InquiryNotificationEmail pattern (same imports, style tokens, layout). Props: `propertyAddress`, `workOrderTitle`, `workOrderDescription`, `estimatedCost`, `approveUrl`, `declineUrl`. Renders two prominent CTA buttons: green "Approve Work Order" and red-outlined "Decline Work Order". Cost formatted as Canadian currency via `Intl.NumberFormat`.

### notifications.ts Updated
The previous inline `createElement` email tree was replaced with `React.createElement(OwnerApprovalEmail, {...})`. Description field added to the work order select query. Subject line updated to match plan spec: `Action Required: Maintenance Approval Needed — {propertyAddress}`.

### (owner-nologin) Route Group
Minimal `layout.tsx` with no auth, no app navigation — standalone HTML shell for public-facing owner pages.

### /owner/approve/[token] Page
Async RSC that:
1. Queries `work_orders` WHERE `owner_approve_token = token AND status = 'pending_approval'`
2. If not found: renders "This link has already been used or is no longer valid"
3. If found: atomically updates `{ status: 'assigned', owner_approve_token: null, owner_decline_token: null }` with `.eq('status','pending_approval')` race condition guard
4. Renders confirmation card with work order title and property address

### /owner/decline/[token] Page + DeclineForm
Server page validates token and renders work order summary. `DeclineForm` client component (`useTransition`) shows optional textarea, calls `declineWorkOrderViaToken(token, note)` server action on submit, shows success state inline.

### declineWorkOrderViaToken Server Action
Added to `src/app/actions/work-orders.ts`. Uses admin client, queries by `owner_decline_token + status='pending_approval'`, atomically updates `{ status: 'closed', owner_approve_token: null, owner_decline_token: null, owner_decline_note? }`.

## Deviations from Plan

### Pre-execution: Worktree merge required
The worktree branch was missing commits from plans 05-01 through 05-03 (created on main). A `git merge main` fast-forward was performed before starting work to bring in `work-orders.ts`, `notifications.ts`, and related files. No plan deviation — routine worktree sync.

### Auto-fixed: notifications.ts was using inline createElement
The 05-02 plan had a placeholder inline email implementation. This plan replaced it with the proper OwnerApprovalEmail React Email component per the plan's explicit instruction to "update notifications.ts to import and use OwnerApprovalEmail."

## Known Stubs

None. Both pages wire real data from the database. The approve page immediately fires the DB update. The decline form wires through to the real server action.

## Threat Flags

None beyond those already catalogued in the plan's threat model (T-05-16 through T-05-19). All mitigations implemented:
- T-05-16: Both tokens nullified atomically with status update; double-fire prevented by `.eq('status','pending_approval')` on update
- T-05-17: Admin client scoped to the single row matched by token; no org-wide queries
- T-05-19: Server action validates token against DB before executing; Next.js 15 built-in origin check covers CSRF

## Self-Check

- [x] `canary-propos/src/lib/email/templates/OwnerApprovalEmail.tsx` — created
- [x] `canary-propos/src/app/(owner-nologin)/layout.tsx` — created
- [x] `canary-propos/src/app/(owner-nologin)/owner/approve/[token]/page.tsx` — created
- [x] `canary-propos/src/app/(owner-nologin)/owner/decline/[token]/page.tsx` — created
- [x] `canary-propos/src/app/(owner-nologin)/owner/decline/[token]/DeclineForm.tsx` — created
- [x] `canary-propos/src/lib/work-orders/notifications.ts` — updated
- [x] `canary-propos/src/app/actions/work-orders.ts` — updated (declineWorkOrderViaToken added)
- [x] Token nullification is atomic with status change (single .update() call with status guard)
- [x] Commits 71ede1a and 62bf850 exist in git log

## Self-Check: PASSED
