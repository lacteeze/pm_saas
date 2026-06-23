# Phase 5: Maintenance - Context

**Gathered:** 2026-06-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Work orders flow from creation through resolution via a strict state machine. Tenants or managers create work orders, managers assign them to vendors (portal or no-login SMS/email via Pingram), the $500 gate routes high-cost jobs to owners for approval before work begins, and all costs feed into disbursement calculations.

**In scope:** Work order CRUD, state machine enforcement (server-side, no skipping), vendor assignment (portal + non-portal), no-login vendor link (status update + invoice submit), Pingram SMS for non-portal vendors, $500 owner approval gate, owner in-app + email notification, dual cost fields flowing to expense ledger.

**Out of scope:** Before/after photo upload from no-login link (Phase 8 vendor portal), real-time work order updates (Phase 10), work order history export.

</domain>

<decisions>
## Implementation Decisions

### State Machine
- **D-01:** State machine: `draft → submitted → assigned → in_progress → pending_approval → approved → completed → closed`. Enforced server-side in the state transition server action — any attempt to skip a state returns an error. No state can be skipped.
- **D-02:** State transitions are application-layer (not DB triggers). The `updateWorkOrderStatus` server action validates: (a) the caller has permission for this transition, (b) the current state is a valid predecessor, (c) any required data is present (e.g. vendor_id required before `assigned`).

### $500 Owner Approval Gate
- **D-03:** Manager enters the estimated cost when assigning a vendor. If `estimated_cost > 500`, the work order is immediately set to `pending_approval` instead of `assigned`. Owner must approve before the work order can advance to `assigned` → `in_progress`.
- **D-04:** If estimated_cost ≤ $500: normal flow `submitted → assigned → in_progress`.
  If estimated_cost > $500: `submitted → pending_approval` → [owner approves] → `assigned → in_progress`.
  If owner declines: `pending_approval → closed` (with decline note).
- **D-05:** Owner notification: in-app record + email via Resend when work order enters `pending_approval`.

### Non-Portal Vendor No-Login Link
- **D-06:** Non-portal vendors receive a no-login link via Pingram SMS (primary) + email (fallback). Link: `app.canarypm.ca/vendor/jobs/[vendor_token]`.
- **D-07:** Token is a UUID stored in `work_orders.vendor_token` column. Reusable until work order reaches `closed`. No expiry beyond work order closure.
- **D-08:** What the no-login link allows (status update + invoice submit only — no photo upload):
  - View job: property address, description, priority, assigned date
  - Mark `in_progress` (from `assigned`)
  - Mark `completed` (from `in_progress`)
  - Submit invoice: dollar amount only (PDF upload is Phase 8)
- **D-09:** No authentication on the vendor no-login route. The vendor_token itself is the credential. The route is at `app.canarypm.ca/vendor/jobs/[token]` — outside the `(public)` route group, its own route group `(vendor-nologin)`.

### Pingram SMS
- **D-10:** Researcher must check https://www.pingram.io/docs/ to determine the exact Pingram API pattern before planning. Key unknowns: REST endpoint, auth method (API key in header vs body), message format, sender ID configuration, Canadian number support. Store Pingram API key as `PINGRAM_API_KEY` env var.
- **D-11:** SMS sent when work order is assigned to a non-portal vendor. Message includes: job summary (property + description), the no-login link, and Canary's contact info.
- **D-12:** Email is sent alongside SMS as fallback (Resend, same as other transactional emails). If vendor has no phone number, email only.

### Cost Fields + Expense Ledger
- **D-13:** Work orders table: `estimated_cost` (numeric, nullable — entered at assignment time), `vendor_cost` (actual cost paid to vendor, entered at completion), `billed_amount` (charged to owner — may include markup). Same dual-field pattern as Phase 4 expenses.
- **D-14:** When work order reaches `completed`, the executor creates an expense record in the `expenses` table (from Phase 4) with `vendor_cost` and `billed_amount` from the work order. This feeds directly into disbursement calculations (PAY-06 pattern).

