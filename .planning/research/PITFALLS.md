# Domain Pitfalls: Property Management SaaS

**Domain:** Multi-tenant property management SaaS
**Stack context:** Next.js 15 / Supabase (PostgreSQL + RLS + Storage + Auth) / Stripe / Canada (PIPEDA, provincial tenancy law)
**Researched:** 2026-06-19
**Confidence:** HIGH (multi-tenant RLS, Stripe payments — verified against official docs); MEDIUM (Canadian law, UX patterns — grounded in domain knowledge and regulatory sources)

---

## CRITICAL PITFALLS

Mistakes that cause data leakage, financial loss, legal liability, or mandatory rewrites.

---

### C1: RLS Enabled But No Policies Written = Full Lockout (Or Silently Open)

**What goes wrong:**
Enabling RLS on a table without defining any policies does not default to "open" — it defaults to deny-all for the `anon` and `authenticated` roles. Every query returns zero rows with no error. This looks like a bug ("data isn't saving") rather than a security configuration problem, causing developers to disable RLS entirely and ship an unprotected table.

The opposite also occurs: a new table is created during a feature sprint, RLS is never enabled, and all data is exposed to any authenticated user across all organizations.

**Why it happens:**
- Supabase's Table Editor creates tables without RLS by default
- Dashboard SQL editor changes bypass migration tracking
- Developers test with the service_role key (which bypasses RLS) and never catch the gap

**Consequences:**
- Cross-organization data exposure — any authenticated user can query any organization's tenants, leases, payments, documents
- Silent data loss appearance causes debugging time wasted in wrong direction
- Discovered by a curious user or a penetration test after launch

**Prevention:**
- Use a database linter or CI check that asserts every table in `public` schema has `row_security = on`
- Never use the Dashboard SQL editor for schema changes in production — all schema changes go through migration files
- Run a test suite that authenticates as a non-member org user and asserts zero rows returned on every protected table
- Template all new tables with RLS enabled and a deny-all baseline before adding permissive policies

**Warning signs:**
- Any query returning "no results" immediately after adding a new feature
- Test data only visible when using service_role key in testing
- Developer says "I had to disable RLS to get it working"

**Phase to address:** Foundation / Data Model phase. Every table created must have RLS on and at minimum an org-isolation policy before any portal feature is built on top of it.

---

### C2: RLS Policy References `auth.uid()` Without `(select ...)` Wrapper = Full Table Scan

**What goes wrong:**
RLS policies that call `auth.uid()` directly inside a `USING` clause without wrapping it in `(select auth.uid())` cause PostgreSQL to re-evaluate the function for every row scanned, not once per query. On tables with thousands of records, this turns sub-millisecond queries into seconds-long scans. The problem is invisible in development with small datasets but catastrophic in production.

Official Supabase documentation explicitly flags this pattern:

```sql
-- BAD: auth.uid() called per-row
create policy "tenant isolation" on leases
  using (org_id in (select org_id from org_members where user_id = auth.uid()));

-- GOOD: auth.uid() called once, result reused
create policy "tenant isolation" on leases
  using (org_id in (select org_id from org_members where user_id = (select auth.uid())));
```

The join-per-row variant is even worse:
```sql
-- CATASTROPHIC: join evaluated per row
using (auth.uid() in (select user_id from org_members where org_members.org_id = leases.org_id))
```

**Why it happens:**
- Natural-looking SQL syntax; the distinction is non-obvious to developers unfamiliar with PostgreSQL RLS internals
- Development datasets too small to reveal the problem before launch

**Consequences:**
- Dashboard loads that take 200ms in dev take 8-15 seconds in production
- Every portal page timed to a database query becomes unusable as data grows
- Difficult to diagnose — looks like Supabase is slow, not that policies are wrong

**Prevention:**
- Establish a policy template at project start with the `(select auth.uid())` pattern enforced
- Add a pg_stat_statements query to CI/staging that flags any policy with execution time over threshold
- Load test with realistic row counts (10,000+ rows per org) before launch

