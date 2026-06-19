# Phase 1: Foundation - Research

**Researched:** 2026-06-19
**Domain:** Multi-tenant auth, Supabase RLS, Next.js 15 App Router, JWT custom claims, org & team management
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01:** New org sign-up triggers a guided setup wizard: org name → logo → province/jurisdiction → invite first manager → dashboard. Org name and province are REQUIRED fields; all others skippable.

**D-02:** Skipped fields show a persistent "Complete your setup" banner on the dashboard until dismissed or completed.

**D-03:** Canary Property Management goes through the same onboarding flow as any SaaS customer (no hardcoded seed data bypass).

**D-04:** Single sign-in page at `app.canarypm.ca/login` for all roles. After authentication, JWT `role` claim determines redirect: manager/employee → `/dashboard`, tenant → `/my-home`, owner → `/portfolio`, vendor → `/jobs`, admin → `/admin`.

**D-05:** Domain structure: `canarypm.ca` (marketing + public listings), `app.canarypm.ca` (all authenticated portals). Public listings for SaaS customer orgs are scoped to Phase 3; only Canary's listings live at `canarypm.ca/listings` initially.

**D-06:** No separate sign-in URLs per role — one URL, role-based redirect after auth.

**D-07:** Tenant invite emails include: property address + unit, move-in date, and sign-up link. Context shown in email before clicking.

**D-08:** First-time invited users (tenant, vendor, employee) land directly on their portal after completing sign-up — no intermediate welcome screen. Invite pre-configures role + org association.

**D-09:** Manager sees pending/accepted invite status on each person record in the people list (`Invite sent` vs `Active` badge).

**D-10:** Session duration: 7 days with activity extension. Session refreshes on each active visit; expires after 7 days of inactivity.

**D-11:** When a manager removes a user from the org, their session is revoked immediately (server-side invalidation via Supabase Auth admin API). User's next API call returns 401.

**D-12:** No device/tab restrictions — unlimited concurrent sessions. Standard SaaS behavior.

### Claude's Discretion

- Error messaging on auth failures (invalid credentials, expired magic link, revoked session) — use clear, non-technical copy; no raw error codes exposed to users.
- Loading states during OAuth redirect flows.
- Form validation approach on sign-up/invite forms.

### Deferred Ideas (OUT OF SCOPE)

- SaaS customer public listings subdomains (e.g., `acmerealty.canarypm.ca`) — Phase 11 SaaS Billing
- Per-org custom domain support (e.g., `pm.acmerealty.com`) — post-v1
- SSO / SAML for enterprise PM companies — post-v1

</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FOUND-01 | User can create an organization account (SaaS sign-up) with email/password | Supabase Auth email/password built-in; onboarding wizard documented below |
| FOUND-02 | User can sign in with Google OAuth | Supabase Auth Google provider; configure in Supabase dashboard + Google Cloud Console |
| FOUND-03 | User can sign in with Apple OAuth | Supabase Auth Apple provider; configure in Supabase dashboard + Apple Developer |
| FOUND-04 | User can sign in with magic link (passwordless email) | Supabase Auth magic link built-in; Resend as SMTP provider |
| FOUND-05 | Each organization's data is completely isolated (RLS, org_id on every row) | `org_id` FK pattern + RLS policies documented in Architecture Patterns section |
| FOUND-06 | JWT tokens include custom claims (role, org_id, person_id) injected via Auth Hooks | Auth Hook pattern documented in Code Examples; must be configured before any other feature |
| FOUND-07 | Admin can access all organizations' data (platform superuser, cross-org RLS bypass) | Admin RLS = `true` pattern; admin routes are SEPARATE from other portals |
| FOUND-08 | Manager can CRUD all data within their organization | `org_id = auth.org_id()` RLS policy; manager route group |
| FOUND-09 | Employee scoped CRUD within their org | Same RLS as manager with optional assignment check |
| FOUND-10 | Tenant can submit records, submit update requests only | Tenant RLS via `leases.tenant_id = auth.person_id()` subquery |
| FOUND-11 | Client/owner: read-only except maintenance approval | Owner RLS via `portfolios.owner_id = auth.person_id()` subquery |
| FOUND-12 | Vendor: work orders scoped to their assignments only | Vendor RLS via `projects.vendor_id = auth.person_id()` subquery |
| FOUND-13 | RLS policies enforce permission model on all tables including storage | CI linter asserts `row_security = on` on every public table; Storage RLS documented |
| FOUND-14 | Supabase Realtime uses private channels only | Enable private-only in Supabase Dashboard > Project Settings > Realtime before any Realtime feature |
| ORGS-01 | Org admin can invite managers and employees by email | Supabase Auth invite flow; `invite_token` on `org_members` |
| ORGS-02 | Invited users receive email with sign-up link pre-associating them | Resend + react-email; custom invite email with property context (D-07) |
| ORGS-03 | Org admin can remove a user from org (triggers session revocation) | Supabase Auth admin API `auth.admin.deleteUser()` / session invalidation (D-11) |
| ORGS-04 | Organization has a profile (name, logo, contact info, province, branding colors) | `organizations` table; logo in Supabase Storage `org-assets/` bucket |
| ORGS-05 | Organization has a plan limit (free: ≤5 units; paid: unit count per subscription) | `plan_type` and `plan_unit_limit` on `organizations`; enforced server-side in Server Actions |
| ORGS-06 | System blocks adding properties/units when org is at plan limit | Server Action pre-check + database constraint; NOT UI-only enforcement |

</phase_requirements>

---

## Summary

Phase 1 establishes every security and routing primitive that all subsequent phases depend on. Getting this phase wrong — wrong Supabase client, public Realtime channels, no RLS linter, or ad-hoc JWT claim assembly — triggers a mandatory full rewrite of the auth layer. There is no patch path; the entire session and permission model must be correct from the first commit.

The three non-negotiable architectural bets are: (1) `@supabase/ssr` with `createServerClient`/`createBrowserClient` for cookie-based session management in Next.js 15 App Router, (2) JWT custom claims (`role`, `org_id`, `person_id`) injected at sign-in via a Supabase Auth Hook — never assembled client-side or via repeated DB joins, and (3) a CI linter that fails the build if any table in the `public` schema lacks `row_security = on`. These three constraints prevent the most common multi-tenant SaaS rewrites.

