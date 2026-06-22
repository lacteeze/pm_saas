---
plan: 04-05
phase: 04
status: complete
completed: 2026-06-22
---

# Plan 04-05: Disbursement + Owner Statement PDF

## What Was Built

- calculateDisbursement server action (rent collected - billed expenses - management fee)
- StatementPDF component using @react-pdf/renderer (billed_amount only — vendor_cost never exposed)
- POST /api/statements/generate — renderToBuffer + Supabase Storage upsert:false (immutable)
- Manager disbursement page at /payments/disbursement/[propertyId]

## Key Files

- canary-propos/src/app/(manager)/payments/disbursement/actions.ts — calculateDisbursement
- canary-propos/src/components/payments/StatementPDF.tsx — PDF layout (no vendor_cost)
- canary-propos/src/app/api/statements/generate/route.ts — renderToBuffer + upsert:false
- canary-propos/src/app/(manager)/payments/disbursement/[propertyId]/page.tsx
- canary-propos/src/components/payments/DisbursementActions.tsx

## Note

@react-pdf/renderer installed via npm install.

## Self-Check: PASSED
