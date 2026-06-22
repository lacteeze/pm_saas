# Phase 4: Payments — Research

**Written:** 2026-06-21 (inline — API overload prevented subagent spawn)
**Confidence:** HIGH

---

## 1. Stripe Canada — ACSS Debit

- **ACSS Debit** (Pre-Authorized Debit) is correct for Canadian bank rent payments. Requires a PAD mandate signed by tenant before first charge via SetupIntent.
- **Direct Stripe (no Connect):** Canary is a single PM company — Connect is for marketplace platforms. Use direct Stripe.
- **5-business-day hold:** On `payment_intent.processing` → status='pending_clearance'. On `payment_intent.succeeded` → cleared_at=NOW(), disbursable_after = cleared_at + 5 business days (excluding weekends + Canadian federal holidays).

## 2. Stripe Webhook Idempotency (PAY-10)

Key events: payment_intent.succeeded, payment_intent.payment_failed, payment_intent.processing, setup_intent.succeeded

stripe_events table: stripe_event_id (text UNIQUE), event_type, processed_at, payload jsonb.

Raw body fix for Next.js: use `req.text()` (not req.json()) in the route handler — gives raw body needed for stripe.webhooks.constructEvent().

## 3. Gmail OAuth — Interac E-Transfer (PAY-03)

Package: `googleapis`. OAuth2 flow: generate auth URL (scope: https://mail.google.com/, access_type: offline) → callback exchanges code → store tokens.

Token storage columns on organizations: gmail_access_token, gmail_refresh_token, gmail_token_expiry (bigint unix ms), gmail_connected_at.

Search query: `from:notifications@payments.interac.ca subject:"INTERAC e-Transfer"`
Parse body for amount ($XXX.XX pattern) and sender name.

Token refresh: check expiry before each API call, call refreshAccessToken() if expired, update stored token.

## 4. Management Fee + Disbursement (PAY-05, PAY-06)

Properties table: add management_fee_type text CHECK IN ('percent','flat'), management_fee_value numeric(10,2).

Disbursement = rentCollected - totalBilledExpenses - managementFee
managementFee = percent mode: rentCollected * (value/100) | flat mode: value

Application-layer calculation (not DB function).

## 5. Monthly Owner Statements PDF (PAY-07)

Use renderToBuffer() from @react-pdf/renderer in a Server Action.
Upload to org-assets bucket: statements/{property_id}/{YYYY-MM}.pdf with upsert:false for immutability.
Store path + totals in owner_statements table (UNIQUE on property_id + period_year + period_month).

PDF sections: property header, period, rent collected, expenses (billed_amount only), management fee, net to owner.

## 6. New DB Tables

payments: id, org_id, lease_id, amount, method (stripe/etransfer/cheque/cash/bank_transfer), status (recorded/pending_clearance/cleared/failed), stripe_payment_intent_id nullable, cleared_at nullable, disbursable_after date nullable, recorded_by, notes, created_at.

expenses: id, org_id, property_id, description, vendor_cost, billed_amount, expense_date, created_by, created_at.

stripe_events: id, stripe_event_id UNIQUE, event_type, processed_at, payload jsonb.

owner_statements: id, org_id, property_id, period_year, period_month, pdf_path, rent_collected, total_expenses, management_fee, net_to_owner, generated_at, generated_by. UNIQUE(property_id, period_year, period_month).

## 7. CSV Export + Tenant History

CSV: payments JOIN leases JOIN people + properties. Headers: Date, Tenant, Property+Unit, Amount, Method, Status, Notes.
Tenant history: payments WHERE lease_id = tenant's active lease. Receipts: /receipts/[payment_id] page.

## Pitfalls

- ACSS mandate required before first charge — SetupIntent first
- Stripe webhooks need raw body: use req.text() not req.json()
- Gmail tokens expire in 1 hour — always check/refresh before API calls
- Statement immutability: upsert:false throws if exists, handle gracefully
- management_fee_type nullable for existing properties — treat null as 0 fee
- Stripe webhook: check idempotency table FIRST before any DB writes
- Canadian holiday list needed for business day calculation

## Wave Structure

Wave 1: DB migrations + DB push (blocking checkpoint)
Wave 2a: Stripe webhook endpoint + payment recording UI
Wave 2b: Gmail OAuth setup in settings
Wave 3a: Manual payment + expense recording
Wave 3b: Disbursement calculation + statement generation
Wave 4: Tenant payment history + CSV export
Wave 5: Manager payment dashboard
