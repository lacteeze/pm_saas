---
phase: 05-maintenance
plan: "04"
subsystem: maintenance
tags: [vendor, sms, pingram, no-login, notifications, work-orders]
dependency_graph:
  requires: [05-02, 05-03]
  provides: [vendor-assignment-ui, vendor-sms-notification, vendor-email-notification, vendor-nologin-page]
  affects: [work-orders, notifications, middleware]
tech_stack:
  added: [pingram SDK (Canadian region), route group (vendor-nologin)]
  patterns: [fire-and-forget SMS, admin client token validation, client dialog with useTransition, server-side vendor_token credential]
key_files:
  created:
    - canary-propos/src/lib/work-orders/sms.ts
    - canary-propos/src/components/work-orders/AssignVendorDialog.tsx
    - canary-propos/src/app/(vendor-nologin)/layout.tsx
    - canary-propos/src/app/(vendor-nologin)/vendor/jobs/[token]/page.tsx
    - canary-propos/src/app/(vendor-nologin)/vendor/jobs/[token]/VendorActions.tsx
  modified:
    - canary-propos/src/lib/work-orders/notifications.ts
    - canary-propos/src/app/actions/work-orders.ts
    - canary-propos/src/app/(manager)/maintenance/[id]/page.tsx
decisions:
  - "Pingram Canadian region ('ca') used via region config; routes to api.ca.pingram.io"
  - "SMS failure is fire-and-forget: catches exception, logs, returns void — never blocks work order assignment"
  - "vendor_token UUID is the no-login credential; admin client used read-only for lookup; writes go through updateViaVendorToken which re-validates"
  - "(vendor-nologin) layout is a minimal pass-through fragment; root layout handles html/body"
  - "VendorActions.tsx is a dedicated client component co-located with the page for useTransition; not inlined in RSC"
metrics:
  duration: "45 minutes"
  completed: "2026-06-23"
  tasks_completed: 2
  files_created: 5
  files_modified: 3
---

# Phase 5 Plan 04: AssignVendorDialog + Pingram SMS + Vendor No-Login Page Summary

**One-liner:** Vendor assignment dialog with Pingram SMS + Resend email notification and standalone no-login vendor job page using vendor_token as credential.

## What Was Built

### Task 1: Pingram SMS wrapper + AssignVendorDialog (commit ae0e8df)

**`src/lib/work-orders/sms.ts`**
- Imports `Pingram` from the `pingram` npm package (v1.0.14, verified against `node_modules/pingram/dist/src/client.d.ts`)
- Constructor: `new Pingram({ apiKey, region: 'ca' })` — Canadian region per Pingram docs
- `.send()` call uses confirmed `SenderPostBody` shape: `{ type, to: { id, number }, sms: { message } }`
- E.164 normalization: strips formatting characters; prepends '+1' for 10-digit Canadian numbers
- `try/catch` wraps all network calls — SMS failure logs to `console.error` and returns silently
- `ORG_PHONE` env var (fallback to placeholder) used in message body

**`src/components/work-orders/AssignVendorDialog.tsx`**
- Client component rendered as "Assign Vendor" button on the work order detail page
- Only shown when status is `submitted` or `approved` (the two states from which assignment is valid)
- Vendors fetched server-side in the detail page RSC and passed as props (avoids client-side data fetching)
- Form: vendor dropdown filtered to `role.includes('vendor')`, estimated_cost (required), optional note
- Calls `updateWorkOrderStatus(id, 'assigned', { assigned_vendor_id, estimated_cost })`
- Toast: "Work order sent to owner for approval (cost > $500)" when cost > 500, else "Vendor assigned and notified"

**`src/lib/work-orders/notifications.ts` — new export `sendVendorAssignmentNotifications`**
- Fetches vendor phone + email via admin client
- Fetches property address via admin client
- SMS: fire-and-forget via `sendVendorJobSMS()` if `vendor.phone` exists
- Email: Resend via `sendEmail()` with React element template; non-blocking (logs on failure)
- No-login link: `${NEXT_PUBLIC_APP_URL}/vendor/jobs/${vendorToken}`

**`src/app/actions/work-orders.ts` — wiring**
- Also selects `description` and `vendor_token` in the work order fetch
- Calls `sendVendorAssignmentNotifications` in a `.catch()` fire-and-forget block when `actualNewStatus === 'assigned'`

### Task 2: No-login vendor job page (commit 1d79749)

