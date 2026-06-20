---
phase: 01-foundation
plan: 05
subsystem: auth-ui
tags: [auth, onboarding, supabase, zod, react-hook-form, shadcn]
requires: [01-04]
provides: [sign-in-page, oauth-callbacks, onboarding-wizard]
affects: [01-06]
tech_stack_added: [shadcn-form]
tech_stack_patterns: [zod-resolver-client-server, wizard-state-machine, role-based-redirect]
key_files_created:
  - canary-propos/src/lib/validation/auth.ts
  - canary-propos/src/lib/constants/provinces.ts
  - canary-propos/src/components/auth/SignInForm.tsx
  - canary-propos/src/components/auth/MagicLinkForm.tsx
  - canary-propos/src/components/auth/OAuthButtons.tsx
  - canary-propos/src/app/(auth)/login/page.tsx
  - canary-propos/src/app/(auth)/signup/page.tsx
  - canary-propos/src/app/(auth)/auth-code-error/page.tsx
  - canary-propos/src/app/auth/callback/route.ts
  - canary-propos/src/app/auth/confirm/route.ts
  - canary-propos/src/app/onboarding/page.tsx
  - canary-propos/src/app/onboarding/actions.ts
  - canary-propos/src/components/onboarding/WizardShell.tsx
  - canary-propos/src/components/onboarding/steps/OrgNameStep.tsx
  - canary-propos/src/components/onboarding/steps/LogoStep.tsx
  - canary-propos/src/components/onboarding/steps/ProvinceStep.tsx
  - canary-propos/src/components/onboarding/steps/InviteStep.tsx
key_files_modified:
  - canary-propos/src/components/ui/form.tsx (added via shadcn CLI)
decisions:
  - "Auth error copy uses UI-SPEC verbatim: 'Couldn't sign you in' heading with non-technical body"
  - "Callback route redirects to /auth-code-error (relative path) rather than full auth path to stay within (auth) route group"
  - "Onboarding wizard is client-side state machine; org creation Server Action runs at Step 4 completion"
  - "Logo file selection shown in LogoStep but upload happens separately — logo path stored as pending reference until org ID exists"
  - "setup_completed_at remains null when logoPath is null AND inviteEmail is null/empty (both optional steps skipped)"
metrics:
  duration_minutes: 45
  completed_date: "2026-06-20"
  tasks_completed: 2
  files_created: 17
---

# Phase 01 Plan 05: Auth UI + Onboarding Wizard Summary

**One-liner:** Single /login page with email/password, magic link, Google/Apple OAuth, role-based redirect via D-04 map, plus 5-step onboarding wizard that creates org + manager person row via Server Action with setup_completed_at tracking for D-02 banner.

## What Was Built

### Task 1: Sign-in page (4 methods) and callback handlers

- **`src/lib/validation/auth.ts`** — Zod schemas for sign-in (email + 8-char password), magic link (email only), and sign-up. Single schema shared by client (`zodResolver`) and server (Server Actions).
- **`src/components/auth/SignInForm.tsx`** — email/password form with show/hide toggle (Eye/EyeOff), Zod validation, UI-SPEC error heading "Couldn't sign you in" with non-technical body copy, loading spinner on submit.
- **`src/components/auth/MagicLinkForm.tsx`** — email-only form calling `signInWithOtp`, inline "Check your email" confirmation after send, toggle back to password mode.
- **`src/components/auth/OAuthButtons.tsx`** — Google (white/border) and Apple (black) buttons using `signInWithOAuth`, "Redirecting to..." loading state, 44px touch height.
- **`src/app/(auth)/login/page.tsx`** — Centered card (max-width 400px), Canary wordmark, password/magic-link toggle, "Or" separator, OAuth buttons, "Create one" link.
- **`src/app/auth/callback/route.ts`** — `exchangeCodeForSession`, reads `user.app_metadata.role`, redirects via D-04 map; falls through to `/auth-code-error` on failure.
- **`src/app/auth/confirm/route.ts`** — OTP magic link confirmation via `verifyOtp`, same role-redirect map.
- **`src/app/(auth)/auth-code-error/page.tsx`** — UI-SPEC "Sign-in didn't complete" copy with "Back to sign in" link.

