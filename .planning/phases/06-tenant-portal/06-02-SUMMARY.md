---
phase: 06-tenant-portal
plan: "02"
subsystem: checklist
tags: [checklist, tenant-portal, manager, server-actions, rls]
dependency_graph:
  requires: [06-01]
  provides: [TENANT-05]
  affects: [leases/[id], my-home/checklist]
tech_stack:
  added: []
  patterns:
    - Server Actions for CRUD (createChecklist, updateChecklistItem, submitChecklist)
    - Idempotent submit via WHERE submitted_at IS NULL
    - useTransition for async server action calls in client components
    - 800ms debounce for note auto-save
key_files:
  created:
    - canary-propos/src/app/(tenant)/my-home/checklist/actions.ts
    - canary-propos/src/app/(manager)/leases/[id]/ChecklistSection.tsx
    - canary-propos/src/app/(tenant)/my-home/checklist/page.tsx
    - canary-propos/src/app/(tenant)/my-home/checklist/ChecklistForm.tsx
  modified:
    - canary-propos/src/app/(manager)/leases/[id]/page.tsx
decisions:
  - createChecklist placed in tenant/my-home/checklist/actions.ts (shared server actions module) even though it is manager-facing — single actions.ts for the feature keeps imports clean; role guard enforces access
  - Note textarea shown only when item is checked OR note already has content (avoids cluttered UI)
  - Confirm dialog inline (not a modal) — avoids Dialog component dependency
metrics:
  duration: "~25 minutes"
  completed: "2026-06-25"
  tasks_completed: 3
  files_created: 4
  files_modified: 1
---

# Phase 6 Plan 02: Checklist Manager Creation + Tenant Sign-Off Flow Summary

Manager creates move-in/out acknowledgment checklists from `/leases/[id]`; tenant checks off items with optional notes and submits atomic sign-off from `/my-home/checklist`.

## What Was Built

**Server Actions (`actions.ts`):**
- `createChecklist(leaseId, type, title, items[])` — manager/employee guard; inserts checklists row (with `created_by`) then checklist_items in bulk; revalidates lease page
- `updateChecklistItem(itemId, checked, note)` — tenant guard; updates checked + note + checked_at; handles RLS rejection for submitted checklists gracefully
- `submitChecklist(checklistId)` — tenant guard; idempotent `WHERE submitted_at IS NULL`; atomically sets items' checked_at on all checked-but-not-yet-timestamped items; returns error if already submitted

**Manager UI (`ChecklistSection.tsx`):**
- Client component on `/leases/[id]` — shows "Create Checklist" empty state with expandable inline form when no checklist exists
- Form: title, type (Move-In/Move-Out select), dynamic item list (min 1, add/remove)
- Read-only summary card after creation: title, type badge, checked count, submitted_at date or "Pending tenant sign-off" badge
- Mobile-responsive (375px safe)

**Lease detail page (`page.tsx`):** Added RSC checklist data fetch (checklists + checklist_items) and ChecklistSection card between Renewal and Lease Document cards.

**Tenant page (`page.tsx`):** RSC with empty states for no active lease and no checklist prepared. Fetches checklist + items without any cost fields (D-11 compliant).

**Tenant form (`ChecklistForm.tsx`):** Controlled checkboxes with useTransition, 800ms debounced note auto-save, confirm dialog before final sign-off, green "Signed off on [date]" banner when submitted, all inputs disabled after submission.

## Deviations from Plan

None — plan executed exactly as written.

## Security

- T-06-04: RLS blocks updates on submitted checklists; action surfaces error message
- T-06-05: submitChecklist idempotent via `WHERE submitted_at IS NULL`; returns count=0 error on double-submit
- T-06-06: createChecklist guards `role.includes('manager') || role.includes('employee')`
- T-06-07: D-11 enforced — no vendor_cost or billed_amount in any query in this plan

## Known Stubs

None.

## Threat Flags

None — no new trust boundaries beyond those documented in plan threat model.

## Self-Check: PASSED

Files exist:
- FOUND: canary-propos/src/app/(tenant)/my-home/checklist/actions.ts
- FOUND: canary-propos/src/app/(manager)/leases/[id]/ChecklistSection.tsx
- FOUND: canary-propos/src/app/(tenant)/my-home/checklist/page.tsx
- FOUND: canary-propos/src/app/(tenant)/my-home/checklist/ChecklistForm.tsx

Commit: 526abcd — feat(06-02): checklist manager creation + tenant sign-off flow

TypeScript: 0 errors in any of the 5 new/modified files (pre-existing Phase 3/4 errors in inquiries, listings, AddLeaseForm unrelated to this plan).
