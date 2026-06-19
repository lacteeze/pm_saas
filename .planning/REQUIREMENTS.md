# Requirements — Canary PropOS

**Version:** v1.0
**Last updated:** 2026-06-19

---

## v1 Requirements

### FOUNDATION — Auth & Multi-Tenancy

- [ ] **FOUND-01**: User can create an organization account (SaaS sign-up) with email/password
- [ ] **FOUND-02**: User can sign in with Google OAuth
- [ ] **FOUND-03**: User can sign in with Apple OAuth
- [ ] **FOUND-04**: User can sign in with magic link (passwordless email)
- [ ] **FOUND-05**: Each organization's data is completely isolated from all other organizations (Supabase RLS, org_id on every row)
- [ ] **FOUND-06**: JWT tokens include custom claims (role, org_id, person_id) injected at sign-in via Supabase Auth Hooks
- [ ] **FOUND-07**: Admin can access all organizations' data (platform superuser, cross-org RLS bypass)
- [ ] **FOUND-08**: Manager can create, read, update, and delete all data within their organization
- [ ] **FOUND-09**: Employee can create, read, update, and delete data shared with them and data from their assigned tenants/clients/vendors
- [ ] **FOUND-10**: Tenant can submit records (maintenance requests, applications) and submit update requests only
- [ ] **FOUND-11**: Client (owner) can view portfolio data, approve/decline maintenance over $500, download statements — read-only otherwise
- [ ] **FOUND-12**: Vendor can view assigned work orders, update job status, upload photos/notes, submit invoices — scoped to their assignments only
- [ ] **FOUND-13**: RLS policies enforce permission model on all database tables including storage buckets
- [ ] **FOUND-14**: Supabase Realtime uses private channels only (no public channel subscriptions)

### ORGS — Organization & Team Management

- [ ] **ORGS-01**: Organization admin can invite managers and employees by email
- [ ] **ORGS-02**: Invited users receive email with sign-up link that pre-associates them with the org and role
- [ ] **ORGS-03**: Organization admin can remove a user from the org (triggers session revocation)
- [ ] **ORGS-04**: Organization has a profile (name, logo, contact info, province/jurisdiction, branding colors)
- [ ] **ORGS-05**: Organization has a plan limit (free: ≤5 units; paid: unit count per subscription)
- [ ] **ORGS-06**: System blocks adding properties/units when org is at plan unit limit

### PEOPLE — People Management

- [ ] **PEOPLE-01**: Manager can create a person record for any role (tenant, client, vendor, employee)
- [ ] **PEOPLE-02**: Person record includes: name, email, phone, role(s), associated org, created date
- [ ] **PEOPLE-03**: Person can be associated with multiple roles (e.g., someone who is both a tenant and a client)
- [ ] **PEOPLE-04**: Manager can view, edit, and deactivate person records within their org

### PROPERTIES — Properties & Portfolios

- [ ] **PROP-01**: Manager can create a property record (address, unit type, bedrooms, bathrooms, square footage, amenities, photos)
- [ ] **PROP-02**: Property record includes province/jurisdiction field for compliance rules
- [ ] **PROP-03**: Manager can associate a property with an owner (client)
- [ ] **PROP-04**: Manager can group properties into a portfolio under one owner
- [ ] **PROP-05**: Manager can view a property dashboard showing current tenant, lease status, rent status, open maintenance
- [ ] **PROP-06**: Manager can upload and manage property photos (stored in org-scoped Supabase Storage bucket)

### LEASES — Lease Management

- [ ] **LEASE-01**: Manager can create a lease linking a tenant (person) to a property with term, monthly rent, due date, and deposit amount
- [ ] **LEASE-02**: Manager can view all active, expiring, and expired leases
- [ ] **LEASE-03**: System displays alerts at 90, 60, and 30 days before lease expiry on manager dashboard
- [ ] **LEASE-04**: Manager can initiate a lease renewal workflow (generate renewal document, send to tenant, track acceptance)
- [ ] **LEASE-05**: Lease documents (PDF) can be uploaded and stored per lease record
- [ ] **LEASE-06**: Tenant can view and download their current lease document from the tenant portal

### LISTINGS — Public Listings

- [ ] **LIST-01**: Public listings page displays available units with no sign-in required
- [ ] **LIST-02**: Visitor can filter listings by price range, number of bedrooms, location, and amenities
- [ ] **LIST-03**: Each listing has a detail page with photos, floor plan, full description, and map
- [ ] **LIST-04**: Visitor can submit an inquiry/showing request with their name, email, phone, desired move-in date, budget, and rental criteria
- [ ] **LIST-05**: Visitor can submit a full rental application through the listing page
- [ ] **LIST-06**: Manager can publish, unpublish, and edit listings from the manager portal
- [ ] **LIST-07**: Manager receives in-app + email notification when an inquiry or application is submitted

### PAYMENTS — Rent Collection & Owner Disbursements

