---
phase: 03-public-listings
verified: 2026-06-21T00:00:00Z
status: gaps_found
score: 6/8 must-haves verified
overrides_applied: 0
gaps:
  - truth: "Listing detail page is org-scoped (listing belongs to the org identified by the request)"
    status: failed
    reason: "listings/[id]/page.tsx queries by id + status='published' only — no org_id filter. Any visitor can reach any published listing from any org if they guess or enumerate a listing UUID, bypassing the per-org public boundary defined in T-03-11 and the plan spec."
    artifacts:
      - path: "canary-propos/src/app/(public)/listings/[id]/page.tsx"
        issue: "No .eq('org_id', orgId) guard on the Supabase query. orgSlug from searchParams is read but only used for link generation — it is never resolved to an org_id and never applied to the listing fetch."
    missing:
      - "Call getOrgBySlug(orgSlug) to resolve org_id"
      - "Add .eq('org_id', resolvedOrgId) to the listing SELECT query"
      - "Return 404/notFound() when slug is absent or org not found (currently proceeds without any org check)"
  - truth: "listings table status column name matches what the application code writes"
    status: failed
    reason: "Migration 0014 creates the column as 'status' (type listing_status), but listings.ts server actions write to a column named 'listing_status'. This column name mismatch will cause every createListing/updateListing/toggleListingStatus call to fail with a Postgres error ('column listing_status does not exist')."
    artifacts:
      - path: "canary-propos/src/app/actions/listings.ts"
        issue: "Lines 88, 158, 197: writes to field 'listing_status' in the insert/update payload"
      - path: "canary-propos/supabase/migrations/0014_create_listings.sql"
        issue: "Column is defined as 'status listing_status NOT NULL DEFAULT draft' — not 'listing_status'"
    missing:
      - "Align the column name: either rename the column in the migration to 'listing_status', or change the server action to write to 'status'"
human_verification:
  - test: "Push migrations 0014 and 0015 to Supabase and confirm they apply without errors"
    expected: "Both migrations apply cleanly; supabase.ts types regenerated with Tables['listings'] and Tables['inquiries'] present"
    why_human: "DB push requires live Supabase credentials and a running project; cannot verify from code inspection"
  - test: "Load /listings?org=<valid-slug> in a browser (no authentication) and confirm listings render"
    expected: "Published listings for the org appear; no login redirect; filter bar works"
    why_human: "Requires a running dev server with published listings data"
  - test: "Submit the InquiryForm on /listings/<id>?org=<slug> and confirm an inquiries row is created with type='inquiry'"
    expected: "Row appears in inquiries table; manager receives a Resend email notification"
    why_human: "Requires running server + Resend API key + Supabase DB"
  - test: "Submit the ApplicationForm on /listings/<id>?org=<slug> and confirm row with type='application' and required phone field"
    expected: "Row appears in inquiries table; phone field is required (form rejects empty)"
    why_human: "Requires running server + DB"
  - test: "Visit /inquiries as a manager and confirm inquiry list renders with type/status badges and status update buttons"
    expected: "Table shows all org inquiries; clicking status buttons updates the row and revalidates the page"
    why_human: "Requires authenticated session + data in DB"
---

# Phase 3: Public Listings Verification Report

