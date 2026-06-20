# Canary PropOS — Roadmap

**Project:** Canary PropOS — Full-Stack Multi-Tenant Property Management SaaS
**Milestone:** v1.0
**Granularity:** Standard
**Total Requirements:** 71
**Coverage:** 71/71

---

## Phases

- [ ] **Phase 1: Foundation** — Auth, multi-tenancy, RLS, JWT custom claims, org & team management
- [ ] **Phase 2: Core Data Model** — People, properties, portfolios, leases (manager portal CRUD)
- [ ] **Phase 3: Public Listings** — Unauthenticated browse, inquiry, and rental application flow
- [ ] **Phase 4: Payments** — Stripe rent collection, manual entry, Gmail e-transfer parsing, owner disbursement
- [ ] **Phase 5: Maintenance** — Full work order state machine, vendor assignment, owner approval gate
- [ ] **Phase 6: Tenant Portal** — Tenant-facing rent, maintenance, lease docs, checklist, announcements
- [ ] **Phase 7: Owner Portal** — Portfolio overview, statements, maintenance approvals, offboarding
- [ ] **Phase 8: Vendor Portal** — Vendor work order queue, status updates, photo/invoice submission
- [ ] **Phase 9: Inspections** — Room-by-room checklists, photo attachments, digital signature, PDF export
- [ ] **Phase 10: Documents & Integrations** — OCR import, branded templates, e-signature, Gmail OAuth, CSV export, notifications
- [ ] **Phase 11: SaaS Billing & Admin** — Freemium plan enforcement, Stripe Subscriptions, admin portal

---

## Phase Details

### Phase 1: Foundation
**Goal**: The multi-tenant security boundary is in place — any user who signs in lands in exactly their org with exactly their role's permissions, and no data ever leaks across org boundaries.
**Depends on**: Nothing (first phase)
**Requirements**: FOUND-01, FOUND-02, FOUND-03, FOUND-04, FOUND-05, FOUND-06, FOUND-07, FOUND-08, FOUND-09, FOUND-10, FOUND-11, FOUND-12, FOUND-13, FOUND-14, ORGS-01, ORGS-02, ORGS-03, ORGS-04, ORGS-05, ORGS-06

**Architectural must-haves (rewrite triggers if skipped):**
- `@supabase/ssr` client with middleware session refresh (not legacy `@supabase/auth-helpers`)
- `org_members` table + private schema RLS policies on every table
- JWT custom claims (role, org_id, person_id) injected via Supabase Auth Hook at sign-in
- RLS CI linter (fails build if any table lacks an RLS policy)
- Supabase Realtime uses private channels only — no public channel subscriptions

**Success Criteria** (what must be TRUE):
  1. A user can create an org account, sign in with email/password, Google OAuth, Apple OAuth, or magic link and land in their org's workspace
  2. A user from Org A cannot read, write, or even enumerate any data belonging to Org B — enforced at the database layer via RLS, not application code
  3. A manager's JWT contains `role=manager`, `org_id`, and `person_id`; the Supabase Auth Hook injects these at sign-in without manual client-side assembly
  4. An org admin can invite an employee by email; the invitee signs up and is immediately scoped to that org and role with no manual configuration
  5. An org admin can remove a user from the org and that user's active sessions are revoked

**Plans**: 6 plans
- [ ] 01-01-PLAN.md — Project scaffold, Supabase clients, test harness, RLS linter
- [x] 01-02-PLAN.md — Schema, Auth Hook JWT claims, RLS policies, storage, schema push
- [ ] 01-03-PLAN.md — RLS isolation, JWT, admin, manager, plan-limit tests
- [x] 01-04-PLAN.md — Middleware routing, portal shells, admin isolation, auth config
- [ ] 01-05-PLAN.md — Sign-in (4 methods), OAuth callbacks, onboarding wizard
- [ ] 01-06-PLAN.md — Invite flow, people list, session revocation, org settings
**UI hint**: yes

---

### Phase 2: Core Data Model
**Goal**: Managers can create and manage the full property portfolio — people, properties, portfolios, and leases — through a functional manager portal CRUD interface.
**Depends on**: Phase 1
**Requirements**: PEOPLE-01, PEOPLE-02, PEOPLE-03, PEOPLE-04, PROP-01, PROP-02, PROP-03, PROP-04, PROP-05, PROP-06, LEASE-01, LEASE-02, LEASE-03, LEASE-04, LEASE-05, LEASE-06

