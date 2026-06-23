# Phase 5: Maintenance - Research

**Researched:** 2026-06-23
**Domain:** Work order state machine, Pingram SMS, no-login vendor route, owner approval gate
**Confidence:** HIGH (stack decisions locked; Pingram API partially verified)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** State machine: `draft → submitted → assigned → in_progress → pending_approval → approved → completed → closed`. Enforced server-side. No state skipping allowed.
- **D-02:** Application-layer state transitions (not DB triggers). `updateWorkOrderStatus` server action validates: (a) caller permission, (b) valid predecessor state, (c) required data present.
- **D-03:** Manager enters estimated_cost at assignment. If > $500, immediately `pending_approval` instead of `assigned`.
- **D-04:** ≤$500 flow: `submitted → assigned → in_progress`. >$500 flow: `submitted → pending_approval → [owner approves] → assigned → in_progress`. Decline: `pending_approval → closed`.
- **D-05:** Owner notification: in-app record + Resend email when work order enters `pending_approval`.
- **D-06:** Non-portal vendors receive no-login link via Pingram SMS (primary) + Resend email (fallback). Link: `app.canarypm.ca/vendor/jobs/[vendor_token]`.
- **D-07:** Token is a UUID stored in `work_orders.vendor_token`. Reusable until work order reaches `closed`. No expiry.
- **D-08:** No-login link allows: view job details, mark `in_progress`, mark `completed`, submit invoice (dollar amount only — no PDF upload until Phase 8).
- **D-09:** No auth on vendor no-login route. The `vendor_token` UUID is the credential. Route group: `(vendor-nologin)`.
- **D-10:** Researcher must determine exact Pingram API pattern. Store key as `PINGRAM_API_KEY`.
- **D-11:** SMS sent when work order assigned to non-portal vendor. Message: property + description + no-login link + Canary contact info.
- **D-12:** Email sent alongside SMS as fallback. If vendor has no phone, email only.
- **D-13:** `work_orders` table: `estimated_cost` (nullable, entered at assignment), `vendor_cost` (actual cost paid to vendor), `billed_amount` (charged to owner, markup invisible to owners/tenants).
- **D-14:** On `completed`, create an expense record in `expenses` table from Phase 4 (application layer, not DB trigger).
- **D-15:** Table columns: id, org_id, property_id FK, unit_id FK nullable, title, description, priority ('low'/'medium'/'high'/'urgent'), status (enum), assigned_vendor_id FK→people nullable, vendor_token UUID nullable, estimated_cost numeric nullable, vendor_cost numeric nullable, billed_amount numeric nullable, owner_decline_note text nullable, created_by FK→people, created_at, updated_at.

### Claude's Discretion

- Exact Pingram API implementation (pending research — D-10)
- Work order list page design (manager + tenant views)
- Work order detail page layout
- State transition button UX (which transitions shown per current state)
- Owner approval UI (minimal for Phase 5 — full owner portal is Phase 7)

### Deferred Ideas (OUT OF SCOPE)

- Before/after photo upload from no-login link (Phase 8)
- Real-time work order status updates (Phase 10)
- Work order history export/CSV (Phase 10)
- Vendor portal work order queue (Phase 8)
- Owner portal full work order view (Phase 7)
- Maintenance calendar/scheduling view
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| MAINT-01 | Tenant, manager, or employee can create a maintenance work order | Work order insert server action with role check; tenant scoped to own org |
| MAINT-02 | Work order state machine enforced server-side | State transition map + `updateWorkOrderStatus` server action pattern |
| MAINT-03 | Manager can assign to portal or non-portal vendor | Assignment server action; vendor lookup from people table (role includes 'vendor') |
| MAINT-04 | Non-portal vendors receive email/SMS with no-login link | Pingram SMS + Resend email on assignment; `(vendor-nologin)` route group |
| MAINT-05 | Non-portal vendors can submit invoice via no-login link | Invoice amount field on vendor no-login page; server action validates via vendor_token |
| MAINT-06 | Work orders >$500 auto-routed to owner for approval | $500 gate in assignment server action; `pending_approval` state |
| MAINT-07 | Owner receives in-app + email notification; can approve/decline | Owner approval token pattern; minimal no-login approve/decline page |
| MAINT-08 | Manager can log vendor cost and billed cost | `vendor_cost` + `billed_amount` columns; markup invisible in owner/tenant queries |
| MAINT-09 | Work order costs feed into owner disbursement | On `completed`, insert into `expenses` table (Phase 4 pattern) |
</phase_requirements>

---

## Summary