### Work Order Data Model
- **D-15:** New table `work_orders`: id, org_id, property_id FK, unit_id FK nullable, title, description, priority ('low'/'medium'/'high'/'urgent'), status (enum per D-01), assigned_vendor_id FK→people nullable, vendor_token UUID nullable, estimated_cost numeric nullable, vendor_cost numeric nullable, billed_amount numeric nullable, owner_decline_note text nullable, created_by FK→people, created_at, updated_at. RLS: managers full CRUD; tenants INSERT + SELECT own org; owners SELECT their properties' work orders.

### Claude's Discretion
- Exact Pingram API implementation (pending research — D-10)
- Work order list page design (manager + tenant views)
- Work order detail page layout
- State transition button UX (which transitions are shown per current state)
- Owner approval UI in the owner portal (minimal for Phase 5 — owner portal is Phase 7, but owner needs to approve via email link or a minimal portal-free page)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` §MAINTENANCE — MAINT-01 through MAINT-09

### Prior Phase Decisions
- `.planning/phases/02-core-data-model/02-01-SUMMARY.md` — properties/units/people schema
- `.planning/phases/04-payments/04-CONTEXT.md` — dual cost fields pattern (D-11 in Phase 4 = D-13 here)
- `.planning/phases/04-payments/04-01-SUMMARY.md` — expenses table exists (work order costs insert here)

### Pingram API
- https://www.pingram.io/docs/ — researcher MUST read before planning to determine REST endpoint, auth, message format

### Existing Code
- `canary-propos/src/app/actions/contacts.ts` — server action pattern for CRUD
- `canary-propos/src/app/(manager)/inquiries/page.tsx` — RSC table pattern for list views
- `canary-propos/src/app/(public)/listings/[id]/page.tsx` — unauthenticated public page pattern (for vendor no-login route)
- `canary-propos/src/lib/supabase/public.ts` — createPublicClient for no-login pages

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Dual cost fields pattern — already in expenses table (Phase 4); work_orders uses same `vendor_cost` / `billed_amount` columns
- `expenses` table from Phase 4 — work order completion inserts here (D-14)
- Resend email pattern — same as inquiry notifications (Phase 3) and Gmail disconnect (Phase 4)
- `createPublicClient()` — for vendor no-login route (no auth needed)
- Dialog + render={`<span />`} pattern — all modal forms
- Desktop table + mobile cards pattern — for work order lists

### Integration Points
- New `work_orders` table links to: `properties`, `units`, `people` (vendor + creator + owner)
- `expenses` table (Phase 4): work order completion creates an expense record
- `owner_statements` (Phase 4): expense flows into disbursement/statement generation
- Owner notifications: use same Resend pattern + in-app record when entering `pending_approval`
- Middleware: add `/vendor/jobs` to passthrough list (no-login route)

</code_context>

<specifics>
## Specific Ideas

- No-login vendor link: `app.canarypm.ca/vendor/jobs/[vendor_token]` — own route group `(vendor-nologin)`
- Manager assigns vendor + enters estimated_cost → if > $500, immediately pending_approval
- Pingram SMS on assignment to non-portal vendor (researcher confirms API)
- Work order completion → automatic expense record created in expenses table
- Owner approve/decline from a minimal no-account page (similar to vendor no-login)

</specifics>

<deferred>
## Deferred Ideas

- Before/after photo upload from no-login link (Phase 8 vendor portal)
- Real-time work order status updates via Supabase Realtime (Phase 10)
- Work order history export/CSV (Phase 10)
- Vendor portal work order queue (Phase 8)
- Owner portal full work order view (Phase 7 — owner portal)
- Maintenance calendar/scheduling view

</deferred>

---

*Phase: 5-Maintenance*
*Context gathered: 2026-06-22*
