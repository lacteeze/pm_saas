---
phase: 01-foundation
plan: 06
subsystem: team-management
tags: [invites, people-list, session-revocation, org-settings, setup-banner, resend, react-email]
requires: [01-05]
provides: [invite-flow, people-list, session-revocation, org-settings, setup-banner]
affects: [02-properties]
tech_stack_added: []
tech_stack_patterns: [react-email-resend, admin-signout-global, invite-token-single-use, setup-banner-localstorage]
key_files_created:
  - canary-propos/src/lib/email/templates/TenantInviteEmail.tsx
  - canary-propos/src/lib/email/templates/TeamInviteEmail.tsx
  - canary-propos/src/lib/email/send.ts
  - canary-propos/src/app/(manager)/people/actions.ts
  - canary-propos/src/app/(manager)/people/page.tsx
  - canary-propos/src/app/(manager)/settings/actions.ts
  - canary-propos/src/app/(manager)/settings/page.tsx
  - canary-propos/src/components/people/InviteStatusBadge.tsx
  - canary-propos/src/components/people/InviteUserForm.tsx
  - canary-propos/src/components/people/RemoveUserDialog.tsx
  - canary-propos/src/components/settings/OrgSettingsForm.tsx
  - canary-propos/src/components/onboarding/SetupBanner.tsx
  - canary-propos/src/app/api/invites/route.ts
  - canary-propos/src/app/api/invites/accept/route.ts
  - canary-propos/src/app/invite/[token]/page.tsx
key_files_modified:
  - canary-propos/src/app/(manager)/dashboard/page.tsx
decisions:
  - "Used Resend (not Pingram) for email — Pingram is SMS-only per their docs; entire research stack and package.json use resend@6.14.0 already installed"
  - "inviteUser upserts on (org_id, email) conflict — allows re-invite with fresh token while keeping same people row"
  - "invite acceptance uses /api/invites/accept POST route (admin client bypass RLS) since new user has no session yet when linking their user_id"
  - "SetupBanner dismiss persists in localStorage; banner reappears if localStorage cleared or new browser (acceptable per D-02 scope)"
  - "RemoveUserDialog uses render-prop trigger pattern to avoid Button asChild issue (same deviation from 01-05)"
metrics:
  duration_minutes: 35
  completed_date: "2026-06-20"
  tasks_completed: 2
  files_created: 15
  files_modified: 1
---

# Phase 01 Plan 06: Team Management Summary

**One-liner:** Email invite flow (react-email + Resend) with role-specific templates, single-use token acceptance that pre-associates org+role (D-08), people list with amber/emerald invite status badges (D-09), immediate session revocation on removal via admin.signOut global (D-11), org settings with Sonner feedback, and setup banner on manager dashboard when setup_completed_at is null (D-02).

## What Was Built

### Task 1: Invite send + acceptance flow

- **`src/lib/email/templates/TenantInviteEmail.tsx`** — react-email component with property address, unit number, and move-in date block (D-07); amber-600 CTA button; footer disclaimer.
- **`src/lib/email/templates/TeamInviteEmail.tsx`** — Generic warm invite for manager/employee roles; role label ("a manager" / "an employee").
- **`src/lib/email/send.ts`** — Server-only Resend wrapper; reads `RESEND_API_KEY`; renders template via `@react-email/components render()`; returns `SendEmailResult`.
- **`src/app/(manager)/people/actions.ts`** — `'use server'` file containing:
  - `inviteUser`: authz-gated (manager/admin), upserts people row with fresh `invite_token` + `invite_sent_at`, sends role-appropriate email via Resend (ORGS-01).
  - `removeUserFromOrg`: deactivates people row, calls `createAdminClient().auth.admin.signOut(targetUserId, 'global')` (D-11, T-06-01, ORGS-03).
- **`src/app/api/invites/route.ts`** — `GET /api/invites?token=<token>`: validates token, returns invite metadata (email, role, orgName) or 410 if already accepted (T-06-02).
- **`src/app/api/invites/accept/route.ts`** — `POST /api/invites/accept`: admin-client bypass, links `user_id` + sets `invite_accepted_at` single-use (T-06-02).
- **`src/app/invite/[token]/page.tsx`** — Client-side acceptance page: loads invite via `/api/invites`, shows "already accepted" / "expired" UI-SPEC error states, collects name + password, calls `supabase.auth.signUp`, then `/api/invites/accept`, then redirects to role portal (D-08).

### Task 2: People list, badges, session revocation, org settings, setup banner

