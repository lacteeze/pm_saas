---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: unknown
last_updated: "2026-06-19T17:46:34.054Z"
progress:
  total_phases: 11
  completed_phases: 0
  total_plans: 6
  completed_plans: 0
  percent: 0
---

# Canary PropOS — Project State

**Last updated:** 2026-06-19
**Session:** Roadmap initialized

---

## Project Reference

**Core value:** A unified hub where any authorized party — manager, owner, tenant, or vendor — can see exactly what they need and take exactly the actions they're allowed to, without phone calls, emails, or spreadsheets filling the gap.

**Current focus:** Phase 1 — Foundation (auth, multi-tenancy, RLS, JWT custom claims, org & team management)

---

## Current Position

| Field | Value |
|-------|-------|
| Phase | 1 — Foundation |
| Plan | None started |
| Status | Not started |
| Phase progress | 0 / 20 requirements complete |

```
Overall: [░░░░░░░░░░░░░░░░░░░░] 0% (0/71 requirements)
Phase 1: [░░░░░░░░░░░░░░░░░░░░] 0% (0/20 requirements)
```

---

## Phase Summary

| # | Phase | Requirements | Status |
|---|-------|-------------|--------|
| 1 | Foundation | 20 (FOUND-01–14, ORGS-01–06) | Not started |
| 2 | Core Data Model | 16 (PEOPLE-01–04, PROP-01–06, LEASE-01–06) | Not started |
| 3 | Public Listings | 7 (LIST-01–07) | Not started |
| 4 | Payments | 10 (PAY-01–10) | Not started |
| 5 | Maintenance | 9 (MAINT-01–09) | Not started |
| 6 | Tenant Portal | 6 (TENANT-01–06) | Not started |
| 7 | Owner Portal | 7 (OWNER-01–07) | Not started |
| 8 | Vendor Portal | 5 (VENDOR-01–05) | Not started |
| 9 | Inspections | 5 (INSP-01–05) | Not started |
| 10 | Documents & Integrations | 13 (DOC-01–05, INT-01–04, NOTIF-01–04) | Not started |
| 11 | SaaS Billing & Admin | 5 (BILLING-01–05) | Not started |

**Total:** 103 requirement slots, 71 unique requirements

---

## Performance Metrics

| Metric | Value |
|--------|-------|
| Phases complete | 0 / 11 |
| Requirements complete | 0 / 71 |
| Plans written | 0 |
| Plans complete | 0 |

---

## Accumulated Context

### Key Architectural Decisions Locked In

- **Auth client:** Use `@supabase/ssr` (not legacy `@supabase/auth-helpers`) — wrong choice is a rewrite trigger
- **RLS:** `org_members` table + private schema; RLS CI linter must fail build on any unprotected table
- **JWT claims:** Auth Hook injects `role`, `org_id`, `person_id` at sign-in
- **Realtime:** Private channels only — no public subscriptions
- **PDF generation:** `@react-pdf/renderer` — not Puppeteer or pdf-lib
- **OCR:** OpenAI GPT-4o Vision for lease import
- **SMS:** Pingram — not Twilio (PROJECT.md reference to Twilio is superseded)
- **Gmail:** Per-org OAuth pattern — each org connects their own Gmail account
- **Stripe:** Webhook idempotency table required; ACH hold is 5 business days (not calendar)
- **Payments:** Dual cost fields — `vendor_cost` (to vendor) + `billed_amount` (to owner); markup invisible to owners/tenants
- **Statements:** Append-only PDF snapshots stored in Supabase Storage; immutable after generation
- **Maintenance state machine:** `draft → submitted → assigned → in_progress → pending_approval → approved → completed → closed` — enforced server-side, no state skipping

### Open Decisions

- Granularity for Phase 1 plans: TBD at plan-phase time
- DocHub API access confirmation: if API gating blocks, fallback is OCR-only per v2 requirements

### Blockers

None currently.

### Todos (cross-phase)

- Confirm Pingram API credentials and SMS template format before Phase 5
- Confirm DocHub API access tier before Phase 10
- Province/jurisdiction field ships Phase 2 — compliance enforcement rules deferred to v2

---

## Session Continuity

**To resume:** Run `/gsd:plan-phase 1` to generate the execution plan for Phase 1: Foundation.

**Context for next session:**

- Roadmap is complete, 71/71 requirements mapped across 11 phases
- Phase 1 is first — establishes `@supabase/ssr`, org RLS, Auth Hook JWT claims, private Realtime channels, team management
- Getting Phase 1 wrong (wrong Supabase client, public Realtime channels, no RLS linter) triggers a full rewrite
- No plans exist yet; all phases are at "Not started"
