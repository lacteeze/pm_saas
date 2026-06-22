---
plan: 04-01
phase: 04
status: complete
completed: 2026-06-22
---

# Plan 04-01: Payment Schema Migrations

## What Was Built

Six migrations creating the full Phase 4 data model, pushed and verified.

| Migration | What It Creates |
|-----------|----------------|
| 0016_create_payments.sql | payments table (lease_id FK, method/status enums, stripe_payment_intent_id, cleared_at, disbursable_after, RLS) |
| 0017_create_expenses.sql | expenses table (vendor_cost + billed_amount dual fields, property_id FK, manager-only RLS) |
| 0018_create_stripe_events.sql | stripe_events table (stripe_event_id UNIQUE for idempotency, service_role-only RLS) |
| 0019_create_owner_statements.sql | owner_statements table (UNIQUE period per property, manager+owner RLS) |
| 0020_alter_properties_fees.sql | Adds management_fee_type ('percent'|'flat') and management_fee_value to properties |
| 0021_alter_organizations_gmail.sql | Adds gmail_access_token, gmail_refresh_token, gmail_token_expiry, gmail_connected_at to organizations |

## Verification

- supabase db push: all 6 migrations applied
- Types regenerated: payments, expenses, stripe_events, owner_statements in supabase.ts
- check-rls.ts: PASS

## Self-Check: PASSED
