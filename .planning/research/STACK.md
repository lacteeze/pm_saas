# Technology Stack

**Project:** Canary PropOS — Property Management SaaS
**Researched:** 2026-06-19
**Confidence:** HIGH (all core choices verified against Context7 official docs)

---

## Verdict on Proposed Stack

The proposed stack (Next.js 15 + Supabase + Stripe + Resend + Twilio + Vercel) is **correct and should be built as specified**. No major pivots are warranted. Several specific library choices and patterns within that stack need clarification — those are detailed below.

---

## Recommended Stack

### Core Framework

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Next.js | 15.x (stable) | Full-stack React framework | App Router, React Server Components, Server Actions, Vercel-native. RSC means dashboard data loads on the server — no client waterfall. Server Actions eliminate a separate API layer for mutations. |
| TypeScript | 5.x | Type safety | Non-negotiable for a multi-role, multi-tenant system. Supabase CLI generates full database types. |
| React | 19.x (ships with Next 15) | UI runtime | Concurrent features, use() hook for Suspense data loading. |

**Do NOT use:** Next.js Pages Router. Pages Router is maintenance-only. App Router is the only forward path and has full Supabase SSR support via `@supabase/ssr`.

### UI Layer

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Tailwind CSS | 4.x | Utility-first styling | v4 is a full rewrite — faster builds, CSS-first config (no `tailwind.config.js` required), native CSS cascade layers. Use v4. |
| shadcn/ui | latest (CLI-managed) | Component library | Not a package — components are copied into your codebase. Latest version is `shadcn@2.x` or `shadcn@3.x` (CLI handles it). Radix UI primitives underneath. Fully accessible, fully customizable. |
| Lucide React | latest | Icons | Ships with shadcn/ui. Consistent icon set, tree-shakeable. |

**Do NOT use:** MUI, Chakra UI, Ant Design (opinionated styling fights Tailwind), or Headless UI standalone (superseded by shadcn/ui patterns).

### Backend / Database

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Supabase | hosted (v1.26+) | PostgreSQL + Auth + Storage + Realtime | Built-in RLS for multi-tenant isolation, auth providers (email/password, Google, Apple, magic link), S3-compatible file storage, real-time subscriptions. Avoids building 4 primitives from scratch. |
| `@supabase/ssr` | latest | Next.js server-side Supabase client | **Use this, not `@supabase/auth-helpers-nextjs` (deprecated).** Provides `createServerClient` for Server Components and `createBrowserClient` for client components. Cookie-based session management. |
| `@supabase/supabase-js` | v2.x | Database queries, storage, realtime | The base JS client. `@supabase/ssr` wraps it for Next.js. |

**Do NOT use:** `@supabase/auth-helpers-nextjs` — officially deprecated, migrated to `@supabase/ssr`.

### Authentication

Supabase Auth handles all four required methods out of the box:
- Email + password: built-in
- Google OAuth: configure in Supabase dashboard + Google Cloud Console
- Apple OAuth: configure in Supabase dashboard + Apple Developer
- Magic link (passwordless email): built-in, uses Resend as SMTP provider

No third-party auth library (Clerk, Auth.js, NextAuth) is needed or recommended. Adding one would duplicate Supabase Auth and create session sync complexity.

### Payments

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `stripe` (Node SDK) | latest (v17+) | Server-side payment processing | Webhooks, subscription management, ACH payments, Stripe Connect for disbursements. |
| `@stripe/stripe-js` | latest | Client-side Stripe Elements | Stripe-hosted card/ACH input UI. Required for PCI compliance — never handle raw card data. |
| `@stripe/react-stripe-js` | latest | React wrapper for Stripe Elements | Integrates Stripe.js into React components cleanly. |

**Stripe webhook handler:** Use Supabase Edge Functions (Deno) to handle Stripe webhooks. Verified pattern from Context7 docs — Edge Functions can verify `stripe-signature` and run `ctx.supabaseAdmin` for database writes.

**For SaaS billing (freemium tiers):** Use Stripe Subscriptions with a `customers` table in your DB mapping `org_id → stripe_customer_id`. Enforce plan limits in the application layer (not just Stripe) — check unit count against plan limits on writes.

**Do NOT use:** Paddle, LemonSqueezy (less control over ACH/disbursement flows, no Canadian payment coverage).

