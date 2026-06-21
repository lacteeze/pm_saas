---
phase: 03-public-listings
plan: "04"
subsystem: public-listings-ui
tags: [listings, public, rsc, supabase, maps]
dependency_graph:
  requires: [03-01, 03-02, 03-03]
  provides: [public-listings-browse, public-listing-detail, createPublicClient, getOrgBySlug]
  affects: [middleware, supabase-types]
tech_stack:
  added: []
  patterns:
    - RSC with anon Supabase client for unauthenticated data fetch
    - x-org-slug header from middleware for org context in public pages
    - Server-side filter form (GET, no JS required)
    - Google Maps Embed API iframe with graceful fallback
key_files:
  created:
    - canary-propos/supabase/migrations/0014_create_listings.sql
    - canary-propos/supabase/migrations/0015_create_inquiries.sql
    - canary-propos/src/lib/supabase/public.ts
    - canary-propos/src/lib/orgs.ts
    - canary-propos/src/app/(public)/layout.tsx
    - canary-propos/src/app/(public)/listings/page.tsx
    - canary-propos/src/app/(public)/listings/[id]/page.tsx
  modified:
    - canary-propos/src/middleware.ts
    - canary-propos/src/types/supabase.ts
decisions:
  - "Used in-memory JS filtering for beds/rent/amenity after a single DB query rather than chaining PostgREST filters, to handle COALESCE of display_rent vs unit.asking_rent cleanly"
  - "Google Maps iframe hidden with a dev placeholder when NEXT_PUBLIC_GOOGLE_MAPS_KEY is unset, rather than rendering a broken embed"
  - "Included migrations 0014/0015 and type updates in this plan because 03-01 had not been executed (no SUMMARY file found), and 03-04 cannot compile without the listings type in supabase.ts"
metrics:
  completed: "2026-06-21"
  tasks_completed: 2
  tasks_total: 2
---

# Phase 03 Plan 04: Public Listings Browse and Detail Pages Summary

Public-facing unauthenticated listings browse page and detail page using RSC + anon Supabase client, with org context from x-org-slug middleware header, server-side filter bar, photo gallery, Google Maps embed, and CTA anchor targets for inquiry/apply forms.

## What Was Built

### Prerequisites created (missing from prior plan executions)

**Migrations (03-01 scope):**
- `0014_create_listings.sql` — listings table with listing_status enum (draft/published/unlisted), RLS: staff full access, anon SELECT published only
- `0015_create_inquiries.sql` — inquiries table with inquiry_type/inquiry_status enums, RLS: staff full access, anon INSERT only

**`src/types/supabase.ts`** — added `listings`, `inquiries` table types and `listing_status`, `inquiry_type`, `inquiry_status` enum types

**`src/lib/supabase/public.ts`** (03-02 scope) — `createPublicClient()`: anon Supabase client with empty cookie handlers, no session

**`src/middleware.ts`** (03-02 scope) — added `isPublicListingsPath()` early-return branch: extracts org slug from subdomain (3+ part hostname) or `?org=` query param (localhost fallback), sets `x-org-slug` header, returns without calling `getUser()`

### Core plan deliverables

**`src/lib/orgs.ts`** — `getOrgBySlug(slug)` resolves org slug → `{ id, name }` via anon client; returns null if slug empty or not found

**`src/app/(public)/layout.tsx`** — minimal public layout: white background, "Rentals" header, no auth nav, no sidebar

**`src/app/(public)/listings/page.tsx`** — RSC browse page:
- Reads `x-org-slug` from `headers()`, calls `getOrgBySlug()`
- Fetches all published listings for org via JOIN: listings → units → properties
- Server-side filter bar (GET form, no JS): minRent, maxRent, beds select, amenity text
- In-memory JS filtering: beds exact match, rent range on `display_rent ?? asking_rent`, amenity substring on `unit.amenities[]`
- Responsive card grid with photo, title, city, beds/baths, rent, available-from badge
- Empty state: "No units available at this time"
- Each card links to `/listings/[id]` with `?org=` passthrough

**`src/app/(public)/listings/[id]/page.tsx`** — RSC detail page:
- Fetches single listing by id + status=published + org_id (T-03-11 enforced)
- Two-column desktop layout (photo gallery left, details right), stacked on mobile
- Photo gallery: first photo large, thumbnails row; grey placeholder if no photos
- Details: title, price (display_rent ?? asking_rent ?? "Price on request"), available-from, beds/baths/sq-ft stats, highlights as amber pill badges, amenities list, description prose
- Google Maps Embed iframe when `NEXT_PUBLIC_GOOGLE_MAPS_KEY` is set; dev placeholder message otherwise
- CTA buttons: "Request a showing" → `#inquiry-form`, "Apply now" → `#apply-form`
- Anchor `<div id="inquiry-form">` and `<div id="apply-form">` as targets for plan 03-05

## Deviations from Plan

### Auto-included missing critical functionality

**1. [Rule 2 - Missing prerequisite] Created listings/inquiries migrations and types**
- **Found during:** Pre-execution check — no SUMMARY for 03-01 or 03-02, `src/types/supabase.ts` missing listings/inquiries types, `src/lib/supabase/public.ts` missing
- **Fix:** Created 0014_create_listings.sql, 0015_create_inquiries.sql, updated supabase.ts with all new types and enums, created public.ts and updated middleware.ts
- **Files modified:** 4 files created/modified from 03-01/03-02 scope
- **Note:** DB push still required — migrations are written but not applied to production. Human must run `npx supabase db push` before the public pages can query the listings table.

## Security Notes

- T-03-11 enforced: all listing queries include `.eq('status', 'published').eq('org_id', resolvedOrgId)` — draft/unlisted rows never returned to anon
- T-03-12 accepted: property photos from public `org-assets` bucket are intentional marketing material
- T-03-10 acknowledged: `NEXT_PUBLIC_GOOGLE_MAPS_KEY` should be restricted to `canarypm.ca/*` referer in Google Cloud Console

## Known Stubs

- `#inquiry-form` and `#apply-form` divs are empty placeholder anchors — forms added in plan 03-05.

## User Setup Required

1. Run `npx supabase db push` from `canary-propos/` to apply migrations 0014 and 0015
2. Set `NEXT_PUBLIC_GOOGLE_MAPS_KEY` in `.env.local` (Google Cloud Console → APIs & Services → Credentials → Maps Embed API key, restricted to `canarypm.ca/*`)

## Self-Check

- [x] 7 files created, 2 modified
- [x] Task 1 commit: d87b0bd
- [x] Task 2 commit: b410478
- [x] Middleware passthrough for /listings paths verified in source
- [x] org_id guard present in both page queries
- [x] status='published' filter present in both page queries

## Self-Check: PASSED
