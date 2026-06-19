<!-- GSD:project-start source:PROJECT.md -->
## Project

**Canary PropOS — Property Management SaaS**

A full-stack, multi-tenant property management platform built first for **Canary Property Management** (150+ units) and sold as **SaaS** to other property managers and independent landlords. It replaces Canary's current AppSheet/Google Sheets system — which works but is slow, visually poor, and impossible to customize — with a modern, responsive web app that looks and performs like a professional product.

The core promise: one system that connects properties, owners, tenants, vendors, leases, maintenance, payments, and documents — with role-appropriate portals for everyone involved.

**Core Value:** A unified hub where any authorized party — manager, owner, tenant, or vendor — can see exactly what they need and take exactly the actions they're allowed to, without phone calls, emails, or spreadsheets filling the gap.

### Constraints

- Owner contact info for tenants is restricted until offboarding (privacy + business retention)
- Maintenance expense approval gate at $500 (owner must approve above threshold)
- Canary uses Gmail; Gmail integration must handle Interac e-transfer parsing for payment matching
- Mobile-responsive design is mandatory (managers and tenants use phones)
<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->
## Technology Stack

## Verdict on Proposed Stack
## Recommended Stack
### Core Framework
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Next.js | 15.x (stable) | Full-stack React framework | App Router, React Server Components, Server Actions, Vercel-native. RSC means dashboard data loads on the server — no client waterfall. Server Actions eliminate a separate API layer for mutations. |
| TypeScript | 5.x | Type safety | Non-negotiable for a multi-role, multi-tenant system. Supabase CLI generates full database types. |
| React | 19.x (ships with Next 15) | UI runtime | Concurrent features, use() hook for Suspense data loading. |
### UI Layer
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Tailwind CSS | 4.x | Utility-first styling | v4 is a full rewrite — faster builds, CSS-first config (no `tailwind.config.js` required), native CSS cascade layers. Use v4. |
| shadcn/ui | latest (CLI-managed) | Component library | Not a package — components are copied into your codebase. Latest version is `shadcn@2.x` or `shadcn@3.x` (CLI handles it). Radix UI primitives underneath. Fully accessible, fully customizable. |
| Lucide React | latest | Icons | Ships with shadcn/ui. Consistent icon set, tree-shakeable. |
### Backend / Database
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Supabase | hosted (v1.26+) | PostgreSQL + Auth + Storage + Realtime | Built-in RLS for multi-tenant isolation, auth providers (email/password, Google, Apple, magic link), S3-compatible file storage, real-time subscriptions. Avoids building 4 primitives from scratch. |
| `@supabase/ssr` | latest | Next.js server-side Supabase client | **Use this, not `@supabase/auth-helpers-nextjs` (deprecated).** Provides `createServerClient` for Server Components and `createBrowserClient` for client components. Cookie-based session management. |
| `@supabase/supabase-js` | v2.x | Database queries, storage, realtime | The base JS client. `@supabase/ssr` wraps it for Next.js. |
### Authentication
- Email + password: built-in
- Google OAuth: configure in Supabase dashboard + Google Cloud Console
- Apple OAuth: configure in Supabase dashboard + Apple Developer
- Magic link (passwordless email): built-in, uses Resend as SMTP provider
### Payments
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `stripe` (Node SDK) | latest (v17+) | Server-side payment processing | Webhooks, subscription management, ACH payments, Stripe Connect for disbursements. |
| `@stripe/stripe-js` | latest | Client-side Stripe Elements | Stripe-hosted card/ACH input UI. Required for PCI compliance — never handle raw card data. |
| `@stripe/react-stripe-js` | latest | React wrapper for Stripe Elements | Integrates Stripe.js into React components cleanly. |
### Email
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `resend` | latest | Transactional email sending | Clean API, React Email template support, excellent deliverability. |
| `react-email` | latest | Email template authoring | Write email templates as React components. Renders to HTML for Resend. Supports preview server. |
### SMS
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Pingram | latest | SMS notifications + vendor comms | Supersedes Twilio per ROADMAP Phase 10. See https://www.pingram.io/docs/ — Canadian numbers supported. |
### File Storage
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Supabase Storage | hosted | Photos, PDFs, lease docs, invoices | S3-compatible, integrated with RLS (bucket policies + object-level policies), signed URLs for private files, resumable uploads via TUS protocol for large files. |
### PDF Generation
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `@react-pdf/renderer` | latest | Owner statements, inspection reports, offboarding packages | Renders React components to PDF server-side via `renderToBuffer()`. No headless browser required. Pure JS, works in Node.js and Edge Functions. |
- **Puppeteer/Playwright** — requires Chromium binary, incompatible with Vercel serverless (size limit), works but needs a dedicated microservice or Docker. Use only if `@react-pdf/renderer` layout capabilities prove insufficient (unlikely for statements/reports).
- **pdf-lib** — use for PDF manipulation only (filling existing templates, merging PDFs). Not a layout engine. Complementary to `@react-pdf/renderer`, not a replacement.
- **wkhtmltopdf** — server binary, no Vercel support.
### OCR (Lease Import)
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| OpenAI Vision API (GPT-4o) | latest | Extract structured data from uploaded lease PDFs | Far superior to Tesseract for document extraction. Prompt-driven extraction of tenant name, property address, rent amount, start/end dates. Pay-per-use, no self-hosting. |
### Form Handling and Validation
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `react-hook-form` | v7.x | Client-side form state management | Best performance (uncontrolled inputs), minimal re-renders, works with shadcn/ui form components. |
| `zod` | v4.x | Schema validation (client + server) | TypeScript-first, v4 is current stable. Use one Zod schema to validate both client-side (via react-hook-form's `zodResolver`) and server-side (in Server Actions). |
| `@hookform/resolvers` | latest | Bridge between react-hook-form and Zod | `zodResolver(schema)` wires validation together. |
### State Management
| Layer | Tool | Why |
|-------|------|-----|
| Server state (DB data) | React Server Components + `revalidatePath()` | Fetch in RSC, mutate via Server Actions, revalidate on demand. |
| Client UI state | React `useState` / `useReducer` | Local component state only. |
| Complex client state (if needed) | Zustand | Lightweight, no boilerplate. Only introduce if RSC + useState proves insufficient. |
| Real-time subscriptions | Supabase Realtime JS client | In-app notifications, live status updates. |
### Hosting and Infrastructure
| Technology | Purpose | Why |
|------------|---------|-----|
| Vercel | Next.js hosting | Zero-config Next.js deployment, preview deployments per PR, Edge Network, serverless functions co-located with code. |
| Supabase (hosted) | Database + Auth + Storage + Realtime | Managed PostgreSQL, automatic backups, dashboard for schema management. Start on Pro plan ($25/mo) — free tier has no daily backups and pauses after inactivity (unsuitable for production). |
| Supabase Edge Functions | Background processing, webhooks | Handles Stripe webhooks, sends Pingram SMS, sends Resend emails triggered by DB events. Deno runtime, deployed alongside Supabase project. |
## Multi-Tenancy Architecture in Supabase (Key Question #4)
### Schema Pattern
### RLS Pattern
### Role Enforcement Pattern
### Admin (Platform Superuser) Pattern
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
| Pingram | latest | Supersedes Twilio (ROADMAP Phase 10) |
| `@react-pdf/renderer` | latest | Server PDF generation |
| `pdf-lib` | latest | PDF merging/manipulation only |
| `react-hook-form` | v7.x | |
| `zod` | v4.x | Current stable |
| `@hookform/resolvers` | latest | |
| `shadcn/ui` | CLI-managed | Not a versioned npm package |
| `lucide-react` | latest | |
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
## Installation
# Create project
# Supabase
# Payments
# Email
# SMS
# PDF generation
# Forms and validation
# UI (shadcn CLI handles component installation)
## What NOT to Install
- `@supabase/auth-helpers-nextjs` — deprecated
- `next-auth` / `auth.js` — duplicates Supabase Auth
- `puppeteer` / `playwright` — incompatible with Vercel serverless
- `redux` / `@reduxjs/toolkit` — unnecessary with RSC
- `tesseract.js` — use OpenAI Vision API instead
- `prisma` / `drizzle` — use Supabase's auto-generated TypeScript types and the PostgREST client instead; ORMs add a mapping layer that fights Supabase's RLS model
## Sources
- Next.js App Router docs (via Context7 `/vercel/next.js`): Server Actions, Middleware, authentication guides
- Supabase docs (via Context7 `/supabase/supabase`): RLS, multi-tenant schema, `@supabase/ssr`, Edge Functions, Storage
- Supabase JS client (via Context7 `/supabase/supabase-js`): v2.58 current
- React-pdf renderer (via Context7 `/diegomura/react-pdf`): `renderToBuffer()`, `renderToStream()` Node.js API
- Stripe docs (via Context7 `/websites/stripe`): Subscriptions, metered billing
- Resend docs (via Context7 `/websites/resend`): Next.js App Router integration, React Email
- Pingram SMS docs: https://www.pingram.io/docs/ (supersedes Twilio per ROADMAP Phase 10)
- Zod docs (via Context7 `/colinhacks/zod`): v4 current stable
- shadcn/ui (via Context7 `/shadcn-ui/ui`): CLI-managed component model
- TanStack Query (via Context7 `/tanstack/query`): v5 (noted but not required given RSC approach)
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->
## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