**Success Criteria** (what must be TRUE):
  1. A manager can create a person record for any role (tenant, client, vendor, employee) and associate that person with one or more roles
  2. A manager can create a property with full details (address, type, beds, baths, sq footage, amenities, photos), associate it with an owner, and group it into a portfolio
  3. A manager can view a property dashboard showing the current tenant, lease status, rent status, and open maintenance count
  4. A manager can create a lease linking a tenant to a property with term, rent, due date, and deposit; the dashboard shows alerts at 90, 60, and 30 days before expiry
  5. A tenant can view and download their current lease document from a link — without accessing any other tenant's data

**Plans**: TBD
**UI hint**: yes

---

### Phase 3: Public Listings
**Goal**: Prospective tenants can browse available units, get full property details, and submit inquiries or rental applications without creating an account.
**Depends on**: Phase 2
**Requirements**: LIST-01, LIST-02, LIST-03, LIST-04, LIST-05, LIST-06, LIST-07

**Success Criteria** (what must be TRUE):
  1. A visitor lands on the listings page with no sign-in prompt and sees all published available units, filterable by price, bedrooms, location, and amenities
  2. A visitor clicks a listing and sees a full detail page with photo gallery, floor plan, description, and map — no auth required
  3. A visitor submits an inquiry or showing request; the manager receives an in-app and email notification immediately
  4. A visitor can complete and submit a rental application through the listing page
  5. A manager can publish, unpublish, or edit a listing from the manager portal and changes are reflected live on the public page

**Plans**: TBD
**UI hint**: yes

---

### Phase 4: Payments
**Goal**: Rent is collected online and reconciled accurately — ACH holds are enforced, duplicate webhook events are idempotent, manual payments are logged, owner disbursements are calculated with markup hidden from owners, and monthly statements are immutable snapshots.
**Depends on**: Phase 2
**Requirements**: PAY-01, PAY-02, PAY-03, PAY-04, PAY-05, PAY-06, PAY-07, PAY-08, PAY-09, PAY-10

**Architectural must-haves:**
- Stripe webhook idempotency table (event ID deduplication before any record creation)
- ACH/ACSS payments held for minimum 5 business days (not calendar days) before disbursement eligibility
- Owner statements are append-only PDF snapshots — stored in Supabase Storage; editing lease/payment data after generation does not alter historical statements
- Expense records carry two cost fields: `vendor_cost` (what was paid to vendor) and `billed_amount` (what is charged to owner); markup is invisible to owners and tenants

**Success Criteria** (what must be TRUE):
  1. A tenant can pay rent via card or ACH through the tenant portal; ACH payments are held for 5 business days before being eligible for disbursement
  2. A manager can manually record an Interac e-transfer, cheque, cash, or bank transfer payment against a lease
  3. The system parses a connected Gmail inbox for Interac e-transfer notification emails and presents suggested matches for manager confirmation — it never auto-confirms a payment
  4. Submitting the same Stripe webhook event twice creates exactly one payment record (idempotent)
  5. A manager can generate a monthly owner statement; the PDF is stored as an immutable snapshot and downloading it again after editing payment data returns the original version

**Plans**: TBD
**UI hint**: yes

---

### Phase 5: Maintenance
**Goal**: Work orders flow from creation through resolution via a strict state machine — tenants or managers create them, managers assign them to vendors (portal or no-login SMS/email), the $500 gate routes high-cost jobs to owners for approval before work begins, and all costs feed into disbursement calculations.
**Depends on**: Phase 2
**Requirements**: MAINT-01, MAINT-02, MAINT-03, MAINT-04, MAINT-05, MAINT-06, MAINT-07, MAINT-08, MAINT-09

**Architectural must-haves:**
- State machine: `draft → submitted → assigned → in_progress → pending_approval → approved → completed → closed` — no skipping states, enforced server-side
- Non-portal vendor communication via Pingram (SMS) — not Twilio; email is the primary fallback, SMS is secondary
- $500 owner approval gate: any work order with estimated cost above $500 is automatically moved to `pending_approval` and blocked until owner approves or declines
- Expense records use dual cost fields (vendor_cost / billed_amount) — same pattern as Phase 4