Phase 5 introduces the work order lifecycle — the most state-rich feature in the system. The core engineering challenge is a strict 8-state machine enforced entirely server-side, with two branching paths depending on estimated cost, and two classes of actors (authenticated portal users + unauthenticated vendors/owners using token-based links).

The `(vendor-nologin)` route group follows the same pattern as `(public)` listings — uses `createPublicClient()` with no cookie/session, but with a critical difference: the vendor token is looked up server-side using `createAdminClient()` or a service-role query (RLS would block anon from reading `work_orders`). The page acts as a server component that validates the UUID token against the DB, fetches job data, and renders a minimal status-update form backed by a server action that also validates the token.

The Pingram SMS integration uses the `pingram` npm package (v1.0.14, confirmed on registry). The API pattern is notification-centric: you define a notification `type` identifier in the Pingram dashboard, then call `pingram.send({ type, to: { number: '+1...' }, sms: { message } })`. The Canadian region endpoint is `api.ca.pingram.io`. For Phase 5, a single notification type `vendor_job_assignment` should be created in the Pingram dashboard.

Owner approval for Phase 5 (before Phase 7 full owner portal) is best handled via a minimal email-link approach: two one-time tokens (`owner_approve_token`, `owner_decline_token`) on the work order row, embedded in the Resend email as two buttons. The approve/decline routes are server actions called via a minimal no-login page at `/owner/approve/[token]` and `/owner/decline/[token]`. This requires no owner portal session and is faster to build than waiting for Phase 7.

**Primary recommendation:** Build the state machine transition map as a single exported constant in `lib/work-orders/transitions.ts`, import it in the server action and vendor no-login route, and never inline state validation logic.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Work order CRUD | API / Backend (Server Actions) | Database (RLS) | Mutations must enforce role + org scoping server-side |
| State machine enforcement | API / Backend (Server Actions) | — | No client-side state changes; all transitions go through `updateWorkOrderStatus` |
| Vendor no-login page | Frontend Server (SSR) | API / Backend | Token lookup is a server-side DB query; page renders without auth session |
| Owner approval page | Frontend Server (SSR) | API / Backend | Same pattern as vendor no-login; one-time tokens validated server-side |
| Pingram SMS sending | API / Backend (Server Actions) | — | API key must stay server-side; never expose to browser |
| $500 gate routing | API / Backend (Server Actions) | — | Business rule enforced in assignment server action |
| Expense auto-creation | API / Backend (Server Actions) | — | Application-layer, called within `updateWorkOrderStatus` when transitioning to `completed` |
| Work order list (manager) | Frontend Server (SSR RSC) | — | Fetch in RSC, no client waterfall |
| Work order list (tenant) | Frontend Server (SSR RSC) | — | Scoped via RLS to tenant's own org |

---

## Standard Stack

### Core (all already in project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `pingram` | 1.0.14 | SMS notifications to vendors | Project-mandated (supersedes Twilio); Canadian numbers supported |
| `resend` | latest | Email fallback + owner approval emails | Already used in Phase 3/4 for transactional email |
| `zod` | v4.x | Schema validation for work order forms + server actions | Project standard |
| `react-hook-form` | v7.x | Work order creation form | Project standard |
| `@supabase/ssr` | latest | Server-side DB queries in RSC + Server Actions | Project standard |

### No New Packages Required

This phase introduces no new dependencies beyond `pingram` (which may already be in package.json as a project-level decision). Verify:

```bash
cd canary-propos && npm list pingram 2>/dev/null || echo "not installed"
```

**Installation (if not present):**
```bash
cd canary-propos && npm install pingram
```

---

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| `pingram` | npm | ~1 yr (v1.0.14) | Low (new product) | github.com/pingram-io | Not run | Approved — official SDK per CLAUDE.md mandate |

**Note:** slopcheck was not run. `pingram` is mandated by CLAUDE.md ("Pingram — supersedes Twilio per ROADMAP Phase 10") and confirmed on npm registry via `npm view pingram version` returning `1.0.14`. This is an authoritative project constraint, not a research recommendation.

**Packages removed due to slopcheck [SLOP] verdict:** none

---

## Architecture Patterns

### System Architecture Diagram

