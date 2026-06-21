# Phase 4: Payments - Context

**Gathered:** 2026-06-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Rent collected online and reconciled accurately — ACH holds enforced, webhook idempotent, manual payments logged, Gmail e-transfer parsing with manager confirmation, expenses recorded with dual cost fields, owner disbursements calculated including management fee, monthly statements as immutable PDF snapshots.

**In scope:** Stripe rent collection (card + ACH/ACSS), manual payment recording, Interac e-transfer Gmail parsing with match suggestions, expense recording (vendor_cost + billed_amount), management fee configuration per property, owner disbursement calculation, monthly PDF statement generation (append-only), CSV export, tenant payment history, Stripe webhook idempotency, Gmail OAuth setup in org settings.

**Out of scope:** Full Gmail integration for outbound email (Phase 10), DocHub e-signature (Phase 10), owner portal payments view (Phase 7), SMS payment alerts (Phase 10).

</domain>

<decisions>
## Implementation Decisions

### Gmail e-Transfer Parsing (PAY-03)
- **D-01:** Gmail OAuth ships in Phase 4 — full gmail scope (read + write) to avoid re-implementing OAuth in Phase 10. Manager connects their org Gmail account from /settings (Integrations section).
- **D-02:** OAuth tokens stored encrypted per org in a `org_integrations` table (or `organizations.gmail_tokens` jsonb column). One Gmail account per org.
- **D-03:** E-transfer parsing: search Gmail for emails from `interac.ca` with subject matching Interac notification patterns. Parse sender name and amount. Present as suggested matches for manager to confirm — never auto-confirm (PAY-03 requirement).
- **D-04:** Gmail integration UI lives in Organization Settings page (`/settings`) — new "Integrations" section with Connect Gmail button + connected status.

### Management Fee Structure (PAY-06)
- **D-05:** Per-property management fee: configurable as either a percentage (%) OR flat monthly amount ($) — each property independently configured. Add `management_fee_type` ('percent'|'flat') and `management_fee_value` (numeric) columns to the `properties` table.
- **D-06:** Management fee IS shown as a line item on owner statements and visible to owners: Rent Collected → Expenses (billed amounts) → Management Fee → Net to Owner.
- **D-07:** Disbursement formula: `net_to_owner = rent_collected - sum(billed_amounts) - management_fee` where management_fee = (rent_collected × fee_pct/100) OR flat fee value.

### Stripe Account Model
- **D-08:** Claude's discretion — researcher should evaluate whether Stripe Connect is needed. Canary's model (150+ units, single PM company) likely uses direct Stripe (one Stripe account, Canary collects rent, disburses to owners manually or via ACH transfer). Stripe Connect adds complexity suited for multi-PM marketplaces. If researcher confirms direct Stripe is sufficient, use it. If PAY-06 disbursement requires automated payouts to owner bank accounts, Connect may be needed.

### Idempotency + ACH Holds
- **D-09:** Stripe webhook idempotency: `stripe_events` table with `stripe_event_id` unique constraint. Every webhook handler checks for existing event before processing (PAY-10).
- **D-10:** ACH/ACSS hold: 5 business days (not calendar). Payment status: `pending_clearance` → `cleared` → `disbursable`. Business day calculation excludes weekends and Canadian federal holidays.

### Expense Recording
- **D-11:** Expenses use dual cost fields per locked architecture: `vendor_cost` (actual paid to vendor) and `billed_amount` (charged to owner). Markup = billed_amount - vendor_cost, visible only to managers/employees, never to owners or tenants.

### Monthly Statements (PAY-07)
- **D-12:** PDF statement generated via `@react-pdf/renderer` on the server. Sections: property info header, rent collected summary, expense line items (billed_amount only — no vendor_cost), management fee line item, net to owner total. Stored in Supabase Storage as append-only snapshot at `org-assets/{org_id}/statements/{property_id}/{year}-{month}.pdf`. Once generated, the PDF is immutable — editing payment data after generation does not alter historical statements.
- **D-13:** Statement generation triggered by manager action (not automatic). Manager selects month + property → generates statement → PDF stored → owner can download from Phase 7 portal.

