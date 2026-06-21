---
phase: 03-public-listings
plan: "02"
subsystem: middleware
tags: [middleware, supabase, public-client, subdomain, org-routing]
dependency_graph:
  requires: [03-01]
  provides: [x-org-slug-header, createPublicClient, public-route-passthrough]
  affects: [public-listings-pages]
tech_stack:
  added: []
  patterns: [subdomain-org-routing, anon-supabase-client, public-route-passthrough]
key_files:
  modified:
    - canary-propos/src/middleware.ts
  created:
    - canary-propos/src/lib/supabase/public.ts
decisions:
  - "Public listings routes bypass getUser() entirely — auth cookies never attach to public page responses"
  - "extractOrgSlug() checks parts.length >= 3 to detect subdomain presence; falls back to ?org= on localhost"
  - "app subdomain excluded from subdomain list alongside www/localhost for future app.domain.com routing"
metrics:
  duration: "~10 minutes"
  completed: "2026-06-21"
  tasks_completed: 2
  tasks_total: 2
---

# Phase 03 Plan 02: Subdomain Middleware + createPublicClient() Summary

Subdomain extraction middleware and unauthenticated Supabase client for public listing pages — enabling org-scoped public routes without touching auth state.

## What Was Built

### Task 1: Middleware — subdomain extraction + public route passthrough

Extended `src/middleware.ts` with two new helper functions:

- `isPublicListingsPath(pathname)` — returns true for any path starting with `/listings`
- `extractOrgSlug(request)` — reads the first hostname segment as org slug; falls back to `?org=` query param when no subdomain is detected (localhost, `www`, or `app`)

For `/listings` paths, the middleware sets `x-org-slug` on request headers and returns `NextResponse.next()` immediately — `supabase.auth.getUser()` is never called. All existing auth logic for protected routes is untouched.

### Task 2: createPublicClient() — anon Supabase helper

Created `src/lib/supabase/public.ts` exporting a synchronous `createPublicClient()` function. It uses `createServerClient` with the anon key and empty cookie handlers — no session, no cookie reads or writes. Server Components in the `(public)` route group call this to query listings and submit inquiries under anon RLS policies.

## Deviations from Plan

None — plan executed exactly as written.

The key_context also mentioned `src/lib/orgs.ts` with `getOrgBySlug()`, but this was **not in the PLAN.md tasks list** (the plan only lists `middleware.ts` and `public.ts` in `files_modified`). Not implemented here — correctly deferred to a downstream plan.

Pre-existing TypeScript errors in `src/components/leases/AddLeaseForm.tsx` and `src/app/(manager)/leases/page.tsx` are out of scope (not caused by this plan's changes) and logged as deferred items.

## Known Stubs

None.

## Threat Flags

T-03-05 noted in plan threat model: `?org=` fallback is active on all environments including production in this implementation. The plan explicitly accepts this for Phase 3 since wrong org slug returns only published listings from that org (no sensitive data). A hardening task (NODE_ENV check) is flagged for follow-up.

## Self-Check

- [x] `canary-propos/src/middleware.ts` — modified, `isPublicListingsPath` and `extractOrgSlug` present
- [x] `canary-propos/src/lib/supabase/public.ts` — created, exports `createPublicClient()`
- [x] TypeScript errors in modified files: none (pre-existing errors in unrelated files are out of scope)
