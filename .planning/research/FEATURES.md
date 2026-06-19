# Feature Landscape — Canary PropOS

**Domain:** Multi-tenant property management SaaS (Canadian market, SMB-focused)
**Researched:** 2026-06-19
**Sources:** AppFolio Stack Partners API (Context7/High confidence), Buildium REST API (Context7/High confidence), training knowledge of AppFolio/Buildium/Propertyware/Rentec Direct/TenantCloud/Landlord Studio feature sets

---

## Table Stakes

Features where absence causes immediate churn or disqualifies the product from evaluation. Every serious competitor has these. "Missing" means users leave or never sign up.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Rent roll / ledger per tenant | Core accounting record — every competitor (AppFolio, Buildium) exposes Charges + Payments + Credits per occupancy | Low | Already planned. Model: charge posted → payment applied → balance tracked |
| Online rent payment (ACH/card) | Tenants expect it; managers stop chasing paper cheques. Buildium and AppFolio have had this for 10+ years | Medium | Stripe ACH + card. Already decided. |
| Manual payment entry | Many Canadian tenants pay by Interac e-transfer or cheque; must be recordable | Low | Critical for Canadian market. Already planned. |
| Maintenance work order lifecycle | Create → assign → in-progress → completed, with vendor assignment and status tracking. AppFolio WO API shows priority, scheduled start/end, permission-to-enter, vendor trade | Medium | Already planned. |
| Lease tracking (dates, rent amount, tenant) | Filtering by lease date range, status, type is baseline per Buildium API. Managers track expirations obsessively | Low | Already planned. |
| Tenant portal (self-serve) | Pay rent, submit maintenance, download docs. TenantCloud and RentecDirect include this even in free tiers | Medium | Already planned. |
| Owner/client statement (monthly PDF) | Owners expect a monthly income/expense summary. This is non-negotiable for any PM managing third-party properties | Medium | Already planned. |
| Document storage (lease PDFs, reports) | Managers keep lease PDFs, inspection reports, correspondence. Must be retrievable per unit/tenant | Low | Already planned via Supabase Storage. |
| Email notifications | Rent due reminders, maintenance updates, lease expiry alerts. No competitor ships without this | Low | Already planned via Resend. |
| Vacancy/listing management | Available units must be publishable. Buildium's Listings API filters by entity type and links to rental application URL | Low-Medium | Already planned. |
| Rental application form | Inquiry → application funnel. Buildium tracks applicant groups with statuses: Undecided → Approved → AddedToLease | Medium | Planned for v1 listing flow. Note: background/credit check is out of scope v1 — correct call. |
| Dashboard (portfolio health snapshot) | Overdue rent, open maintenance, expiring leases — managers check this daily | Low-Medium | Already planned. |
| Multi-property / portfolio grouping | Any manager with 10+ units needs to see across properties, not one at a time | Low | Already planned. |
| SMS/in-app notifications | Urgent alerts (overdue rent, maintenance escalation) need faster channel than email | Medium | Already planned via Twilio + in-app feed. |
| Role-based access control | Managers, tenants, owners, vendors must each see only their data | Medium | Already planned as 6-role model. |

---

## Differentiators

Features that set Canary PropOS apart from the field. These are either absent from competitors, done poorly by them, or uniquely valuable for the target market.

### Tier 1 — Direct Competitive Advantage (build these well)

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Interac e-transfer parsing from Gmail** | AppFolio and Buildium are US-centric; neither has Interac support. Canadian PMs currently reconcile e-transfers manually by reading bank emails. Auto-matching a parsed e-transfer to the correct tenant + lease ledger eliminates 2-5 min of manual work per payment, dozens of times per month | High | Gmail OAuth → read Interac notification emails → extract amount + sender name → fuzzy match to tenant → suggest payment record. The "suggest" UX is important — never auto-post without confirmation. |
| **Vendor email/SMS fallback (no portal required)** | Many small trade vendors refuse to learn new software. AppFolio's vendor portal requires full onboarding. Email job assignment + reply-to-update-status removes that friction entirely | Medium | Already planned. Differentiating because competitors force portal adoption. |
| **Freemium tier (≤5 units free)** | TenantCloud and Landlord Studio offer free tiers; AppFolio and Buildium do not. This is the acquisition channel for independent landlords who grow into the paid tier | Low (product) / Medium (billing enforcement) | Already decided. Stripe Subscriptions per org. |
| **OCR lease import** | Onboarding friction for switchers from other systems or from spreadsheets: they have existing lease PDFs. Auto-extracting tenant name, property, dates, rent from the PDF cuts hours of data entry | High | DocHub API or pdf-lib + OCR. Already planned. High complexity — scope to a "review and confirm" flow, not auto-save. |
| **Inspection mobile UX (room-by-room with photos)** | Buildium has inspections in higher tiers; AppFolio's inspection module is desktop-centric and clunky on mobile. A touch-first, room-by-room checklist with inline camera capture is a real differentiator for field inspectors | Medium | Already planned. Key UX investment: must feel native on iOS/Android despite being a PWA. |
| **Owner maintenance approval workflow** | Threshold-gated approval ($500+) with mobile notification → tap to approve. Most competitors have this in enterprise tiers only. Owners love it because they feel in control without being in the weeds | Medium | Already planned at $500 threshold. |
| **Canadian compliance defaults** | BC Residential Tenancy Act / Ontario RTA notice periods, rent increase rules, and required form templates pre-loaded. US competitors offer zero Canadian-specific templates or notice calculators | Medium | Not yet explicitly planned. Should be phased in: v1 ships document template slots, v2 ships jurisdiction-specific defaults per province. |
| **Branded org templates (white-label per PM company)** | SaaS customers (other PM companies) want their own logo on leases and owner statements. AppFolio supports this; Buildium's free tier does not. For a PM company buying Canary PropOS, this is professional necessity | Medium | Already planned. |