**Warning signs:**
- Queries fast with service_role but slow with authenticated user
- Performance degrades linearly as row count grows
- `EXPLAIN ANALYZE` shows RLS filter evaluated per-row

**Phase to address:** Foundation / Data Model phase. Establish the correct pattern in the first migration. Review every new policy added during feature phases.

---

### C3: service_role Key Leaked to Client-Side Code

**What goes wrong:**
The Supabase `service_role` key (or its replacement `sb_secret_...` key) bypasses all RLS policies. If this key appears in any client-side code, environment variable accessible to the browser, or is committed to a public git repository, any user can make arbitrary read/write/delete queries against any organization's data.

This is a complete and immediate security incident requiring credential rotation and a full data audit.

**Why it happens:**
- Copy-paste from server-side API route into a client component
- `.env.local` committed to a public GitHub repo
- Next.js app with an `NEXT_PUBLIC_` prefix on the service key (exposes it to the browser bundle)
- Supabase Edge Function that echoes environment variables in error responses

**Consequences:**
- Total multi-tenant data breach — every organization's data is accessible
- PIPEDA breach notification obligation (72 hours to OPC if risk of significant harm)
- Loss of all customer trust; likely business-ending for a SaaS startup

**Prevention:**
- Never name the service key with `NEXT_PUBLIC_` prefix
- Add `SUPABASE_SERVICE_ROLE_KEY` to `.gitignore` patterns and run `git-secrets` or similar pre-commit hooks
- Server-side only: service_role client is created only in API routes, Server Components, or Edge Functions — never in any file that runs in the browser
- Supabase dashboard: monitor API key usage for anomalous patterns

**Warning signs:**
- Service key appears in Next.js `_next/static` bundle (check with browser dev tools > Network > filter for `sbp_` or `sb_secret`)
- Any `NEXT_PUBLIC_SUPABASE_SERVICE_KEY` variable name in codebase
- API routes not using the authenticated user context when they should

**Phase to address:** Foundation phase. Establish server/client Supabase client split in the first commit. Never revisit.

---

### C4: Storage Buckets Without Per-Org File Path Isolation

**What goes wrong:**
Supabase Storage RLS policies on `storage.objects` must scope access by file path, not just bucket membership. If all organizations store files in the same bucket with only bucket-level RLS, any authenticated user can construct a file URL to access another org's lease PDFs, inspection photos, or owner statements.

The correct pattern requires org-scoped folder structure:
```
/{org_id}/leases/{lease_id}.pdf
/{org_id}/inspections/{inspection_id}/photo1.jpg
/{org_id}/statements/{statement_id}.pdf
```

And RLS policies that verify:
```sql
(storage.foldername(name))[1] = (select get_user_org_id())
```

**Why it happens:**
- Storage RLS is separate from database RLS — developers who set up table policies forget storage has its own policy system
- Signed URLs generated without verifying the requesting user belongs to the org that owns the file

**Consequences:**
- Tenant A can access Tenant B's lease documents, personal inspection photos, and financial statements
- PIPEDA violation for personal information disclosure without consent
- Potential provincial tenancy law violation (tenant personal data exposure)

**Prevention:**
- Enforce org-prefixed paths at the upload layer before files reach storage
- Add RLS policies on `storage.objects` scoped to `(storage.foldername(name))[1] = org_id`
- Before generating a signed URL, verify the requesting user's org matches the file's org prefix
- Integration test: attempt cross-org file access with a different org's authenticated user

**Warning signs:**
- Storage bucket has no RLS policies
- File paths do not include org_id as the first segment
- Signed URLs generated directly from file paths passed in by the client

**Phase to address:** Foundation / Storage setup. Must be in place before any file upload feature ships.

---

### C5: Stripe Webhook Events Processed Without Idempotency = Double-Credited Payments

**What goes wrong:**
Stripe delivers webhook events with at-least-once semantics — the same event can arrive multiple times (network retry, Stripe retry on non-200 response). If the webhook handler writes a payment record to the database on every event receipt without checking for duplicates, the same rent payment gets credited twice. The tenant's ledger shows two payments; the owner gets disbursed for a payment that only arrived once.