### Email

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `resend` | latest | Transactional email sending | Clean API, React Email template support, excellent deliverability. |
| `react-email` | latest | Email template authoring | Write email templates as React components. Renders to HTML for Resend. Supports preview server. |

Pattern: Supabase Auth can use Resend as a custom SMTP provider for magic links and auth emails. All application emails (rent reminders, statements, notifications) go through Resend directly from Server Actions or Edge Functions.

**Do NOT use:** SendGrid (worse DX), Nodemailer directly (no template system, deliverability work).

### SMS

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `twilio` (Node SDK) | latest | SMS notifications + vendor comms | `client.messages.create()` — straightforward. Industry standard, Canadian numbers supported. |

Pattern: Trigger SMS from Supabase Edge Functions or Next.js Route Handlers. Do not call Twilio from client-side code — API keys must stay server-side.

### File Storage

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Supabase Storage | hosted | Photos, PDFs, lease docs, invoices | S3-compatible, integrated with RLS (bucket policies + object-level policies), signed URLs for private files, resumable uploads via TUS protocol for large files. |

**Bucket structure recommendation:**
```
org-{org_id}/
  properties/{property_id}/photos/
  leases/{lease_id}/
  inspections/{inspection_id}/photos/
  inspections/{inspection_id}/reports/
  statements/{year}/{month}/
  documents/templates/
```

**Storage RLS:** Apply `org_id`-scoped policies at the bucket level. Use signed URLs (not public buckets) for all tenant-specific files. Supabase Storage supports generating signed URLs server-side.

**Do NOT use:** AWS S3 directly (adds infrastructure complexity when Supabase Storage is already in the stack), Cloudinary (overkill for document storage, unnecessary cost).

### PDF Generation

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `@react-pdf/renderer` | latest | Owner statements, inspection reports, offboarding packages | Renders React components to PDF server-side via `renderToBuffer()`. No headless browser required. Pure JS, works in Node.js and Edge Functions. |

Pattern:
```typescript
// In a Next.js Route Handler or Server Action:
import { renderToBuffer } from '@react-pdf/renderer';
const buffer = await renderToBuffer(<StatementDocument data={statementData} />);
// Upload buffer to Supabase Storage, return signed URL
```

**Do NOT use for PDF generation:**
- **Puppeteer/Playwright** — requires Chromium binary, incompatible with Vercel serverless (size limit), works but needs a dedicated microservice or Docker. Use only if `@react-pdf/renderer` layout capabilities prove insufficient (unlikely for statements/reports).
- **pdf-lib** — use for PDF manipulation only (filling existing templates, merging PDFs). Not a layout engine. Complementary to `@react-pdf/renderer`, not a replacement.
- **wkhtmltopdf** — server binary, no Vercel support.

**Complementary use of pdf-lib:** If DocHub returns a signed PDF that needs to be merged with a cover page, `pdf-lib` can handle that merging step cleanly.

### OCR (Lease Import)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| OpenAI Vision API (GPT-4o) | latest | Extract structured data from uploaded lease PDFs | Far superior to Tesseract for document extraction. Prompt-driven extraction of tenant name, property address, rent amount, start/end dates. Pay-per-use, no self-hosting. |

Pattern: Upload PDF to Supabase Storage → call OpenAI API with base64-encoded pages → parse JSON response → present extracted fields for human confirmation before saving.

**Do NOT use:** Tesseract.js — poor accuracy on real-world PDFs, requires significant post-processing, returns raw text not structured data. The OpenAI Vision API approach is more reliable and costs cents per document.