- [ ] **PAY-01**: Tenant can pay rent online via card or ACH through the tenant portal (Stripe)
- [ ] **PAY-02**: Manager can manually record a payment (amount, method: Interac e-transfer, cheque, cash, bank transfer, date, reference note)
- [ ] **PAY-03**: System parses connected Gmail inbox for Interac e-transfer notification emails and suggests matching to a tenant/lease for manager confirmation (never auto-confirms)
- [ ] **PAY-04**: Online payments via ACH/ACSS are held for a minimum of 5 business days before releasing for disbursement
- [ ] **PAY-05**: Manager can record expenses against a property (vendor invoice, supplies, repairs) with a vendor cost field and a billed-to-owner field (markup is not visible to owners or tenants)
- [ ] **PAY-06**: System calculates owner disbursement: rent collected minus expenses (billed amount) minus management fee = net to owner
- [ ] **PAY-07**: Monthly owner statement is generated as an append-only PDF snapshot (historical statements cannot be changed by subsequent edits)
- [ ] **PAY-08**: All payment data is exportable to CSV for bookkeeper/QuickBooks import
- [ ] **PAY-09**: Tenant can view their full payment history with receipts in the tenant portal
- [ ] **PAY-10**: Stripe webhook events are idempotent (duplicate events do not create duplicate payment records)

### MAINTENANCE — Work Orders

- [ ] **MAINT-01**: Tenant, manager, or employee can create a maintenance work order (description, priority, photos, property)
- [ ] **MAINT-02**: Work order has a state machine: draft → submitted → assigned → in_progress → pending_approval → approved → completed → closed
- [ ] **MAINT-03**: Manager can assign a work order to a vendor (portal user) or trigger email/SMS notification to a non-portal vendor
- [ ] **MAINT-04**: Non-portal vendors receive work order details via email/SMS with a no-login link to update status and upload completion photos
- [ ] **MAINT-05**: Non-portal vendors can submit an invoice (PDF or dollar amount) via the no-login link
- [ ] **MAINT-06**: Work orders with an estimated cost above $500 are automatically flagged and routed to the owner for approval before proceeding
- [ ] **MAINT-07**: Owner receives in-app + email notification for pending approval; can approve or decline with optional note
- [ ] **MAINT-08**: Manager can log vendor cost (actual cost paid to vendor) and billed cost (amount charged to owner); markup is visible only to managers and employees
- [ ] **MAINT-09**: Work order costs feed into owner disbursement calculations as property expenses

### TENANT PORTAL — Tenant-Facing Features

- [ ] **TENANT-01**: Tenant has a dedicated portal accessible after sign-in
- [ ] **TENANT-02**: Tenant can pay rent and view full payment history with receipts
- [ ] **TENANT-03**: Tenant can submit a maintenance request with description and photos
- [ ] **TENANT-04**: Tenant can view their current lease document (download PDF)
- [ ] **TENANT-05**: Tenant can view and complete their move-in or move-out digital checklist
- [ ] **TENANT-06**: Tenant can view announcements and notices posted by management

### OWNER PORTAL — Client-Facing Features

- [ ] **OWNER-01**: Owner (client) has a dedicated portal accessible after sign-in
- [ ] **OWNER-02**: Owner can view a portfolio overview: all properties, occupancy status, rent status, open maintenance
- [ ] **OWNER-03**: Owner can view and download their monthly PDF statements
- [ ] **OWNER-04**: Owner can see tenant names on their properties but NOT tenant contact information
- [ ] **OWNER-05**: Owner can approve or decline maintenance work orders over $500
- [ ] **OWNER-06**: Manager can generate an offboarding package for an owner that includes all lease details and tenant contact information
- [ ] **OWNER-07**: Owner can send messages to their property manager through the portal

### VENDOR PORTAL — Vendor-Facing Features

- [ ] **VENDOR-01**: Portal vendor has a dedicated sign-in and work order queue
- [ ] **VENDOR-02**: Vendor can view assigned work orders with property address, description, photos, and priority
- [ ] **VENDOR-03**: Vendor can update work order status (accepted, in-progress, completed)
- [ ] **VENDOR-04**: Vendor can upload before/after photos and completion notes to a work order
- [ ] **VENDOR-05**: Vendor can submit an invoice (PDF upload or enter dollar amount) for manager review

### INSPECTIONS — Property Inspections

- [ ] **INSP-01**: Manager can create an inspection of type: move-in, move-out, or routine
- [ ] **INSP-02**: Inspection uses a room-by-room checklist with pass/fail/note per item (checklist template configurable per org)
- [ ] **INSP-03**: Each checklist item supports photo attachment
- [ ] **INSP-04**: Tenant can digitally sign the completed inspection report
- [ ] **INSP-05**: Completed inspection generates a PDF report exportable and storable per property

### DOCUMENTS — Document Management

- [ ] **DOC-01**: Manager can upload an existing lease PDF; system uses OCR (OpenAI GPT-4o Vision) to extract key fields (tenant name, property, term, rent, deposit) for manager review and confirmation before saving
- [ ] **DOC-02**: Each organization can upload branded document templates (lease, inspection report, owner agreement)
- [ ] **DOC-03**: System can generate a filled PDF document from a template with lease or inspection data
- [ ] **DOC-04**: Manager can send a document for e-signature via DocHub API
- [ ] **DOC-05**: System generates owner statement PDFs and inspection report PDFs in-app (using @react-pdf/renderer)