The inverse also breaks things: if the webhook handler times out after debiting but before responding 200, Stripe retries and the debit is processed twice.

**Why it happens:**
- Webhook handler implemented as a simple "receive event → write record" without idempotency check
- Transient database connection failure causes handler to error, Stripe retries, second write succeeds

**Consequences:**
- Tenant ledger shows phantom credits; owner disbursed more than collected
- Financial reconciliation is a manual nightmare to untangle
- Repeated for every affected tenant; scales with payment volume

**Prevention:**
- Store Stripe event IDs in a `processed_webhook_events` table with a unique constraint on `stripe_event_id`
- Webhook handler: attempt insert of event ID first; if unique constraint violation, return 200 immediately and skip processing
- Use database transactions: event ID insert + payment record creation in one atomic operation
- Test by replaying the same event twice against staging and asserting single payment record

**Warning signs:**
- Webhook handler does not log or store received event IDs
- Payment records have no `stripe_payment_intent_id` or `stripe_event_id` for deduplication
- No unique constraint on payment event references

**Phase to address:** Payments phase. Build idempotency in before any payment processing goes live.

---

### C6: ACH / ACSS Debit "Succeeded" Is Not Final — Disbursing Before Funds Settle

**What goes wrong:**
Stripe ACH (US) and ACSS Debit (Canada) payments report `payment_intent.succeeded` but the funds are not immediately settled. ACH has a multi-day return window (up to 5 business days for standard returns, 60+ days for unauthorized claim returns). ACSS has similar characteristics. If an owner disbursement is triggered the same day a `payment_intent.succeeded` event arrives, the disbursement goes out before the actual funds land in the Stripe balance.

If the ACH payment later returns (NSF, account closed, unauthorized), the disbursed funds have already left the platform. Recovery from the owner is a manual collections problem.

**Why it happens:**
- Developers treat `payment_intent.succeeded` the same as a card payment success (which settles within 2-3 days)
- Disbursement automation triggered on payment success event without settlement delay logic

**Consequences:**
- Platform liable for unsettled funds that were disbursed
- Owner statements sent for payments that later reverse
- Financial loss on every returned ACH/ACSS payment

**Prevention:**
- Implement a disbursement hold period (minimum 5 business days for ACH/ACSS) between payment success and owner disbursement
- Track payment status through `charge.succeeded`, monitor for `charge.dispute.created` and return events
- Never auto-disburse on the day of payment success for bank transfer methods
- Explicitly document to property managers that Interac e-transfer manual entries should only be logged after the transfer is confirmed in the bank account

**Warning signs:**
- Disbursement triggered directly from `payment_intent.succeeded` webhook for non-card methods
- No hold period in disbursement calculation logic
- No handling for `charge.dispute.created` events in webhook code

**Phase to address:** Payments phase, specifically the disbursement calculation feature.

---

### C7: Multi-Tenancy Bypassed in Server-Side API Routes Using service_role Client

**What goes wrong:**
Server-side API routes (Next.js Route Handlers, Server Actions) often use the service_role Supabase client for legitimate admin operations. If those routes do not independently verify that the requesting user belongs to the organization whose data they are accessing, a user from Org A can call the API with Org B's IDs and receive Org B's data — completely bypassing RLS because the service_role client doesn't enforce it.

Example: `GET /api/properties/:propertyId` fetches property using service_role client. Attacker sends a valid JWT from Org A with Org B's `propertyId`. Route returns Org B's property.

**Why it happens:**
- Developer relies on RLS for browser queries but uses service_role in API routes "for performance" or to avoid RLS complexity
- Input validation checks that `propertyId` exists but not that it belongs to the requesting user's org

**Consequences:**
- IDOR (Insecure Direct Object Reference) vulnerability across every API route using service_role without org ownership checks
- Data from any organization accessible to any authenticated user who can guess or enumerate IDs (UUIDs are not secret)