The phase also establishes the five portal route groups (`(auth)`, `(manager)`, `(tenant)`, `(owner)`, `(vendor)`) with empty scaffolding, the middleware session refresh loop, and the onboarding wizard. The admin portal is explicitly excluded from the portal group pattern — it requires separate server-side org verification on every route because cross-org access must never share middleware with single-org routes.

**Primary recommendation:** Build in this strict order — Supabase project setup and migrations → Auth Hook JWT injection → RLS CI linter → core schema with all org_id indexes → middleware → portal shells → auth UI → onboarding wizard → invite flows → org settings → session revocation. Do not build any UI before RLS is verified by automated test.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Session management (cookie refresh) | Frontend Server (Next.js middleware) | — | `@supabase/ssr` middleware must run on every request to refresh the session token |
| JWT custom claims injection | Database / Supabase Auth Hook | — | Claims are injected server-side at sign-in; never assembled in browser |
| RLS policy enforcement | Database (PostgreSQL) | API / Backend | DB enforces isolation; Server Actions enforce write permissions at app layer |
| OAuth redirect handling | Frontend Server (Next.js route handler) | Supabase Auth | Callback URL receives auth code, exchanges for session via `@supabase/ssr` |
| Role-based portal routing | Frontend Server (middleware) | — | Middleware reads JWT role claim and redirects before page renders |
| Org sign-up wizard | API / Backend (Server Actions) | Browser / Client | Form state client-side; mutations server-side via Server Actions |
| Invite email dispatch | API / Backend (Server Action or Edge Function) | — | Resend API call must stay server-side; email templates rendered server-side |
| Session revocation (remove user) | API / Backend (Server Action) | Supabase Auth Admin API | `auth.admin.deleteUser()` or session invalidation via admin API — never client-side |
| Logo upload | Browser / Client | Supabase Storage | Client uploads directly to Supabase Storage with signed upload URL; server validates |
| Plan limit enforcement (ORGS-05/06) | API / Backend (Server Action) | Database trigger | Server Action checks unit count before INSERT; DB constraint as final gate |
| Realtime channel authorization | Database (Supabase Realtime) | — | Private channels verified against `realtime.messages` policies |

---

## Standard Stack

### Core (Phase 1 installs)

| Library | Version (verified) | Purpose | Why Standard |
|---------|-------------------|---------|--------------|
| `next` | 15.x (16.2.9 latest stable) | Full-stack React framework | App Router, RSC, Server Actions, Vercel-native |
| `react` | 19.x (ships with Next 15) | UI runtime | Concurrent features, use() hook |
| `typescript` | 5.x | Type safety | Supabase CLI generates full DB types |
| `@supabase/supabase-js` | 2.108.2 [VERIFIED: npm registry] | DB queries, storage, realtime | Base JS client |
| `@supabase/ssr` | 0.12.0 [VERIFIED: npm registry] | Next.js SSR session management | Replaces deprecated `@supabase/auth-helpers-nextjs`; cookie-based sessions |
| `tailwindcss` | 4.3.1 [VERIFIED: npm registry] | Utility-first styling | v4 CSS-first config, no `tailwind.config.js` required |
| `react-hook-form` | 7.79.0 [VERIFIED: npm registry] | Form state management | Uncontrolled inputs, minimal re-renders, shadcn/ui integration |
| `zod` | 4.4.3 [VERIFIED: npm registry] | Schema validation (client + server) | Single schema validates both sides via `zodResolver` |
| `@hookform/resolvers` | 5.4.0 [VERIFIED: npm registry] | react-hook-form ↔ Zod bridge | `zodResolver(schema)` wires validation |
| `resend` | 6.14.0 [VERIFIED: npm registry] | Transactional email | React Email integration; magic link SMTP; invite emails |
| `react-email` | 6.6.3 [VERIFIED: npm registry] | Email template authoring | React components → HTML; Resend-native |
| `lucide-react` | 1.21.0 [VERIFIED: npm registry] | Icons | Ships with shadcn/ui; tree-shakeable |

### shadcn/ui components (Phase 1)

shadcn/ui is CLI-managed, not a versioned npm package. Initialize with `npx shadcn@latest init` (New York style, neutral base color, CSS variables enabled, TypeScript). Then add:

```bash
npx shadcn@latest add button input label form card separator avatar badge
npx shadcn@latest add alert dialog dropdown-menu progress
npx shadcn@latest add select toast sonner
```

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@supabase/ssr` | `@supabase/auth-helpers-nextjs` | auth-helpers is deprecated; `@supabase/ssr` is the only supported path |
| Supabase Auth | Clerk, Auth.js | Clerk adds cost; Auth.js needs a separate adapter. Supabase Auth handles all 4 required methods natively |
| zod v4 | yup, joi | Zod v4 is TypeScript-first, works same schema client + server; yup/joi require separate server validation |
| react-hook-form | Formik | RHF is faster (uncontrolled), fewer re-renders, shadcn/ui Form component wraps RHF natively |

### Installation

```bash
# Scaffold project
npx create-next-app@latest canary-propos --typescript --tailwind --app --src-dir

# Supabase
npm install @supabase/supabase-js @supabase/ssr

# Forms and validation
npm install react-hook-form zod @hookform/resolvers

# Email (invites, magic links)
npm install resend react-email @react-email/components