```
Tenant/Manager Browser
        |
        | POST (Server Action)
        v
  createWorkOrder / assignVendor / updateWorkOrderStatus
        |
        |---> work_orders table (Supabase)
        |         |
        |         | if estimated_cost > 500
        |         v
        |    status = pending_approval
        |         |
        |         |---> Resend email (owner approval link)
        |         |       contains approve_token + decline_token
        |         v
        |    /owner/approve/[token]  OR  /owner/decline/[token]
        |         |
        |         | Server Action: validateOwnerToken()
        |         v
        |    status = assigned  OR  status = closed
        |
        | if estimated_cost <= 500
        v
   status = assigned
        |
        |---> if vendor.phone: Pingram SMS (vendor_job_assignment)
        |---> always: Resend email with no-login link
        |
        v
   /vendor/jobs/[vendor_token]   (vendor-nologin route group)
        |
        | Server Action: updateViaVendorToken()
        v
   status = in_progress  OR  status = completed + invoice amount
        |
        | on completed:
        v
   INSERT into expenses (vendor_cost, billed_amount, property_id, org_id)
```

### Recommended Project Structure
```
src/
├── app/
│   ├── (manager)/
│   │   └── maintenance/
│   │       ├── page.tsx                    # Work order list (RSC)
│   │       ├── new/page.tsx                # Create work order
│   │       └── [id]/
│   │           ├── page.tsx                # Work order detail
│   │           └── assign/page.tsx         # Assign vendor + enter estimated_cost
│   ├── (vendor-nologin)/
│   │   └── vendor/
│   │       └── jobs/
│   │           └── [token]/
│   │               └── page.tsx            # No-login vendor status page
│   └── (owner-nologin)/
│       └── owner/
│           ├── approve/[token]/page.tsx    # Owner approve page
│           └── decline/[token]/page.tsx    # Owner decline page
├── actions/
│   └── work-orders.ts                      # All work order server actions
├── lib/
│   └── work-orders/
│       ├── transitions.ts                  # State machine map (exported const)
│       ├── sms.ts                          # Pingram SMS wrapper
│       └── notifications.ts               # Owner email + in-app notification helpers
└── components/
    └── work-orders/
        ├── WorkOrderList.tsx
        ├── WorkOrderStatusBadge.tsx
        ├── AssignVendorDialog.tsx
        └── TransitionButton.tsx
```

### Pattern 1: State Machine Transition Map

**What:** A single exported constant defines valid transitions and who can trigger each.
**When to use:** Every call to `updateWorkOrderStatus` checks this map first.

```typescript
// Source: application design — adapted from state machine pattern
// src/lib/work-orders/transitions.ts

export type WorkOrderStatus =
  | 'draft'
  | 'submitted'
  | 'assigned'
  | 'in_progress'
  | 'pending_approval'
  | 'approved'
  | 'completed'
  | 'closed'

type TransitionRule = {
  allowedFrom: WorkOrderStatus[]
  allowedRoles: ('manager' | 'tenant' | 'vendor_token')[]
  requiredFields?: string[]
}

export const TRANSITIONS: Record<WorkOrderStatus, TransitionRule> = {
  draft: {
    allowedFrom: [],
    allowedRoles: ['manager', 'tenant'],
  },
  submitted: {
    allowedFrom: ['draft'],
    allowedRoles: ['manager', 'tenant'],
  },
  assigned: {
    // Normal path (≤$500): manager assigns vendor
    // Post-approval path: system transitions after owner approves
    allowedFrom: ['submitted', 'approved'],
    allowedRoles: ['manager'],
    requiredFields: ['assigned_vendor_id', 'estimated_cost'],
  },
  in_progress: {
    allowedFrom: ['assigned'],
    allowedRoles: ['manager', 'vendor_token'],
  },
  pending_approval: {
    // Set by system when estimated_cost > 500 at assignment time
    allowedFrom: ['submitted'],
    allowedRoles: ['manager'],
  },
  approved: {
    allowedFrom: ['pending_approval'],
    allowedRoles: ['manager'], // triggered by owner token validation server-side
  },
  completed: {
    allowedFrom: ['in_progress'],
    allowedRoles: ['manager', 'vendor_token'],
  },
  closed: {
    allowedFrom: ['completed', 'pending_approval'],
    allowedRoles: ['manager'],
  },
}
```

### Pattern 2: `updateWorkOrderStatus` Server Action