**Prevention:**
- Establish a rule: API routes that need service_role must explicitly verify org membership: `assert resource.org_id === user.org_id`
- Better default: use the authenticated user's Supabase client (with their JWT) in API routes; RLS handles isolation automatically
- Service_role client only for operations that genuinely need elevated privileges (cross-org admin, billing), never for data retrieval scoped to one org

**Warning signs:**
- API route fetches by ID without a WHERE clause including org_id
- Server action accepts org-scoped resource IDs without verifying ownership
- `createClient(url, serviceKey)` used in data-fetching routes

**Phase to address:** Foundation and every subsequent feature phase. Code review checklist item on every PR.

---

## MODERATE PITFALLS

Mistakes that cause significant friction, incorrect data, or user churn — fixable without a full rewrite but costly.

---

### M1: Interac E-Transfer Gmail Parsing Treated as Authoritative Payment Confirmation

**What goes wrong:**
Gmail inbox parsing is inherently unreliable as a payment confirmation mechanism. E-transfer notification emails can be:
- Delayed (Gmail API polling is not real-time)
- Filtered by Gmail before the app sees them
- Modified by the sender's bank in format (RBC, TD, Scotiabank, credit unions all format differently)
- Absent entirely (tenant uses Interac via a banking app that sends only a push notification)

If the system treats a parsed e-transfer email as a confirmed payment and auto-credits the tenant ledger, unmatched or mis-parsed emails create phantom credits or missed credits.

**Why it happens:**
- Desire to automate a manual process without acknowledging the limits of email parsing
- Testing against a single bank's e-transfer format passes but others fail in production

**Consequences:**
- Tenant shows as paid when payment hasn't arrived; rent chase delayed a month
- Tenant shows as unpaid despite paying; relationship damage, spurious late fee
- Property manager loses trust in the system's payment accuracy

**Prevention:**
- Gmail parsing should only create a *suggested match*, never an auto-confirmed payment
- Manager must explicitly confirm each e-transfer match before it posts to the ledger
- Build for multiple bank email formats from the start: RBC, TD, Scotiabank, BMO, Desjardins, and credit unions all differ
- Store the raw parsed data alongside the suggested match so discrepancies are auditable
- Implement a "No email found — log manually" fallback flow that is first-class, not an afterthought

**Warning signs:**
- System auto-confirms payments from email parsing without human approval step
- Only one bank's email format tested in development
- No fallback for tenants who don't use email-based e-transfer notifications

**Phase to address:** Gmail integration phase. Design the UX as "suggestion + confirmation," not "auto-match."

---

### M2: Provincial Tenancy Law Hard-Coded to One Province (Ontario Assumption)

**What goes wrong:**
Canadian residential tenancy law is provincial jurisdiction. Rent increase limits, notice periods, eviction procedures, and required lease forms differ dramatically by province:

- **Ontario (RTA):** Rent increase guideline set annually by province (~2-4%); 90 days notice required; specific N-form eviction notices mandated; standard lease form legally required for most residential tenancies
- **BC (RTA):** Different rent increase formula; 3-month notice for some rent increases; dispute resolution through RTB not court
- **Alberta:** No rent increase limit (as of current law); different notice periods
- **Quebec:** Lease renewal process via mandatory offer form; Tribunal administratif du logement (TAL); French language requirements

If the system hard-codes Ontario rent increase rules or generates Ontario-specific N-forms for a property manager in BC, documents are legally invalid and potentially unenforceable.

**Why it happens:**
- Canary operates in one province today; rules get baked in as "the rules"
- SaaS expansion to other provinces assumed to be a config change but requires significant document and workflow rework

**Consequences:**
- Rent increase notices legally invalid for non-Ontario tenants
- Lease documents may not meet provincial requirements (Quebec especially)
- Eviction procedure support for wrong province; property manager acts on bad advice

**Prevention:**
- Every organization record must have a `province` field that gates all tenancy-law-dependent features
- Rent increase rule engine must be province-parameterized from day one
- Lease template system must support province-specific templates, not a single national template
- Notice period calculations must query province-specific rules, not a constant
- Do not ship tenancy law enforcement features (rent increase wizard, eviction notice generator) for provinces whose rules have not been verified against current legislation