### Task 2: 5-step onboarding wizard and org-creation Server Action

- **`src/lib/constants/provinces.ts`** — All 13 Canadian provinces/territories (value/label pairs, alphabetical per UI-SPEC).
- **`src/app/onboarding/actions.ts`** — `createOrganization` Server Action: Zod-validates name (2-80 chars), province (enum), invite email (optional); inserts `organizations` row with `setup_completed_at` set only when neither logo nor invite were skipped; inserts `people` row with `role='manager'` and `invite_accepted_at`.
- **`src/components/onboarding/WizardShell.tsx`** — shadcn `Progress` bar, "Step N of 5" counter (14px), step label display.
- **`src/components/onboarding/steps/OrgNameStep.tsx`** — Required, 2-80 char validation, "Continue" CTA.
- **`src/components/onboarding/steps/LogoStep.tsx`** — Optional, file input (PNG/JPEG/WebP, 2MB max), 80x80 avatar preview, "Skip for now" link.
- **`src/components/onboarding/steps/ProvinceStep.tsx`** — Required, shadcn `Select` with all 13 provinces, keyboard navigable.
- **`src/components/onboarding/steps/InviteStep.tsx`** — Optional, valid email format only, "Skip for now" link.
- **`src/app/onboarding/page.tsx`** — Client-side wizard state machine, orchestrates all 4 steps plus Step 5 completion screen ("You're all set, {org name}!").
- **`src/app/(auth)/signup/page.tsx`** — Account creation via `supabase.auth.signUp`, redirects to `/onboarding` (D-03: same flow for all customers).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] shadcn/ui `form` component not installed**
- **Found during:** Task 1 setup
- **Issue:** `form.tsx` was missing from `src/components/ui/` despite being listed in the UI-SPEC component inventory.
- **Fix:** Ran `npx shadcn@latest add form` (declined overwrite prompts for existing button/label). Form component added.
- **Files modified:** `src/components/ui/form.tsx`, `package.json`, `package-lock.json`

**2. [Rule 1 - Bug] `Button asChild` prop not supported in this shadcn version**
- **Found during:** TypeScript check after Task 1 draft
- **Issue:** The installed `button.tsx` uses `@base-ui/react/button` (a newer pattern) which does not expose an `asChild` prop. Using `Button asChild` with `Link` caused a TS2322 error.
- **Fix:** Replaced `<Button asChild><Link>` in `auth-code-error/page.tsx` with a plain `<Link>` styled with Tailwind to match the button's visual appearance.
- **Files modified:** `src/app/(auth)/auth-code-error/page.tsx`

## Known Stubs

- **Logo upload flow:** `LogoStep.tsx` collects the file locally and shows a preview but the actual upload to Supabase Storage `org-assets/` bucket happens outside the current Server Action (the action receives a path string, not a file). The pending logo path is a placeholder reference. A future plan (01-06 or org settings) should wire the actual upload. This does not prevent the wizard from completing — the logo remains null in the DB until properly uploaded.

## Threat Flags

No new network endpoints or auth paths introduced beyond those in the plan's threat model.

All T-05 mitigations applied:
- **T-05-01:** `exchangeCodeForSession` server-side; redirect map uses only known internal paths.
- **T-05-02:** UI-SPEC copy verbatim; no raw error codes in any user-facing error.
- **T-05-03:** Zod validation on all Server Action inputs; RLS enforces org scope at DB layer.

## Self-Check: PASSED

Key files verified present:
- canary-propos/src/lib/validation/auth.ts — FOUND
- canary-propos/src/lib/constants/provinces.ts — FOUND
- canary-propos/src/components/auth/SignInForm.tsx — FOUND
- canary-propos/src/app/auth/callback/route.ts — FOUND
- canary-propos/src/app/onboarding/actions.ts — FOUND
- canary-propos/src/components/onboarding/WizardShell.tsx — FOUND

Commits verified:
- dd6cfda — feat(01-05): sign-in page with 4 auth methods and OAuth callback handlers
- b79dd9d — feat(01-05): 5-step onboarding wizard and org-creation Server Action