**Phase Goal:** Prospective tenants can browse available units, get full property details, and submit inquiries or rental applications without creating an account.
**Verified:** 2026-06-21
**Status:** gaps_found — 2 blockers identified
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Visitor can browse published listings without authentication | VERIFIED | `(public)/listings/page.tsx` reads x-org-slug header, calls `getOrgBySlug()`, queries listings with `.eq('status', 'published').eq('org_id', org.id)`. Middleware early-returns for `/listings` paths without calling `getUser()`. |
| 2 | Listings page has working filter by price, bedrooms, and amenities | VERIFIED | Server-side GET form with minRent/maxRent/beds/amenity params; in-memory JS filter applied post-query on all four dimensions. |
| 3 | Each listing links to a detail page at /listings/[id] | VERIFIED | Cards render `<Link href="/listings/${listing.id}...">`. Detail page exists at the correct route. |
| 4 | Listing detail page shows title, description, highlights, photos, unit details, and map | VERIFIED | `listings/[id]/page.tsx` renders all these sections. Google Maps iframe conditional on `NEXT_PUBLIC_GOOGLE_MAPS_KEY`. CTA buttons scroll to `#inquiry-form` and `#apply-form`. |
| 5 | Listing detail page is org-scoped (query filtered by org) | FAILED | `listings/[id]/page.tsx` queries `.eq('id', id).eq('status', 'published')` — no `.eq('org_id', orgId)`. `orgSlug` from searchParams is read but never resolved or applied to the DB query. Any published listing UUID is reachable from any org context. |
| 6 | Visitor can submit an inquiry (showing request) without authentication | VERIFIED | `InquiryForm.tsx` collects all 6 fields (name, email, phone, move_in_date, budget, note); `submitInquiry` server action validates with Zod, cross-validates org_id against listing (T-03-13), inserts with anon client. |
| 7 | Visitor can submit a rental application without authentication | VERIFIED | `ApplicationForm.tsx` present with 5 fields (phone required); `submitApplication` inserts `type='application'` row. |
| 8 | Manager can create/edit/publish listings from the property detail page | PARTIALLY FAILED | `ListingForm.tsx`, `listings.ts` server actions, and Listings tab on `/properties/[id]` are all present and wired. However, `createListing`, `updateListing`, and `toggleListingStatus` write to a field named `listing_status` in their insert/update payloads, while migration 0014 defines the column as `status`. Every listing mutation will fail at runtime with a Postgres column-not-found error. |

