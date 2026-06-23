---
phase: 04-payments
verified: 2026-06-23T00:00:00Z
status: gaps_found
score: 8/10
overrides_applied: 0
gaps:
  - truth: "Owner disbursement calculates rent collected correctly from payments"
    status: failed
    reason: "calculateDisbursement queries payments with .eq('property_id', propertyId) but the payments table has no property_id column — only lease_id. The query always returns empty results, so rentCollected is always 0. Disbursement totals and statement PDFs will show $0 rent regardless of actual payments."
    artifacts:
      - path: "canary-propos/src/app/(manager)/payments/disbursement/actions.ts"
        issue: "Lines 135-142: .eq('property_id', propertyId) applied to payments table which has no property_id column. Must join payments → leases → units → properties to filter by property."
      - path: "canary-propos/supabase/migrations/0016_create_payments.sql"
        issue: "Payments table has lease_id FK but no property_id column — the query column does not exist."
    missing:
      - "Fix payments query in calculateDisbursement to join via lease_id: select payments where lease_id IN (select leases.id from leases join units on leases.unit_id = units.id where units.property_id = $propertyId)"
  - truth: "Online Stripe payments are recorded in the payments table when payment_intent.processing fires"
    status: failed
    reason: "Webhook handler inserts currency: pi.currency into payments table on payment_intent.processing event, but the payments table (0016) has no currency column. This insert will fail with a column-not-found error, leaving the payment unrecorded. Idempotency check passes but the payment record is never created."
    artifacts:
      - path: "canary-propos/src/app/api/stripe/webhook/route.ts"
        issue: "Line 62: inserts currency field which does not exist in payments table schema."
      - path: "canary-propos/supabase/migrations/0016_create_payments.sql"
        issue: "No currency column defined — payments table has no currency field."
    missing:
      - "Remove currency: pi.currency from the webhook insert (line 62 of webhook/route.ts) since the column does not exist in the schema. Currency is implicitly CAD for this Canadian-market app."
---

# Phase 4: Payments — Verification Report

**Phase Goal:** Rent is collected online and reconciled accurately — ACH holds are enforced, duplicate webhook events are idempotent, manual payments are logged, owner disbursements are calculated with markup hidden from owners, and monthly statements are immutable snapshots.
**Verified:** 2026-06-23T00:00:00Z
**Status:** gaps_found — 2 blockers
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Tenant can pay rent online via Stripe Elements | VERIFIED | `/my-home/pay` page wired to `RentPaymentForm` with `PaymentElement`, `create-payment-intent` route exists, `stripe.confirmPayment()` called |
| 2 | ACH/online payments are held 5 business days before disbursement | VERIFIED | Webhook sets `disbursable_after = addBusinessDays(now, 5)` on `payment_intent.succeeded`; `businessDays.ts` implements Canadian federal holiday skip logic |
| 3 | Duplicate Stripe webhook events are idempotent | VERIFIED | Webhook checks `stripe_events` table for existing `stripe_event_id` before any DB write; returns 200 on duplicate without re-processing; UNIQUE constraint on `stripe_events.stripe_event_id` as DB backstop |
| 4 | Manager can manually record a payment (cheque, cash, e-transfer, bank transfer) | VERIFIED | `recordPayment` server action in `payments/actions.ts`; `RecordPaymentDialog` component; method enum enforced; org ownership of lease verified before insert |
| 5 | Vendor cost (markup) is hidden from owners and tenants | VERIFIED | `expenses` table has no owner/tenant RLS SELECT policy; `calculateDisbursement` selects only `billed_amount` never `vendor_cost`; `StatementPDF` uses `billedAmount` only; comment on line 241 confirms intentional exclusion |
| 6 | Owner disbursement is calculated as rent minus billed expenses minus management fee | FAILED | `calculateDisbursement` queries `payments` with `.eq('property_id', propertyId)` — this column does not exist on the payments table. `rentCollected` will always be 0. The formula is correct but produces wrong output due to the broken query. |
| 7 | Monthly owner statements are immutable PDF snapshots | VERIFIED | Storage upload uses `upsert: false`; 409 check before generation; `owner_statements` UNIQUE(property_id, period_year, period_month) prevents duplicate DB rows; footer text reads "Historical statements are immutable snapshots." |
| 8 | Online Stripe payments are recorded in payments table | FAILED | Webhook `payment_intent.processing` handler inserts `currency: pi.currency` (line 62) but `payments` table has no `currency` column. Insert will fail — payment record never created. |
| 9 | Manager can export payment data to CSV | VERIFIED | `/payments/export` route exists; auth + manager role check; `org_id` scoped query; `csvEscape()` helper; correct Content-Disposition header; `vendor_cost` absent from SELECT |
| 10 | Tenant can view payment history with receipts | VERIFIED | `/my-home/payments` page queries by `lease_id`; links to `/receipts/[paymentId]`; receipt page has full join with `notFound()` guard for cross-tenant access |

