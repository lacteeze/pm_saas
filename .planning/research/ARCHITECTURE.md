# Architecture Patterns: Canary PropOS

**Domain:** Multi-tenant property management SaaS
**Stack:** Next.js 15 App Router + Supabase (PostgreSQL + RLS)
**Researched:** 2026-06-19
**Confidence:** HIGH — these are established Supabase and Next.js patterns documented in official sources

---

## 1. Multi-Tenancy Strategy: org_id on Every Row + RLS

**Verdict: Single database, single schema, org_id foreign key on every tenant-scoped table + RLS policies.**

### Why Not the Alternatives

| Strategy | Problem |
|---|---|
| Separate database per org | Impossible to manage at scale; connection pools explode; migrations are a nightmare |
| Separate schema per org | PostgreSQL schema switching is clunky; Supabase doesn't support it cleanly; migrations must run per-schema |
| org_id + RLS (recommended) | Supabase's native pattern; all official examples use this; scales to thousands of orgs |

### The org_id Principle

Every tenant-scoped table carries `org_id uuid NOT NULL REFERENCES organizations(id)`. Tables that are naturally global (e.g., `auth.users`) link to an org via the `people` bridge table.

```
organizations          -- SaaS tenant root
  id uuid PK
  name text
  plan text            -- free | starter | growth | enterprise
  stripe_customer_id text
  created_at timestamptz

people                 -- all users across all roles
  id uuid PK
  user_id uuid REFERENCES auth.users(id)
  org_id uuid REFERENCES organizations(id)
  role text            -- admin | manager | employee | tenant | client | vendor
  created_at timestamptz
```

Every other table: `properties`, `leases`, `payments`, `projects`, `inspections`, `documents`, `listings`, `portfolios` — all carry `org_id`.

---

## 2. Supabase RLS Pattern for 6 Roles

### Core Mechanism

Supabase RLS policies evaluate against the authenticated user's JWT. The critical insight: **store role and org_id in the JWT custom claims**, not in repeated subqueries. This prevents N+1 policy evaluation.

#### Custom JWT Claims Setup