**Warning signs:**
- Rent increase percentage referenced as a constant in code
- Notice period (90 days, 60 days, etc.) hard-coded as a number
- "Province" field missing from organization or property records

**Phase to address:** Data Model phase (province field on all relevant entities); Compliance review before each province-specific feature ships.

---

### M3: PIPEDA Consent and Data Minimization Violations

**What goes wrong:**
PIPEDA (Personal Information Protection and Electronic Documents Act) requires:
1. **Consent** for collection, use, and disclosure of personal information
2. **Purpose limitation** — data collected for one purpose cannot be used for another
3. **Data minimization** — collect only what is necessary
4. **Retention limits** — not kept longer than necessary
5. **Breach notification** — OPC notified within a "reasonable time" (effectively 72 hours for significant risk) and affected individuals notified

Common SaaS violations in property management:
- Storing tenant SIN numbers "for credit checks" but keeping them indefinitely after move-out
- Sharing tenant contact information with vendors without tenant consent
- Sending tenant data to third-party analytics tools without disclosure in a privacy policy
- Retaining ex-tenant financial data in a production database with no deletion/archival policy

**Why it happens:**
- Privacy policy written once at launch and not updated as features are added
- "Collect everything, use later" engineering culture
- Third-party integrations (analytics, error tracking) not evaluated for personal data exposure

**Consequences:**
- OPC investigation and public finding (reputational damage even if no fine)
- PIPEDA does not currently have significant financial penalties but Quebec's Law 25 (which has teeth — up to 4% of worldwide turnover) applies to Quebec residents
- Loss of enterprise/PM company customers who require privacy compliance attestation

**Prevention:**
- Privacy-by-design: every new field added to the data model requires a documented purpose and retention period
- Vendor data sharing: vendor sees only property address and work order description — never tenant name, phone, or email unless explicitly required and consented to
- Tenant offboarding: define a data retention and deletion schedule (e.g., 7 years for financial records per CRA, then deletion)
- Privacy policy must enumerate every third-party service that receives personal data (Stripe, Twilio, Resend, Supabase hosting region)
- Supabase project must be in the `ca-central-1` region (Canada) or data residency implications must be disclosed

**Warning signs:**
- No documented retention policy for tenant personal data after lease end
- Vendor portal shows tenant contact information
- Error tracking (e.g., Sentry) configured to capture full request/response bodies which may contain PII
- Privacy policy last updated at MVP launch, never reviewed

**Phase to address:** Foundation (privacy policy, data model), and before any third-party integration ships.

---

### M4: Realtime Subscriptions Without Channel Authorization = Cross-Org Live Events

**What goes wrong:**
Supabase Realtime subscriptions listen to database change events. If Realtime channels are not set to `private: true` with appropriate authorization policies, any authenticated user can subscribe to any channel and receive change events from any organization.

A tenant from Org A could subscribe to `properties:*` and receive real-time updates about Org B's property listings, maintenance events, or payment confirmations.

**Why it happens:**
- Public channel mode is the default in older Supabase setups
- RLS on database tables does not automatically restrict Realtime event visibility; Realtime has its own authorization layer
- Developers test Realtime in dev with a single org and never test cross-org scenarios

**Consequences:**
- Real-time data leakage of property and tenant events across organizations
- Difficult to detect — no audit log of channel subscriptions by default

**Prevention:**
- Enable "Private-only channels" in Supabase Dashboard > Project Settings > Realtime Settings
- All channel subscriptions use `config: { private: true }`
- Realtime authorization policies on `realtime.messages` scope access by org membership
- Do not pass `org_id` or other org data in channel names that users construct themselves

**Warning signs:**
- Any `supabase.channel(...)` call without `{ config: { private: true } }`
- Realtime settings not reviewed after initial project setup

**Phase to address:** Foundation. Before any Realtime feature ships.

---

### M5: Custom JWT Claims with Stale Role/Org Data

**What goes wrong:**
When org membership or roles are stored in JWT custom claims (via Supabase custom access token hooks), those claims are baked into the token at login time and do not update until the token is refreshed. If a manager is removed from an organization, demoted, or their permissions are changed, they retain their old claims for up to 1 hour (token TTL) or until they log out.