# shadcn/ui
npx shadcn@latest init
npx shadcn@latest add button input label form card separator avatar badge alert dialog dropdown-menu progress select sonner
```

**Phase 1 intentionally does NOT install:** stripe, twilio, @react-pdf/renderer, pdf-lib, openai — those are Phase 4+ dependencies.

---

## Package Legitimacy Audit

> slopcheck was run but operates against PyPI (Python Package Index). These are npm packages. Cross-ecosystem false positives are documented in the protocol (~9% rate). All packages were verified against the npm registry directly via `npm view`.

| Package | Registry | Age | Verified Version | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------------|-------------|-----------|-------------|
| `@supabase/ssr` | npm | ~2 yrs | 0.12.0 | github.com/supabase/supabase | N/A (PyPI cross-ecosystem false positive) | Approved — official Supabase package, confirmed via npm |
| `@supabase/supabase-js` | npm | ~5 yrs | 2.108.2 | github.com/supabase/supabase-js | N/A (PyPI cross-ecosystem false positive) | Approved — official Supabase package |
| `react-hook-form` | npm | ~5 yrs | 7.79.0 | github.com/react-hook-form/react-hook-form | N/A (PyPI cross-ecosystem false positive) | Approved — well-established |
| `zod` | npm | ~4 yrs | 4.4.3 | github.com/colinhacks/zod | OK (exists on PyPI as unrelated package) | Approved |
| `@hookform/resolvers` | npm | ~4 yrs | 5.4.0 | github.com/react-hook-form/resolvers | N/A (PyPI cross-ecosystem false positive) | Approved — official react-hook-form org |
| `resend` | npm | ~2 yrs | 6.14.0 | github.com/resend/resend-node | OK (exists on PyPI) | Approved |
| `react-email` | npm | ~2 yrs | 6.6.3 | github.com/resend/react-email | N/A (PyPI cross-ecosystem false positive) | Approved — official Resend org |
| `tailwindcss` | npm | ~6 yrs | 4.3.1 | github.com/tailwindlabs/tailwindcss | OK (exists on PyPI as unrelated) | Approved |
| `lucide-react` | npm | ~4 yrs | 1.21.0 | github.com/lucide-icons/lucide | N/A (PyPI cross-ecosystem false positive) | Approved — official Lucide org |

**Packages removed due to slopcheck [SLOP] verdict:** none (all SLOP verdicts were PyPI cross-ecosystem false positives for npm packages)
**Packages flagged as suspicious [SUS]:** none

---

## Architecture Patterns

### System Architecture Diagram

```
Browser (app.canarypm.ca)
        │
        │ HTTP request (with session cookie)
        ▼
Next.js Middleware (middleware.ts)
  ├── createServerClient(@supabase/ssr) reads session cookie
  ├── Refreshes expired token → sets new cookie in response
  ├── No session → redirect to /login
  └── Has session → reads JWT app_metadata.role
        │
        ├── role=manager/employee/admin → allow (manager) routes
        ├── role=tenant              → allow (tenant) routes
        ├── role=owner               → allow (owner) routes
        ├── role=vendor              → allow (vendor) routes
        └── role mismatch for path  → redirect to /unauthorized
        │
        ▼
Next.js App Router (Server Components)
  ├── createServerClient() — authenticated user's JWT (respects RLS)
  ├── Supabase query → RLS enforces org isolation at DB layer
  └── Render page with org-scoped data
        │
        ▼ (on mutation)
Server Action ('use server')
  ├── createServerClient() — authenticated user's JWT
  ├── Validate input (Zod schema)
  ├── Check role/permissions at app layer
  ├── Supabase INSERT/UPDATE/DELETE (RLS also enforces)
  └── revalidatePath() → triggers RSC re-fetch
        │
        ▼
PostgreSQL (Supabase hosted, ca-central-1)
  ├── RLS policies on every public table
  ├── JWT helper functions: auth.org_id(), auth.user_role(), auth.person_id()
  ├── org_id index on every tenant-scoped table
  └── Auth Hook fires at sign-in → injects app_metadata claims into JWT

Supabase Auth (OAuth / Magic Link / Email+Password)
  ├── Google OAuth callback → /auth/callback route handler
  ├── Apple OAuth callback → /auth/callback route handler
  ├── Magic link → /auth/confirm route handler
  └── After all sign-in methods → Auth Hook runs → JWT has role/org_id/person_id
        │
        ▼ (on invite/remove)
Resend (transactional email)
  ├── Invite emails (react-email templates) with property context
  └── Magic link relay (Supabase Auth custom SMTP → Resend)

Supabase Auth Admin API (server-side only)
  └── Session revocation when manager removes user from org (D-11)
```

### Recommended Project Structure

```
src/
├── app/
│   ├── (auth)/                    # Sign-in, sign-up, verify, callback
│   │   ├── layout.tsx             # Centered card layout
│   │   ├── login/page.tsx
│   │   ├── signup/page.tsx        # Onboarding wizard entry
│   │   ├── verify/page.tsx        # Magic link confirmation
│   │   └── auth/
│   │       ├── callback/route.ts  # OAuth + magic link callback
│   │       └── confirm/route.ts   # Email confirmation
│   ├── (manager)/                 # Manager + employee portal
│   │   ├── layout.tsx             # Sidebar shell (Manager nav)
│   │   ├── dashboard/page.tsx
│   │   ├── people/page.tsx        # Invite status badges (D-09)
│   │   └── settings/page.tsx      # Org profile, logo, province
│   ├── (tenant)/                  # Tenant portal
│   │   ├── layout.tsx
│   │   └── my-home/page.tsx
│   ├── (owner)/                   # Owner/client portal
│   │   ├── layout.tsx
│   │   └── portfolio/page.tsx
│   ├── (vendor)/                  # Vendor portal
│   │   ├── layout.tsx
│   │   └── jobs/page.tsx
│   ├── (admin)/                   # Platform superuser — SEPARATE from other portals
│   │   ├── layout.tsx             # Additional server-side org verification on every route
│   │   └── admin/page.tsx
│   ├── onboarding/                # Wizard (outside portal groups — runs before org exists)
│   │   └── page.tsx
│   └── api/
│       └── invites/
│           └── route.ts           # Invite acceptance handler
├── components/
│   ├── ui/                        # shadcn/ui primitives (auto-generated)
│   ├── auth/
│   │   ├── SignInForm.tsx
│   │   ├── MagicLinkForm.tsx
│   │   └── OAuthButtons.tsx
│   ├── onboarding/
│   │   ├── WizardShell.tsx
│   │   ├── steps/
│   │   │   ├── OrgNameStep.tsx
│   │   │   ├── LogoStep.tsx
│   │   │   ├── ProvinceStep.tsx
│   │   │   └── InviteStep.tsx
│   │   └── SetupBanner.tsx        # "Complete your setup" (D-02)
│   ├── layout/
│   │   ├── ManagerShell.tsx
│   │   ├── TenantShell.tsx
│   │   ├── OwnerShell.tsx
│   │   └── VendorShell.tsx
│   └── people/
│       └── InviteStatusBadge.tsx  # "Invite sent" / "Active" (D-09)
├── lib/
│   ├── supabase/
│   │   ├── server.ts              # createServerClient (Server Components + Actions)
│   │   ├── client.ts              # createBrowserClient (Client Components)
│   │   └── admin.ts              # createAdminClient (service_role — server only)
│   └── email/
│       └── templates/
│           └── TenantInviteEmail.tsx
├── middleware.ts                  # Session refresh + role-based routing
└── supabase/
    └── migrations/
        ├── 0001_create_organizations.sql
        ├── 0002_create_people.sql
        ├── 0003_rls_helpers.sql   # auth.org_id(), auth.user_role(), auth.person_id()
        ├── 0004_rls_organizations.sql
        ├── 0005_rls_people.sql
        └── 0006_storage_buckets.sql