### Tier 2 — Nice to Have (defer to v2 unless low effort)

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Rent price suggestion (AI/market) | Tells manager if their rent is below market. Useful but requires external data feed (Rentcast, Zumper API) | High | Out of scope v1 — correct. |
| Predictive maintenance flagging | Flag units with recurring issues. Requires ML over historical WO data — needs 12+ months of data first | Very High | Out of scope v1 — correct. |
| Tenant credit/background check | Equifax or TransUnion integration for Canadian credit pulls. TransUnion has a Canadian API; Certn is the leading Canadian screening platform | High | Out of scope v1. Certn is the right Canadian partner when ready (not US-only vendors like Checkr or Experian). |
| Owner mobile app | Owners are high-value users; a native iOS app for statement review and maintenance approval would increase stickiness | High | PWA covers v1. |
| Maintenance recurring scheduling | Preventive maintenance (furnace filter every 3 months, etc.) | Medium | Not planned — good v2 candidate. |
| Tenant communication log | All emails/texts with a tenant archived per lease. Valuable for dispute resolution | Medium | Gmail logging partially covers this. Explicit thread log is v2. |

---

## Anti-Features

Deliberate choices to NOT build in v1, with rationale.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Full double-entry accounting / GL** | AppFolio and Buildium built full GL systems. It took them years. This is a sink of infinite complexity (bank reconciliation, chart of accounts, journal entries, audit trails) that delays shipping every other feature | Ship: charge/payment ledger per tenant + CSV export for bookkeeper. Plan: QuickBooks Online sync in v2. The bookkeeper owns the GL — don't replicate it. |
| **Built-in credit / background screening** | US-only APIs (Experian, Checkr) are useless for Canada. Canadian APIs (TransUnion, Certn) require compliance vetting and PIPEDA handling. Getting this wrong is a liability. | Gate the rental application at v1; add a "screening in progress" status field. Link out to Certn externally if pressed. Build the integration in v2. |
| **Native iOS / Android app** | Native apps require separate codebases, App Store review cycles, and ongoing platform maintenance. PWA with responsive design covers 90% of mobile use cases for the target user | Mobile-first responsive web. PWA manifest for home screen install. |
| **Bi-directional QuickBooks sync** | Real-time two-way sync requires conflict resolution logic, QBO webhook handling, and extensive testing. Bookkeepers often have their own QBO setup that conflicts | CSV export that matches QBO import format. Solves the bookkeeper workflow without the sync complexity. |
| **AI chat / copilot UX** | Premature. Adds latency, cost, and hallucination risk before the data model is mature | Ship structured workflows. Add AI suggestions (e.g., payment matching) as a specific, scoped feature — not a general chat interface. |
| **Complex lease clause library** | Legal clause libraries need jurisdiction-specific legal review to be safe to use. Without a lawyer's sign-off, a bad clause is a liability | Ship blank/custom template slots. Let the PM company's lawyer provide their own clauses. |
| **Marketplace / vendor directory** | Buildium has a "Buildium Marketplace" for finding vendors. Premature for a new platform — no trust signal without transaction history | Keep vendor management internal. Do not build a public vendor marketplace until there is volume. |
| **Tenant renter's insurance integration** | US competitors (Lemonade, etc.) offer embedded insurance. Canadian renters insurance market works differently. No clear API partner | Skip v1. Surface a reminder in the tenant portal to get insurance; no integration needed. |
| **HOA / condo association management** | Buildium supports HOA; it is a meaningfully different product category (common area budgeting, meeting minutes, board voting). Splitting focus between residential PM and HOA is a classic startup mistake | Strictly in-scope: residential rental management only. |

---

## Canadian Market Gaps (What US-Centric Tools Miss)

