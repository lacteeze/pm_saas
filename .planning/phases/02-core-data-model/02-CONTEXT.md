# Phase 2: Core Data Model - Context

**Gathered:** 2026-06-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Managers can create and manage the full property portfolio — people, properties, portfolios, and leases — through a functional manager portal CRUD interface.

**In scope:** People CRUD (all roles), Properties (building-level), Units (child records of buildings), Portfolio grouping, Lease creation and management, Property dashboard, Lease expiry alerts, Lease document upload, Tenant lease view.

**Out of scope:** Public listings (Phase 3), Rent collection/payments (Phase 4), Maintenance (Phase 5), Tenant portal beyond lease download (Phase 6), Owner portal (Phase 7), SMS/email notifications (Phase 10), Document generation from templates (Phase 10).

</domain>

<decisions>
## Implementation Decisions

### Unit Hierarchy (Data Model)
- **D-01:** Two-table hierarchy: `properties` (building-level: address, type, owner association, portfolio, photos) → `units` (child records: unit number, floor, bedrooms, bathrooms, sq footage, amenities, status, asking_rent). A building at "123 Main St" has Units 1A, 1B, 2A — not separate property records.
- **D-02:** Unit fields (Claude's choice for Phase 2 + forward compatibility): `unit_number` (text, e.g. "1A", "201"), `floor` (int, nullable), `bedrooms` (int), `bathrooms` (numeric — allows 1.5), `sq_footage` (int, nullable), `status` (enum: vacant/occupied/maintenance), `asking_rent` (numeric, nullable — used for Phase 3 public listings), `amenities` (text[], nullable). Bedrooms/baths only — no floor plan type names.
- **D-03:** Leases link to `units` (not `properties`). A tenant is associated with a specific unit, not just a building.

### People Taxonomy
- **D-04:** The existing `/people` page grows to have two tabs: **Team** (managers/employees — existing view with invite/remove) and **Contacts** (tenants, owners/clients, vendors). No new nav item; tabs are the entry point.
- **D-05:** Creating a contact record and inviting them to the portal are **separate actions**. A manager creates a person record first; sending a portal invite is an explicit follow-up action when ready.
- **D-06:** Person records for contacts carry the same `people` table — role field differentiates them. People can hold multiple roles (PEOPLE-03) via a `roles` array or junction. Claude to pick: use `role` text[] on the people table (simplest, fits Supabase PostgREST, avoids extra junction table in Phase 2).

### Properties & Portfolios
- **D-07:** A portfolio is a named grouping of properties under one owner. `portfolios` table: `id`, `org_id`, `owner_id` (FK → people), `name`. Properties have a nullable `portfolio_id` FK. A property without a portfolio is still valid (owner managed directly).
- **D-08:** Property-level owner association: `properties.owner_id` FK → `people` (role = client/owner). One property, one owner; a portfolio groups multiple properties under one owner.

### Manager Dashboard
- **D-09:** Dashboard scope deferred to Claude's discretion — build a functional Phase 2 dashboard with the data available: summary cards (total units, occupied units, vacant units, active leases), lease expiry alerts (90/60/30 days), and a recent activity list. No payments or maintenance data yet.

### Lease Renewal Scope (Phase 2)
- **D-10:** Lease renewal in Phase 2 = **simple status flag only**. LEASE-04 `renewal_status` field on the lease record: `pending | sent | accepted | declined`. A manager can mark a lease as renewal pending and note a proposed rent. No document generation (Phase 10), no email sending (Phase 10).

### Claude's Discretion
- Unit fields selection (D-02 above)
- People roles: use `role text[]` column on `people` table (not a separate roles junction table for Phase 2)
- Dashboard card layout and metric selection (D-09)
- Property photo storage path pattern in `org-assets` bucket
- RLS policies for new tables — follow same patterns from Phase 1 (`(SELECT public.org_id())` wrapper, not bare call)
- Form UX details (drawer vs. modal vs. inline for property/unit creation)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Context
- `.planning/REQUIREMENTS.md` §PEOPLE — PEOPLE-01 through PEOPLE-04
- `.planning/REQUIREMENTS.md` §PROPERTIES — PROP-01 through PROP-06
- `.planning/REQUIREMENTS.md` §LEASES — LEASE-01 through LEASE-06

### Phase 1 Decisions (locked patterns to follow)
- `.planning/phases/01-foundation/01-CONTEXT.md` — All Phase 1 decisions; RLS patterns, JWT helpers, admin client usage
- `.planning/research/ARCHITECTURE.md` — Multi-tenancy pattern, RLS helper function pattern with `(SELECT ...)` wrapper
- `.planning/research/PITFALLS.md` — Critical pitfalls: RLS omission, bare `auth.uid()`, service_role exposure

### Existing Code (read before implementing)
- `canary-propos/src/app/(manager)/people/page.tsx` — Existing people list pattern: RSC + desktop table + mobile cards
- `canary-propos/src/app/(manager)/dashboard/page.tsx` — Dashboard placeholder to replace with real content
- `canary-propos/src/components/layout/ManagerShell.tsx` — Nav items to extend with Properties/Portfolio links
- `canary-propos/src/lib/supabase/server.ts` — Server client pattern
- `canary-propos/src/components/ui/` — Available: card, badge, dialog, select, form, button, input, label, separator, avatar, alert, progress, dropdown-menu, sonner

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `Card` component — use for property cards, unit cards, dashboard summary cards
- `Badge` component — unit status (vacant/occupied/maintenance), lease status, invite status
- `Dialog` component — create/edit forms (modal pattern used in InviteUserForm)
- Desktop table + mobile cards pattern (people/page.tsx) — reuse exactly for properties list, units list, leases list
- `InviteStatusBadge` — model for unit status badges and lease expiry alert badges
- `SetupBanner` — model for lease expiry alert banners on dashboard
- `form` + `react-hook-form` + `zod` — established form validation pattern; use for all Phase 2 forms

### Established Patterns
- **RSC + admin data fetch**: Server Component fetches data, passes to client components for interaction (no client-side fetch waterfalls)
- **RLS wrapper**: Always `(SELECT public.org_id())` not bare `public.org_id()` in RLS policies
- **Admin client**: Use `createAdminClient()` only for server actions that insert on behalf of users with no JWT claims. For Phase 2, regular `createServerClient` is fine (managers are authenticated)
- **Route structure**: `src/app/(manager)/[section]/page.tsx` — add `properties/`, `units/`, `leases/` following this pattern
- **Hard redirect after JWT-affecting actions**: `window.location.href` not `router.push` — only needed if JWT claims change (not typical for Phase 2 CRUD)

### Integration Points
- `people` table — extend with `role text[]` to support multiple roles per person (PEOPLE-03)
- `organizations` table — already has `province` field (shipped in Phase 1 onboarding)
- `units` table — already exists from Phase 1 plan-limit trigger; extend it with all Phase 2 fields
- `org-assets` storage bucket — already exists with RLS; use for property photos, lease document PDFs
- ManagerShell nav — add Properties and Leases nav items

</code_context>

<specifics>
## Specific Ideas

- Two-tab People page: "Team" (existing) + "Contacts" (new) — no new nav item
- Properties/units hierarchy: building → units, leases link to units not buildings
- Lease expiry: 90/60/30 day alerts visible on manager dashboard and property dashboard
- Tenant can view/download their lease PDF (LEASE-06) — handled by a signed URL from Supabase Storage

</specifics>

<deferred>
## Deferred Ideas

- Public listings page for available units (Phase 3)
- Lease document generation from templates (Phase 10)
- Lease renewal document send + e-signature (Phase 10)
- SMS/email notifications for lease expiry (Phase 10)
- Maintenance open count on property dashboard (Phase 5 — no maintenance table yet)
- Rent status on property dashboard (Phase 4 — no payments table yet)

</deferred>

---

*Phase: 2-Core Data Model*
*Context gathered: 2026-06-21*