```

### Pattern 1: @supabase/ssr Middleware Session Refresh

**What:** Middleware reads the session cookie, refreshes the token if needed, writes the updated cookie to the response, then enforces role-based routing.

**When to use:** Every request to any authenticated route. This is the single entry point for session management.

```typescript
// src/middleware.ts
// Source: https://supabase.com/docs/guides/auth/server-side/nextjs
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // CRITICAL: getUser() must be called to refresh session — do not remove
  const { data: { user } } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl
  const role = user?.app_metadata?.role as string | undefined

  // Unauthenticated — redirect to login
  if (!user && isProtectedPath(pathname)) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Role guard per portal
  if (pathname.startsWith('/dashboard') && !['manager', 'employee', 'admin'].includes(role ?? '')) {
    return NextResponse.redirect(new URL('/login', request.url))
  }
  if (pathname.startsWith('/my-home') && role !== 'tenant') {
    return NextResponse.redirect(new URL('/login', request.url))
  }
  if (pathname.startsWith('/portfolio') && role !== 'owner') {
    return NextResponse.redirect(new URL('/login', request.url))
  }
  if (pathname.startsWith('/jobs') && role !== 'vendor') {
    return NextResponse.redirect(new URL('/login', request.url))
  }
  if (pathname.startsWith('/admin') && role !== 'admin') {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
```

### Pattern 2: Supabase Auth Hook — JWT Custom Claims

**What:** A PostgreSQL function registered as a Supabase Auth Hook that fires at every sign-in and injects `role`, `org_id`, and `person_id` into `app_metadata` in the JWT.

**When to use:** Must be configured in the Supabase dashboard (Authentication > Hooks) before any auth feature is tested.

```sql
-- Source: Supabase Auth Hooks documentation
-- supabase/migrations/0003_rls_helpers.sql

-- Auth Hook function: fires at every sign-in
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  claims jsonb;
  person_record record;
BEGIN
  -- Fetch the person record for this user
  SELECT p.id, p.org_id, p.role
  INTO person_record
  FROM public.people p
  WHERE p.user_id = (event->>'user_id')::uuid
  LIMIT 1;

  claims := event->'claims';

  IF person_record IS NOT NULL THEN
    claims := jsonb_set(claims, '{app_metadata,org_id}', to_jsonb(person_record.org_id::text));
    claims := jsonb_set(claims, '{app_metadata,role}', to_jsonb(person_record.role));
    claims := jsonb_set(claims, '{app_metadata,person_id}', to_jsonb(person_record.id::text));
  END IF;

  RETURN jsonb_set(event, '{claims}', claims);
END;
$$;

-- Grant execute permission to supabase_auth_admin
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook FROM authenticated, anon, public;
```

```sql
-- JWT helper functions (call once per query, not per row)
CREATE OR REPLACE FUNCTION auth.org_id() RETURNS uuid AS $$
  SELECT (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid;
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION auth.user_role() RETURNS text AS $$
  SELECT auth.jwt() -> 'app_metadata' ->> 'role';
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION auth.person_id() RETURNS uuid AS $$
  SELECT (auth.jwt() -> 'app_metadata' ->> 'person_id')::uuid;
$$ LANGUAGE sql STABLE;
```

### Pattern 3: RLS Policy with SELECT Wrapper (Performance Critical)

**What:** Every RLS policy wraps function calls in `(SELECT ...)` so PostgreSQL evaluates them once per query, not once per row.

**When to use:** EVERY RLS policy without exception. This is the most common RLS performance mistake.

```sql
-- Source: Supabase RLS performance best practices
-- CORRECT: functions evaluated once per query (cached)
CREATE POLICY "org_isolation_select" ON public.properties
FOR SELECT TO authenticated
USING (
  org_id = (SELECT auth.org_id())
  AND (
    (SELECT auth.user_role()) IN ('manager', 'employee', 'admin')
    OR (SELECT auth.user_role()) = 'admin'
  )
);

-- WRONG: auth.uid() re-evaluated per row — catastrophic on large tables
-- NEVER DO THIS:
-- USING (org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid()))
```

### Pattern 4: RLS CI Linter

**What:** A SQL query run in CI that fails if any table in `public` schema lacks RLS enabled. Gates deployment.

```sql
-- Run in CI: psql --no-psqlrc -c "..." || exit 1
-- Source: PITFALLS.md C1 prevention strategy [ASSUMED: implementation pattern]
SELECT tablename
FROM pg_tables
WHERE schemaname = 'public'
  AND NOT rowsecurity
ORDER BY tablename;
-- Exit code non-zero (via application check) if any rows returned
```

```typescript
// scripts/check-rls.ts — runs in CI pipeline
// Connects to DB, runs above query, exits 1 if any tables lack RLS
const { data } = await supabase.rpc('tables_without_rls')
if (data && data.length > 0) {
  console.error('FAIL: Tables missing RLS:', data.map(r => r.tablename))
  process.exit(1)
}
```

### Pattern 5: createServerClient in Server Components

```typescript
// src/lib/supabase/server.ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from '@/types/supabase'

export function createClient() {
  const cookieStore = cookies()
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Server Component — cookie writes are handled by middleware
          }
        },
      },
    }
  )
}
```

```typescript
// src/lib/supabase/admin.ts — service_role client, SERVER ONLY
// NEVER import this in any file that runs in the browser
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'