### Form Handling and Validation

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `react-hook-form` | v7.x | Client-side form state management | Best performance (uncontrolled inputs), minimal re-renders, works with shadcn/ui form components. |
| `zod` | v4.x | Schema validation (client + server) | TypeScript-first, v4 is current stable. Use one Zod schema to validate both client-side (via react-hook-form's `zodResolver`) and server-side (in Server Actions). |
| `@hookform/resolvers` | latest | Bridge between react-hook-form and Zod | `zodResolver(schema)` wires validation together. |

**Do NOT use:** Formik (performance worse than RHF), yup (Zod v4 is strictly better), manual validation in Server Actions without a schema library.

### State Management

No global state library is needed. The recommended approach:

| Layer | Tool | Why |
|-------|------|-----|
| Server state (DB data) | React Server Components + `revalidatePath()` | Fetch in RSC, mutate via Server Actions, revalidate on demand. |
| Client UI state | React `useState` / `useReducer` | Local component state only. |
| Complex client state (if needed) | Zustand | Lightweight, no boilerplate. Only introduce if RSC + useState proves insufficient. |
| Real-time subscriptions | Supabase Realtime JS client | In-app notifications, live status updates. |

**Do NOT use:** Redux, MobX, Jotai for this application. The RSC model makes global state largely unnecessary.

### Hosting and Infrastructure

| Technology | Purpose | Why |
|------------|---------|-----|
| Vercel | Next.js hosting | Zero-config Next.js deployment, preview deployments per PR, Edge Network, serverless functions co-located with code. |
| Supabase (hosted) | Database + Auth + Storage + Realtime | Managed PostgreSQL, automatic backups, dashboard for schema management. Start on Pro plan ($25/mo) — free tier has no daily backups and pauses after inactivity (unsuitable for production). |
| Supabase Edge Functions | Background processing, webhooks | Handles Stripe webhooks, sends Twilio SMS, sends Resend emails triggered by DB events. Deno runtime, deployed alongside Supabase project. |

**Do NOT use:** Railway, Render, or self-hosted Supabase for the SaaS launch (more operational overhead than Vercel + Supabase hosted). Revisit self-hosting only if costs become material at scale.

---

## Multi-Tenancy Architecture in Supabase (Key Question #4)

**Recommended pattern: `org_members` junction table + `security definer` helper functions + `org_id` on every domain table.**

### Schema Pattern

```sql
-- Every organization (SaaS tenant)
CREATE TABLE public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  plan_type TEXT NOT NULL DEFAULT 'free',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Membership table: maps users to orgs with roles
CREATE TABLE public.org_members (
  org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('manager', 'employee', 'admin')),
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (org_id, user_id)
);

-- Every domain table carries org_id
CREATE TABLE public.properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id),
  -- ... other fields
);
```

### RLS Pattern

Use a `private` schema with `SECURITY DEFINER` helper functions. This avoids recursive RLS evaluation and improves query performance:

```sql
CREATE SCHEMA IF NOT EXISTS private;

-- Security definer: bypasses RLS to check membership
CREATE OR REPLACE FUNCTION private.get_user_org_role(p_org_id UUID, p_user_id UUID)
RETURNS TEXT
LANGUAGE SQL
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT role FROM public.org_members
  WHERE org_id = p_org_id AND user_id = p_user_id;
$$;

-- Policy on properties table
CREATE POLICY "org_members_can_access"
ON public.properties
TO authenticated
USING (
  private.get_user_org_role(org_id, (SELECT auth.uid())) IS NOT NULL
);
```

**Critical performance rule:** Always wrap `auth.uid()` and helper function calls in `SELECT` subqueries inside RLS policies. This allows PostgreSQL to cache the result once per query instead of re-evaluating per row:

```sql
-- CORRECT (cached):
USING ((SELECT private.get_user_org_role(org_id, (SELECT auth.uid()))) IS NOT NULL)

-- WRONG (re-evaluated per row):
USING (private.get_user_org_role(org_id, auth.uid()) IS NOT NULL)
```

### Role Enforcement Pattern

The 6-role model (Admin, Manager, Employee, Tenant, Client/Owner, Vendor) should be enforced at two layers:

1. **RLS (database layer):** Controls which rows are visible. `org_members` table drives org-level access. Tenant, Client, Vendor have separate membership/invitation tables scoped to their records.
2. **Application layer (Server Actions / Route Handlers):** Controls what operations are allowed. Check role before performing mutations. RLS prevents data leaks even if application code has bugs.

### Admin (Platform Superuser) Pattern

Platform admin (Canary's internal superuser) uses the Supabase `service_role` key on the server only — never exposed to the client. Admin API calls go through protected Server Actions that verify the caller has the `admin` role stored in `app_metadata`.

---

## Package Versions (Current as of Research Date)

| Package | Version | Notes |
|---------|---------|-------|
| `next` | 15.x | Use `create-next-app@latest` |
| `react` | 19.x | Ships with Next 15 |
| `typescript` | 5.x | |
| `tailwindcss` | 4.x | CSS-first config |
| `@supabase/ssr` | latest | Replaces auth-helpers |
| `@supabase/supabase-js` | 2.x (v2.58+) | |
| `stripe` | 17.x | Server Node SDK |
| `@stripe/stripe-js` | latest | Client-side Elements |
| `@stripe/react-stripe-js` | latest | React wrapper |
| `resend` | latest | |
| `react-email` | latest | |
| `twilio` | latest | |
| `@react-pdf/renderer` | latest | Server PDF generation |
| `pdf-lib` | latest | PDF merging/manipulation only |
| `react-hook-form` | v7.x | |
| `zod` | v4.x | Current stable |
| `@hookform/resolvers` | latest | |
| `shadcn/ui` | CLI-managed | Not a versioned npm package |
| `lucide-react` | latest | |

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Framework | Next.js 15 | Remix, SvelteKit | Next.js is Vercel-native, has the largest RSC ecosystem, Supabase SSR package targets it explicitly |
| Auth | Supabase Auth | Clerk, Auth.js | Clerk adds cost ($$$) and a third session store. Auth.js needs a DB adapter and duplicates Supabase Auth. Supabase Auth already handles all 4 required methods. |
| Database | Supabase/PostgreSQL | PlanetScale, Neon | PlanetScale dropped free tier; no built-in auth or storage. Neon is Postgres but no auth/storage/realtime. Supabase bundles everything needed. |
| PDF generation | `@react-pdf/renderer` | Puppeteer, wkhtmltopdf | Puppeteer needs Chromium binary (fails on Vercel serverless). `@react-pdf/renderer` is pure JS, works anywhere Node runs, `renderToBuffer()` is clean API. |
| Email | Resend | SendGrid, Postmark | Resend has React Email integration, better DX, competitive deliverability. SendGrid has complex pricing. |
| State | RSC + useState | Redux, Zustand | RSC model eliminates the need for global state in most cases. Introduce Zustand only if genuinely needed. |
| OCR | OpenAI Vision (GPT-4o) | Tesseract.js | Tesseract returns raw text from images; requires complex parsing to extract structured fields. GPT-4o returns structured JSON from a prompt. Cost is negligible (cents per lease). |
| File storage | Supabase Storage | AWS S3, Cloudinary | Supabase Storage is already in the stack, RLS policies apply directly, signed URLs work without additional SDK. |

---

## Installation

```bash
# Create project
npx create-next-app@latest canary-propos --typescript --tailwind --app --src-dir

# Supabase
npm install @supabase/supabase-js @supabase/ssr

# Payments
npm install stripe @stripe/stripe-js @stripe/react-stripe-js

# Email
npm install resend react-email @react-email/components

# SMS
npm install twilio

# PDF generation
npm install @react-pdf/renderer pdf-lib

# Forms and validation
npm install react-hook-form zod @hookform/resolvers

# UI (shadcn CLI handles component installation)
npx shadcn@latest init
```

---

## What NOT to Install

- `@supabase/auth-helpers-nextjs` — deprecated
- `next-auth` / `auth.js` — duplicates Supabase Auth
- `puppeteer` / `playwright` — incompatible with Vercel serverless
- `redux` / `@reduxjs/toolkit` — unnecessary with RSC
- `tesseract.js` — use OpenAI Vision API instead
- `prisma` / `drizzle` — use Supabase's auto-generated TypeScript types and the PostgREST client instead; ORMs add a mapping layer that fights Supabase's RLS model

---

## Sources

- Next.js App Router docs (via Context7 `/vercel/next.js`): Server Actions, Middleware, authentication guides
- Supabase docs (via Context7 `/supabase/supabase`): RLS, multi-tenant schema, `@supabase/ssr`, Edge Functions, Storage
- Supabase JS client (via Context7 `/supabase/supabase-js`): v2.58 current
- React-pdf renderer (via Context7 `/diegomura/react-pdf`): `renderToBuffer()`, `renderToStream()` Node.js API
- Stripe docs (via Context7 `/websites/stripe`): Subscriptions, metered billing
- Resend docs (via Context7 `/websites/resend`): Next.js App Router integration, React Email
- Twilio Node docs (via Context7 `/twilio/twilio-node`): SMS `messages.create()` API
- Zod docs (via Context7 `/colinhacks/zod`): v4 current stable
- shadcn/ui (via Context7 `/shadcn-ui/ui`): CLI-managed component model
- TanStack Query (via Context7 `/tanstack/query`): v5 (noted but not required given RSC approach)
