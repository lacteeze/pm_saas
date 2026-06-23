# Phase 6: Tenant Portal - Context

**Gathered:** 2026-06-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Tenants have a complete, role-scoped portal where they can pay rent, track payment history, submit maintenance requests, access their lease, sign off on a manager-prepared move-in/out acknowledgment checklist, and view property announcements — all without seeing any other tenant's data.

**Already built (carry forward — verify wiring):**
- TENANT-01: /my-home portal shell ✓ (Phase 1 routing)
- TENANT-02: /my-home/payments + Pay Rent ✓ (Phase 4)
- TENANT-03: /my-home/maintenance ✓ (Phase 5)
- TENANT-04: Lease PDF download on /my-home ✓ (Phase 2)

**Net new for Phase 6:**
- TENANT-05: Move-in/out acknowledgment checklist (manager-prepared → tenant signs off)
- TENANT-06: Management announcements feed on /my-home

**Out of scope:** Full room-by-room inspections with photos (Phase 9), tenant digital signature on inspection reports (Phase 9).

</domain>

<decisions>
## Implementation Decisions

### Move-In/Out Checklist (TENANT-05)
- **D-01:** Physical inspections are done by managers (Phase 9). The Phase 6 tenant checklist is an **acknowledgment checklist** — manager prepares a list of items (keys received, parking pass, mailbox key, etc.) and tenant signs off from their portal.
- **D-02:** Tenant checklist flow: manager creates a checklist from the lease/unit context (a simple list of text items). Tenant sees it on /my-home/checklist. For each item, tenant can check ✓ and add an optional note. A "Submit sign-off" button finalizes and records the acknowledgment timestamp.
- **D-03:** New tables: `checklists` (id, org_id, lease_id, type enum 'move_in'/'move_out', title, created_by, created_at, submitted_at nullable, submitted_by nullable) and `checklist_items` (id, checklist_id, position, label, checked boolean DEFAULT false, note text nullable, checked_at nullable).
- **D-04:** Manager creates checklist from /leases/[id] detail page (new "Checklist" tab or section). Tenant views + completes from /my-home/checklist. One active checklist per lease at a time.
- **D-05:** Once submitted, checklist is read-only (submitted_at set). Tenant can view but not edit.

### Announcements (TENANT-06)
- **D-06:** Announcements are per-property. Manager posts from /properties/[id] (new Announcements section). All active tenants with leases at that property see the announcement.
- **D-07:** New table: `announcements` (id, org_id, property_id FK, title, body text, created_by FK people, created_at, expires_at nullable). RLS: managers full CRUD; tenants SELECT for their property only.
- **D-08:** Tenant sees announcements on /my-home in a dedicated section. Unread count shown as a simple badge (number of announcements created after tenant's last_seen_announcements_at). No real-time — server-rendered, refreshes on page load.
- **D-09:** `last_seen_announcements_at` stored on the `people` table (nullable timestamptz column). Updated when tenant visits /my-home or the announcements section.

### Portal Polish
- **D-10:** /my-home landing page should show a clear summary card per section: Lease, Payments (last payment + next due), Maintenance (open request count), Checklist (if pending), Announcements (unread count). Navigation links to each sub-page.
- **D-11:** All tenant queries MUST exclude vendor_cost, billed_amount, management fee data — confirmed across all existing and new tenant-facing queries.

### Claude's Discretion
- /my-home landing page card layout and visual hierarchy
- Empty states for each section
- Checklist item UI design (checkbox list vs. card-per-item)
- Announcement card design (title + excerpt + date)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` §TENANT PORTAL — TENANT-01 through TENANT-06

### Prior Phase Decisions (existing /my-home pages to NOT break)
- `.planning/phases/02-core-data-model/02-CONTEXT.md` — lease/unit schema
- `.planning/phases/04-payments/04-CONTEXT.md` — payment history already on /my-home
- `.planning/phases/05-maintenance/05-CONTEXT.md` — maintenance already on /my-home

### Existing Code
- `canary-propos/src/app/(tenant)/my-home/page.tsx` — main page to extend
- `canary-propos/src/app/(tenant)/my-home/payments/page.tsx` — payment history (already built)
- `canary-propos/src/app/(tenant)/my-home/maintenance/page.tsx` — maintenance (already built)
- `canary-propos/src/components/layout/TenantShell.tsx` — tenant nav shell

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- RSC + desktop/mobile pattern throughout
- Dialog + render={<span />} for manager checklist creation form
- Card component for summary cards on /my-home landing
- Badge component for unread count
- people table already accessible — add last_seen_announcements_at column

### Integration Points
- `leases` table: checklist links via lease_id
- `properties` table: announcements link via property_id
- Tenant's property_id derived from active lease (leases → units → property_id)
- `people` table: add last_seen_announcements_at column (migration)

</code_context>

<specifics>
## Specific Ideas

- /my-home landing: summary cards for Lease, Payments, Maintenance, Checklist, Announcements
- Manager posts announcements from /properties/[id] Announcements tab
- Tenant checklist: check + note per item, Submit sign-off button
- Unread announcements badge — count of announcements since last_seen

</specifics>

<deferred>
## Deferred Ideas

- Full room-by-room inspection with photos (Phase 9)
- Tenant digital signature on inspection PDF (Phase 9)
- Real-time announcement notifications via Supabase Realtime (Phase 10)
- Push notifications for announcements (Phase 10)
- Multiple concurrent checklists (Phase 9 handles this)

</deferred>

---

*Phase: 6-Tenant Portal*
*Context gathered: 2026-06-22*
