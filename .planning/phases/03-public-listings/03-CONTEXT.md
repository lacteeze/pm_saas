# Phase 3: Public Listings - Context

**Gathered:** 2026-06-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Unauthenticated visitors can browse published available units, view detailed listing pages with photos and a map, submit inquiries/showing requests, and register interest in applying — all without a sign-in. Managers can publish/unpublish listings from the manager portal and receive in-app + email notifications when inquiries or applications come in.

**In scope:** Listings table + CRUD, public listings browse page, listing detail page (photos, description, map embed), inquiry form, application interest capture (name/email/phone), manager publish/unpublish UI, in-app + email notifications, subdomain-based org routing.

**Out of scope:** Full tenant screening API integration with Single Key/Plaid (Phase 3.5 or Phase 4 — deferred by decision D-08), PDF document collection (Phase 10), credit check/income verification in Phase 3.

</domain>

<decisions>
## Implementation Decisions

### Listing Data Model
- **D-01:** Separate `listings` table — listings are distinct from units. A unit can exist without a listing; a listing is created by a manager when they want to market a unit. FK: `unit_id` → `units.id` (one listing per unit, unique constraint).
- **D-02:** Listing fields beyond the unit: `listing_title` (text), `listing_description` (text), `highlights` (text[]), `display_rent` (numeric, nullable — overrides unit.asking_rent for public display), `status` (enum: draft/published/unlisted), `available_from` (date, nullable), `org_id` (for RLS).
- **D-03:** Published listing inherits from unit: bedrooms, bathrooms, sq_footage, amenities, status. Inherits from property: address, city, province, photos. Manager can override rent for display via `display_rent`.

### Public URL Structure
- **D-04:** Listings live in the same Next.js app (not a separate site): `app.canarypm.ca/listings` → multi-org by subdomain — e.g. `canary.canarypm.ca/listings`. No separate deployment needed.
- **D-05:** Subdomain routing: middleware extracts subdomain from the request hostname, looks up `organizations.slug`, passes org context to the public listing pages. Subdomain `canary` → org where `slug = 'canary'`. Localhost dev: use query param `?org=canary` as fallback for local testing since subdomains don't resolve locally without hosts file edits.
- **D-06:** Route group `(public)` for unauthenticated listing pages — middleware must explicitly skip auth for these routes. Routes: `/listings`, `/listings/[id]`.
- **D-07:** RLS consideration: public listings query uses a server-side Supabase call with `anon` key filtered to `org_id` derived from slug lookup — no user JWT required. Only `status = 'published'` rows are returned.

### Map on Detail Page
- **D-08-map:** Google Maps Embed API via iframe — no SDK or npm package. Pass `property.address + city + province` as the query. API key stored in `NEXT_PUBLIC_GOOGLE_MAPS_KEY` env var. Free tier sufficient for v1 volume.

### Application Flow (Tenant Screening)
- **D-08:** Single Key or Plaid API for tenant screening — decision deferred pending researcher API comparison. Do NOT build a full application form in Phase 3.
- **D-09:** Phase 3 "Apply" button captures: name, email, phone, desired move-in date, note. Creates a record in a new `inquiries` table with `type = 'application'`. Manager sees it in-app. Full screening (credit, income, identity via Single Key or Plaid) is a subsequent phase.
- **D-10:** `inquiries` table covers both inquiry/showing requests (type = 'inquiry') and application interest (type = 'application'). Fields: id, org_id, listing_id, type, name, email, phone, move_in_date, budget (for inquiries), note, created_at, status (new/contacted/closed).

### Inquiry Form
- **D-11:** Inquiry/showing request form (LIST-04): name, email, phone, desired move-in date, budget, rental criteria (free text note). Maps to `inquiries` table with `type = 'inquiry'`.

### Notifications (Phase 3 scope)
- **D-12:** When an inquiry or application is submitted, send an email to the manager via Resend and create an in-app record. Email: simple transactional template (inquiry details, listing address, visitor contact). In-app: shown as a count/badge on the manager dashboard (no real-time; server-rendered on next page load). Full notification system (Realtime, SMS) is Phase 10.