```typescript
// src/actions/work-orders.ts  [ASSUMED — follows contacts.ts pattern]
'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { TRANSITIONS, WorkOrderStatus } from '@/lib/work-orders/transitions'
import { revalidatePath } from 'next/cache'
import { createExpenseFromWorkOrder } from './expenses'
import { sendVendorAssignmentNotifications } from '@/lib/work-orders/notifications'

export async function updateWorkOrderStatus(
  workOrderId: string,
  newStatus: WorkOrderStatus,
  extraData?: {
    assigned_vendor_id?: string
    estimated_cost?: number
    vendor_cost?: number
    billed_amount?: number
    owner_decline_note?: string
  }
): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated.' }

  // Fetch current work order
  const { data: wo, error: fetchErr } = await supabase
    .from('work_orders')
    .select('*')
    .eq('id', workOrderId)
    .single()
  if (fetchErr || !wo) return { success: false, error: 'Work order not found.' }

  // Validate transition
  const rule = TRANSITIONS[newStatus]
  if (!rule.allowedFrom.includes(wo.status as WorkOrderStatus)) {
    return { success: false, error: `Cannot transition from ${wo.status} to ${newStatus}.` }
  }

  // Role check (fetch from JWT claims or people table)
  // ... role validation ...

  // $500 gate: if assigning (estimated_cost provided) and cost > 500, redirect to pending_approval
  let actualNewStatus = newStatus
  if (newStatus === 'assigned' && extraData?.estimated_cost && extraData.estimated_cost > 500) {
    actualNewStatus = 'pending_approval'
  }

  const { error: updateErr } = await supabase
    .from('work_orders')
    .update({ status: actualNewStatus, ...extraData, updated_at: new Date().toISOString() })
    .eq('id', workOrderId)
    .eq('org_id', wo.org_id) // RLS + explicit scope

  if (updateErr) return { success: false, error: 'Failed to update work order.' }

  // Side effects based on new status
  if (actualNewStatus === 'pending_approval') {
    await notifyOwnerPendingApproval(wo, workOrderId)
  }
  if (actualNewStatus === 'assigned' && wo.assigned_vendor_id) {
    await sendVendorAssignmentNotifications(wo, workOrderId)
  }
  if (actualNewStatus === 'completed' && extraData?.vendor_cost && extraData?.billed_amount) {
    await createExpenseFromWorkOrder(wo, extraData.vendor_cost, extraData.billed_amount)
  }

  revalidatePath('/maintenance')
  return { success: true }
}
```

### Pattern 3: Pingram SMS Integration

**What:** Uses the official `pingram` Node.js SDK. Notification types are configured in the Pingram dashboard — the SDK call only provides the recipient + message content.
**When to use:** When work order is assigned to a non-portal vendor who has a phone number.

```typescript
// Source: npm package pingram v1.0.14 + docs.pingram.io
// src/lib/work-orders/sms.ts

import Pingram from 'pingram'

const pingram = new Pingram({ apiKey: process.env.PINGRAM_API_KEY! })

export async function sendVendorJobSMS(params: {
  vendorPhone: string          // E.164 format: +1XXXXXXXXXX
  propertyAddress: string
  jobDescription: string
  noLoginLink: string
}) {
  const { vendorPhone, propertyAddress, jobDescription, noLoginLink } = params

  const message = [
    `New job from Canary Property Management:`,
    `Property: ${propertyAddress}`,
    `Job: ${jobDescription}`,
    `View details and update status: ${noLoginLink}`,
    `Questions? Call 1-XXX-XXX-XXXX`,
  ].join('\n')

  await pingram.send({
    type: 'vendor_job_assignment',   // Must be created in Pingram dashboard first
    to: {
      id: vendorPhone,               // Pingram uses 'id' as a unique recipient identifier
      number: vendorPhone,           // E.164: +16135551234 for Canadian number
    },
    sms: {
      message,                       // max 800 chars; ~160 recommended for single segment
    },
  })
}
```

**Phone number format:** E.164 with plus sign — `+16135551234` for a Canadian number. Unformatted variants like `613-555-1234` are also accepted for CA/US. Store phone numbers in `people.phone` in E.164 to avoid runtime formatting.

**Dashboard setup required (Wave 0 task):** Create notification type `vendor_job_assignment` in Pingram dashboard before the SMS call will succeed.

**Canadian region endpoint:** For Canadian phone numbers or data residency, initialize with the CA region base URL. Check Pingram dashboard environment settings — if the project is on the CA endpoint, pass `baseURL: 'https://api.ca.pingram.io'` to the constructor.

### Pattern 4: Vendor No-Login Page

**What:** RSC that validates a UUID token server-side (using admin client to bypass RLS), renders job details, and provides a form backed by a server action that also re-validates the token.

```typescript
// src/app/(vendor-nologin)/vendor/jobs/[token]/page.tsx  [ASSUMED pattern]
import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'

export default async function VendorJobPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  // Admin client bypasses RLS — the token itself is the authorization
  const supabase = createAdminClient()
  const { data: wo } = await supabase
    .from('work_orders')
    .select(`
      id, title, description, priority, status, vendor_token,
      properties ( street_address, city ),
      units ( unit_number )
    `)
    .eq('vendor_token', token)
    .not('status', 'eq', 'closed')
    .single()

  if (!wo) notFound()

  // Render job view + action buttons based on current status
  // in_progress button: shown when status = 'assigned'
  // completed button + invoice amount: shown when status = 'in_progress'
}
```