export function createAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!, // NEVER prefix with NEXT_PUBLIC_
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}
```

### Pattern 6: OAuth Callback Route Handler

```typescript
// src/app/auth/callback/route.ts
// Source: Supabase SSR Next.js guide
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  if (code) {
    const cookieStore = cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          },
        },
      }
    )

    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      // Role-based redirect — JWT claims are now set by Auth Hook
      const { data: { user } } = await supabase.auth.getUser()
      const role = user?.app_metadata?.role
      const redirectMap: Record<string, string> = {
        manager: '/dashboard',
        employee: '/dashboard',
        admin: '/admin',
        tenant: '/my-home',
        owner: '/portfolio',
        vendor: '/jobs',
      }
      return NextResponse.redirect(
        new URL(redirectMap[role ?? ''] ?? '/dashboard', origin)
      )
    }
  }

  return NextResponse.redirect(new URL('/auth/auth-code-error', origin))
}
```

### Pattern 7: Session Revocation (D-11, ORGS-03)

```typescript
// src/app/(manager)/people/actions.ts
'use server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export async function removeUserFromOrg(targetUserId: string) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Verify the requesting user is a manager/admin in the same org
  if (!user || !['manager', 'admin'].includes(user.app_metadata?.role)) {
    throw new Error('Unauthorized')
  }

  const admin = createAdminClient()

  // Remove org membership
  await supabase
    .from('people')
    .update({ active: false, deactivated_at: new Date().toISOString() })
    .eq('user_id', targetUserId)
    .eq('org_id', user.app_metadata.org_id)

  // Revoke all sessions — user's next request returns 401 (D-11)
  await admin.auth.admin.signOut(targetUserId, 'global')
}
```

### Anti-Patterns to Avoid

- **`@supabase/auth-helpers-nextjs`:** Deprecated. Import from `@supabase/ssr` only.
- **`NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY`:** Never prefix the service key with `NEXT_PUBLIC_`. This exposes it in the browser bundle.
- **`auth.uid()` without `(SELECT ...)` wrapper in RLS policies:** Causes per-row function evaluation. Always: `(SELECT auth.uid())`.
- **Public Realtime channels:** Always configure `private: true` in channel options AND enable private-only mode in Supabase project settings before any Realtime feature ships.
- **Assembling JWT claims client-side:** Role and org_id must come from the Auth Hook, not from a database query assembled in the browser after sign-in.
- **Admin routes in a shared portal group:** The admin portal shares no middleware with other portals. Cross-org access requires separate server-side verification on every route.
- **Schema changes via Supabase Dashboard SQL editor:** All changes go through migration files in `supabase/migrations/`. Dashboard is read-only in staging and production.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cookie-based session management | Custom JWT cookie logic | `@supabase/ssr` `createServerClient` | Handles token refresh, cookie serialization, edge runtime compatibility |
| OAuth flow (Google, Apple) | Custom OAuth redirect/callback | Supabase Auth built-in providers | Token exchange, PKCE, refresh — already implemented |
| Magic link generation and delivery | Custom time-expiring link + SMTP | Supabase Auth magic link + Resend SMTP relay | Expiry, single-use enforcement, rate limiting — already handled |
| Password hashing | bcrypt/argon2 | Supabase Auth | Never store raw or hand-hashed passwords |
| RLS row filtering logic | Application-layer WHERE clauses | PostgreSQL RLS policies | RLS enforces at query time even if application code has bugs; defense in depth |
| Session revocation | Custom `revoked_tokens` table with every-request check | `supabase.auth.admin.signOut(userId, 'global')` | Supabase's admin API invalidates all refresh tokens server-side immediately |
| Email template rendering | String interpolation / HTML strings | `react-email` components + Resend | Outlook/Gmail compatibility, preview server, responsive layout |
| Form validation deduplication | Separate client and server validation schemas | Single `zod` schema + `zodResolver` | One source of truth for both sides |

**Key insight:** Supabase provides session management, auth, RLS, and storage as integrated primitives. The value of this stack is the integration — hand-rolling any of these pieces creates sync problems with Supabase's own auth state machine.

---

## Common Pitfalls

### Pitfall 1: RLS Enabled Without Policies = Silent Deny-All (C1)

**What goes wrong:** Enabling RLS on a table without writing any policies causes all queries from `authenticated` and `anon` roles to return zero rows with no error. Developers test with the service_role key (which bypasses RLS), see data, and ship. Production users see empty screens.

**Why it happens:** Supabase Table Editor creates tables with RLS disabled by default. Developers enabling it forget that "RLS on + no policies = deny all (not allow all)."

**How to avoid:** Template every migration with RLS enabled AND at least one policy before the migration is committed. Run the CI linter (Pattern 4) on every PR.

**Warning signs:** A developer says "I had to disable RLS to get the feature working." This is always the wrong fix.

### Pitfall 2: auth.uid() Without (SELECT ...) Wrapper = Full Table Scan (C2)

**What goes wrong:** RLS policies calling `auth.uid()` directly re-evaluate the function for every row scanned. On tables with thousands of records: 200ms dev query becomes 15 seconds in production.

**Why it happens:** The SQL looks identical. The difference is invisible until production row counts.

**How to avoid:** Establish the `(SELECT auth.uid())` pattern in the first migration. Code review checklist: every new RLS policy must use `(SELECT ...)` wrappers.

**Warning signs:** Queries are fast with service_role key but slow for authenticated users. Performance degrades as row count grows. `EXPLAIN ANALYZE` shows per-row filter evaluation.

### Pitfall 3: service_role Key Exposed to Browser (C3)

**What goes wrong:** `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY` prefix exposes the service key in the browser bundle. Service role bypasses all RLS — complete data breach for every org.

**How to avoid:** `SUPABASE_SERVICE_ROLE_KEY` with no `NEXT_PUBLIC_` prefix. Import `createAdminClient` only from Server Components, Server Actions, and Route Handlers — never from `'use client'` files. Add a git-secrets check for `service_role` in `.env*` files.

### Pitfall 4: Stale JWT Claims After Role/Org Change (M5)

**What goes wrong:** JWT claims are baked in at sign-in. If a user's role changes or they are removed from an org, they retain old claims until the token refreshes (up to 1 hour). RLS policies that rely on JWT claims enforce the stale permissions.

**How to avoid:** For security-sensitive permission changes (removal, ORGS-03), always call `supabase.auth.admin.signOut(userId, 'global')` immediately. This forces a new sign-in. Document the ~1 hour eventual consistency for role changes that aren't security-critical (e.g., promotion from employee to manager).

### Pitfall 5: Public Realtime Channels Leaking Cross-Org Events (M4)

**What goes wrong:** Supabase Realtime's public channel mode (the old default) lets any authenticated user subscribe to any channel and receive events from any org.

**How to avoid:** On day one, before any Realtime feature: go to Supabase Dashboard > Project Settings > Realtime > enable "Private-only channels." Then every channel in code uses `{ config: { private: true } }`. Realtime policies on `realtime.messages` scope by org.

### Pitfall 6: Admin Portal Shares Middleware with Other Portals

**What goes wrong:** If the admin route group uses the same middleware as manager/tenant portals, a middleware misconfiguration could expose cross-org data. Admin access means "all orgs" — the blast radius of a bug is the entire database.

**How to avoid:** Admin routes are a separate route group `(admin)` with an additional server-side org verification check inside every Server Component. The layout.tsx for `(admin)` verifies `user.app_metadata.role === 'admin'` and throws to the nearest error boundary if not. Never rely solely on middleware for admin access control.

### Pitfall 7: Migrations Applied via Dashboard SQL Editor (N4)

**What goes wrong:** Schema changes made via the Supabase Dashboard SQL editor bypass the `supabase_migrations` history. Future `supabase db push` fails with sync errors. Migration history and remote schema diverge.

**How to avoid:** First team rule: all schema changes go through `supabase db diff` locally → commit migration file → `supabase db push`. Dashboard SQL editor is for read-only inspection only.

---

## Code Examples

### Core Schema (Phase 1 tables)

```sql
-- supabase/migrations/0001_create_organizations.sql
CREATE TABLE public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL CHECK (length(name) >= 2 AND length(name) <= 80),
  slug TEXT UNIQUE NOT NULL,
  province TEXT NOT NULL,             -- required (D-01); drives Canadian compliance (M2)
  logo_path TEXT,                     -- Supabase Storage path, nullable
  plan_type TEXT NOT NULL DEFAULT 'free' CHECK (plan_type IN ('free', 'starter', 'growth')),
  plan_unit_limit INTEGER NOT NULL DEFAULT 5,
  stripe_customer_id TEXT,
  setup_completed_at TIMESTAMPTZ,     -- null until wizard fully complete (D-02)
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
CREATE INDEX ON public.organizations (id);

