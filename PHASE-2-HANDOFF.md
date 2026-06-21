# Phase 2 Handoff — Canary PropOS

## Status
Phase 1 (Foundation) is **complete and committed**. Phase 2 (Core Data Model) is **ready to start**.

The user typed "go" to kick off Phase 2. The `/gsd-discuss-phase 2` skill was invoked but the user dismissed the gray-area question dialog (likely accidental during context compaction). No Phase 2 planning has started yet.

## What to do next

Invoke `/gsd-discuss-phase 2` to start the Phase 2 discussion. The gray areas to present are:

1. Properties & portfolios structure (property → units hierarchy, portfolio grouping)
2. Lease data model (multi-tenant leases, co-signers, lease renewal flow)
3. People list & manager portal layout (table design, filters, search)
4. Dashboard design (what cards/metrics show on first login)

After discussion → `/gsd-plan-phase 2` → `/gsd-execute-phase 2`.

## Phase 2 Goal
> Managers can create and manage the full property portfolio — people, properties, portfolios, and leases — through a functional manager portal CRUD interface.

Requirements: PEOPLE-01-04, PROP-01-06, LEASE-01-06.

## Project: Canary PropOS
- **Repo:** `canary-propos/` (inside `C:\Users\aaron\OneDrive\Claude Code`)
- **Domain:** canarypm.ca / app.canarypm.ca
- **Supabase project ref:** mdzegkaymdsmgspdgkko (ca-central-1 — immutable)
- **Stack:** Next.js 15, TypeScript, Tailwind v4, shadcn/ui (New York), Supabase (@supabase/ssr), Zod v4, react-hook-form v7
- **Design:** warm white #FAFAF9, amber-600 (#D97706) accent, Inter font

## What Phase 1 Built
- Supabase auth (email/password, magic link) with JWT custom claims injected via `public.custom_access_token_hook`
- JWT helpers in public schema: `public.org_id()`, `public.user_role()`, `public.person_id()`
- Multi-tenant RLS on organizations + people tables
- 5-step onboarding wizard (org name → logo → province → invite → done)
- Role-based middleware routing: manager/employee→/dashboard, tenant→/my-home, owner→/portfolio, vendor→/jobs, admin→/admin
- Invite system with token-based signup (`/invite/[token]`)
- Storage bucket `org-assets` with RLS
- Units table with plan-limit trigger
- CI linter (`scripts/check-rls.ts`) that exits 1 if any table lacks RLS
- Pingram SMTP relay configured for Supabase auth emails

## Key Architecture Decisions (locked)
- **No ORM** — Supabase auto-generated types + PostgREST client
- **Admin client** (`createAdminClient`) uses service_role key. NEVER import in `'use client'` files, NEVER with NEXT_PUBLIC_ prefix
- **Bootstrap pattern**: new users have no JWT claims → use admin client for org+people inserts, then call `admin.auth.admin.updateUserById()` to inject claims immediately
- **RLS pattern**: always wrap helpers in SELECT subquery — `(SELECT public.org_id())` not bare call (prevents per-row full scans)
- **Session refresh**: use `window.location.href` not `router.push` after actions that change JWT claims
- **6 roles**: admin, manager, employee, tenant, owner, vendor

## Security fixes already applied (do not revert)
- CR-01: Invite accept route authenticates caller via session, never accepts userId from body
- CR-02: Auth callbacks use `NEXT_PUBLIC_APP_URL ?? origin` to prevent open redirect
- CR-03: updateOrgLogo derives org_id from JWT, never from caller input
- CR-04: /onboarding, /people, /settings added to middleware protected paths
- CR-06: Invite signup checks `session !== null` before calling accept API

## Planning artifacts
All under `.planning/` in the repo root (one level above `canary-propos/`):
- `.planning/ROADMAP.md` — 11-phase roadmap
- `.planning/REQUIREMENTS.md` — full requirement list
- `.planning/STATE.md` — current phase state
- `.planning/phases/01-foundation/` — all Phase 1 artifacts