**Success Criteria** (what must be TRUE):
  1. A tenant or manager can create a maintenance work order with description, priority, photos, and property; the work order is visible on the manager dashboard
  2. A work order follows the exact state machine — a manager can move it forward but cannot skip states; the current state is always visible to all parties
  3. A manager assigns a work order to a non-portal vendor; that vendor receives job details via email/SMS with a no-login link where they can update status, upload completion photos, and submit an invoice
  4. Any work order with an estimated cost above $500 is automatically flagged and the owner receives an in-app and email notification; the work order cannot advance until the owner approves or declines
  5. Work order costs (vendor_cost and billed_amount) are recorded and automatically flow into the property's expense ledger for disbursement calculation

**Plans**: TBD
**UI hint**: yes

---

### Phase 6: Tenant Portal
**Goal**: Tenants have a dedicated, role-scoped portal where they can pay rent, track their payment history, submit maintenance requests, access their lease, complete move-in/out checklists, and view announcements — all without seeing any other tenant's data.
**Depends on**: Phase 4, Phase 5
**Requirements**: TENANT-01, TENANT-02, TENANT-03, TENANT-04, TENANT-05, TENANT-06

**Success Criteria** (what must be TRUE):
  1. A tenant signs in and lands on their portal — they can see their own data only; attempting to access another tenant's lease or payment history returns a permissions error
  2. A tenant can pay rent online (card or ACH) and view their full payment history with downloadable receipts for each transaction
  3. A tenant can submit a maintenance request with a description and photos; the request appears in the manager's work order queue immediately
  4. A tenant can view and download their current lease document as a PDF
  5. A tenant can view and complete their move-in or move-out digital checklist, and read announcements posted by management

**Plans**: TBD
**UI hint**: yes

---

### Phase 7: Owner Portal
**Goal**: Property owners have a dedicated portal showing their full portfolio health — occupancy, rent status, open maintenance — plus downloadable monthly statements and an approval workflow for high-cost maintenance jobs, with tenant contact info kept private until offboarding.
**Depends on**: Phase 4, Phase 5
**Requirements**: OWNER-01, OWNER-02, OWNER-03, OWNER-04, OWNER-05, OWNER-06, OWNER-07

**Success Criteria** (what must be TRUE):
  1. An owner signs in and sees all their properties with occupancy status, rent status, and open maintenance count — no other org's data is visible
  2. An owner can view and download monthly PDF statements for any of their properties; historical statements are unchanged by subsequent edits
  3. An owner can see tenant names on their properties but tenant contact information is hidden; clicking a tenant name shows no phone number or email
  4. An owner can approve or decline a maintenance work order flagged as over $500, with an optional note, directly from the portal
  5. A manager can generate an offboarding package for an owner that includes all lease details and full tenant contact information in a downloadable PDF

**Plans**: TBD
**UI hint**: yes

---

### Phase 8: Vendor Portal
**Goal**: Portal vendors have a dedicated work order queue where they can view assigned jobs, update status, upload photos and notes, and submit invoices — scoped strictly to their own assignments.
**Depends on**: Phase 5
**Requirements**: VENDOR-01, VENDOR-02, VENDOR-03, VENDOR-04, VENDOR-05

**Success Criteria** (what must be TRUE):
  1. A vendor signs in and sees only work orders assigned to them — no other vendor's jobs or any other org data is visible
  2. A vendor can view each work order's property address, description, photos, and priority level
  3. A vendor can update a work order's status through the accepted → in-progress → completed progression
  4. A vendor can upload before/after photos and completion notes to a work order
  5. A vendor can submit an invoice by uploading a PDF or entering a dollar amount; the invoice appears in the manager's review queue

**Plans**: TBD
**UI hint**: yes

---

### Phase 9: Inspections
**Goal**: Managers can conduct move-in, move-out, and routine inspections using a configurable room-by-room checklist with photo attachments and digital tenant signature, producing an exportable PDF report.
**Depends on**: Phase 2
**Requirements**: INSP-01, INSP-02, INSP-03, INSP-04, INSP-05