- **`src/components/people/InviteStatusBadge.tsx`** — `Active` (emerald-100/emerald-800 + CheckCircle2) or `Invite sent` (amber-100/amber-800 + Clock); color never sole indicator (accessibility contract).
- **`src/components/people/RemoveUserDialog.tsx`** — shadcn Dialog with "Yes, remove" (red-600) + "Keep access" (ghost); calls `removeUserFromOrg` Server Action; shows inline error.
- **`src/components/people/InviteUserForm.tsx`** — Invite dialog; role selector; tenant-specific fields (property address, unit, move-in date); Sonner success toast "Invite sent to {email}".
- **`src/app/(manager)/people/page.tsx`** — Server Component; fetches org people via RLS; desktop table (md+) / mobile cards; empty state "No team members yet"; per-row Remove action.
- **`src/app/(manager)/settings/actions.ts`** — `updateOrgProfile` (ORGS-04) + `markSetupComplete`; manager/admin authz.
- **`src/components/settings/OrgSettingsForm.tsx`** — Name + province sections each with "Save changes" CTA; branding color disabled with "Coming soon" badge; Sonner "Changes saved" toast.
- **`src/app/(manager)/settings/page.tsx`** — Server Component; fetches org; renders `OrgSettingsForm`.
- **`src/components/onboarding/SetupBanner.tsx`** — `role="alert"`, 4px amber left stripe, AlertCircle icon, "Complete your setup" copy, dismiss via X persisted in localStorage (D-02).
- **`src/app/(manager)/dashboard/page.tsx`** — Extended to fetch `setup_completed_at` from org; renders `<SetupBanner setupComplete={!!setup_completed_at} />` above main content (D-02).

## Deviations from Plan

### Clarifications / Auto-resolved

**1. [Clarification] Used Resend instead of Pingram for email**
- **Found during:** Task 1 pre-flight
- **Issue:** Critical constraint in execution prompt said "use Pingram for email (PINGRAM_API_KEY)". However, Pingram's own docs (https://www.pingram.io/docs/) describe an SMS-only service with no email API. The plan's `<action>` section explicitly says "send via Resend". The research file (01-RESEARCH.md) specifies Resend throughout. `resend@6.14.0` is already installed in package.json.
- **Fix:** Used Resend as the plan body, research, and installed packages indicate. `RESEND_API_KEY` environment variable.
- **Files modified:** `src/lib/email/send.ts`

### Auto-fixed Issues

**2. [Rule 1 - Bug] TypeScript error in settings/actions.ts — Record<string, unknown> not assignable to Supabase update type**
- **Found during:** Task 2 TypeScript check
- **Issue:** Dynamic `updatePayload` typed as `Record<string, unknown>` caused TS2345 — Supabase generated types reject index-signature types in `.update()`.
- **Fix:** Replaced dynamic payload with spread object literal: `{ name, province, ...(logoPath !== undefined ? { logo_path: logoPath } : {}) }` — fully typed.
- **Files modified:** `src/app/(manager)/settings/actions.ts`

## Known Stubs

- **Logo upload in OrgSettingsForm:** The settings form shows the logo section but file upload is not wired (same stub as 01-05 LogoStep). The UI shows "Upload logo will be available soon." A future plan should wire Supabase Storage upload.
- **Logo upload in InviteUserForm:** Tenant invite email uses `orgName` as text wordmark — no logo URL passed. Future plan: pass signed logo URL when storage upload is wired.
- **`invite/[token]/page.tsx` sign-up flow:** Uses `supabase.auth.signUp` with email + password only. Google/Apple OAuth variants for invite acceptance are deferred (OAuth is already conditional per 01-04/01-05 checkpoints).

## Threat Flags

No new network endpoints or auth paths beyond those in the plan's threat model.

All T-06 mitigations applied:
- **T-06-01:** `createAdminClient().auth.admin.signOut(userId, 'global')` called in `removeUserFromOrg`.
- **T-06-02:** `invite_accepted_at` checked IS NULL before accepting; set to now on acceptance; 410 returned for already-accepted tokens.
- **T-06-03:** All Server Actions check `person.role === 'manager' || 'admin'` before mutating.
- **T-06-04:** `RESEND_API_KEY` read in `src/lib/email/send.ts` (server-only file, never `NEXT_PUBLIC_`).

## Self-Check: PASSED

Key files verified present:
- canary-propos/src/lib/email/templates/TenantInviteEmail.tsx — FOUND
- canary-propos/src/lib/email/templates/TeamInviteEmail.tsx — FOUND
- canary-propos/src/lib/email/send.ts — FOUND
- canary-propos/src/app/(manager)/people/actions.ts — FOUND
- canary-propos/src/components/people/InviteStatusBadge.tsx — FOUND
- canary-propos/src/components/people/RemoveUserDialog.tsx — FOUND
- canary-propos/src/app/api/invites/route.ts — FOUND
- canary-propos/src/app/invite/[token]/page.tsx — FOUND
- canary-propos/src/app/(manager)/settings/page.tsx — FOUND
- canary-propos/src/components/onboarding/SetupBanner.tsx — FOUND
- canary-propos/src/app/(manager)/dashboard/page.tsx — FOUND (modified)

Commits verified:
- 3da3e22 — feat(01-06): invite flow — email templates, send utility, inviteUser action, accept route
- ccf90a1 — feat(01-06): people list, session revocation, org settings, setup banner