**Security note:** UUID v4 token space is 2^122 (~5 × 10^36). Brute-force enumeration is computationally infeasible. The `not('status', 'eq', 'closed')` filter ensures tokens are dead after closure. No rate limiting is strictly required at the DB level, but Next.js middleware can add rate limiting per IP on the `/vendor/jobs/*` path if desired.

### Pattern 5: Owner Approval — Email Link Tokens

**Recommendation:** Minimal email-link approach for Phase 5 (Phase 7 owner portal is full).

Add two columns to `work_orders`:
- `owner_approve_token UUID` — generated when entering `pending_approval`
- `owner_decline_token UUID` — generated when entering `pending_approval`

Owner receives a Resend email with two buttons:
- "Approve" → `https://app.canarypm.ca/owner/approve/[owner_approve_token]`
- "Decline" → `https://app.canarypm.ca/owner/decline/[owner_decline_token]`

Each route uses admin client to validate token, update status, nullify both tokens (one-time use), and render a confirmation page. No owner login required.

```typescript
// src/app/(owner-nologin)/owner/approve/[token]/page.tsx  [ASSUMED]
export default async function OwnerApprovePage({ params }) {
  const { token } = await params
  const supabase = createAdminClient()

  const { data: wo } = await supabase
    .from('work_orders')
    .select('id, status, org_id, estimated_cost')
    .eq('owner_approve_token', token)
    .eq('status', 'pending_approval')
    .single()

  if (!wo) {
    // Already actioned or invalid token
    return <div>This approval link has already been used or has expired.</div>
  }

  // Transition to 'approved', then system transitions to 'assigned'
  await supabase
    .from('work_orders')
    .update({
      status: 'assigned',           // approved → assigned immediately (no separate 'approved' pause needed)
      owner_approve_token: null,     // one-time use
      owner_decline_token: null,
    })
    .eq('id', wo.id)

  return <div>Thank you — work order approved. Work will proceed.</div>
}
```

**Note on `approved` state:** D-01 includes `approved` in the state machine. For Phase 5 simplicity, the owner approve action can transition directly to `assigned` (skipping the intermediate `approved` state display) unless the manager needs to see an "approved, pending assignment" state. Recommend: transition `pending_approval → approved → assigned` as two DB writes in the same server action (approved is the intermediate state recorded in history, but the final persisted status is `assigned`). This preserves auditability if work order history is added later.

### Anti-Patterns to Avoid

- **State validation in the UI only:** Never trust client-submitted `newStatus` without checking the TRANSITIONS map server-side. A client can send any status string.
- **RLS as the only gate for vendor no-login:** Anon RLS cannot read work orders (nor should it). Use admin client + explicit token validation in the server component.
- **Sending Pingram SMS synchronously in the request path without error handling:** SMS failure must not block the work order assignment. Wrap in try/catch; log failure but return success to the caller.
- **Storing raw phone numbers without E.164 formatting:** Canadian numbers like `(613) 555-1234` will fail Pingram validation. Normalize to E.164 on `people` record save.
- **Using `createPublicClient()` for vendor no-login:** The public client uses anon key + anon RLS. Work orders have no anon read policy. Use `createAdminClient()` in the vendor no-login server component.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SMS sending | Custom fetch to Pingram REST API | `pingram` npm SDK | SDK handles auth header, base URL selection, retries, type safety |
| Email with approve/decline buttons | Raw HTML string in Resend | React Email template | Consistent with existing Resend/React Email pattern in codebase |
| Phone number E.164 formatting | Custom regex | Store E.164 at input time (enforce in Zod schema) | No runtime conversion needed if stored correctly |
| State transition validation | Inline if/else chains per action | `TRANSITIONS` constant + shared validator | Single source of truth; one change propagates everywhere |

---

## Common Pitfalls

### Pitfall 1: Pingram Notification Type Must Exist in Dashboard Before Sending
**What goes wrong:** `pingram.send({ type: 'vendor_job_assignment', ... })` throws a 404 or validation error because the notification type `vendor_job_assignment` has not been created in the Pingram dashboard.
**Why it happens:** Pingram is a notification management platform — notification types (templates, channel configuration) are defined in the dashboard, not in code. The SDK call only provides recipient + dynamic content.
**How to avoid:** Wave 0 task: log into Pingram dashboard → create notification type `vendor_job_assignment` with SMS channel enabled → save.
**Warning signs:** `404` or `"notification type not found"` error from Pingram SDK in dev.

