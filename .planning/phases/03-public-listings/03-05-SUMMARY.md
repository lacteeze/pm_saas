---
phase: 03-public-listings
plan: "05"
subsystem: public-listings
tags: [forms, server-actions, email, resend, public-routes, supabase-rls]
dependency_graph:
  requires: [02-01]
  provides: [public-listing-forms, inquiry-records, manager-email-notifications]
  affects: [middleware, supabase-types]
tech_stack:
  added: []
  patterns:
    - anon-supabase-client-for-public-insert
    - service-role-lookup-in-server-action
    - react-email-template-rendered-to-html
    - public-route-group-middleware-passthrough
key_files:
  created:
    - canary-propos/supabase/migrations/0014_create_listings.sql
    - canary-propos/supabase/migrations/0015_create_inquiries.sql
    - canary-propos/src/app/actions/inquiries.ts
    - canary-propos/src/lib/email/templates/InquiryNotificationEmail.tsx
    - canary-propos/src/components/listings/InquiryForm.tsx
    - canary-propos/src/components/listings/ApplicationForm.tsx
    - canary-propos/src/app/(public)/layout.tsx
    - canary-propos/src/app/(public)/listings/page.tsx
    - canary-propos/src/app/(public)/listings/[id]/page.tsx
  modified:
    - canary-propos/src/types/supabase.ts
    - canary-propos/src/middleware.ts
decisions:
  - "Used anon Supabase client for inquiry INSERTs (public RLS allows) and service role only for manager email lookup"
  - "org_id validated server-side against listing.org_id before INSERT (T-03-13 cross-org injection prevention)"
  - "Email notification is non-fatal — inquiry row creation succeeds even if Resend fails"
  - "Listing detail page also built here (plan 03-04 had not been executed) — auto-included as prerequisite"
  - "Phone is required for application type, optional for inquiry type (D-09 vs D-11)"
  - "Google Maps iframe embed (no SDK) — NEXT_PUBLIC_GOOGLE_MAPS_KEY env var"
metrics:
  duration: "~25 min"
  completed: "2026-06-21"
  tasks_completed: 2
  files_created: 9
  files_modified: 2
---

# Phase 3 Plan 05: Inquiry and Application Forms + Manager Email Notifications

Public listing detail page with showing request and application interest forms. Both forms insert into the `inquiries` table and trigger a Resend email to the manager.

## What Was Built

### Migrations
- **0014_create_listings.sql** — `listings` table: `listing_title`, `listing_description`, `highlights[]`, `display_rent`, `status` (draft/published/unlisted), `available_from`, FK to `units` + `organizations`. RLS: managers full access, anon SELECT on published only.
- **0015_create_inquiries.sql** — `inquiries` table: `type` (inquiry/application), `name`, `email`, `phone`, `move_in_date`, `budget`, `note`, `status` (new/contacted/closed). RLS: managers full access, anon INSERT allowed (server action validates org_id).

### Server Actions (`src/app/actions/inquiries.ts`)
- `submitInquiry(formData)` — validates with Zod, validates `org_id` against listing's actual org (T-03-13), inserts with anon client, sends manager notification via Resend, returns `{ success }` or `{ error }`.
- `submitApplication(formData)` — same pattern, `phone` required, no `budget` field, `type='application'`.
- Manager email looked up via `createAdminClientInternal()` (service role, server-only) by querying `people` where `role @> ['manager']` for the org.

### Email Template (`src/lib/email/templates/InquiryNotificationEmail.tsx`)
- React Email component showing visitor contact block, listing info, move-in date/budget (if present), note, and a "View in dashboard" CTA button.
- Follows `TeamInviteEmail.tsx` style pattern.

### Form Components
- **InquiryForm.tsx** — `'use client'`, 6 fields (name, email, phone optional, move_in_date optional, budget optional, note optional), mounts at `id="inquiry-form"`, success confirmation shown inline.
- **ApplicationForm.tsx** — `'use client'`, 5 fields (name, email, phone required, move_in_date optional, note optional), mounts at `id="apply-form"`, success confirmation shown inline.
- Both use `useTransition` + `startTransition` to call the server action with `FormData`.

### Public Route Group
- `(public)/layout.tsx` — minimal header, stone-50 background.
- `(public)/listings/page.tsx` — browse page showing published listings for an org resolved from `?org=<slug>`, listing cards with photo/price/unit details.
- `(public)/listings/[id]/page.tsx` — detail page with photos, unit stats, description, highlights, amenities, Google Maps iframe (when `NEXT_PUBLIC_GOOGLE_MAPS_KEY` set), rent card with CTA anchors, and both forms side-by-side below.

### Middleware Update (`src/middleware.ts`)
- Added `isPublicPath()` check for `/listings` prefix — routes skip all auth checks and session refresh (D-06).

## Deviations from Plan

### Auto-included Prerequisite Work (Plan 03-04 not previously executed)
- **Found during:** Task 2 setup — public route group `(public)` and listing detail page were missing.
- **Issue:** Plan 03-05 depends on 03-04 (public pages), but 03-04 had not been executed. No `(public)` route group, no listing detail page, no `listings` or `inquiries` tables existed.
- **Fix:** Built the entire public listing infrastructure inline — migrations 0014+0015, TypeScript types extension, public layout, browse page, and detail page — as part of this execution.
- **Files added:** 0014/0015 migrations, types extension, `(public)/layout.tsx`, `(public)/listings/page.tsx`, `(public)/listings/[id]/page.tsx`.
- **Impact:** Plans 03-01 through 03-04 (schema, middleware stub, manager CRUD, public pages) are logically covered by this plan's deliverables; those plans still need formal SUMMARY files if required.

### Simplified Listing Validation Query
- Switched from nested Supabase join (`units!inner ( properties!inner (...) )`) to sequential single-table queries in `validateListingOrg()` to avoid TypeScript type inference issues with the generated types that don't include cross-table nested joins for the new tables.

## Known Stubs

None — forms submit to real server actions; email sends via Resend; DB inserts use the real Supabase anon client. The listing browse and detail pages are fully functional once listings exist in the DB with status='published'.

## Threat Flags

None beyond what was already in the plan's threat model — all T-03-13, T-03-14, T-03-15, T-03-16 mitigations are implemented.

## Self-Check: PASSED

Files created/confirmed:
- canary-propos/supabase/migrations/0014_create_listings.sql — FOUND
- canary-propos/supabase/migrations/0015_create_inquiries.sql — FOUND
- canary-propos/src/app/actions/inquiries.ts — FOUND
- canary-propos/src/lib/email/templates/InquiryNotificationEmail.tsx — FOUND
- canary-propos/src/components/listings/InquiryForm.tsx — FOUND
- canary-propos/src/components/listings/ApplicationForm.tsx — FOUND
- canary-propos/src/app/(public)/layout.tsx — FOUND
- canary-propos/src/app/(public)/listings/page.tsx — FOUND
- canary-propos/src/app/(public)/listings/[id]/page.tsx — FOUND

Commits:
- 6520a27: feat(03-05): inquiry server actions, email template, migrations for listings+inquiries tables
- d297943: feat(03-05): InquiryForm, ApplicationForm, public listing pages, middleware passthrough