### Tenant Payment History (PAY-09)
- **D-14:** Tenant portal shows full payment history with downloadable receipts for each transaction. Receipts are server-rendered pages (no separate PDF needed for basic receipts in Phase 4 — a `/receipts/[payment_id]` page is sufficient). Full PDF receipts can be Phase 6 enhancement.

### Claude's Discretion
- Stripe Connect vs. direct Stripe (D-08 above — researcher decides)
- Payment status state machine details (researcher to document)
- Stripe webhook endpoint implementation details
- CSV export format for bookkeeper/QuickBooks import (PAY-08)
- Canadian federal holiday list for business day calculation
- Gmail OAuth redirect URI and token refresh handling

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` §PAYMENTS — PAY-01 through PAY-10

### Prior Phase Decisions
- `.planning/phases/02-core-data-model/02-CONTEXT.md` — dual cost fields, people/properties/leases schema
- `.planning/phases/02-core-data-model/02-01-SUMMARY.md` — actual schema built (properties, units, leases, people tables)
- `.planning/STATE.md` — locked architectural decisions (Stripe webhook idempotency, ACH 5-day hold, dual cost fields)

### Existing Code
- `canary-propos/src/app/(manager)/settings/page.tsx` — add Gmail integration section here (D-04)
- `canary-propos/src/app/(manager)/settings/actions.ts` — add Gmail OAuth actions here
- `canary-propos/src/types/supabase.ts` — current types (reference for new payment table types)
- `canary-propos/src/lib/supabase/server.ts` — server client pattern
- `canary-propos/src/lib/supabase/admin.ts` — admin client for webhook processing

### External Docs to Research
- Stripe Node SDK v17+ — subscriptions, ACH/ACSS, webhook signature verification
- Gmail API (googleapis Node SDK) — OAuth2 flow, token storage, message search
- `@react-pdf/renderer` — renderToBuffer() for server-side PDF generation (Context7: /diegomura/react-pdf)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `settings/page.tsx` + `settings/actions.ts` — extend with Gmail Integrations section (D-04)
- `org-assets` Supabase Storage bucket — already exists, add `statements/` path for PDF snapshots
- `react-hook-form` + `zod` — established form pattern for payment recording forms
- `Dialog` + `render={<span />}` pattern — for payment modals (NOT asChild)

### Established Patterns
- Server actions with `getCallerContext()` + `role.includes('manager')` checks
- Admin client (`createAdminClient()`) for Stripe webhook processing (no user session)
- `revalidatePath()` after mutations
- RSC + desktop table + mobile cards pattern for payment history list

### Integration Points
- `leases` table: `tenant_id` + `unit_id` + `monthly_rent` — payment recording links to a lease
- `properties` table: add `management_fee_type` + `management_fee_value` columns (migration)
- `organizations` table: add `gmail_access_token`, `gmail_refresh_token`, `gmail_token_expiry` columns (or separate `org_integrations` table)
- New tables needed: `payments`, `expenses`, `stripe_events` (idempotency), `owner_statements`

</code_context>

<specifics>
## Specific Ideas

- Gmail OAuth: full scope (gmail) — connect from /settings Integrations section
- Management fee: per-property, percent or flat, shown to owners on statements
- Statement PDF sections: Rent Collected / Expenses (billed) / Management Fee / Net to Owner
- Stripe webhook endpoint at `/api/stripe/webhook` — verify signature, check idempotency table, process
- ACH 5-business-day hold — track `cleared_at` date, Canadian holidays excluded
- Interac e-transfer parsing: search Gmail for `from:interac.ca` + parse amount and sender name

</specifics>

<deferred>
## Deferred Ideas

- Stripe Connect for automated owner payouts (evaluate in research — may not be needed for Phase 4)
- Full PDF receipts per payment (Phase 6 tenant portal enhancement)
- Automated monthly statement generation on a schedule (Phase 10 — Phase 4 is manager-triggered)
- SMS payment reminders via Pingram (Phase 10)
- QuickBooks direct integration (Phase 10 — CSV export is Phase 4)
- Outbound email from connected Gmail account (Phase 10)

</deferred>

---

*Phase: 4-Payments*
*Context gathered: 2026-06-21*