### Pitfall 2: $500 Gate Bypassed by Direct Status Update
**What goes wrong:** A secondary code path (e.g., a bulk update, a different server action) transitions directly from `submitted` to `assigned` without going through the $500 check.
**Why it happens:** The gate logic lives in `updateWorkOrderStatus`, but if other code writes to `work_orders` directly, it bypasses the check.
**How to avoid:** All status mutations must go through `updateWorkOrderStatus`. No direct `.update({ status: 'assigned' })` calls outside that action.
**Warning signs:** Work orders with `estimated_cost > 500` and `status = 'assigned'` with no `pending_approval` in history.

### Pitfall 3: Owner Approval Token Used More Than Once
**What goes wrong:** Owner clicks "Approve" twice (e.g., back button + forward). Work order status transitions twice. With `pending_approval → approved → assigned`, double-firing could attempt `approved → approved` which is an invalid transition (caught by state machine) — but the error page is confusing for the owner.
**How to avoid:** After using the token, immediately null both `owner_approve_token` and `owner_decline_token` in the same DB update as the status change. The token lookup `.eq('owner_approve_token', token).eq('status', 'pending_approval')` will return no rows on the second request, rendering a friendly "already actioned" message.

### Pitfall 4: Vendor Token Exposed in RLS Queries
**What goes wrong:** A policy that allows tenants to `SELECT` work orders for their org also returns `vendor_token` and `owner_approve_token` / `owner_decline_token` columns.
**How to avoid:** In all tenant-facing queries, explicitly select only safe columns (omit all token columns). Consider a `work_orders_tenant_view` DB view that excludes token columns. At minimum, never `SELECT *` in tenant-facing RSC queries.

### Pitfall 5: SMS Sending Blocks Work Order Assignment
**What goes wrong:** Pingram API is slow or unavailable. The `assignVendor` server action awaits SMS send, causing a timeout or user-visible delay.
**How to avoid:** Fire Pingram SMS in a non-blocking way. Options: (a) `sendVendorJobSMS().catch(err => console.error('[sms]', err))` without await, (b) Supabase Edge Function triggered by DB insert (Phase 10 pattern), (c) background job. For Phase 5, option (a) is simplest and sufficient.

---

## Work Orders Schema (Final)

```sql
-- Migration: create_work_orders_table
CREATE TYPE work_order_status AS ENUM (
  'draft', 'submitted', 'assigned', 'in_progress',
  'pending_approval', 'approved', 'completed', 'closed'
);

CREATE TYPE work_order_priority AS ENUM ('low', 'medium', 'high', 'urgent');

CREATE TABLE work_orders (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                UUID NOT NULL REFERENCES organizations(id),
  property_id           UUID NOT NULL REFERENCES properties(id),
  unit_id               UUID REFERENCES units(id),
  title                 TEXT NOT NULL,
  description           TEXT NOT NULL,
  priority              work_order_priority NOT NULL DEFAULT 'medium',
  status                work_order_status NOT NULL DEFAULT 'draft',
  assigned_vendor_id    UUID REFERENCES people(id),
  vendor_token          UUID UNIQUE DEFAULT gen_random_uuid(),  -- pre-generated
  estimated_cost        NUMERIC(10,2),
  vendor_cost           NUMERIC(10,2),
  billed_amount         NUMERIC(10,2),
  owner_decline_note    TEXT,
  owner_approve_token   UUID UNIQUE,   -- set when entering pending_approval
  owner_decline_token   UUID UNIQUE,   -- set when entering pending_approval
  created_by            UUID NOT NULL REFERENCES people(id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_work_orders_org_id ON work_orders (org_id);
CREATE INDEX idx_work_orders_property_id ON work_orders (property_id);
CREATE INDEX idx_work_orders_status ON work_orders (status);
CREATE INDEX idx_work_orders_assigned_vendor ON work_orders (assigned_vendor_id);
CREATE INDEX idx_work_orders_vendor_token ON work_orders (vendor_token);

-- RLS
ALTER TABLE work_orders ENABLE ROW LEVEL SECURITY;

-- Managers: full CRUD within org
CREATE POLICY "managers_full_crud" ON work_orders
  FOR ALL TO authenticated
  USING (
    org_id = (SELECT org_id FROM people WHERE user_id = auth.uid() AND active = true)
    AND 'manager' = ANY(SELECT role FROM people WHERE user_id = auth.uid() AND active = true)
  );

-- Tenants: INSERT + SELECT own org (created_by = their person_id)
CREATE POLICY "tenants_insert" ON work_orders
  FOR INSERT TO authenticated
  WITH CHECK (
    org_id = (SELECT org_id FROM people WHERE user_id = auth.uid() AND active = true)
    AND 'tenant' = ANY(SELECT role FROM people WHERE user_id = auth.uid() AND active = true)
  );

CREATE POLICY "tenants_select_own" ON work_orders
  FOR SELECT TO authenticated
  USING (
    created_by = (SELECT id FROM people WHERE user_id = auth.uid() AND active = true)
  );

-- Owners: SELECT work orders on their properties (Phase 7 will expand this)
-- Deferred to Phase 7 owner portal — no owner portal auth yet in Phase 5
-- Vendor no-login route uses admin client, not RLS
```