In Supabase, add a `handle_new_user` trigger or use Auth Hooks (Supabase's recommended approach from 2024 onward) to inject custom claims:

```sql
-- JWT will contain:
-- app_metadata.org_id: "uuid-of-org"
-- app_metadata.role: "manager"
-- app_metadata.person_id: "uuid-in-people-table"
```

Access in RLS policies via:
```sql
(auth.jwt() ->> 'org_id')::uuid
(auth.jwt() ->> 'role')::text
```

#### Helper Functions (define once, reuse in all policies)

```sql
CREATE OR REPLACE FUNCTION auth.org_id() RETURNS uuid AS $$
  SELECT (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid;
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION auth.user_role() RETURNS text AS $$
  SELECT auth.jwt() -> 'app_metadata' ->> 'role';
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION auth.person_id() RETURNS uuid AS $$
  SELECT (auth.jwt() -> 'app_metadata' ->> 'person_id')::uuid;
$$ LANGUAGE sql STABLE;
```

### RLS Policy Matrix by Table

#### Properties table (representative example)

```sql
-- SELECT: Admin sees all; Manager/Employee see own org; Tenant sees their leased property;
--         Client sees portfolio properties; Vendor sees assigned-work-order properties
CREATE POLICY "properties_select" ON properties FOR SELECT USING (
  CASE auth.user_role()
    WHEN 'admin'    THEN true
    WHEN 'manager'  THEN org_id = auth.org_id()
    WHEN 'employee' THEN org_id = auth.org_id()
    WHEN 'tenant'   THEN id IN (
      SELECT property_id FROM leases
      WHERE tenant_id = auth.person_id() AND status = 'active'
    )
    WHEN 'client'   THEN id IN (
      SELECT property_id FROM portfolios
      WHERE owner_id = auth.person_id()
    )
    WHEN 'vendor'   THEN id IN (
      SELECT property_id FROM projects
      WHERE vendor_id = auth.person_id() AND status != 'closed'
    )
    ELSE false
  END
);

-- INSERT/UPDATE/DELETE: admin, manager, employee (org-scoped)
CREATE POLICY "properties_write" ON properties
  FOR ALL USING (
    auth.user_role() IN ('admin', 'manager', 'employee')
    AND (auth.user_role() = 'admin' OR org_id = auth.org_id())
  );
```

#### Pattern Summary by Role

| Role | Sees | Can Write | Scope Mechanism |
|------|------|-----------|-----------------|
| admin | Everything | Everything | `true` in policy |
| manager | Own org | Own org | `org_id = auth.org_id()` |
| employee | Own org (scoped subset) | Own org (limited) | `org_id = auth.org_id()` + optional assignment check |
| tenant | Their lease + property | Maintenance requests, applications | Subquery via `leases.tenant_id` |
| client | Their portfolios + properties | Maintenance approval (UPDATE only) | Subquery via `portfolios.owner_id` |
| vendor | Their assigned work orders | Status + invoice on own records | Subquery via `projects.vendor_id` |

### Critical: Service Role for Webhooks and Background Jobs

Stripe webhooks, Twilio callbacks, and scheduled jobs (owner statements, rent reminders) must use the **Supabase service role key** — they bypass RLS entirely. Never expose the service role key to the browser.

These run in:
- Next.js Route Handlers (`/api/webhooks/stripe`, `/api/webhooks/twilio`)
- Supabase Edge Functions (for scheduled jobs)

### Performance: Index org_id on Every Table

```sql
CREATE INDEX ON properties (org_id);
CREATE INDEX ON leases (org_id);
CREATE INDEX ON projects (org_id);
CREATE INDEX ON payments (org_id);
-- ... on every tenant-scoped table
```

Without these, RLS policy table scans will kill query performance as data grows.

---

## 3. Next.js App Router: 5-Portal Component Architecture

### Route Group Strategy

Use Next.js **route groups** (parenthesized folders) to scope layouts, middleware, and auth context per portal. Each portal has its own `layout.tsx` with the appropriate navigation shell.

```
app/
  (public)/                     -- No auth required
    layout.tsx                  -- Minimal layout (nav + footer)
    page.tsx                    -- Marketing / home
    listings/
      page.tsx                  -- Browse listings
      [id]/
        page.tsx                -- Listing detail
    apply/
      [listingId]/
        page.tsx                -- Rental application

  (auth)/                       -- Auth pages (login, signup, reset)
    layout.tsx                  -- Centered card layout
    login/page.tsx
    signup/page.tsx
    verify/page.tsx

  (manager)/                    -- Manager + Employee portal
    layout.tsx                  -- Sidebar nav + top bar
    middleware.ts               -- Role guard: manager | employee | admin
    dashboard/page.tsx
    properties/
      page.tsx
      [id]/page.tsx
    tenants/
      page.tsx
      [id]/page.tsx
    leases/
      page.tsx
      [id]/page.tsx
    maintenance/
      page.tsx
      [id]/page.tsx
    owners/
      page.tsx
      [id]/page.tsx
    inspections/
      page.tsx
      [id]/page.tsx
    payments/
      page.tsx
    documents/
      page.tsx
    team/
      page.tsx
    settings/
      page.tsx

  (tenant)/                     -- Tenant portal
    layout.tsx                  -- Simplified nav
    middleware.ts               -- Role guard: tenant
    dashboard/page.tsx
    rent/page.tsx
    maintenance/page.tsx
    documents/page.tsx
    profile/page.tsx

  (owner)/                      -- Owner / Client portal
    layout.tsx
    middleware.ts               -- Role guard: client
    dashboard/page.tsx
    portfolio/page.tsx
    statements/page.tsx
    maintenance/page.tsx        -- Approval queue only
    documents/page.tsx

  (vendor)/                     -- Vendor portal
    layout.tsx
    middleware.ts               -- Role guard: vendor
    dashboard/page.tsx
    jobs/
      page.tsx
      [id]/page.tsx
    invoices/page.tsx

  api/                          -- Route Handlers (server-side only)
    webhooks/
      stripe/route.ts           -- Stripe events (service role)
      twilio/route.ts           -- SMS replies (service role)
    documents/
      generate/route.ts         -- PDF generation
      ocr/route.ts              -- Lease OCR
    gmail/
      callback/route.ts         -- OAuth callback
      parse/route.ts            -- E-transfer parsing
    cron/
      rent-reminders/route.ts
      statement-generation/route.ts
```

### Middleware Architecture

A single `middleware.ts` at the root handles role routing:

```typescript
// middleware.ts
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const session = await getSupabaseSession(request);

  // Redirect unauthenticated users to login
  const protectedPrefixes = ['/(manager)', '/(tenant)', '/(owner)', '/(vendor)'];
  if (isProtectedPath(pathname) && !session) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Role-based path enforcement
  const role = session?.user?.app_metadata?.role;
  if (pathname.startsWith('/manager') && !['manager', 'employee', 'admin'].includes(role)) {
    return NextResponse.redirect(new URL('/unauthorized', request.url));
  }
  // ... etc per portal
}
```

### Component Boundaries

```
components/
  ui/                     -- shadcn/ui primitives (Button, Input, Dialog, etc.)
  layout/
    Sidebar.tsx           -- Manager sidebar nav
    TopBar.tsx            -- Header with org switcher + notifications
    PortalShell.tsx       -- Wraps each portal layout
  shared/                 -- Used across multiple portals
    PropertyCard.tsx
    LeaseStatus.tsx
    PaymentBadge.tsx
    NotificationFeed.tsx
    FileUploader.tsx
    DatePicker.tsx
  manager/                -- Manager-specific components
    MaintenanceBoard.tsx  -- Kanban-style work order view
    DisbursementCalculator.tsx
    TenantTable.tsx
    InspectionChecklist.tsx
  tenant/
    RentPaymentForm.tsx
    MaintenanceRequestForm.tsx
    MoveInChecklist.tsx
  owner/
    PortfolioOverview.tsx
    StatementViewer.tsx
    MaintenanceApproval.tsx
  vendor/
    JobCard.tsx
    StatusUpdater.tsx
    InvoiceSubmit.tsx
  documents/
    OcrImporter.tsx
    TemplateGenerator.tsx
    SignatureRequest.tsx
```

### Data Fetching Pattern

- **Server Components** (default): fetch from Supabase directly using server-side client — no API roundtrip, no auth exposure
- **Client Components** (opt-in with `'use client'`): Supabase browser client for real-time subscriptions, form interactions, optimistic updates
- **Server Actions**: mutations (create, update, delete) — keep business logic server-side, co-located with the page

```typescript
// Server Component — direct Supabase fetch
// app/(manager)/properties/page.tsx
import { createServerClient } from '@/lib/supabase/server'

export default async function PropertiesPage() {
  const supabase = createServerClient()
  const { data: properties } = await supabase
    .from('properties')
    .select('*, portfolios(*), leases(status)')
    .order('name')
  return <PropertyTable properties={properties} />
}

// Server Action — mutation
// app/(manager)/properties/actions.ts
'use server'
export async function createProperty(formData: FormData) {
  const supabase = createServerClient()
  // org_id injected from JWT via RLS — no need to pass it explicitly
  await supabase.from('properties').insert({ name: formData.get('name'), ... })
  revalidatePath('/properties')
}
```

---

## 4. Critical Data Flows

### 4a. Rent Payment Flow

```
TENANT INITIATES PAYMENT (Stripe)
  │
  ▼
Stripe Checkout Session created
  (amount = lease.rent_amount, metadata = { lease_id, tenant_id, org_id })
  │
  ▼
Tenant completes payment on Stripe-hosted page
  │
  ▼
Stripe fires webhook → /api/webhooks/stripe (service role, bypasses RLS)
  │
  ├── Event: checkout.session.completed
  │     │
  │     ▼
  │   INSERT payments (
  │     type='rent', status='paid',
  │     amount, lease_id, tenant_id, property_id, org_id,
  │     stripe_payment_intent_id, paid_at
  │   )
  │     │
  │     ▼
  │   UPDATE leases SET last_payment_date = NOW()
  │     │
  │     ▼
  │   INSERT notifications (type='rent_paid', recipients=[manager, tenant])
  │
  └── Event: payment_intent.payment_failed
        │
        ▼
      INSERT notifications (type='payment_failed', recipients=[tenant, manager])

MANUAL PAYMENT (Interac e-transfer)
  │
  ├── Option A: Manager manually logs in Manager portal
  │     INSERT payments (type='rent', status='paid', method='etransfer', manually_entered=true)
  │
  └── Option B: Gmail integration detects e-transfer notification email
        Gmail API webhook → /api/gmail/parse
          Parse email body → extract amount, sender name
          → Surface "suggested match" to manager
          → Manager confirms → INSERT payment (same as Option A)

OWNER STATEMENT GENERATION (monthly cron)
  │
  ▼
Cron job fires (/api/cron/statement-generation or Supabase Edge Function)
  │
  ▼
For each active org + each portfolio:
  SELECT payments WHERE period = last_month AND property_id IN portfolio.property_ids
    → Sum: gross_rent, management_fee, maintenance_costs, other_expenses
    → Calculate: net_disbursement = gross_rent - fees - expenses
  │
  ▼
Generate PDF (Puppeteer or pdf-lib)
  → Upload to Supabase Storage (owner-scoped bucket)
  │
  ▼
INSERT owner_statements (portfolio_id, period, pdf_url, net_disbursement, org_id)
  │
  ▼
INSERT notifications (type='statement_ready', recipients=[client])
  → Resend email with PDF link

DISBURSEMENT RECORD
  │
  ▼
Manager reviews statement → clicks "Mark Disbursed"
  INSERT payments (type='disbursement', amount=net_disbursement,
                   recipient_id=client.id, org_id, method='etransfer|wire')
  UPDATE owner_statements SET disbursed_at = NOW()
```

### 4b. Maintenance Workflow State Machine

```
STATES
  draft → submitted → assigned → in_progress → pending_approval → approved → completed → closed
                                                                ↘ rejected → assigned (re-assign)

STATE TRANSITIONS

  [Any portal user] CREATE maintenance request
    → status: 'submitted'
    → notify: manager

  [Manager/Employee] ASSIGN to vendor or staff
    → status: 'assigned'
    → if vendor: INSERT vendor_assignment, send email/SMS (Twilio/Resend)
    → notify: assignee

  [Vendor/Staff] ACCEPT job
    → status: 'in_progress'
    → notify: manager

  [Vendor/Staff] ADD estimate
    → if estimate > 500:
        status: 'pending_approval'
        → notify: owner (client) with estimate details
    → if estimate ≤ 500:
        continue 'in_progress' (no approval gate)

  [Owner] APPROVE or REJECT estimate (Owner portal)
    → APPROVE: status: 'approved' → notify: vendor, manager
    → REJECT:  status: 'rejected' → notify: manager (re-assign or close)

  [Vendor/Staff] COMPLETE work
    → status: 'completed'
    → attach: photos, completion_notes, invoice
    → notify: manager for review

  [Manager] CLOSE and LOG COST
    → status: 'closed'
    → INSERT payments (type='expense', amount=final_cost, project_id=...)
    → UPDATE projects SET actual_cost = final_cost

projects table:
  id, org_id, property_id, lease_id (nullable), created_by_id
  title, description, priority (low|medium|high|emergency)
  status (enum above)
  estimated_cost, actual_cost
  assigned_to_id (people.id), vendor_id (people.id)
  requires_owner_approval bool
  owner_approved_at timestamptz, owner_approved_by_id
  completed_at timestamptz, closed_at timestamptz
  photos jsonb[]           -- array of Supabase Storage URLs
  created_at, updated_at
```

### 4c. Vendor Communication Flow (Dual Mode)

```
Manager assigns work order
  │
  ├── Vendor has portal account?
  │     YES → INSERT vendor_assignment
  │           → Supabase Realtime pushes to vendor portal dashboard
  │           → Resend email: "New job assigned — view in portal"
  │
  └── No portal account / prefers email+SMS
        → Twilio SMS: job summary + property address + priority
        → Resend email: full job details (HTML)
        → Vendor replies to SMS/email:
            "accept" → status: in_progress
            "done"   → status: completed
            "photo"  → attachment parsed, stored in Supabase Storage
        → /api/webhooks/twilio parses inbound SMS → updates projects table
```

---

## 5. Database Schema: Core Table Structure

### Entity Relationship Overview

```
organizations (1) ──────────── (∞) people
      │                                │
      │ (1)                    role: manager|employee|tenant|client|vendor
      │
      ├──(∞) portfolios ──── (∞) properties
      │           │                   │
      │      owned by (client)    has (∞) leases ── tenant (person)
      │                               │
      │                           has (∞) projects (maintenance)
      │                               │
      │                           has (∞) inspections
      │                               │
      │                           has (∞) payments
      │
      ├──(∞) listings (→ property, nullable until leased)
      │
      ├──(∞) documents
      │
      └──(∞) notifications
```

### Key Join Patterns

```sql
-- "What properties does this manager need to see?"
SELECT p.* FROM properties p
WHERE p.org_id = auth.org_id()  -- enforced by RLS

-- "What maintenance does a tenant have visibility on?"
SELECT proj.* FROM projects proj
JOIN leases l ON l.property_id = proj.property_id
WHERE l.tenant_id = auth.person_id() AND l.status = 'active'

-- "What does an owner client see?"
SELECT prop.* FROM properties prop
JOIN portfolios port ON port.id = prop.portfolio_id
WHERE port.owner_id = auth.person_id()

-- "Monthly owner statement calculation"
SELECT
  SUM(p.amount) FILTER (WHERE p.type = 'rent') as gross_rent,
  SUM(p.amount) FILTER (WHERE p.type = 'management_fee') as fees,
  SUM(p.amount) FILTER (WHERE p.type = 'expense') as expenses
FROM payments p
JOIN leases l ON l.id = p.lease_id
JOIN properties prop ON prop.id = l.property_id
WHERE prop.portfolio_id = $1
  AND date_trunc('month', p.paid_at) = date_trunc('month', $2::date)
```

---

## 6. Integration Architecture

### Stripe Integration

```
Two distinct Stripe flows:

1. RENT COLLECTION (Stripe Checkout / Payment Intents)
   Tenant → Stripe Checkout → webhook → payments table
   Stripe account: one per Supabase org (Stripe Connect) OR
   Stripe account: one for platform (collect, then disburse)
   DECISION: Start with single platform Stripe account for simplicity;
             move to Stripe Connect when needed for multi-org payouts.

2. SUBSCRIPTION BILLING (Stripe Subscriptions)
   Organization → subscribes to plan → monthly billing
   Separate from rent flow; org.stripe_customer_id links them.
```

### Notification Service Pattern

```
All notification triggers → NotificationService (server-side module)

NotificationService.send({
  type: 'rent_overdue',
  recipient: person,
  channels: ['email', 'sms', 'in_app'],
  data: { amount, lease, property }
})
  │
  ├── in_app: INSERT notifications table → Supabase Realtime → portal feed
  ├── email:  Resend.send(ReactEmailTemplate, recipient.email)
  └── sms:    Twilio.messages.create(body, to: recipient.phone)
```

### Supabase Storage Buckets

```
Buckets (with RLS policies):
  org-documents/        -- leases, contracts, templates (manager+ read, tenant read own)
  inspection-photos/    -- inspection photo attachments (manager+ write, tenant read own)
  maintenance-photos/   -- project photos (manager|vendor write, client read own properties)
  owner-statements/     -- generated PDFs (manager write, client read own portfolio)
  listing-photos/       -- public listing images (public read, manager write)
  profile-photos/       -- user avatars (owner read, self write)
```

---

## 7. Build Order: Dependency-Driven Sequence

The build order is driven by strict data and auth dependencies. You cannot build payments before leases. You cannot build the tenant portal before tenants exist in the system.

```
PHASE 1 — Foundation (Everything else depends on this)
  ├── Supabase project setup + org_id RLS pattern
  ├── auth.users + people table + JWT custom claims
  ├── organizations table + plan enforcement hook
  ├── Middleware: role-based portal routing
  └── Shared layout shells (all 5 portals, empty pages)
  GATE: Can log in, get routed to correct portal, RLS denies cross-org data

PHASE 2 — Core Data Model
  ├── portfolios + properties (parent data — everything else hangs off this)
  ├── people as tenants/clients/vendors (invite flows)
  ├── leases (links tenants → properties)
  └── listings (public-facing; depends on properties)
  GATE: Manager can create org → add portfolio → add property → create lease → add tenant

PHASE 3 — Manager Portal (Core Workflows)
  ├── Property/portfolio management UI
  ├── Tenant management + lease creation/renewal
  ├── Public listings (browse + detail + inquiry form)
  └── Team management (invite employees, assign scope)
  GATE: Full property management lifecycle works end-to-end

PHASE 4 — Payments
  ├── Stripe integration (rent collection via Checkout)
  ├── Manual payment entry (Interac e-transfer logging)
  ├── Payment history views (manager + tenant)
  └── Expense tracking (linked to projects)
  GATE: Tenant can pay rent; manager can log manual payment; history is accurate
  NOTE: Disbursement calculation depends on this phase completing first

PHASE 5 — Maintenance System
  ├── Project/work order CRUD with full state machine
  ├── Vendor assignment (portal + email/SMS via Twilio)
  ├── Owner approval gate (>$500 threshold)
  ├── Photo uploads (Supabase Storage)
  └── Cost logging → links to payments (expense type)
  GATE: Full maintenance ticket lifecycle end-to-end, including vendor dual-mode

PHASE 6 — Tenant Portal
  ├── Rent payment UI (calls Stripe flow from Phase 4)
  ├── Maintenance request submission (calls Phase 5 state machine)
  ├── Lease document viewer
  ├── Payment history
  └── Move-in/move-out digital checklist
  GATE: Tenant can complete core self-service actions without contacting manager

PHASE 7 — Owner/Client Portal
  ├── Portfolio overview dashboard
  ├── Monthly statement generation + PDF export (requires Phase 4 payments data)
  ├── Owner disbursement calculation + recording
  ├── Maintenance approval UI (>$500 — Phase 5 must exist)
  └── Offboarding package generation
  GATE: Owner can self-serve statements and maintenance approvals

PHASE 8 — Vendor Portal + Email/SMS Fallback
  ├── Vendor job dashboard (assigned work orders)
  ├── Status update UI
  ├── Photo + invoice upload
  ├── Twilio inbound SMS parsing (/api/webhooks/twilio)
  └── Email reply parsing for status updates
  GATE: Vendor can complete a job lifecycle via portal AND via SMS-only mode

PHASE 9 — Inspections
  ├── Inspection CRUD (move-in, move-out, routine)
  ├── Room-by-room checklist builder
  ├── Photo attachment per checklist item
  ├── Digital signature (DocHub or simple canvas)
  └── PDF report export
  GATE: Manager can create, complete, and export an inspection report end-to-end

PHASE 10 — Documents + Integrations
  ├── OCR lease import (extract fields from uploaded PDF)
  ├── Branded document templates per org
  ├── DocHub e-signature API
  ├── Gmail integration (e-transfer parsing, email logging)
  ├── CSV export for all core tables
  └── Notification system (Resend + Twilio + in-app feed)
  GATE: Document workflows and third-party integrations are operational

PHASE 11 — Billing + SaaS Shell
  ├── Stripe Subscription for org billing
  ├── Freemium plan enforcement (≤5 units free)
  ├── Upgrade/downgrade flows
  ├── Org settings + branding per org
  └── Admin portal (platform-level, Canary internal)
  GATE: SaaS billing is operational; orgs can self-serve signup and upgrade
```

### Why This Order

- Phases 1-2 are **auth and data prerequisites** — nothing else can be built without them
- Phase 3 (Manager Portal) comes before any tenant/owner portals because managers configure the data that tenants and owners see
- Phase 4 (Payments) comes before Owner Portal because owner statements are derived from payment data
- Phase 5 (Maintenance) comes before Vendor Portal — the portal is just a view into the maintenance system
- Phase 6 (Tenant Portal) can start in parallel with Phase 5 for some features, but maintenance request submission depends on Phase 5
- Phase 9 (Inspections) is deliberately late — it's important but has no blocking dependencies on later phases; it just needs properties and leases
- Phase 10 (Documents/Integrations) is late because integrations are layered on top of working core workflows
- Phase 11 (Billing) is last for internal launch but can be built in parallel with Phase 10 for the SaaS expansion

---

## 8. Key Architectural Decisions

| Decision | Recommendation | Rationale |
|---|---|---|
| Multi-tenancy | org_id on every row + RLS | Supabase native pattern; avoids schema sprawl |
| JWT claims | Inject role + org_id + person_id into app_metadata | Prevents per-request subqueries in RLS policies |
| Portal routing | Next.js route groups with per-group middleware | Clean separation; each portal has its own layout and auth guard |
| Data fetching | Server Components by default; Client Components for realtime | RSC eliminates client-side token handling for most data |
| Mutations | Server Actions | Co-located with pages; automatic CSRF protection; works without JS |
| Background jobs | Supabase Edge Functions or Next.js cron Route Handlers | Statement generation, rent reminders — run server-side with service role |
| Stripe model | Single platform account (v1), Stripe Connect (v2) | Simplest for single-org launch; Connect needed when orgs have own payouts |
| Vendor SMS | Twilio webhooks parse inbound SMS to update project status | No vendor portal account required; critical for vendor adoption |
| Storage | Supabase Storage with per-bucket RLS | Co-located with DB auth; avoids separate S3 permission layer |
| PDF generation | Puppeteer (Node.js) for statements; pdf-lib for simpler docs | Puppeteer renders HTML templates for complex layout; pdf-lib for programmatic docs |

---

## 9. Pitfall: The Admin Platform Role

**The `admin` role (Canary platform superuser) is cross-org.** Most Supabase RLS examples assume one org per user. The admin role sees all orgs.

Implementation: Admin RLS policy is `true` (no filter). This is safe because admin accounts are manually provisioned, never user-created, and sit behind an additional internal auth check.

**Do not implement the Admin portal as a portal group.** Build it as a separate Next.js app or deeply protected internal route with additional server-side role verification on every Server Component. The risk of a policy misconfiguration exposing all-org data through a shared portal is too high.

---

## Sources

- Supabase official RLS documentation and multi-tenant pattern: https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase Auth custom claims (JWT): https://supabase.com/docs/guides/auth/jwts
- Next.js App Router route groups: https://nextjs.org/docs/app/building-your-application/routing/route-groups
- Next.js Server Actions: https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions-and-mutations
- Stripe Connect vs single account: https://stripe.com/docs/connect
- Confidence: HIGH for RLS patterns and Next.js routing (stable, official-documented). MEDIUM for PDF generation tooling (Puppeteer vs alternatives — verify current Vercel serverless support for Puppeteer at build time).