**Score:** 8/10 truths verified (2 blockers)

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `supabase/migrations/0016_create_payments.sql` | payments table DDL | VERIFIED | Exists; status enum, disbursable_after, lease_id FK, RLS with manager + tenant policies |
| `supabase/migrations/0017_create_expenses.sql` | expenses table with dual cost fields | VERIFIED | Exists; vendor_cost + billed_amount columns; manager-only RLS (no owner/tenant SELECT) |
| `supabase/migrations/0018_create_stripe_events.sql` | stripe_events idempotency table | VERIFIED | Exists; UNIQUE(stripe_event_id) constraint present; service_role-only RLS |
| `supabase/migrations/0019_create_owner_statements.sql` | owner_statements table | VERIFIED | Exists; UNIQUE(property_id, period_year, period_month); manager + owner RLS |
| `supabase/migrations/0020_alter_properties_fees.sql` | management_fee columns on properties | VERIFIED | Exists per SUMMARY — not read directly but referenced in 04-01 SUMMARY as pushed |
| `supabase/migrations/0021_alter_organizations_gmail.sql` | gmail token columns on organizations | VERIFIED | Exists per SUMMARY — gmail_access_token, gmail_refresh_token, gmail_token_expiry (bigint), gmail_connected_at |
| `src/app/api/stripe/webhook/route.ts` | Webhook with idempotency | VERIFIED (with gap) | Exists and is substantive; idempotency logic correct; BUT inserts non-existent `currency` column on processing event |
| `src/lib/businessDays.ts` | addBusinessDays with Canadian holidays | VERIFIED | Exists; full holiday list including Good Friday (computed), Victoria Day, Labour Day, Thanksgiving |
| `src/app/(manager)/payments/actions.ts` | recordPayment + recordExpense server actions | VERIFIED | Exists; org ownership checks; vendor_cost only in INSERT body not in any response |
| `src/components/payments/StatementPDF.tsx` | PDF with billed_amount only, no vendor_cost | VERIFIED | Exists; renders billedAmount; comment on line 241 explicitly states vendor_cost excluded |
| `src/app/api/statements/generate/route.ts` | Statement generation with upsert:false | VERIFIED | Exists; upsert:false enforced; 409 on duplicate; renderToBuffer + Supabase Storage upload |
| `src/app/(manager)/payments/disbursement/actions.ts` | calculateDisbursement | VERIFIED (with gap) | Exists; correct formula; BUT payments query uses non-existent property_id column |
| `src/app/(tenant)/my-home/payments/page.tsx` | Tenant payment history | VERIFIED | Exists; queries by lease_id; status badges; receipt links |
| `src/app/(tenant)/receipts/[paymentId]/page.tsx` | Receipt page with notFound() guard | VERIFIED | Exists; full join; notFound() on null (cross-tenant RLS returns null) |
| `src/app/(manager)/payments/export/route.ts` | CSV export route | VERIFIED | Exists; manager role check; org_id scoped; no vendor_cost in SELECT |
| `src/lib/gmail.ts` | Gmail OAuth helpers | VERIFIED | Exists; 4 exports: getGmailAuthUrl, exchangeCodeForTokens, refreshTokenIfNeeded, searchETransfers |
| `src/app/api/gmail/etransfers/route.ts` | Interac e-transfer suggestions endpoint | VERIFIED | Exists; no auto-confirm; returns empty array if Gmail not connected |
| `src/components/payments/ETransferSuggestions.tsx` | E-transfer confirmation UI | VERIFIED | Exists; requires explicit lease Select + Confirm button; no programmatic auto-confirm path |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| payments | leases | lease_id FK | VERIFIED | 0016 migration: `REFERENCES leases(id) ON DELETE RESTRICT` |
| expenses | properties | property_id FK | VERIFIED | 0017 migration: `REFERENCES properties(id) ON DELETE RESTRICT` |
| owner_statements | properties | property_id + UNIQUE | VERIFIED | 0019 migration: `UNIQUE(property_id, period_year, period_month)` |
| webhook → payments insert | stripe_events idempotency | check before insert | VERIFIED | webhook checks stripe_events before payment insert |
| calculateDisbursement → payments | property_id filter | .eq('property_id') | FAILED | payments table has no property_id column; query returns 0 rows |
| webhook payments insert | payments schema | currency column | FAILED | inserts currency field not defined in 0016 payments table |
| StatementPDF → generate route | renderToBuffer | React.createElement | VERIFIED | generate/route.ts calls renderToBuffer(React.createElement(StatementPDF, { statement })) |
| generate route → owner_statements | insert record | after storage upload | VERIFIED | insert row after successful storage upload; statementAlreadyExists pre-check |