**Success Criteria** (what must be TRUE):
  1. A manager can create an inspection of type move-in, move-out, or routine and select a checklist template configured for the org
  2. A manager can mark each checklist item as pass, fail, or add a note, and attach a photo to any individual item
  3. A tenant can digitally sign the completed inspection report from any device
  4. The completed inspection generates a PDF report that can be downloaded, emailed, and stored against the property record

**Plans**: TBD
**UI hint**: yes

---

### Phase 10: Documents & Integrations
**Goal**: Managers can import existing leases via OCR, generate branded documents from templates, send documents for e-signature, connect Gmail for e-transfer parsing and outbound email, export any core table to CSV, and the full notification system (email, SMS, in-app) is operational across all prior features.
**Depends on**: Phase 4, Phase 5, Phase 7, Phase 9
**Requirements**: DOC-01, DOC-02, DOC-03, DOC-04, DOC-05, INT-01, INT-02, INT-03, INT-04, NOTIF-01, NOTIF-02, NOTIF-03, NOTIF-04

**Architectural must-haves:**
- PDF generation uses `@react-pdf/renderer` — not Puppeteer or pdf-lib
- OCR uses OpenAI GPT-4o Vision — upload lease PDF, extract fields, present for manager confirmation before saving
- SMS notifications use Pingram — not Twilio (Twilio reference in PROJECT.md is superseded by research decision)
- Gmail integration uses per-org OAuth — each org connects their own Gmail account; Canary's Gmail is not shared

**Success Criteria** (what must be TRUE):
  1. A manager can upload an existing lease PDF; the system extracts tenant name, property, term, rent, and deposit via OCR and presents them for review before saving — no data is committed without manager confirmation
  2. An org admin can upload branded document templates (lease, inspection report, owner agreement); the system can generate a filled PDF from a template with real lease or inspection data
  3. A manager can send a document for e-signature via DocHub API from within the app
  4. A manager can connect a Gmail account (OAuth); the system surfaces Interac e-transfer notification matches and the manager can send outbound email from the connected account
  5. Any portal user receives the correct notification channel (email for reminders/statements, SMS via Pingram for urgent alerts, in-app feed for all events); a manager can post an announcement to all tenants of a property

**Plans**: TBD
**UI hint**: yes

---

### Phase 11: SaaS Billing & Admin
**Goal**: The freemium plan is enforced at the database layer — free orgs are blocked at 5 units, paid orgs are metered via Stripe Subscriptions, and a platform admin portal gives Canary full visibility into all orgs, plans, unit counts, and MRR.
**Depends on**: Phase 1
**Requirements**: BILLING-01, BILLING-02, BILLING-03, BILLING-04, BILLING-05

**Success Criteria** (what must be TRUE):
  1. A new org is automatically on the free plan; attempting to add a 6th unit displays an upgrade prompt and the unit is not created
  2. An org on a paid plan is billed $5/unit/month for each unit above 5 via Stripe Subscriptions; adding or removing units adjusts the metered billing automatically
  3. A platform admin (Canary) can view a list of all organizations showing their plan, unit count, and MRR contribution in an admin portal
  4. An org admin can view their current plan, unit usage, billing history, and upgrade or downgrade their subscription from the org settings page

**Plans**: TBD
**UI hint**: yes

---

## Progress Table

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 2/6 | In Progress|  |
| 2. Core Data Model | 0/? | Not started | - |
| 3. Public Listings | 0/? | Not started | - |
| 4. Payments | 0/? | Not started | - |
| 5. Maintenance | 0/? | Not started | - |
| 6. Tenant Portal | 0/? | Not started | - |
| 7. Owner Portal | 0/? | Not started | - |
| 8. Vendor Portal | 0/? | Not started | - |
| 9. Inspections | 0/? | Not started | - |
| 10. Documents & Integrations | 0/? | Not started | - |
| 11. SaaS Billing & Admin | 0/? | Not started | - |

---

## Coverage Map

