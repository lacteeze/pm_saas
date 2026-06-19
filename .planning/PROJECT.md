# Canary PropOS — Property Management SaaS

## What This Is

A full-stack, multi-tenant property management platform built first for **Canary Property Management** (150+ units) and sold as **SaaS** to other property managers and independent landlords. It replaces Canary's current AppSheet/Google Sheets system — which works but is slow, visually poor, and impossible to customize — with a modern, responsive web app that looks and performs like a professional product.

The core promise: one system that connects properties, owners, tenants, vendors, leases, maintenance, payments, and documents — with role-appropriate portals for everyone involved.

## Who It's For

**Internal (Canary)**
- Canary manages 150+ units across multiple owner portfolios today
- Day-to-day: tracking rent, maintenance tickets, lease renewals, owner disbursements, and vendor work orders — currently scattered across AppSheet, Gmail, and manual processes

**SaaS customers**
- Other property management companies who need a professional tool without enterprise pricing
- Independent landlords not ready to hire a property manager but wanting PM-grade software
- Freemium model: free for small portfolios (≤5 units), paid tiers for growing operations

## Core Value

A unified hub where any authorized party — manager, owner, tenant, or vendor — can see exactly what they need and take exactly the actions they're allowed to, without phone calls, emails, or spreadsheets filling the gap.

## Users & Roles

Six roles with strictly scoped permissions:

| Role | CRUD Scope | Key Restrictions |
|------|-----------|-----------------|
| **Admin** | Full CRUD on all data across all organizations | Platform superuser — Canary internal only |
| **Manager** | Full CRUD on their org's data and all data created by their team, tenants, clients, vendors | Cannot access other orgs |
| **Employee** | CRUD on data shared with them + data from their assigned tenants/clients/vendors | Cannot manage users or billing |
| **Tenant** | Create records (maintenance requests, applications) + submit update requests | Cannot view other tenants, limited contact visibility |
| **Client (Owner)** | View portfolio/statements, approve maintenance >$500, download statements | Cannot see tenant contact info (except offboarding doc) |
| **Vendor** | CRUD on their own records, update job statuses, submit invoices | Only sees their assigned work orders |

**Multi-tenant SaaS structure:** Each PM company or landlord is an **organization**. Organization admins invite managers and employees. Canary is organization #1.

## Data Model (Core Tables)

- **People** — all users across all roles (polymorphic with role + org association)
- **Organizations** — SaaS tenants (PM companies, individual landlords)
- **Portfolios** — grouping of properties under one owner client
- **Properties** — individual units/buildings with full details
- **Leases** — tenant-property-term-rent contract records
- **Listings** — publicly visible available-for-rent records
- **Projects** (Maintenance) — work orders from creation through resolution
- **Payments** — rent collection, disbursements, expenses, invoices
- **Inspections** — move-in, move-out, routine; linked to property + lease
- **Documents** — leases, inspection reports, owner agreements (per-org branded templates)

## Key Features

### Public Listings (no auth required)
- Browse available units with filters (price, beds, location, amenities)
- Full listing detail page with gallery, floor plan, map
- Inquiry / showing request form capturing rental criteria (budget, move-in date, preferences)
- Online rental application

### Manager / Employee Portal (auth required)
- Dashboard: portfolio health, overdue rent, open maintenance, upcoming lease expirations
- Property and portfolio management
- Tenant management (lease creation/renewal, rent tracking)
- Maintenance work order system with vendor assignment or email/SMS escalation
- Owner disbursement calculation and monthly statement generation
- Inspection management (create, assign, complete)
- Document management with OCR import and branded template generation
- Team management (invite employees, set access scope)

### Tenant Portal
- Pay rent online (Stripe — ACH/card) or log manual payment (Interac e-transfer)
- Submit maintenance requests
- View and download lease documents
- Payment history with receipts
- Move-in / move-out digital checklist
- Announcements / notices from management

### Owner / Client Portal
- Portfolio overview (occupancy, rent status, open maintenance per property)
- Monthly owner statements (downloadable PDF)
- Tenant names visible; contact info hidden (released only in offboarding document)
- Maintenance approval workflow for expenses >$500
- Offboarding package generation (all leases + tenant info when owner offboards)

### Vendor Portal + Email/SMS Fallback
- View assigned work orders with property address, description, priority
- Update job status (accepted → in-progress → completed)
- Upload photos and completion notes
- Submit invoices (PDF upload or dollar-amount entry)
- **Email/SMS mode**: vendors who prefer not to use the portal receive job details by email/SMS and can reply to update status

### Maintenance System
- Created by: tenants, managers, employees, or managers on behalf of tenants
- Assign to internal staff or a vendor (portal or email/SMS)
- Photo uploads, status tracking, cost logging
- Escalation to owner for approval when estimate >$500

### Inspections
- Types: Move-in, Move-out, Routine
- Room-by-room checklist with pass/fail/note per item
- Photo attachment per checklist item
- Digital tenant signature on completion
- PDF report export

### Payments
- Online rent collection via Stripe (ACH/card)
- Manual payment entry (e.g., Interac e-transfer received in Gmail)
- Expense tracking (maintenance costs, management fees)
- Owner disbursement calculation
- Payment history per tenant, per property