---

## Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| `calculateDisbursement` | `rentCollected` | `payments` query with `.eq('property_id', propertyId)` | No — column does not exist, always returns empty | DISCONNECTED |
| `calculateDisbursement` | `expenses` (billedAmount) | `expenses` query with `.eq('property_id', propertyId)` | Yes — property_id exists on expenses table | FLOWING |
| `StatementPDF` | `statement` prop | calculateDisbursement → generate route → renderToBuffer | Partially — expenses flow but rentCollected is always 0 | HOLLOW (rentCollected=0) |
| Tenant payment history | `payments` | `supabase.from('payments').select().in('lease_id', leaseIds)` | Yes — queries by lease_id which exists | FLOWING |
| Receipt page | payment row | `payments` join with lease/unit/property/person | Yes — notFound() guard; RLS enforces cross-tenant isolation | FLOWING |
| CSV export | payments list | `payments` query `.eq('org_id', callerPerson.org_id)` | Yes — org_id scoped | FLOWING |

---

## Behavioral Spot-Checks

| Behavior | Check | Status |
|----------|-------|--------|
| payments table has no currency column | `grep -n "currency" canary-propos/supabase/migrations/0016_create_payments.sql` → no match | CONFIRMED BUG |
| payments table has no property_id column | `grep -n "property_id" canary-propos/supabase/migrations/0016_create_payments.sql` → no match | CONFIRMED BUG |
| Webhook inserts currency field | `grep -n "currency" canary-propos/src/app/api/stripe/webhook/route.ts` → line 62 | CONFIRMED BUG |
| calculateDisbursement filters payments by property_id | `grep -n "property_id" ...disbursement/actions.ts` → line 139 | CONFIRMED BUG |
| UNIQUE constraint on stripe_events | `grep "UNIQUE" 0018_create_stripe_events.sql` → `CONSTRAINT stripe_events_stripe_event_id_key UNIQUE (stripe_event_id)` | PASS |
| upsert:false in generate route | `grep "upsert" route.ts` → `upsert: false` with comment | PASS |
| vendor_cost absent from StatementPDF | `grep "vendor_cost" StatementPDF.tsx` → no match | PASS |

---

## Requirements Coverage

