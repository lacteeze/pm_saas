---
phase: 03-public-listings
plan: "03"
subsystem: listings
tags: [listings, properties, crud, manager]
dependency_graph:
  requires: [03-01]
  provides: [manager-listing-crud]
  affects: [properties-detail-page]
tech_stack:
  added: []
  patterns: [server-actions, dialog-form, react-hook-form-manual, tabs]
key_files:
  created:
    - canary-propos/src/app/actions/listings.ts
    - canary-propos/src/components/listings/ListingForm.tsx
  modified:
    - canary-propos/src/app/(manager)/properties/[id]/page.tsx
decisions:
  - "Listings tab added as fourth tab on /properties/[id] (per D-13 locked decision)"
  - "ListingForm uses manual useState pattern (matches existing AddUnitForm pattern) rather than react-hook-form+zodResolver to keep consistency"
  - "toggleListingStatus bound via Server Action form action pattern — no extra client component needed"
  - "Additional create listing button shown below existing listings to allow multi-unit listings on same property"
metrics:
  duration: "~20 min"
  completed: "2026-06-21"
  tasks_completed: 2
  files_changed: 3
---

# Phase 3 Plan 03: Manager Listing CRUD Summary

Listings tab on /properties/[id] — managers can create, edit, and toggle publish status of unit listings within the property detail context.

## What Was Built

**`src/app/actions/listings.ts`** — Three server actions:
- `createListing`: validates with zod, verifies unit belongs to org (T-03-09), inserts with org_id from JWT (T-03-07)
- `updateListing`: same validation + org_id guard on update (T-03-08) + unit ownership check
- `toggleListingStatus`: status flip with org_id guard, revalidates property page

**`src/components/listings/ListingForm.tsx`** — Client Dialog component:
- Props: propertyId, orgId, units[], existingListing (optional edit mode)
- Fields: unit selector, listing_title (required), listing_description (textarea), highlights (comma-separated), display_rent (number), available_from (date), status (draft/published/unlisted)
- Create mode shows "Create listing", edit mode pre-populates and shows "Edit listing"
- On success: toast + router.refresh()

**`/properties/[id]/page.tsx`** — Listings tab added:
- Fourth tab: "Listings (N)" count badge when listings exist
- Queries listings filtered by property's unit_ids + org_id
- Empty state: "No listing yet" with create form (when units exist)
- Listing cards: title, status badge (stone=draft, green=published, amber=unlisted), rent, available date, description preview, highlights chips
- Per-card actions: Publish/Unpublish toggle button (Server Action form binding) + Edit button (ListingForm in edit mode)

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all data is wired to the Supabase listings table. The listings query is live; if no migrations have been applied yet, the page will show empty state gracefully.

## Threat Flags

No new threat surface beyond what was in the plan's threat model (T-03-07, T-03-08, T-03-09 — all mitigated in server actions).

## Self-Check

- [x] `canary-propos/src/app/actions/listings.ts` created
- [x] `canary-propos/src/components/listings/ListingForm.tsx` created
- [x] `canary-propos/src/app/(manager)/properties/[id]/page.tsx` modified with Listings tab
- [x] Three server actions exported: createListing, updateListing, toggleListingStatus
- [x] All server actions have org_id guards (T-03-07, T-03-08, T-03-09)
- [x] ListingForm edit mode pre-populates from existingListing prop
- [x] Publish/Unpublish toggle bound to toggleListingStatus server action

## Self-Check: PASSED
