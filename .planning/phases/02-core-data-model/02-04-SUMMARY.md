---
plan: 02-04
phase: 02
status: complete
completed: 2026-06-21
---

# Plan 02-04: Leases Pages

## What Was Built

Full lease management UI — list page with expiry alerts, detail page with PDF upload/download and renewal status, and cascade form (property → unit → tenant) for creating leases.

## Key Files

- canary-propos/src/app/actions/leases.ts — createLease, updateRenewalStatus, uploadLeaseDoc, generateLeaseDownloadUrl (60s signed URL)
- canary-propos/src/components/leases/AddLeaseForm.tsx — cascade select: property → available units → tenant contact
- canary-propos/src/components/leases/LeaseDocUpload.tsx — PDF upload to org-assets/{org_id}/leases/{lease_id}/document.pdf
- canary-propos/src/components/leases/LeaseDownloadButton.tsx — client component, calls generateLeaseDownloadUrl server action
- canary-propos/src/components/leases/LeaseRenewalCard.tsx — renewal status dropdown (pending/sent/accepted/declined, D-10)
- canary-propos/src/components/leases/ExpiryAlertCallout.tsx — 3-bucket urgency grouping (≤30d red, 31-60d amber, 61-90d stone)
- canary-propos/src/app/(manager)/leases/page.tsx — RSC list: tenant + property+unit + dates + rent + status + expiry alerts
- canary-propos/src/app/(manager)/leases/[id]/page.tsx — RSC detail: lease info + LeaseDocUpload + LeaseRenewalCard + LeaseDownloadButton

## Security

- generateLeaseDownloadUrl: server-side only, verifies lease.org_id matches caller's org_id before signing URL (60s expiry)
- All actions use role.includes() not === (people.role is text[])
- org_id always derived from JWT, never from request body

## Self-Check: PASSED

Agent hit session limit before committing — files rescued and committed by orchestrator. All logic verified correct.