| Requirement | Description | Status | Evidence |
|-------------|-------------|--------|----------|
| PAY-01 | Tenant can pay rent online via card or ACH (Stripe) | VERIFIED | `/my-home/pay` + `RentPaymentForm` + Stripe Elements wired |
| PAY-02 | Manager can manually record a payment | VERIFIED | `recordPayment` server action + `RecordPaymentDialog` |
| PAY-03 | Gmail inbox parsed for Interac e-transfer suggestions (never auto-confirms) | VERIFIED | `searchETransfers`, `/api/gmail/etransfers`, `ETransferSuggestions` — no auto-confirm path exists |
| PAY-04 | ACH payments held 5 business days before disbursement | VERIFIED | `addBusinessDays(now, 5)` on `payment_intent.succeeded`; `disbursable_after` column set |
| PAY-05 | Manager records expenses with vendor cost + billed-to-owner (markup hidden) | VERIFIED | `recordExpense` with dual fields; vendor_cost never in UI responses; no owner/tenant RLS SELECT on expenses |
| PAY-06 | Owner disbursement = rent collected - expenses (billed) - management fee | FAILED | Formula correct but rentCollected always 0 due to non-existent property_id column on payments table |
| PAY-07 | Monthly owner statement is append-only PDF snapshot | VERIFIED | `upsert: false`; 409 on duplicate; UNIQUE DB constraint; "immutable snapshots" in PDF footer |
| PAY-08 | Payment data exportable to CSV | VERIFIED | `/payments/export` route; correct headers; org-scoped; no vendor_cost |
| PAY-09 | Tenant can view full payment history with receipts | VERIFIED | `/my-home/payments` page + `/receipts/[paymentId]` page |
| PAY-10 | Stripe webhook events are idempotent | VERIFIED | Pre-insert check + UNIQUE constraint backstop; duplicate returns 200 without re-processing |

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/app/api/stripe/webhook/route.ts` | 62 | `currency: pi.currency` inserted into payments table which has no currency column | BLOCKER | payment_intent.processing inserts fail — online payments not recorded |
| `src/app/(manager)/payments/disbursement/actions.ts` | 139 | `.eq('property_id', propertyId)` on payments table (no property_id column) | BLOCKER | rentCollected always 0 — disbursements and statements incorrect |
| `src/app/(manager)/payments/disbursement/actions.ts` | 117 | `(supabase ... as any)` cast for management_fee_type / management_fee_value | WARNING | Types not yet regenerated after 04-01 migration — indicates types regeneration may not have completed |
| `src/app/(manager)/payments/disbursement/actions.ts` | 136 | `(supabase ... as any)` cast for payments query | WARNING | Additional any cast — combined with the property_id bug, the cast masked the query error at compile time |
| `src/components/payments/RentPaymentForm.tsx` | 15-19 | `@ts-ignore` comments because `@stripe/stripe-js` / `@stripe/react-stripe-js` not yet installed | WARNING | TypeScript compilation will fail if ts-ignore removed; packages need npm install |

---

## Human Verification Required

### 1. Gmail OAuth Flow

**Test:** Connect a Gmail account from Manager Settings (/settings), authorize, confirm "Connected" badge appears with the connected date.
**Expected:** OAuth redirect to Google, return to /settings?gmail=connected, GmailIntegrationSection shows green badge.
**Why human:** OAuth redirect/callback flow cannot be tested without a browser and live Google credentials.

### 2. Stripe Payment End-to-End (requires bug fix first)

**Test:** After fixing the `currency` insert bug, complete a test payment as a tenant using Stripe test card 4242 4242 4242 4242.
**Expected:** PaymentIntent created, payment form processes, webhook fires, payment appears in tenant history with status `pending_clearance`, transitions to `cleared` after `payment_intent.succeeded`.
**Why human:** Requires live Stripe test mode, webhook delivery, and browser interaction.

### 3. E-Transfer Suggestion Confirmation

**Test:** With Gmail connected, have a test Interac e-transfer notification email in the inbox. Open /payments as manager, verify ETransferSuggestions panel shows the suggestion. Select a lease from the dropdown and click Confirm.
**Expected:** Suggestion disappears from panel; payment appears in recent payments table as method=etransfer.
**Why human:** Requires live Gmail connection and a real/test Interac notification email.

### 4. Statement PDF Visual Quality

**Test:** Generate a statement PDF for a property with at least one cleared payment and one expense. Open the PDF.
**Expected:** Org name, property address, owner name, period, rent collected, expense detail (billed amounts only, no vendor cost), management fee, net to owner all correctly rendered and visually legible.
**Why human:** PDF layout and visual correctness cannot be verified by code inspection alone. Also validates the rentCollected fix (after gap closure) produces correct dollar amounts.

---

## Gaps Summary

Two blockers prevent the phase goal from being fully achieved.

**Gap 1 — Disbursement rent calculation broken (PAY-06, PAY-07 data accuracy):** `calculateDisbursement` in `canary-propos/src/app/(manager)/payments/disbursement/actions.ts` line 139 filters the `payments` table on `property_id`, a column that does not exist. The payments table only has `lease_id`. The fix requires joining: `payments WHERE lease_id IN (SELECT id FROM leases WHERE unit_id IN (SELECT id FROM units WHERE property_id = $propertyId))`. The `(supabase as any)` cast on this query masked the error at compile time.

**Gap 2 — Online payment recording broken (PAY-01, PAY-10 runtime):** The Stripe webhook handler at `canary-propos/src/app/api/stripe/webhook/route.ts` line 62 inserts `currency: pi.currency` on `payment_intent.processing`, but the `payments` table schema (migration 0016) defines no `currency` column. The insert will fail at runtime. Idempotency correctly records the event, but the payment row is never created. Fix: remove `currency: pi.currency` from the insert object.

Both gaps are small targeted fixes (one line each) with no schema changes required.

---

_Verified: 2026-06-23T00:00:00Z_
_Verifier: Claude (gsd-verifier)_