During that window, RLS policies that rely on JWT claims (`auth.jwt() -> 'org_id'`) rather than real-time database lookups will enforce the stale permissions.

**Why it happens:**
- JWT claims used in RLS for performance (avoids a DB join on every query)
- Assumption that permission changes take effect immediately

**Consequences:**
- Removed employee continues accessing org data for up to an hour after removal
- Role downgrade (Manager → Employee) not enforced until token refresh
- For security incidents (employee termination), immediate effect requires manual token invalidation

**Prevention:**
- For sensitive permission changes (removal, demotion), force token invalidation via Supabase Auth admin API
- Consider a hybrid: use JWT claims for org_id (stable, rarely changes) but check role from the database for permission-sensitive operations
- Implement a `revoked_sessions` table checked at request time for terminated users
- Document the delay behavior in the team guide so it is a known, managed tradeoff not a surprise

**Warning signs:**
- RLS policies rely entirely on JWT `user_role` claim for role-based access decisions
- No process for immediately revoking access when a team member is terminated
- No test case for "removed user still has JWT, can they access data?"

**Phase to address:** Auth / Foundation phase. Design the session revocation strategy before the team management feature ships.

---

### M6: Owner Disbursement Calculation Without Audit Trail

**What goes wrong:**
Owner disbursements are calculated from: rent collected minus management fee minus maintenance expenses minus any reserves. If this calculation runs as application logic without storing an immutable audit trail of the inputs at calculation time, disputes become irresolvable.

Common failure modes:
- A rent payment's status changes after disbursement was calculated (e.g., marked returned)
- A maintenance expense is edited or deleted after the statement was generated
- Management fee percentage is changed mid-month; which rate applied?

Property owners are financially sophisticated and will dispute inaccurate statements. Without an audit trail, the PM has no defensible record.

**Why it happens:**
- Statements generated dynamically from current data rather than snapshotted data
- "We can always recalculate" assumption

**Consequences:**
- Owner disputes that cannot be resolved from system records
- Double-counted or missed expenses across statement periods
- Trust breakdown with owners (biggest churn risk for a PM company)

**Prevention:**
- Statements are snapshots, not live views: generate and store the line-item inputs at statement time
- Once a statement is finalized, mark all contributing records as statement-locked (prevent edits without creating adjustment entries)
- Store management fee rate on each disbursement record, not just on the org record
- Use ledger-style accounting: never update records, create offsetting entries instead

**Warning signs:**
- Statement PDF regenerated from current database state rather than stored snapshot
- No `statement_locked` flag or equivalent on payment/expense records
- Management fee stored only on the org, not on individual disbursements

**Phase to address:** Payments / Disbursement phase. Design the ledger model before any financial records are created.

---

### M7: Document Generation via Puppeteer in a Serverless Environment

**What goes wrong:**
Puppeteer (headless Chromium) for PDF generation has specific runtime requirements:
- Chromium binary (~200MB) is too large for standard serverless function packages (AWS Lambda 250MB limit; Vercel 50MB function limit)
- Supabase Edge Functions have a 20MB bundle limit and 150MB memory limit — Puppeteer cannot run in Edge Functions at all
- Cold starts with a full Chromium launch add 3-8 seconds to PDF generation
- Concurrent PDF generation (e.g., generating 50 owner statements on the 1st of the month) creates memory exhaustion if each function call spins up its own browser instance

**Why it happens:**
- Puppeteer is the well-known PDF solution; its serverless incompatibility is not obvious until deployment
- Works fine in local development (no size or memory constraints)

**Consequences:**
- PDF generation fails to deploy or times out in production
- Owner statement batch generation fails on the first of each month
- Fallback to synchronous blocking PDF generation degrades API response times