### Authentication
- Email + password
- Google OAuth
- Apple OAuth
- Magic link (passwordless email)

### Notifications
- **Email**: rent due reminders, lease expiry warnings, maintenance updates, owner statements, showing confirmations
- **SMS**: urgent alerts (overdue rent, maintenance status, vendor job assignments)
- **In-app**: notification feed for all portal users
- **Push** (v2): mobile push via PWA or native app

### Documents
- OCR import: upload existing lease PDF → system extracts tenant, property, dates, rent amount
- Branded document templates per organization (leases, inspection reports, owner agreements)
- DocHub API integration for e-signature on leases, inspection reports, owner agreements
- PDF export for statements, inspection reports, offboarding packages

### Integrations
- **Gmail**: parse Interac e-transfer notification emails → suggest payment match; log emails to tenant/maintenance records; send outbound email from app via connected Gmail
- **CSV export**: all core tables exportable to CSV for QuickBooks or bookkeeper
- **QuickBooks Online**: plan data model for future bi-directional sync; v1 ships CSV export only
- **Stripe**: rent collection, refunds, disbursement records
- **DocHub**: e-signature API; fallback to OCR-only if API gating is complex
- **Twilio**: SMS notifications and vendor communication

## Tech Stack (Recommended)

| Layer | Choice | Rationale |
|-------|--------|-----------|
| Frontend | Next.js 15 App Router (TypeScript) | SaaS-grade routing, RSC, Vercel native |
| UI | Tailwind CSS + shadcn/ui | Fast, customizable, no licensing cost |
| Backend / DB | Supabase (PostgreSQL + Auth + Storage + Realtime) | Row-level security for multi-tenant, built-in auth, file storage for docs/photos |
| Payments | Stripe | Industry standard, ACH + card, webhooks |
| Email | Resend | Transactional email, React Email templates |
| SMS | Twilio | Programmable SMS for notifications + vendor comms |
| Hosting | Vercel | Next.js native, preview deployments, edge network |
| Documents | DocHub API + pdf-lib / Puppeteer | E-signature + PDF generation |
| File Storage | Supabase Storage | Photos, inspection reports, lease PDFs |

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Multi-tenant from day one | Canary is SaaS customer #1; org isolation in Supabase RLS avoids a rewrite later | Org-scoped RLS on all tables |
| Supabase over custom backend | Built-in auth, RLS, storage, realtime — avoids building these primitives | Supabase as backend-of-record |
| Freemium SaaS model | Lowers barrier for indie landlords; upgrades to paid as portfolio grows | Free ≤5 units; paid tiers TBD |
| DocHub over DocuSign | User already uses DocHub; has an API | DocHub API primary, OCR as fallback |
| CSV export before QBO sync | Bookkeeper workflow works today; sync is a nice-to-have | Ship CSV export v1, plan QBO v2 |
| Dual vendor mode (portal + email/SMS) | Some vendors won't use software; can't force adoption | Both paths exist in v1 |

## Constraints

- Owner contact info for tenants is restricted until offboarding (privacy + business retention)
- Maintenance expense approval gate at $500 (owner must approve above threshold)
- Canary uses Gmail; Gmail integration must handle Interac e-transfer parsing for payment matching
- Mobile-responsive design is mandatory (managers and tenants use phones)

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Multi-tenant org isolation with 6-role permission model
- [ ] Public listings page (browse, detail, inquiry, application) — no auth
- [ ] Manager portal with full property/tenant/lease/maintenance/payment management
- [ ] Tenant portal (rent payment, maintenance, lease docs, payment history, move-in/out checklist, announcements)
- [ ] Owner/client portal (portfolio overview, statements, maintenance approval >$500, offboarding doc)
- [ ] Vendor portal + email/SMS fallback for job assignment and status updates
- [ ] Maintenance work order system (create, assign, photo, status, cost)
- [ ] Inspections (move-in, move-out, routine) with checklist, photos, signature, PDF export
- [ ] Online rent collection (Stripe) + manual payment entry
- [ ] Auth: email/password, Google, Apple, magic link
- [ ] Notifications: email, SMS, in-app (push v2)
- [ ] OCR lease import (extract key info from uploaded PDF)
- [ ] Branded document templates per org (leases, inspection reports, owner agreements)
- [ ] DocHub e-signature integration
- [ ] Gmail integration (e-transfer parsing, email logging, outbound send)
- [ ] CSV export for all core tables
- [ ] QuickBooks Online integration (v2, plan data model now)
- [ ] Freemium billing (Stripe Subscriptions) with org-level plan enforcement
- [ ] Monthly owner statement generation (PDF)
- [ ] Portfolio and property management with owner disbursement calculation
- [ ] Team management (invite managers/employees, scope their access)

### Out of Scope (v1)

- Native mobile app — PWA responsive design covers mobile; native is v2
- QuickBooks bi-directional sync — CSV export ships v1, sync is v2
- Push notifications — in-app + email + SMS covers v1; push requires PWA/native
- AI/ML features (predictive maintenance, rent pricing suggestions) — v2
- Online rental applications with credit check / background check API — v2

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-06-19 after initialization*
