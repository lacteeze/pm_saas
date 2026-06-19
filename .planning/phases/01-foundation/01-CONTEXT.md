# Phase 1: Foundation - Context

**Gathered:** 2026-06-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver the multi-tenant security boundary: every user who signs in lands in exactly their org with exactly their role's permissions, and no data ever crosses org boundaries. This includes the full auth system (4 methods), 6-role RBAC enforced at the database layer, org/team management, and the onboarding flow that gets a new PM company from sign-up to first use.

This phase does NOT include: property/lease/payment data (Phase 2+), public listings (Phase 3), tenant portal features (Phase 6).

</domain>

<decisions>
## Implementation Decisions

### Onboarding Flow
- **D-01:** New org sign-up triggers a guided setup wizard: org name → logo → province/jurisdiction → invite first manager → dashboard. Org name and province are REQUIRED fields; all others skippable.
- **D-02:** Skipped fields show a persistent "Complete your setup" banner on the dashboard until dismissed or completed.
- **D-03:** Canary Property Management goes through the same onboarding flow as any SaaS customer (no hardcoded seed data bypass).

### Sign-in Experience
- **D-04:** Single sign-in page at `app.canarypm.ca/login` for all roles. After authentication, JWT `role` claim determines redirect: manager/employee → `/dashboard`, tenant → `/my-home`, owner → `/portfolio`, vendor → `/jobs`, admin → `/admin`.
- **D-05:** Domain structure: `canarypm.ca` (marketing + public listings), `app.canarypm.ca` (all authenticated portals). Public listings for SaaS customer orgs are scoped to Phase 3; only Canary's listings live at `canarypm.ca/listings` initially.
- **D-06:** No separate sign-in URLs per role — one URL, role-based redirect after auth.

### Invite & Join UX
- **D-07:** Tenant invite emails include: property address + unit, move-in date, and sign-up link. Context shown in email before clicking, so tenants aren't confused by a generic invite.
- **D-08:** First-time invited users (tenant, vendor, employee) land directly on their portal after completing sign-up — no intermediate welcome screen. Invite pre-configures role + org association.
- **D-09:** Manager sees pending/accepted invite status on each person record in the people list (`Invite sent` vs `Active` badge).

### Session & Device Policy
- **D-10:** Session duration: 7 days with activity extension. Session refreshes on each active visit; expires after 7 days of inactivity.
- **D-11:** When a manager removes a user from the org, their session is revoked immediately (server-side invalidation via Supabase Auth admin API). User's next API call returns 401.
- **D-12:** No device/tab restrictions — unlimited concurrent sessions. Standard SaaS behavior.

### Claude's Discretion
- Error messaging on auth failures (invalid credentials, expired magic link, revoked session) — use clear, non-technical copy; no raw error codes exposed to users.
- Loading states during OAuth redirect flows.
- Form validation approach on sign-up/invite forms.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Context
- `.planning/PROJECT.md` — Full project overview, roles/permissions table, domain structure, key decisions
- `.planning/REQUIREMENTS.md` §FOUNDATION — FOUND-01 through FOUND-14 (auth + RLS requirements)
- `.planning/REQUIREMENTS.md` §ORGS — ORGS-01 through ORGS-06 (org/team management requirements)

### Research Findings
- `.planning/research/STACK.md` — Finalized stack decisions; critical: use `@supabase/ssr` (not deprecated `@supabase/auth-helpers-nextjs`); no ORM
- `.planning/research/ARCHITECTURE.md` — Multi-tenancy pattern (org_id + RLS), JWT custom claims injection, Next.js App Router route groups for portal isolation, Supabase RLS performance patterns
- `.planning/research/PITFALLS.md` — Critical Phase 1 pitfalls: RLS omission on new tables, `auth.uid()` without `(select ...)` wrapper, service_role key exposure, Realtime public channels

### Architecture Decisions (from research)
- Use `@supabase/ssr` with `createServerClient` / `createBrowserClient` — NOT `@supabase/auth-helpers-nextjs`
- JWT custom claims (`role`, `org_id`, `person_id`) injected via Supabase Auth Hook at sign-in — NOT assembled client-side
- RLS uses `(select auth.jwt() -> 'app_metadata' ->> 'org_id')` pattern for org scoping — NOT `auth.uid()` alone
- `org_members` junction table + private schema with SECURITY DEFINER helper functions for role checks inside RLS policies
- Supabase Realtime: private channels only — configure in project settings before any Realtime feature ships
- CI linter asserting `row_security = on` for every `public` schema table — gates deployment
- Next.js App Router route groups: `(public)`, `(auth)`, `(manager)`, `(tenant)`, `(owner)`, `(vendor)`, `(admin)` — each with own `layout.tsx` and role-guard middleware
- Admin platform routes are SEPARATE from manager routes — additional server-side org verification required (cross-org access must not share middleware with single-org routes)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- None yet — greenfield project. This phase establishes all foundational patterns.

### Established Patterns
- None yet — this phase sets the patterns all subsequent phases follow.

### Integration Points
- Supabase Auth Hook: fires at every sign-in to inject JWT custom claims — must be configured before any other feature
- Middleware at `app/middleware.ts`: refreshes session on every request via `@supabase/ssr`; also enforces role-guard per route group
- `province` field must be on `organizations` table from this phase — all subsequent phases depend on it for Canadian compliance

</code_context>

<specifics>
## Specific Ideas

- Domain: `canarypm.ca` (owned); app at `app.canarypm.ca`
- Onboarding wizard collects: org name, logo (optional), province/jurisdiction (required), invite first user
- Invite email copy should feel warm and property-context-aware (not generic SaaS invite)
- Pending invite badge on people list for manager visibility

</specifics>

<deferred>
## Deferred Ideas

- SaaS customer public listings subdomains (e.g., `acmerealty.canarypm.ca`) — Phase 11 SaaS Billing
- Per-org custom domain support (e.g., `pm.acmerealty.com`) — post-v1
- SSO / SAML for enterprise PM companies — post-v1

</deferred>

---

*Phase: 1-Foundation*
*Context gathered: 2026-06-19*