### Listing Management (Manager Portal)
- **D-13:** Manager creates/edits listings from within the property detail page (`/properties/[id]`). A "Listings" tab on the property detail shows the current listing (or a "Create listing" prompt if none). Publish/unpublish toggle. No separate `/listings` manager route — listings are managed in the context of their property.

### Claude's Discretion
- Filter UI on the public listings page (price slider vs. input range, mobile collapse behavior)
- Listing card design on the browse page
- Inquiry confirmation message shown to visitor after submission
- Empty state for the public listings page when no units are published

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` §LISTINGS — LIST-01 through LIST-07

### Phase 2 Decisions (schema to build on)
- `.planning/phases/02-core-data-model/02-CONTEXT.md` — D-01 through D-10 (properties/units/portfolios/people schema)
- `.planning/phases/02-core-data-model/02-01-SUMMARY.md` — schema that was actually built (properties, units, portfolios, leases migrations)

### Existing Code
- `canary-propos/src/middleware.ts` — extend to handle (public) route group + subdomain org lookup
- `canary-propos/src/app/(manager)/properties/[id]/page.tsx` — add Listings tab here (D-13)
- `canary-propos/src/types/supabase.ts` — current DB types (reference for new table types)
- `canary-propos/src/components/ui/` — existing component set

### External APIs to Research
- Single Key tenant screening API: https://singlekey.com (researcher must evaluate for Phase 3.5)
- Plaid income/identity verification API: https://plaid.com/products/income/ (alternative to Single Key)
- Google Maps Embed API docs (for D-08-map)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `properties/[id]/page.tsx` — tabs pattern to extend with a Listings tab (D-13)
- `src/components/leases/ExpiryAlertCallout.tsx` — model for a notification callout component
- `org-assets` storage bucket — property photos already stored here; listings page reads these
- `src/lib/supabase/server.ts` — server client (use with anon key for public pages, no session required)
- `src/components/ui/` — card, badge, dialog, select, form, button, input, separator, tabs all available

### Established Patterns
- RSC page → fetch server-side → render with no client waterfall
- `(public)` route group: add to middleware skip list (alongside `(auth)`)
- Subdomain → org slug → org_id lookup: new pattern; middleware is the right place
- Server actions for form submissions (inquiry/application interest) — follow contacts.ts pattern

### Integration Points
- `middleware.ts`: add subdomain extraction + public route passthrough
- `organizations` table: slug column already set during onboarding (Phase 1)
- `units` table: status/asking_rent/bedrooms/bathrooms/photos feed into listings
- `properties` table: address/city/province/photos for listing context
- Manager dashboard: add inquiry count badge/card (D-12)

</code_context>

<specifics>
## Specific Ideas

- Public listings page at `{slug}.canarypm.ca/listings` — org identified by subdomain
- Listing detail at `{slug}.canarypm.ca/listings/{listing_id}`
- "Apply" button: captures name/email/phone + creates inquiry record type='application'; no screening in Phase 3
- Manager sees new inquiries as a card on the dashboard and a count in the manager portal
- Google Maps embed iframe (no SDK) on listing detail page
- Localhost dev: `?org=canary` query param fallback since subdomains don't resolve locally
- Listing managed from within /properties/[id] detail page — new "Listing" tab

</specifics>

<deferred>
## Deferred Ideas

- Single Key / Plaid tenant screening API integration (Phase 3.5 or Phase 4)
- Real-time in-app notifications for new inquiries (Phase 10)
- SMS notifications for inquiries via Pingram (Phase 10)
- Custom domain support per org (e.g. rentals.canaryrealty.com) — post-v1
- Multi-language listing pages — post-v1
- Listing performance analytics (views, inquiry conversion) — post-v1

</deferred>

---

*Phase: 3-Public Listings*
*Context gathered: 2026-06-21*