**`src/app/(vendor-nologin)/layout.tsx`**
- Minimal fragment layout — no html/body (root layout handles those)
- No auth check, no navigation

**`src/app/(vendor-nologin)/vendor/jobs/[token]/page.tsx`**
- Async RSC using `await params` (Next.js 15 pattern)
- Queries `work_orders` via `createAdminClient()` filtering `vendor_token = token AND status != 'closed'`
- T-05-13: `billed_amount` deliberately not selected — vendor cannot see markup
- Invalid/closed token → friendly "Link No Longer Active" page (not `notFound()`)
- Status-appropriate display: priority badge, current status, action section
- Terminal states (completed/approved/pending_approval) show confirmation message
- Draft/submitted states show "not yet assigned" message

**`src/app/(vendor-nologin)/vendor/jobs/[token]/VendorActions.tsx`**
- Client component co-located with the page
- `assigned` status: "Start Work" button → `updateViaVendorToken(token, 'in_progress')`
- `in_progress` status: "Mark Complete" form with optional invoice amount → `updateViaVendorToken(token, 'completed', amount)`
- Uses `useTransition` for pending state; shows inline error/success messages

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed wrong property column name in notifications.ts**
- **Found during:** Task 1 (while implementing `sendVendorAssignmentNotifications`)
- **Issue:** Existing `notifyOwnerPendingApproval` from Plan 05-02 used `.select('address, city, province')` but the `properties` table column is `street_address`, not `address`. This would have caused runtime errors and empty property addresses in emails.
- **Fix:** Changed all three property selects in notifications.ts to use `street_address`. Also fixed the string interpolation `property.address` → `property.street_address`.
- **Files modified:** `src/lib/work-orders/notifications.ts`
- **Commits:** ae0e8df

**2. [Rule 2 - Missing functionality] Added VendorActions.tsx as separate client component file**
- **Found during:** Task 2
- **Issue:** Plan suggests "small inline client component" but Next.js 15 requires `'use client'` to be at the top of a file — you cannot have a `'use client'` component inline in an RSC page file. A separate file is required.
- **Fix:** Created `VendorActions.tsx` co-located with the page instead of inline.
- **Files created:** `src/app/(vendor-nologin)/vendor/jobs/[token]/VendorActions.tsx`

**3. [Rule 3 - Blocking issue] Worktree missing 05-01 through 05-03 work**
- **Found during:** Start of execution
- **Issue:** Worktree was behind `main` by 10+ commits (05-01, 05-02, 05-03 work not present)
- **Fix:** `git merge main` — fast-forward merge brought all prerequisite files into the worktree

**4. [Rule 3 - Blocking issue] (vendor-nologin)/layout.tsx initially had incorrect html/body tags**
- **Found during:** Task 2 review
- **Issue:** Route group layouts in Next.js 15 are nested inside the root layout, not standalone; having `<html>`/`<body>` inside would cause duplicate HTML structure.
- **Fix:** Changed to minimal fragment pass-through layout.

## Known Stubs

None. All features are fully wired:
- AssignVendorDialog calls real `updateWorkOrderStatus` server action
- `sendVendorAssignmentNotifications` fires real Pingram SDK + Resend email
- Vendor no-login page calls real `updateViaVendorToken` server action
- Vendor list in dialog is fetched from real `people` table filtered by `role.includes('vendor')`

## Threat Flags

No new threat surface beyond what the plan's `<threat_model>` covers. All four mitigations confirmed implemented:
- T-05-12: Admin client in vendor page is read-only for token lookup; writes via `updateViaVendorToken`
- T-05-13: `billed_amount` not selected in vendor page query
- T-05-15: `PINGRAM_API_KEY` is server-only env var; `sms.ts` is server-side only, no `NEXT_PUBLIC_` prefix

## Self-Check: PASSED

Files created:
- FOUND: canary-propos/src/lib/work-orders/sms.ts
- FOUND: canary-propos/src/components/work-orders/AssignVendorDialog.tsx
- FOUND: canary-propos/src/app/(vendor-nologin)/layout.tsx
- FOUND: canary-propos/src/app/(vendor-nologin)/vendor/jobs/[token]/page.tsx
- FOUND: canary-propos/src/app/(vendor-nologin)/vendor/jobs/[token]/VendorActions.tsx

Commits:
- ae0e8df: feat(05-04): Pingram SMS wrapper + AssignVendorDialog + vendor notifications
- 1d79749: feat(05-04): no-login vendor job page at /vendor/jobs/[token]