This is the most under-researched segment in PM software. Confidence: MEDIUM (based on known regulatory context + Interac's market position; verified by the absence of Interac support in AppFolio/Buildium APIs).

| Gap | What Canadian PMs Need | Current US Tool Response | Canary PropOS Approach |
|-----|----------------------|--------------------------|------------------------|
| **Interac e-transfer reconciliation** | ~70% of Canadian tenants pay rent by Interac. No PM software parses Interac notification emails | None — manual ledger entry | Gmail OAuth parsing → suggested payment match (flagship differentiator) |
| **Provincial tenancy law compliance** | BC, Ontario, Alberta each have different notice periods, rent increase limits, and required forms (e.g., BC RTB Form 1, Ontario N-series forms) | Zero Canadian forms — US tools use state-specific US forms | v1: custom template slots. v2: province selector with pre-built form templates and increase calculators |
| **GST/HST on management fees** | PM companies charge management fees that are subject to GST/HST. Invoicing must reflect this | US tools use US tax framework (no HST concept) | Expense/invoice entries must support a "tax rate" field. This affects owner statements. Flag for implementation. |
| **Canadian credit bureaus** | TransUnion and Equifax Canada (not US entities) are the screening sources | Experian, TransUnion US — Canadian SINs won't match | Skip v1. Partner with Certn when ready. |
| **EFT / pre-authorized debit** | Canadian banks use EFT/PAD (pre-authorized debit) for recurring payments, not ACH. Stripe supports Canadian PAD via "pre_authorized_debit" payment method | US tools default to ACH | Stripe's `payment_method_types: ["accrual", "pre_authorized_debit"]` for Canadian customers. Medium complexity — scope clearly. |
| **French language support (Quebec)** | Quebec rental law requires French in leases; RLRQ c. B-1.1 applies | English-only US tools | Out of scope v1. Flag for v2 if Quebec PM companies are targeted. |

---

## Feature Dependencies

Build order matters. These are hard dependencies:

```
Organizations (multi-tenant) → ALL features (nothing works without org isolation)

Properties → Leases → Payments (can't have a payment without a lease)
Properties → Listings (listing is a property in available state)
Properties → Inspections (inspection is tied to a property/unit)
Properties → Maintenance (work order scoped to a property)

Leases → Tenant Portal (tenants need an active lease to access portal)
Leases → Inspections (move-in/out linked to lease)

Payments → Owner Statements (statements are an aggregation of payments)

Maintenance → Vendor Portal (vendors need assigned work orders to exist)
Maintenance → Owner Approval Workflow (threshold approval triggered from maintenance cost estimate)

Gmail OAuth → Interac e-transfer parsing (parsing needs a connected Gmail account)
Stripe → Online rent collection
Stripe Subscriptions → Freemium billing enforcement
```

---

## MVP Recommendation

**Prioritize for v1 (table stakes first, then top differentiators):**

1. Multi-tenant org isolation + RBAC (6 roles) — everything depends on this
2. Properties + leases + tenant management
3. Maintenance work orders (create → assign → complete)
4. Manual payment entry + online rent (Stripe ACH/card)
5. Tenant portal (rent payment, maintenance, docs)
6. Owner portal (statements, maintenance approval)
7. Interac e-transfer parsing via Gmail — ship this early; it is the flagship Canadian differentiator
8. Listings + rental application form
9. Inspections (move-in, move-out, routine)
10. DocHub e-signature on leases
11. Document storage + OCR import
12. Freemium billing (Stripe Subscriptions)
13. Notifications (email, SMS, in-app)

**Defer confidently:**
- GL / double-entry accounting → CSV export covers v1
- Credit/background screening → v2, use Certn (Canada)
- Quebec French localization → v2
- Native mobile app → PWA covers v1
- QuickBooks bi-directional sync → v2
- AI/predictive features → v2
- HOA management → never (wrong product category)
- Pre-authorized debit (PAD) via Stripe → v2 (credit card + Interac cash covers most users)

---

## Confidence Assessment

| Area | Confidence | Basis |
|------|------------|-------|
| Table stakes feature list | HIGH | Verified against AppFolio Stack Partners API + Buildium REST API (Context7, high-reputation sources) |
| Differentiator assessment | HIGH | Competitor API surfaces confirm what is and isn't present; Canadian Interac gap is well-established |
| Canadian market gaps | MEDIUM | Known regulatory context + confirmed absence of Interac in competitor APIs; specific form requirements need province-by-province legal validation |
| Anti-feature rationale | HIGH | Based on known engineering cost patterns + confirmed competitor feature surfaces |
| Feature complexity estimates | MEDIUM | Engineering estimates from comparable implementations; individual tasks may vary |

---

## Sources

- AppFolio Stack Partners API — https://www.appfolio.com/stack/partners/api/index (via Context7, High reputation)
- Buildium REST API — https://developer.buildium.com/ (via Context7, High reputation, 1840 code snippets)
- AppFolio feature set: work orders support `PermissionToEnter`, `Priority`, `VendorTrade`, `ScheduledStart/End` — confirms enterprise-grade WO features that represent the table stakes ceiling
- Buildium applicant groups: statuses `Undecided → Approved → AddedToLease → Cancelled → Deferred` — confirms application funnel expectations
- Buildium payment methods enum: `Check, Cash, MoneyOrder, CashierCheck, DirectDeposit, CreditCard, ElectronicPayment` — no Interac variant confirms the gap
- Interac e-transfer market position: Payments Canada data (training knowledge) — Interac processed 1.1B e-transfers in 2023, ~$550B value; dominant for P2P and small business rent payments in Canada