**Prevention:**
- Use `@sparticuz/chromium` (the serverless-optimized Chromium distribution) with Puppeteer on a long-running server target (not Vercel serverless functions or Edge Functions)
- Better: use `pdf-lib` or `react-pdf/renderer` for template-based PDFs (statements, lease summaries) — no Chromium needed
- Reserve Puppeteer for complex pixel-perfect rendering if genuinely needed; host it as a dedicated service (separate Render/Railway instance or AWS Lambda Layer with correct layer config)
- For batch statement generation: queue jobs (use Supabase Database Webhooks → Edge Function → queue), generate asynchronously, notify when ready

**Warning signs:**
- Puppeteer in a Vercel serverless function (`/api/generate-pdf`)
- PDF generation called synchronously in a request handler with no timeout handling
- No queue or async pattern for batch PDF generation

**Phase to address:** Documents phase. Evaluate the PDF library choice before building any document generation feature.

---

## MINOR PITFALLS

Friction points that hurt UX and conversion but don't cause data or financial problems.

---

### N1: Tenant Onboarding Friction Causes Portal Abandonment

**What goes wrong:**
Property management portals have notoriously low tenant adoption because:
- Registration requires an invite email → tenant ignores it → manager chases them → manual workaround established
- Tenants on mobile see a desktop-first layout and abandon
- Password creation barrier for a portal they will use once a month

If adoption is below ~60%, managers continue using manual processes in parallel, negating the system's value.

**Prevention:**
- Magic link (passwordless) as the primary onboarding method for tenants
- Mobile-first responsive design, not responsive-afterthought
- Deep link from the invite email directly to the rent payment page, not to a generic dashboard
- First session should take under 60 seconds: land → pay rent → done

**Phase to address:** Tenant Portal phase.

---

### N2: Vendor Email/SMS Fallback Treated as Second-Class

**What goes wrong:**
The email/SMS fallback for vendors who won't use the portal is scoped correctly in design but often implemented incompletely:
- Job details sent via email but status reply-parsing is not implemented ("just use the portal for updates")
- Vendor replies to email; email sits in a notification inbox nobody monitors
- Invoice submitted via portal but vendor was assigned via email and has no account → invoice link doesn't work

This forces the manager to become the communication intermediary, eliminating the efficiency benefit.

**Prevention:**
- Email/SMS vendor mode must be a complete path: job dispatch → reply-to-update-status → invoice submission via email attachment or web link that doesn't require account creation
- Consider a stateless one-click status update link (vendor clicks "Completed" in email → job marked done without login)

**Phase to address:** Vendor Portal phase.

---

### N3: Inspection Photos Stored Without Compression = Storage Cost Explosion

**What goes wrong:**
Move-in/move-out inspections generate 30-100 photos per property. On iOS and newer Android, uncompressed photos are 8-15MB each. At 100 units with 2 inspections per year, uncompressed storage is ~100 units × 100 photos × 12MB × 2 inspections = ~240GB/year, at Supabase Storage pricing.

**Prevention:**
- Client-side image compression before upload (use `browser-image-compression` npm package)
- Target: 1-2MB per inspection photo
- Store original metadata but not original file

**Phase to address:** Inspections phase.

---

### N4: Schema Migrations Applied Directly in Dashboard Editor = Sync Errors

**What goes wrong:**
Supabase documents this explicitly: making schema changes directly via the Dashboard SQL editor or Table Editor on a remote project bypasses the migration history in `supabase_migrations`. Subsequent `supabase db push` from local will fail with sync errors because local migration history and remote schema diverge. This breaks the entire migration workflow and can require manual reconciliation.

**Prevention:**
- Team rule: all schema changes go through migration files created with `supabase db diff` locally, committed to git, applied with `supabase db push`
- Dashboard SQL editor is for read-only inspection only in staging and production
- CI pipeline that runs `supabase db push --dry-run` and fails if migration history is dirty

**Phase to address:** Foundation phase. First team standup rule.

---

### N5: Freemium Plan Limits Enforced Only in the UI, Not the Database

**What goes wrong:**
If the free plan limit ("maximum 5 units") is enforced only by hiding the "Add Property" button in the UI, any user with basic API knowledge can call the Supabase REST API directly and create properties beyond the limit. The database has no enforcement.