-- supabase/migrations/0002_create_people.sql
CREATE TABLE public.people (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,  -- null until invite accepted
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'manager', 'employee', 'tenant', 'owner', 'vendor')),
  email TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  phone TEXT,
  invite_token UUID UNIQUE DEFAULT gen_random_uuid(),  -- used in invite link
  invite_sent_at TIMESTAMPTZ,
  invite_accepted_at TIMESTAMPTZ,     -- null until user completes sign-up
  active BOOLEAN NOT NULL DEFAULT true,
  deactivated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.people ENABLE ROW LEVEL SECURITY;
CREATE INDEX ON public.people (org_id);
CREATE INDEX ON public.people (user_id);
CREATE INDEX ON public.people (invite_token);
```

### Invite Status Badge (D-09)

```typescript
// src/components/people/InviteStatusBadge.tsx
// Renders "Invite sent" or "Active" with correct color from UI-SPEC
import { Badge } from '@/components/ui/badge'
import { Clock, CheckCircle2 } from 'lucide-react'
import type { Person } from '@/types/supabase'

export function InviteStatusBadge({ person }: { person: Pick<Person, 'invite_accepted_at'> }) {
  const isActive = !!person.invite_accepted_at

  if (isActive) {
    return (
      <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
        <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
        Active
      </Badge>
    )
  }

  return (
    <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">
      <Clock className="mr-1 h-3.5 w-3.5" />
      Invite sent
    </Badge>
  )
}
```

### Onboarding Wizard — Province Select (ORGS-04, D-01)

```typescript
// All 13 Canadian provinces/territories (UI-SPEC Step 3)
export const CANADIAN_PROVINCES = [
  { value: 'AB', label: 'Alberta' },
  { value: 'BC', label: 'British Columbia' },
  { value: 'MB', label: 'Manitoba' },
  { value: 'NB', label: 'New Brunswick' },
  { value: 'NL', label: 'Newfoundland and Labrador' },
  { value: 'NT', label: 'Northwest Territories' },
  { value: 'NS', label: 'Nova Scotia' },
  { value: 'NU', label: 'Nunavut' },
  { value: 'ON', label: 'Ontario' },
  { value: 'PE', label: 'Prince Edward Island' },
  { value: 'QC', label: 'Quebec' },
  { value: 'SK', label: 'Saskatchewan' },
  { value: 'YT', label: 'Yukon' },
] as const
```

### Tenant Invite Email (D-07, react-email)

```typescript
// src/lib/email/templates/TenantInviteEmail.tsx
import {
  Body, Button, Container, Head, Heading, Html,
  Preview, Section, Text
} from '@react-email/components'

interface TenantInviteEmailProps {
  tenantFirstName: string
  orgName: string
  propertyAddress: string
  unitNumber: string
  moveInDate: string
  signUpUrl: string
}