| Requirement | Phase |
|-------------|-------|
| FOUND-01 | Phase 1 |
| FOUND-02 | Phase 1 |
| FOUND-03 | Phase 1 |
| FOUND-04 | Phase 1 |
| FOUND-05 | Phase 1 |
| FOUND-06 | Phase 1 |
| FOUND-07 | Phase 1 |
| FOUND-08 | Phase 1 |
| FOUND-09 | Phase 1 |
| FOUND-10 | Phase 1 |
| FOUND-11 | Phase 1 |
| FOUND-12 | Phase 1 |
| FOUND-13 | Phase 1 |
| FOUND-14 | Phase 1 |
| ORGS-01 | Phase 1 |
| ORGS-02 | Phase 1 |
| ORGS-03 | Phase 1 |
| ORGS-04 | Phase 1 |
| ORGS-05 | Phase 1 |
| ORGS-06 | Phase 1 |
| PEOPLE-01 | Phase 2 |
| PEOPLE-02 | Phase 2 |
| PEOPLE-03 | Phase 2 |
| PEOPLE-04 | Phase 2 |
| PROP-01 | Phase 2 |
| PROP-02 | Phase 2 |
| PROP-03 | Phase 2 |
| PROP-04 | Phase 2 |
| PROP-05 | Phase 2 |
| PROP-06 | Phase 2 |
| LEASE-01 | Phase 2 |
| LEASE-02 | Phase 2 |
| LEASE-03 | Phase 2 |
| LEASE-04 | Phase 2 |
| LEASE-05 | Phase 2 |
| LEASE-06 | Phase 2 |
| LIST-01 | Phase 3 |
| LIST-02 | Phase 3 |
| LIST-03 | Phase 3 |
| LIST-04 | Phase 3 |
| LIST-05 | Phase 3 |
| LIST-06 | Phase 3 |
| LIST-07 | Phase 3 |
| PAY-01 | Phase 4 |
| PAY-02 | Phase 4 |
| PAY-03 | Phase 4 |
| PAY-04 | Phase 4 |
| PAY-05 | Phase 4 |
| PAY-06 | Phase 4 |
| PAY-07 | Phase 4 |
| PAY-08 | Phase 4 |
| PAY-09 | Phase 4 |
| PAY-10 | Phase 4 |
| MAINT-01 | Phase 5 |
| MAINT-02 | Phase 5 |
| MAINT-03 | Phase 5 |
| MAINT-04 | Phase 5 |
| MAINT-05 | Phase 5 |
| MAINT-06 | Phase 5 |
| MAINT-07 | Phase 5 |
| MAINT-08 | Phase 5 |
| MAINT-09 | Phase 5 |
| TENANT-01 | Phase 6 |
| TENANT-02 | Phase 6 |
| TENANT-03 | Phase 6 |
| TENANT-04 | Phase 6 |
| TENANT-05 | Phase 6 |
| TENANT-06 | Phase 6 |
| OWNER-01 | Phase 7 |
| OWNER-02 | Phase 7 |
| OWNER-03 | Phase 7 |
| OWNER-04 | Phase 7 |
| OWNER-05 | Phase 7 |
| OWNER-06 | Phase 7 |
| OWNER-07 | Phase 7 |
| VENDOR-01 | Phase 8 |
| VENDOR-02 | Phase 8 |
| VENDOR-03 | Phase 8 |
| VENDOR-04 | Phase 8 |
| VENDOR-05 | Phase 8 |
| INSP-01 | Phase 9 |
| INSP-02 | Phase 9 |
| INSP-03 | Phase 9 |
| INSP-04 | Phase 9 |
| INSP-05 | Phase 9 |
| DOC-01 | Phase 10 |
| DOC-02 | Phase 10 |
| DOC-03 | Phase 10 |
| DOC-04 | Phase 10 |
| DOC-05 | Phase 10 |
| INT-01 | Phase 10 |
| INT-02 | Phase 10 |
| INT-03 | Phase 10 |
| INT-04 | Phase 10 |
| NOTIF-01 | Phase 10 |
| NOTIF-02 | Phase 10 |
| NOTIF-03 | Phase 10 |
| NOTIF-04 | Phase 10 |
| BILLING-01 | Phase 11 |
| BILLING-02 | Phase 11 |
| BILLING-03 | Phase 11 |
| BILLING-04 | Phase 11 |
| BILLING-05 | Phase 11 |

**Total mapped: 71/71**

---

*Last updated: 2026-06-19*