**Note on `vendor_token`:** Pre-generated at row creation (`DEFAULT gen_random_uuid()`). This avoids a second update call when assigning a vendor. The token is meaningful only when `assigned_vendor_id` is set and status is `assigned` or later.

---

## Expense Auto-Creation on Completion

When `updateWorkOrderStatus` transitions to `completed`, the server action calls:

```typescript
// src/actions/work-orders.ts  [ASSUMED]
async function createExpenseFromWorkOrder(
  wo: WorkOrderRow,
  vendorCost: number,
  billedAmount: number
) {
  const supabase = await createClient()
  await supabase.from('expenses').insert({
    org_id: wo.org_id,
    property_id: wo.property_id,
    description: `Work order: ${wo.title}`,
    expense_date: new Date().toISOString().split('T')[0],
    vendor_cost: vendorCost,
    billed_amount: billedAmount,
    created_by: wo.created_by,  // or current user — manager who marks completed
  })
}
```

This matches the Phase 4 `expenses` table schema exactly (see `supabase.ts` lines 17–73).

---

## Middleware Update Required

The `/vendor/jobs/*` path must be added to the middleware passthrough list (no auth redirect). Same pattern as `/listings/*`.

```typescript
// In middleware.ts matcher or passthrough logic:
// Add: '/vendor/jobs/:path*'
// Add: '/owner/approve/:path*'
// Add: '/owner/decline/:path*'
```

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `pingram` npm | D-10 SMS | Not yet installed (not in package.json) | 1.0.14 | Email-only if not installed |
| `PINGRAM_API_KEY` env var | D-10 | Unknown — must add to `.env.local` | — | No SMS without this |
| Pingram dashboard account | D-10 notification type setup | Unknown | — | Blocks SMS until created |
| `resend` + `RESEND_API_KEY` | D-12 email fallback | Present (Phase 3/4) | latest | — |

**Missing dependencies with no fallback:**
- `PINGRAM_API_KEY` — must be added before any vendor SMS can send. Wave 0 task.
- Pingram notification type `vendor_job_assignment` — must be created in dashboard. Wave 0 task.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest / Vitest (check `canary-propos/package.json` for existing test setup) |
| Config file | To be confirmed in Wave 0 |
| Quick run command | `npm test -- --testPathPattern=work-orders` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| MAINT-02 | State machine rejects invalid transitions | unit | `npm test -- transitions` | No — Wave 0 |
| MAINT-06 | $500 gate routes to pending_approval | unit | `npm test -- work-orders-gate` | No — Wave 0 |
| MAINT-04 | Vendor no-login page 404s on closed/invalid token | integration | Manual (no-login page test) | No — Wave 0 |
| MAINT-07 | Owner approval token is single-use | unit | `npm test -- owner-approval` | No — Wave 0 |
| MAINT-09 | Expense created on completion | unit | `npm test -- expense-creation` | No — Wave 0 |