export function TenantInviteEmail({
  tenantFirstName, orgName, propertyAddress,
  unitNumber, moveInDate, signUpUrl,
}: TenantInviteEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>{orgName} has invited you to your tenant portal</Preview>
      <Body style={{ backgroundColor: '#FAFAF9', fontFamily: 'Inter, system-ui, sans-serif' }}>
        <Container style={{ maxWidth: '600px', margin: '0 auto', padding: '32px' }}>
          <Heading style={{ fontSize: '20px', fontWeight: 600 }}>
            Hi {tenantFirstName},
          </Heading>
          <Text>
            {orgName} has invited you to manage your tenancy at:
          </Text>
          <Section style={{ backgroundColor: '#F5F4F2', padding: '16px', borderRadius: '6px' }}>
            <Text style={{ margin: 0 }}><strong>{propertyAddress}</strong></Text>
            <Text style={{ margin: '4px 0 0' }}>Unit {unitNumber}</Text>
            <Text style={{ margin: '4px 0 0' }}>Move-in date: {moveInDate}</Text>
          </Section>
          <Button
            href={signUpUrl}
            style={{
              backgroundColor: '#D97706',
              color: '#ffffff',
              fontSize: '16px',
              height: '48px',
              padding: '0 24px',
              borderRadius: '6px',
              marginTop: '24px',
            }}
          >
            Set up my account
          </Button>
          <Text style={{ fontSize: '14px', color: '#78716C', marginTop: '32px' }}>
            This invite was sent by {orgName}. If you didn&apos;t expect this email, you can ignore it.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `@supabase/auth-helpers-nextjs` | `@supabase/ssr` | 2024 | auth-helpers is deprecated and incompatible with Next.js 15 App Router cookies API |
| Supabase DB triggers for JWT claims | Supabase Auth Hooks (custom access token hook) | 2024 | Hooks fire at every sign-in, not just first sign-in; more reliable than triggers |
| `auth.uid()` direct in RLS | `(SELECT auth.uid())` in RLS | Long-standing best practice, documented 2023+ | Dramatic performance improvement on tables with >1000 rows |
| Public Realtime channels | Private Realtime channels | Supabase Realtime v2 (2024) | Required for multi-tenant isolation — public channels leak events across orgs |
| Tailwind v3 `tailwind.config.js` | Tailwind v4 CSS-first config | v4 released 2025 | No config file required; faster builds; cascade layers native |

**Deprecated/outdated:**
- `@supabase/auth-helpers-nextjs`: deprecated, removed from Supabase's active documentation. Use `@supabase/ssr`.
- Supabase Auth triggers on `auth.users` for custom claims: superseded by Auth Hooks. Triggers fire on INSERT only; hooks fire on every sign-in including token refresh.

---

## Open Questions (RESOLVED)

1. **Supabase project region (PIPEDA compliance)**
   - **RESOLVED:** Project has not yet been created (greenfield). Plan 01-01 Task 1 includes a human checkpoint (`autonomous: false`) that requires the developer to confirm `ca-central-1` region selection before any data is written. Plan will not proceed past this checkpoint until confirmed. If project already exists in the wrong region, the task flags manual intervention.

2. **Apple OAuth developer account**
   - **RESOLVED:** Apple Developer credentials may not be immediately available. Plan 01-04 implements Apple OAuth as a conditional task with `autonomous: false` and a documented fallback: email/password + Google + magic link are sufficient for all Phase 1 testing. FOUND-03 is implemented with a human checkpoint; if credentials are unavailable at execution time, the task is deferred and noted in the phase summary. Phase verification will flag FOUND-03 as conditional rather than blocking.

3. **Google Cloud Console OAuth credentials**
   - **RESOLVED:** Same pattern as Apple OAuth. Plan 01-04 implements Google OAuth with `autonomous: false` checkpoint for credential configuration. Fallback: email/password + magic link cover all sign-in scenarios for local development. FOUND-02 is conditional on credential availability; email/password covers all other sign-in tests.

4. **7-day session duration configuration (D-10)**
   - **RESOLVED [ASSUMED]:** Configure Supabase Auth → Auth Settings → Refresh token expiry to 604800 seconds (7 days). JWT TTL remains at 3600 seconds (1 hour) for security — short-lived JWTs with long-lived refresh tokens achieves the "7 days with activity extension" behavior specified in D-10. Plan 01-02 includes this configuration step. Assumption: Supabase Auth refresh token sliding window implements "activity extension" correctly — verify in Supabase Auth dashboard during execution.

---

## Environment Availability

> Phase 1 is greenfield — no code exists. External service availability is the primary concern.

| Dependency | Required By | Available | Notes | Fallback |
|------------|------------|-----------|-------|----------|
| Supabase hosted project | All backend | Unknown — must be created | Must be `ca-central-1` for PIPEDA | No fallback |
| Supabase Auth (Google provider) | FOUND-02 | Unknown — requires Google Cloud credentials | OAuth 2.0 client ID needed | Skip during local dev; test with email/password |
| Supabase Auth (Apple provider) | FOUND-03 | Unknown — requires Apple Developer account | Services ID + private key needed | Skip during local dev |
| Resend account | FOUND-04, ORGS-01-02 | Unknown | API key needed; configure as Supabase Auth SMTP | Magic link won't work without this |
| Vercel project | Hosting | Unknown — must be created | `app.canarypm.ca` domain must be configured | Local dev unaffected |
| Node.js ≥ 18 | Next.js 15 | [ASSUMED] available | Next 15 requires Node 18+ | — |
| npm ≥ 9 | Package management | [ASSUMED] available | — | — |

**Missing dependencies with no fallback:**
- Supabase hosted project (must be created, must be ca-central-1)
- Resend account (magic links cannot be tested without an SMTP relay)

**Missing dependencies with fallback:**
- Google OAuth — use email/password for local dev until Google credentials are available
- Apple OAuth — use email/password for local dev until Apple credentials are available
- Vercel — use `next dev` locally; Vercel deployment is a deploy-time concern

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None detected (greenfield) — install Vitest for unit tests, Playwright for E2E |
| Config file | None — Wave 0 gap |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run && npx playwright test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FOUND-01 | Email/password sign-up creates org + person record | Integration | `vitest run tests/auth/signup.test.ts` | Wave 0 |
| FOUND-02 | Google OAuth redirects to /dashboard for manager | E2E | `playwright test tests/e2e/google-oauth.spec.ts` | Wave 0 |
| FOUND-03 | Apple OAuth redirects correctly by role | E2E | `playwright test tests/e2e/apple-oauth.spec.ts` | Wave 0 |
| FOUND-04 | Magic link sends email and confirms sign-in | Integration | `vitest run tests/auth/magic-link.test.ts` | Wave 0 |
| FOUND-05 | Cross-org data isolation (Org A cannot see Org B's data) | Integration | `vitest run tests/rls/cross-org-isolation.test.ts` | Wave 0 — CRITICAL |
| FOUND-06 | JWT claims contain role, org_id, person_id after sign-in | Integration | `vitest run tests/auth/jwt-claims.test.ts` | Wave 0 |
| FOUND-07 | Admin sees all orgs; non-admin does not | Integration | `vitest run tests/rls/admin-access.test.ts` | Wave 0 |
| FOUND-08 | Manager can CRUD within own org | Integration | `vitest run tests/rls/manager-permissions.test.ts` | Wave 0 |
| FOUND-13 | Every public table has RLS enabled | CI linter | `node scripts/check-rls.ts` | Wave 0 — GATE |
| FOUND-14 | No public Realtime channel subscriptions in codebase | Grep/lint | `grep -r "private: false" src/ && exit 1` | Wave 0 |
| ORGS-03 | Removed user's session is revoked immediately | Integration | `vitest run tests/auth/session-revocation.test.ts` | Wave 0 |
| ORGS-05/06 | Plan limit blocks adding units beyond threshold | Integration | `vitest run tests/orgs/plan-limits.test.ts` | Wave 0 |

### Sampling Rate
- **Per task commit:** `node scripts/check-rls.ts && npx vitest run tests/rls/`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full Vitest suite green + RLS linter passes before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `vitest.config.ts` — Vitest configuration with Supabase test client setup
- [ ] `tests/helpers/supabase-test-client.ts` — authenticated test client fixture per role
- [ ] `tests/rls/cross-org-isolation.test.ts` — the most critical test in Phase 1
- [ ] `tests/auth/jwt-claims.test.ts` — verifies Auth Hook is wired correctly
- [ ] `scripts/check-rls.ts` — CI linter for missing RLS
- [ ] `playwright.config.ts` — Playwright for OAuth E2E (may defer to Phase 1 end)

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | YES | Supabase Auth (all 4 methods); no hand-rolled password handling |
| V3 Session Management | YES | `@supabase/ssr` cookie-based sessions; 7-day inactivity expiry (D-10); immediate revocation (D-11) |
| V4 Access Control | YES | Supabase RLS + middleware role guard; admin isolated from other portals |
| V5 Input Validation | YES | Zod schemas on every Server Action; client-side via `zodResolver` |
| V6 Cryptography | NO | No custom crypto; Supabase Auth handles all hashing and token signing |
| V7 Error Handling | YES | No raw error codes exposed to users (Claude's Discretion); UI-SPEC error copy documented |
| V9 Communications | YES | HTTPS enforced by Vercel + Supabase; all API calls over TLS |
| V13 API | YES | Server Actions only (no direct Supabase client queries from browser for mutations) |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Cross-org IDOR (access Org B's data with Org A JWT) | Information Disclosure | RLS `org_id = (SELECT auth.org_id())` on all tables; never use service_role for org-scoped data fetches |
| JWT claim forgery | Elevation of Privilege | Claims in `app_metadata` (server-controlled, not writable by clients); signed by Supabase Auth HS256 |
| service_role key exposure | Information Disclosure | `SUPABASE_SERVICE_ROLE_KEY` — no `NEXT_PUBLIC_` prefix; server-only import; git-secrets pre-commit hook |
| Stale JWT after removal | Elevation of Privilege | Immediate `admin.signOut(userId, 'global')` on ORGS-03 (D-11) |
| Public Realtime channel subscription | Information Disclosure | Private-only channels in project settings; `{ config: { private: true } }` in all channel code |
| SQL injection via PostgREST | Tampering | Supabase JS client uses parameterized queries internally; no raw SQL construction from user input |
| OAuth redirect hijacking | Spoofing | Callback URLs allowlisted in Supabase + Google/Apple consoles; no open redirects in callback handler |
| PIPEDA data residency | Compliance | Supabase project in `ca-central-1`; no personal data logged to external services without disclosure |

---

## Sources

### Primary (HIGH confidence)
- Supabase `@supabase/ssr` — official package, verified via npm registry at v0.12.0
- Supabase Auth Hooks documentation (custom_access_token_hook) — `.planning/research/ARCHITECTURE.md` (researched via Context7)
- Supabase RLS performance best practices — `.planning/research/PITFALLS.md` C1/C2 (researched via Context7 and official Supabase docs)
- Next.js 15 App Router middleware and route groups — `.planning/research/ARCHITECTURE.md` (researched via Context7 `/vercel/next.js`)
- `.planning/research/STACK.md` — all package versions verified against Context7 at research time (2026-06-19)
- `.planning/phases/01-foundation/01-UI-SPEC.md` — UI design contract for auth pages, onboarding wizard, portal shells, error copy
- `.planning/phases/01-foundation/01-CONTEXT.md` — user decisions D-01 through D-12

### Secondary (MEDIUM confidence)
- PIPEDA compliance requirements (`.planning/research/PITFALLS.md` M3) — grounded in regulatory domain knowledge; verify against OPC guidance before shipping
- Provincial tenancy law differences (`.planning/research/PITFALLS.md` M2) — province field ships Phase 1; enforcement rules deferred to v2

### Tertiary (LOW confidence — verify before executing)
- 7-day session configuration via Supabase refresh token reuse interval (Open Question 4) — behavior not verified in this session; confirm in Supabase Auth settings

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Setting Supabase Auth refresh token reuse interval to 7 days implements D-10 "7 days with activity extension" | Open Questions #4 | Session duration behavior differs from spec; users get logged out unexpectedly |
| A2 | Node.js ≥ 18 and npm ≥ 9 are available on the development machine | Environment Availability | `create-next-app` will fail or Next.js 15 won't run |
| A3 | Supabase project has not yet been created (greenfield) | Environment Availability | If a project already exists in the wrong region, data residency is non-compliant and region cannot be changed |

**If this table is empty:** All claims in this research were verified or cited — no user confirmation needed.

---

## Project Constraints (from CLAUDE.md)

| Directive | Source | Constraint |
|-----------|--------|------------|
| Use `@supabase/ssr`, not `@supabase/auth-helpers-nextjs` | CLAUDE.md / STACK.md | Hard constraint — wrong package is a rewrite trigger |
| No ORM (Prisma/Drizzle) | STACK.md | Use Supabase auto-generated TypeScript types and PostgREST client directly |
| All file-changing work must go through a GSD command | CLAUDE.md GSD Workflow Enforcement | Do not make direct repo edits outside a GSD workflow |
| `@react-pdf/renderer` for PDF generation (not Puppeteer) | CLAUDE.md / STACK.md | Puppeteer incompatible with Vercel serverless |
| No Redux/MobX/Jotai | STACK.md | RSC + useState is sufficient; introduce Zustand only if genuinely needed |
| Mobile-responsive is mandatory | CLAUDE.md | Every UI element must work on mobile; 44px min touch targets (UI-SPEC) |
| Do not expose service_role key client-side | PITFALLS.md C3 | Hard security requirement |

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages verified via npm registry; versions current as of 2026-06-19
- Architecture patterns: HIGH — sourced from ARCHITECTURE.md and PITFALLS.md which were researched against Context7 and official Supabase/Next.js docs
- Security domain: HIGH — ASVS categories mapped against this phase's actual tech stack
- Environment availability: LOW — external services (Supabase project, Google/Apple OAuth, Resend) not verified in this session; cannot be verified without credentials

**Research date:** 2026-06-19
**Valid until:** 2026-07-19 (stable APIs; re-verify `@supabase/ssr` version if more than 30 days pass)