### NOTIFICATIONS — Alerts & Communications

- [ ] **NOTIF-01**: System sends email notifications for: rent due reminders, lease expiry warnings (90/60/30 days), maintenance status updates, new inquiry/application received, owner statement ready
- [ ] **NOTIF-02**: System sends SMS notifications via Pingram for: overdue rent alerts, maintenance status changes, vendor job assignments
- [ ] **NOTIF-03**: All portal users have an in-app notification feed (bell icon) with notification history
- [ ] **NOTIF-04**: Manager can send an announcement/notice to all tenants of a property or portfolio

### INTEGRATIONS

- [ ] **INT-01**: Manager can connect a Gmail account (OAuth); system scans for Interac e-transfer notifications and surfaces suggested payment matches
- [ ] **INT-02**: Manager can send outbound email through the connected Gmail account from within the app
- [ ] **INT-03**: Incoming emails relevant to a tenant or work order can be logged to that record
- [ ] **INT-04**: All core tables (people, properties, leases, payments, work orders) are exportable to CSV

### SAAS BILLING

- [ ] **BILLING-01**: New organizations are on the free plan (up to 5 units at no cost)
- [ ] **BILLING-02**: Organizations pay $5/unit/month for each unit above 5 (metered billing via Stripe Subscriptions)
- [ ] **BILLING-03**: System blocks adding units when an org would exceed their plan limit (prompts upgrade)
- [ ] **BILLING-04**: Admin portal shows all organizations, their plan, unit count, and MRR
- [ ] **BILLING-05**: Org admin can manage their subscription and billing from the org settings page

---

## v2 Requirements (Deferred)

- Online rental application with credit check / background check (Certn for Canadian market)
- QuickBooks Online bi-directional sync (data model planned in v1 to support this)
- Stripe Connect for direct owner payouts (single-account + disbursement records in v1)
- Push notifications (PWA / native)
- Native mobile app (iOS/Android)
- AI features: predictive maintenance, rent pricing suggestions
- Bulk rent increase workflow with province-specific notice period enforcement
- Province-specific tenancy form templates (BC RTA, Ontario RTA, Alberta RLRA)
- GST/HST invoicing on management fees (data model fields in v1, UI/logic in v2)
- DocHub e-signature fallback to OCR-only if DocHub API access is unavailable

---

## Out of Scope (v1)

- **Full double-entry accounting / GL** — This is a years-long build. CSV export + bookkeeper covers v1. Reason: anti-feature; avoid AppFolio scope creep.
- **QuickBooks bi-directional sync** — CSV export ships v1; QBO sync is complex to maintain. Reason: bookkeeper workflow works today.
- **Rent price suggestions / market comps** — Requires ongoing data feeds. Not core to operations.
- **Tenant screening (credit/background check)** — Third-party API complexity + Canadian provider (Certn) selection needed. Defer to v2.
- **Stripe Connect** — Single-account + disbursement records covers v1. Connect adds complexity. Defer to v2 when orgs need direct payouts.
- **Province-specific compliance enforcement** — Province field ships v1; enforcement rules (rent increase caps, notice periods) are legally complex per province. Defer compliance logic to v2.
- **Native mobile app** — PWA responsive design covers mobile for v1.

---

## Traceability

| Requirement | Phase |
|-------------|-------|
| FOUND-01 to FOUND-14 | Phase 1: Foundation |
| ORGS-01 to ORGS-06 | Phase 1: Foundation |
| PEOPLE-01 to PEOPLE-04 | Phase 2: Core Data Model |
| PROP-01 to PROP-06 | Phase 2: Core Data Model |
| LEASE-01 to LEASE-06 | Phase 2: Core Data Model |
| LIST-01 to LIST-07 | Phase 3: Public Listings |
| PAY-01 to PAY-10 | Phase 4: Payments |
| MAINT-01 to MAINT-09 | Phase 5: Maintenance |
| TENANT-01 to TENANT-06 | Phase 6: Tenant Portal |
| OWNER-01 to OWNER-07 | Phase 7: Owner Portal |
| VENDOR-01 to VENDOR-05 | Phase 8: Vendor Portal |
| INSP-01 to INSP-05 | Phase 9: Inspections |
| DOC-01 to DOC-05 | Phase 10: Documents & Integrations |
| INT-01 to INT-04 | Phase 10: Documents & Integrations |
| NOTIF-01 to NOTIF-04 | Phase 10: Documents & Integrations |
| BILLING-01 to BILLING-05 | Phase 11: SaaS Billing & Admin |

---

## Definition of Done (v1)

A requirement is complete when:
1. Feature is implemented and passing automated tests
2. Role-based access is enforced (correct roles can access, others cannot)
3. Works correctly on mobile (responsive design)
4. Data is org-scoped (no cross-org data leakage)
5. Error states are handled gracefully (not blank screens or raw error messages)