### Wave 0 Gaps
- [ ] `src/lib/work-orders/transitions.test.ts` — unit tests for TRANSITIONS map
- [ ] `src/actions/work-orders.test.ts` — $500 gate + token single-use tests

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | Partial | Vendor/owner no-login uses UUID token as credential — not Supabase Auth |
| V4 Access Control | Yes | State machine role checks; RLS on work_orders table |
| V5 Input Validation | Yes | Zod schema on all work order forms and server actions |
| V6 Cryptography | No | UUID tokens are random, not encrypted; sufficient for this use case |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Token enumeration (vendor_token) | Elevation of Privilege | UUID v4 space (2^122) — computationally infeasible; `not('status', 'eq', 'closed')` filter |
| State skipping via direct API | Tampering | All transitions via `updateWorkOrderStatus`; TRANSITIONS map enforced server-side |
| Cross-org work order access | Information Disclosure | `org_id` scoped in all queries + RLS; admin client only in token-validation routes |
| Owner token replay | Spoofing | Nullify both tokens in same DB transaction as status update; check `.eq('status', 'pending_approval')` |
| SMS API key exposure | Information Disclosure | `PINGRAM_API_KEY` server-only env var; never in `NEXT_PUBLIC_*` namespace |
| Tenant sees vendor cost markup | Information Disclosure | Never `SELECT *` in tenant queries; explicitly exclude `vendor_cost` if showing billed fields |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Pingram SDK constructor accepts `{ apiKey }` and `.send()` accepts `{ type, to: { id, number }, sms: { message } }` | Standard Stack / Pattern 3 | SMS sending code must be rewritten; planner should add a Wave 0 "verify Pingram SDK integration" task |
| A2 | Pingram supports Canadian numbers in E.164 (+1XXXXXXXXXX) | Pattern 3 | Canadian vendors would not receive SMS; fallback to email only |
| A3 | `createAdminClient()` exists in `src/lib/supabase/admin.ts` (used in vendor no-login + owner approval patterns) | Pattern 4/5 | Code won't compile; admin client helper must be confirmed/created |
| A4 | Owner approval via email token (no-login) is sufficient for Phase 5 before Phase 7 owner portal | Pattern 5 | If owners require portal auth for approval, more Phase 7 work must be pulled into Phase 5 |
| A5 | `pingram` npm SDK is the `pingram` package at version 1.0.14 | Package Audit | If this is the wrong package, SMS integration will fail; verify with Pingram support |

---

## Open Questions

1. **Pingram dashboard access**
   - What we know: `PINGRAM_API_KEY` env var is the credential format; notification types are created in the dashboard
   - What's unclear: Does Canary already have a Pingram account? What is the `pingram_sk_...` key value?
   - Recommendation: Treat as a Wave 0 blocker — add human-verify checkpoint before the SMS task

2. **`createAdminClient()` availability**
   - What we know: `createClient()` and `createPublicClient()` exist and are established patterns
   - What's unclear: Whether `src/lib/supabase/admin.ts` exists with a service-role client
   - Recommendation: Check in Wave 0; if absent, create it (pattern: `createServerClient` with `SUPABASE_SERVICE_ROLE_KEY`)

3. **Middleware passthrough list location**
   - What we know: Middleware exists (Phase 1); `/listings/*` is already in the passthrough list
   - What's unclear: Exact file path and syntax for adding new unauthenticated routes
   - Recommendation: Planner should add a task to read middleware.ts and add `/vendor/jobs/*` and `/owner/approve/*` and `/owner/decline/*`

---

## Sources

### Primary (HIGH confidence)
- Pingram SMS channel docs (https://www.pingram.io/docs/channels/sms) — phone format, message field names, sender config
- Pingram advanced send docs (https://www.pingram.io/docs/advanced/send-a-notification) — request body structure, regional endpoints
- `npm view pingram` — confirmed package exists at v1.0.14
- `canary-propos/src/types/supabase.ts` — confirmed `expenses` table schema (lines 17–73)
- `canary-propos/src/app/actions/contacts.ts` — server action pattern (getCallerContext, ActionResult, revalidatePath)
- `canary-propos/src/lib/supabase/public.ts` — createPublicClient pattern for no-auth pages
- `canary-propos/src/app/(public)/listings/[id]/page.tsx` — no-login RSC page pattern

### Secondary (MEDIUM confidence)
- Pingram WebSearch results — SDK initialization pattern `new Pingram({ apiKey })` and `.send()` call structure
- Pingram Supabase integration docs — confirmed Pingram is notification-type driven (types configured in dashboard)

### Tertiary (LOW confidence — flagged as ASSUMED)
- Pingram SDK exact field names (`to.id`, `to.number`) — derived from docs excerpts; verify against npm package source before coding

---

## Metadata

**Confidence breakdown:**
- Standard Stack: HIGH — all packages confirmed on npm; `pingram` v1.0.14 verified
- Architecture: HIGH — follows established patterns in the codebase exactly
- Pingram API pattern: MEDIUM — base URL and request body structure retrieved from official docs; SDK field names assumed from docs excerpts (A1, A5)
- Pitfalls: HIGH — derived from direct analysis of the state machine and token-based auth design
- Owner approval pattern: MEDIUM — recommended approach is sound; final decision is Claude's discretion per CONTEXT.md

**Research date:** 2026-06-23
**Valid until:** 2026-07-23
