---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: in_progress
last_updated: "2026-06-21T16:17:31.057Z"
progress:
  total_phases: 11
  completed_phases: 0
  total_plans: 12
  completed_plans: 6
  percent: 0
---

# Canary PropOS — Project State

**Last updated:** 2026-06-21
**Session:** Plan 01-06 complete — team management (invite flow, people list, session revocation, org settings, setup banner). Post-verification fixes: root redirect /login; admin client for org bootstrap; hard redirect post-org-creation to refresh JWT claims. Phase 01 Foundation verified end-to-end by user. Next: Phase 02 — Core Data Model.

---

## Project Reference

**Core value:** A unified hub where any authorized party — manager, owner, tenant, or vendor — can see exactly what they need and take exactly the actions they're allowed to, without phone calls, emails, or spreadsheets filling the gap.

**Current focus:** Phase 01 — Foundation

---

## Current Position

Phase: 01 (Foundation) — EXECUTING
Plan: 6 of 6
| Field | Value |
|-------|-------|
| Phase | 1 — Foundation |
| Plan | 06 — SetupBanner + People List |
| Status | Ready to execute |
| Phase progress | Plans 01-05 complete; 01-02 Tasks 4+5 still pending DB push credentials |

```
Overall: [▓░░░░░░░░░░░░░░░░░░░] 3% (2/71 requirements)
Phase 1: [▓▓░░░░░░░░░░░░░░░░░░] 10% (2/20 requirements)
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
| Phase 01-foundation P02 | 90 | 5 tasks | 9 files |
| Phase 01-foundation P04 | 15m | 2 tasks | 17 files |

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
- **Org bootstrap inserts:** Must use `createAdminClient()` — new users have no JWT claims yet, so user-client inserts are rejected by RLS
- **Post-org-creation redirect:** Use `window.location.href` (hard redirect), not `router.push` — forces full session reload so refreshed JWT claims (with org_id/role) are available before dashboard auth guards fire
- **Session revocation:** `createAdminClient().auth.admin.signOut(userId, 'global')` on user removal — immediately invalidates all sessions (D-11)

### Open Decisions

- Granularity for Phase 1 plans: TBD at plan-phase time
- DocHub API access confirmation: if API gating blocks, fallback is OCR-only per v2 requirements

### Blockers

- **Plan 01-02 Tasks 4+5:** SUPABASE_ACCESS_TOKEN and SUPABASE_DB_PASSWORD needed in canary-propos/.env.local for `supabase db push`. After push, Auth Hook must be registered in Supabase Dashboard → Authentication → Hooks → Custom Access Token → select `public.custom_access_token_hook`.

### Todos (cross-phase)

- Confirm Pingram API credentials and SMS template format before Phase 5
- Confirm DocHub API access tier before Phase 10
- Province/jurisdiction field ships Phase 2 — compliance enforcement rules deferred to v2

---

## Session Continuity

**To resume Tasks 4+5 of 01-02:**

1. Get SUPABASE_ACCESS_TOKEN from Supabase Dashboard → Account → Access Tokens
2. Get SUPABASE_DB_PASSWORD from Supabase Dashboard → Project Settings → Database → Database password
3. Update canary-propos/.env.local with real values for both
4. Run: `cd canary-propos && npx supabase link --project-ref mdzegkaymdsmgspdgkko`
5. Run: `SUPABASE_ACCESS_TOKEN=<token> npx supabase db push`
6. Run: `npx supabase gen types typescript --linked > src/types/supabase.ts`
7. Verify: `npx tsx scripts/check-rls.ts` passes
8. Register Auth Hook: Supabase Dashboard → Authentication → Hooks → Custom Access Token → select `public.custom_access_token_hook`
9. Commit: src/types/supabase.ts

**Context for next session:**

- Plans 01-01 and 01-02 (Tasks 1-3) are complete
- 7 migrations authored: organizations, people, RLS helpers+hook, org RLS, people RLS, storage bucket, units+trigger
- Schema push pending credentials (see blockers)
- Next plan after Tasks 4-5 complete: 01-03 (middleware, portal route groups, auth UI)