**Prevention:**
- Enforce plan limits via a database trigger or RLS policy that checks `org.current_unit_count <= org.plan_unit_limit` on INSERT
- Alternatively, enforce in a Next.js Server Action (server-side, not client-side) that checks the org's subscription status via Stripe before allowing the operation
- UI enforcement is UX, not security; database or server enforcement is the real gate

**Phase to address:** Billing / Freemium phase.

---

## Phase-Specific Warning Summary

| Phase | Likely Pitfall | Mitigation |
|-------|---------------|------------|
| Foundation / Data Model | RLS not enabled on new tables (C1, C4) | Linter on every table; migration template |
| Foundation / Auth | Service_role key in client code (C3); stale JWT claims (M5) | Env var naming convention; session revocation design |
| Foundation / Realtime | Public channels leaking cross-org events (M4) | Enable private-only channels in project settings before any Realtime feature |
| Payments | Webhook idempotency missing (C5); disbursing before ACH settles (C6) | Idempotency table; 5-day hold period |
| Payments / Disbursement | No audit trail for statement inputs (M6) | Snapshot ledger design before first financial record |
| Gmail Integration | E-transfer parsing treated as confirmed payment (M1) | "Suggested match" UX; human confirmation required |
| Documents / PDF | Puppeteer in serverless (M7) | Choose pdf-lib for templates; async queue for batch |
| Owner Portal | Calculation disputes without audit trail (M6) | See above |
| Tenant Portal | Low adoption due to onboarding friction (N1) | Magic link; mobile-first; deep link to rent payment |
| Vendor Portal | Incomplete email/SMS fallback path (N2) | One-click status update links; no-login invoice submission |
| Province expansion | Ontario rules hard-coded (M2) | Province field on all entities from day one |
| All feature phases | IDOR via service_role in API routes (C7) | Org ownership assertion in every service_role route |
| Freemium / Billing | Plan limits UI-only (N5) | Server-side or database enforcement |
| Inspections | Uncompressed photo storage (N3) | Client-side compression before upload |
| Schema management | Dashboard SQL editor bypasses migrations (N4) | Team rule + CI enforcement |

---

## Sources

- Supabase RLS documentation (official): https://github.com/supabase/supabase/blob/master/apps/docs/content/guides/database/postgres/row-level-security.mdx — HIGH confidence
- Supabase RLS performance best practices: https://github.com/supabase/supabase/blob/master/apps/docs/content/troubleshooting/rls-performance-and-best-practices-Z5Jjwv.mdx — HIGH confidence
- Supabase Storage access control: https://github.com/supabase/supabase/blob/master/apps/docs/content/guides/storage/security/access-control.mdx — HIGH confidence
- Supabase Realtime authorization: https://github.com/supabase/supabase/blob/master/apps/www/_blog/2024-08-13-supabase-realtime-broadcast-and-presence-authorization.mdx — HIGH confidence
- Supabase migration management: https://github.com/supabase/supabase/blob/master/apps/docs/content/guides/deployment/database-migrations.mdx — HIGH confidence
- Supabase Edge Function limits (20MB bundle, 150MB memory): verified via Context7 — HIGH confidence
- Stripe webhook idempotency pattern: https://docs.stripe.com/webhooks/migrate-snapshot-to-thin-events — HIGH confidence
- Stripe ACSS Debit (Canadian pre-authorized debit): https://docs.stripe.com/payments/acss-debit/set-up-payment — HIGH confidence
- Stripe transfer failure and reversal: https://docs.stripe.com/reporting/balance-transaction-types — HIGH confidence
- PIPEDA obligations: Office of the Privacy Commissioner of Canada (pipeda.gc.ca) — MEDIUM confidence (WebFetch unavailable; grounded in regulatory domain knowledge)
- Provincial tenancy legislation: Alberta, BC, Ontario, Quebec residential tenancy acts — MEDIUM confidence (domain knowledge; must be verified against current legislation before shipping tenancy-law features)
- Puppeteer serverless constraints: Context7 Puppeteer docs + Vercel function size limits — HIGH confidence
