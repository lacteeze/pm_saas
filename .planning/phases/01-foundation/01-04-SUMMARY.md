---
phase: 01-foundation
plan: "04"
subsystem: routing
tags: [middleware, auth, portals, role-based-routing, supabase-ssr]
dependency_graph:
  requires: ["01-02"]
  provides: ["01-05", "01-06", "01-07"]
  affects: [all portal pages]
tech_stack:
  added: []
  patterns:
    - "@supabase/ssr createServerClient in middleware for session refresh"
    - "Route groups (auth), (manager), (tenant), (owner), (vendor), (admin)"
    - "Independent server-side role check in (admin)/layout.tsx (Pitfall 6)"
    - "Client components for shell nav with usePathname active state"
key_files:
  created:
    - canary-propos/src/middleware.ts
    - canary-propos/src/app/(auth)/layout.tsx
    - canary-propos/src/app/(manager)/layout.tsx
    - canary-propos/src/app/(manager)/dashboard/page.tsx
    - canary-propos/src/app/(tenant)/layout.tsx
    - canary-propos/src/app/(tenant)/my-home/page.tsx
    - canary-propos/src/app/(owner)/layout.tsx
    - canary-propos/src/app/(owner)/portfolio/page.tsx
    - canary-propos/src/app/(vendor)/layout.tsx
    - canary-propos/src/app/(vendor)/jobs/page.tsx
    - canary-propos/src/app/(admin)/layout.tsx
    - canary-propos/src/app/(admin)/admin/page.tsx
    - canary-propos/src/components/layout/ManagerShell.tsx
    - canary-propos/src/components/layout/TenantShell.tsx
    - canary-propos/src/components/layout/OwnerShell.tsx
    - canary-propos/src/components/layout/VendorShell.tsx
    - canary-propos/docs/supabase-auth-config.md
  modified: []
decisions:
  - "Shell components are 'use client' for usePathname active nav state; layout wrappers stay RSC"
  - "Admin layout performs its own getUser() + role check independent of middleware (Pitfall 6)"
  - "Mobile bottom tab bar shows first 5 nav items for manager; all items for other roles (4 or fewer)"
  - "Accent amber-600 reserved per UI-SPEC — not used on active nav (active uses bg-white shadow)"
metrics:
  duration: "~15 minutes"
  completed: "2026-06-20"
  tasks_completed: 2
  tasks_total: 3
  files_created: 17
---

# Phase 1 Plan 04: Session Middleware and Portal Shells Summary

**One-liner:** @supabase/ssr session middleware with role-based routing, five empty portal shells with role-appropriate nav, and independently-guarded admin layout.

---

## What Was Built

### Task 1 — Session Middleware (fe2a021)

`src/middleware.ts` implements the @supabase/ssr session refresh loop per RESEARCH Pattern 1:

- `createServerClient` with `getAll`/`setAll` cookie handlers wired to request/response
- `supabase.auth.getUser()` called on every request (critical — refreshes session token, do not replace with `getSession()`)
- Reads `user?.app_metadata?.role` from the refreshed JWT
- Unauthenticated users accessing protected paths redirect to `/login`
- Role guards per D-04: `/dashboard` (manager/employee/admin), `/my-home` (tenant), `/portfolio` (owner), `/jobs` (vendor), `/admin` (admin)
- `config.matcher` excludes `_next/static`, `_next/image`, `favicon.ico`
- Admin guard in middleware is first layer only; `(admin)/layout.tsx` adds an independent check

### Task 2 — Portal Route Groups and Layout Shells (8cb2730)

Five route groups created:

| Group | Layout | Landing Page | Shell Component |
|-------|--------|-------------|----------------|
| `(auth)` | Centered card, warm white bg | — | None (unauthenticated) |
| `(manager)` | ManagerShell | `/dashboard` | ManagerShell.tsx |
| `(tenant)` | TenantShell | `/my-home` | TenantShell.tsx |
| `(owner)` | OwnerShell | `/portfolio` | OwnerShell.tsx |
| `(vendor)` | VendorShell | `/jobs` | VendorShell.tsx |
| `(admin)` | Inline admin shell + independent role check | `/admin` | None (inline) |

**Shell design:**
- Desktop: fixed left sidebar 240px, `#F5F4F2` (stone-100) background
- Mobile: fixed bottom tab bar, min 56px height per item
- Active nav: white background + shadow (not amber accent — reserved per UI-SPEC)
- 44px minimum touch targets (`min-h-11`) on all interactive elements
- Content area: 16px mobile / 32px desktop padding, max-width 1280px

**Admin layout independence (Pitfall 6):**
`(admin)/layout.tsx` calls `createClient()` (server), `supabase.auth.getUser()`, and redirects to `/login` if no session or `role !== 'admin'`. This check is completely independent from middleware.

**Empty states:** All landing pages render exactly:
- Heading: `{Feature} coming soon`
- Body: `This section is being built. Check back in the next update.`

### Task 3 — Supabase Auth Config Checklist (23e5453, checkpoint:human-action)

`docs/supabase-auth-config.md` created with step-by-step instructions for each dashboard-only setting:

1. Google OAuth — client ID/secret, redirect URI
2. Apple OAuth — Services ID, key, redirect URI
3. Magic link / SMTP — Resend as custom SMTP provider
4. Session duration — JWT expiry 604800s (7 days), refresh token rotation
5. **Realtime private-only — required before Phase 2** (T-04-03 security gate)
6. Allowed redirect URLs — `app.canarypm.ca`, `localhost:3000`

This task is a `checkpoint:human-action` — the checklist is created and committed, but the actual dashboard configuration requires human action in the Supabase Dashboard.

---

## Deviations from Plan

None — plan executed as written. The docs file was created and committed before surfacing the checkpoint so the human has the checklist in hand when they log into the dashboard.

---

## Known Stubs

All portal landing pages are intentional empty scaffolding stubs:
- `/dashboard` — `Dashboard coming soon`
- `/my-home` — `Home coming soon`
- `/portfolio` — `Portfolio coming soon`
- `/jobs` — `My Jobs coming soon`
- `/admin` — `Admin coming soon`

These stubs are the plan's intended output. They will be populated in subsequent plans (05+). User avatar and org name in sidebar are placeholder text (future plans wire real data).

---

## Threat Surface Scan

| Flag | File | Description |
|------|------|-------------|
| None | — | No new threat surface beyond what the plan's threat model covers. Middleware role guards (T-04-01), admin isolation (T-04-02), Realtime private checklist (T-04-03) all implemented as specified. |

---

## Self-Check: PASSED

Files verified:

- src/middleware.ts — exists, contains `getUser`, `app_metadata`, `matcher`
- src/app/(admin)/layout.tsx — exists, contains `getUser`, `admin`
- src/app/(manager)/dashboard/page.tsx — exists, contains `coming soon`
- src/components/layout/ManagerShell.tsx — exists, 140+ lines
- docs/supabase-auth-config.md — exists, contains `private`

Commits verified: fe2a021, 8cb2730, 23e5453