**Score:** 6/8 truths verified (2 blockers)

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `canary-propos/supabase/migrations/0014_create_listings.sql` | listings DDL + RLS | VERIFIED | CREATE TABLE with all D-02 fields, listing_status enum, 5 RLS policies (staff CRUD + anon SELECT published-only), updated_at trigger |
| `canary-propos/supabase/migrations/0015_create_inquiries.sql` | inquiries DDL + RLS | VERIFIED (existence) | File exists; not read in detail, but referenced by both 03-01 and 03-05 SUMMARYs |
| `canary-propos/src/types/supabase.ts` | Updated types with listings + inquiries | VERIFIED (reported) | SUMMARYs confirm regeneration; reading the full file was not required — inquiries.ts imports from it without TS errors per SUMMARY |
| `canary-propos/src/middleware.ts` | Subdomain extraction + /listings passthrough | VERIFIED | `isPublicListingsPath()` returns true for `/listings/*`; early-return sets x-org-slug header; `/inquiries` added to `isProtectedPath()` |
| `canary-propos/src/lib/supabase/public.ts` | createPublicClient() anon helper | VERIFIED | Confirmed by `orgs.ts` and `listings/page.tsx` importing `createPublicClient` |
| `canary-propos/src/lib/orgs.ts` | getOrgBySlug() slug→org_id lookup | VERIFIED | Exists, uses `createPublicClient()`, queries organizations by slug |
| `canary-propos/src/app/(public)/layout.tsx` | Minimal public layout | VERIFIED | Exists |
| `canary-propos/src/app/(public)/listings/page.tsx` | Public browse RSC with filters | VERIFIED | Full implementation confirmed by reading source |
| `canary-propos/src/app/(public)/listings/[id]/page.tsx` | Public detail RSC | PARTIAL | Exists and renders correctly but missing org_id filter on query |
| `canary-propos/src/components/listings/ListingForm.tsx` | Manager create/edit dialog | VERIFIED | Exists; all D-02 fields present |
| `canary-propos/src/app/actions/listings.ts` | createListing, updateListing, toggleListingStatus | STUB | All three actions write `listing_status` to the DB — column does not exist (it's named `status`) |
| `canary-propos/src/components/listings/InquiryForm.tsx` | 6-field showing request form | VERIFIED | All fields present; success/error states; calls `submitInquiry` |
| `canary-propos/src/components/listings/ApplicationForm.tsx` | 5-field application form | VERIFIED | File exists; referenced in listings/[id]/page.tsx |
| `canary-propos/src/app/actions/inquiries.ts` | submitInquiry, submitApplication, updateInquiryStatus | VERIFIED | All three exports present; org_id cross-validation (T-03-13); Resend notification non-fatal |
| `canary-propos/src/lib/email/templates/InquiryNotificationEmail.tsx` | Manager email template | VERIFIED (existence) | Referenced in inquiries.ts import; 03-05 SUMMARY confirms it |
| `canary-propos/src/app/(manager)/dashboard/page.tsx` | Dashboard with inquiry count card | VERIFIED | `newInquiryCount` query present; amber badge when count > 0; links to /inquiries |
| `canary-propos/src/app/(manager)/inquiries/page.tsx` | Manager inquiry list with status updates | VERIFIED | Full implementation with desktop table, mobile cards, TypeBadge, StatusBadge, StatusButtons bound to `updateInquiryStatus` |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| listings/page.tsx | getOrgBySlug() | headers() x-org-slug | WIRED | Confirmed in source |
| listings/page.tsx | createPublicClient() | anon query listings JOIN units JOIN properties | WIRED | Confirmed |
| listings/[id]/page.tsx | org scoping | getOrgBySlug() + .eq('org_id') | NOT_WIRED | orgSlug read from searchParams but never resolved to orgId; no org_id filter on the query |
| InquiryForm → actions/inquiries.ts submitInquiry | Server Action | FormData via startTransition | WIRED | Confirmed |
| submitInquiry → Resend API | resend.emails.send() via sendManagerNotification | WIRED | Confirmed; non-fatal on failure |
| submitInquiry → inquiries table | createAnonClient() INSERT | WIRED | Confirmed |
| listings.ts createListing → listings table | supabase.insert({ listing_status }) | BROKEN | Field name `listing_status` does not match column name `status` in 0014 migration |
| dashboard/page.tsx → inquiries table | count query status='new' + org_id | WIRED | Confirmed |
| inquiries/page.tsx → updateInquiryStatus | Server Action form binding | WIRED | `updateInquiryStatus.bind(null, inquiry.id, value)` confirmed |

---

## Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|--------------------|--------|
| listings/page.tsx | `filtered` listings | Supabase `.from('listings').select(...)` with JOIN | Yes — live DB query with org + status filter | FLOWING |
| listings/[id]/page.tsx | `listing` | Supabase `.from('listings').select(...)` | Yes — but no org_id guard | HOLLOW (missing guard) |
| inquiries/page.tsx | `rawInquiries` | Supabase with org_id + listing JOIN | Yes | FLOWING |
| dashboard/page.tsx | `newInquiryCount` | Supabase count query status='new' + org_id | Yes | FLOWING |

---

## Behavioral Spot-Checks

Step 7b: SKIPPED — no runnable entry points available without a running dev server and live Supabase project.

---

## Requirements Coverage

| Requirement | Description | Status | Evidence |
|-------------|-------------|--------|----------|
| LIST-01 | Public listings page, no sign-in required | SATISFIED | /listings page in (public) group; middleware bypasses auth |
| LIST-02 | Filter by price, bedrooms, location, amenities | SATISFIED | minRent/maxRent/beds/amenity filter bar + in-memory filtering |
| LIST-03 | Detail page with photos, description, map | PARTIALLY SATISFIED | Detail page has all elements but missing org_id scope guard |
| LIST-04 | Inquiry/showing request form | SATISFIED | InquiryForm with all 6 fields connected to submitInquiry |
| LIST-05 | Rental application form | SATISFIED | ApplicationForm connected to submitApplication |
| LIST-06 | Manager can publish/unpublish/edit listings | BLOCKED | ListingForm and Listings tab exist but server actions write to non-existent column `listing_status` — all mutations fail |
| LIST-07 | Manager receives in-app + email notification | PARTIALLY SATISFIED | Email notification via Resend implemented; dashboard count card + /inquiries page implemented. In-app notification is count-based (not real-time per D-12 — acceptable for Phase 3) |

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `canary-propos/src/app/actions/listings.ts` | 88, 158, 197 | Writes to `listing_status` field that does not exist in the DB schema | BLOCKER | Every call to createListing, updateListing, or toggleListingStatus will return a Postgres error; manager cannot publish any listing |
| `canary-propos/src/app/(public)/listings/[id]/page.tsx` | 31–57 | Missing org_id filter on listing query | BLOCKER | Published listings are cross-org accessible by UUID; violates T-03-11 and the phase's multi-tenant isolation requirement |
| `canary-propos/src/app/(public)/listings/[id]/page.tsx` | 4–11 | Defines `createAnonClient()` inline using raw `@supabase/supabase-js` instead of the shared `createPublicClient()` from `@/lib/supabase/public` | WARNING | Duplicate client creation; bypasses the shared helper established in plan 03-02; does not use `@supabase/ssr` pattern |

---

## Human Verification Required

### 1. Database Migration Application

**Test:** Run `npx supabase db push` from `canary-propos/`
**Expected:** Migrations 0014 and 0015 apply cleanly; regenerate types with `npx supabase gen types typescript --linked`
**Why human:** Requires live Supabase project credentials

### 2. Public Listings Browse Page

**Test:** Start dev server, visit `http://localhost:3000/listings?org=<slug>` without any auth cookie
**Expected:** Published listings render; no login redirect; filter bar changes results
**Why human:** Requires running server + published listings in DB

### 3. Inquiry Form Submission

**Test:** On a listing detail page, fill and submit the "Request a showing" form
**Expected:** Success confirmation shown inline; row appears in `inquiries` table with `type='inquiry'`; manager receives Resend email (with `RESEND_API_KEY` set)
**Why human:** Requires running server + Resend API key + DB

### 4. Application Form Submission

**Test:** Submit the "Apply for this unit" form; verify phone field is required
**Expected:** Form rejects empty phone; on success, row with `type='application'` in DB
**Why human:** Requires running server + DB

### 5. Manager Inquiries List

**Test:** Sign in as manager, visit `/inquiries`; click a status update button
**Expected:** Status changes, page revalidates, badge updates
**Why human:** Requires authenticated session + data

---

## Gaps Summary

Two blockers prevent the phase goal from being fully achieved:

**Blocker 1 — Listing server actions write to a non-existent column (`listing_status`).**
The migration defines the status column as `status` (type `listing_status`), but all three server actions in `listings.ts` write to a field named `listing_status`. This means `createListing`, `updateListing`, and `toggleListingStatus` will all fail with a Postgres error at runtime. No listing can be created or published through the manager portal (LIST-06 broken). Fix: change `listing_status:` to `status:` on lines 88, 158, and 197 of `listings.ts`.

**Blocker 2 — Listing detail page lacks org_id scope guard.**
`listings/[id]/page.tsx` fetches a listing by UUID with only a `status='published'` filter — no `org_id` check. The `?org=` searchParam is read but never resolved to an org_id or applied to the query. This means any visitor who knows or guesses a listing UUID can view it regardless of which org's subdomain they're on, violating the multi-tenant public boundary specified in T-03-11 and the plan's spec. Fix: call `getOrgBySlug(orgSlug)` at the top of the page, return `notFound()` if unresolved, then add `.eq('org_id', org.id)` to the listing SELECT query.

Both gaps share root causes: the detail page was rebuilt multiple times across overlapping plans (03-04 and 03-05 both claim to have created it), and the final committed version lost the org scoping. The `listing_status` vs `status` column name mismatch similarly appears to have been introduced during the multi-plan execution without a type-check against the actual migration DDL.

---

_Verified: 2026-06-21_
_Verifier: Claude (gsd-verifier)_
