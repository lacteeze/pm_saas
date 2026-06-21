---
phase: 01-foundation
reviewed: 2026-06-20T00:00:00Z
depth: standard
files_reviewed: 23
files_reviewed_list:
  - canary-propos/src/middleware.ts
  - canary-propos/src/lib/supabase/admin.ts
  - canary-propos/src/lib/supabase/server.ts
  - canary-propos/src/lib/supabase/client.ts
  - canary-propos/src/app/onboarding/actions.ts
  - canary-propos/src/app/(manager)/people/actions.ts
  - canary-propos/src/app/(manager)/settings/actions.ts
  - canary-propos/src/app/auth/callback/route.ts
  - canary-propos/src/app/auth/confirm/route.ts
  - canary-propos/src/app/api/invites/route.ts
  - canary-propos/src/app/api/invites/accept/route.ts
  - canary-propos/src/components/auth/SignInForm.tsx
  - canary-propos/src/components/auth/MagicLinkForm.tsx
  - canary-propos/src/components/auth/OAuthButtons.tsx
  - canary-propos/src/app/(auth)/login/page.tsx
  - canary-propos/src/app/(auth)/signup/page.tsx
  - canary-propos/src/app/(admin)/layout.tsx
  - canary-propos/src/app/invite/[token]/page.tsx
  - canary-propos/src/app/onboarding/page.tsx
  - canary-propos/src/components/onboarding/WizardShell.tsx
  - canary-propos/src/components/onboarding/steps/OrgNameStep.tsx
  - canary-propos/src/components/onboarding/steps/ProvinceStep.tsx
  - canary-propos/src/components/onboarding/steps/InviteStep.tsx
findings:
  critical: 6
  warning: 5
  info: 3
  total: 14
status: issues_found
---

# Phase 01: Code Review Report

**Reviewed:** 2026-06-20
**Depth:** standard
**Files Reviewed:** 23
**Status:** issues_found

## Summary

Phase 1 establishes the multi-tenant security boundary: auth, RLS bootstrap, JWT claims injection, org management, and invite flow. The structural security choices are sound — `getUser()` over `getSession()` in middleware, global `signOut` on removal, independent admin layout re-check, Zod validation on server actions, and no `NEXT_PUBLIC_` prefix on the service role key.

Six critical issues were found. The two most severe are an unauthenticated invite-accept endpoint that allows account takeover via `userId` spoofing, and an open redirect vector in both auth callback routes that allows `origin` to be controlled by the attacker. Three additional critical issues concern the logo upload path being stored but the file never actually uploaded (broken data), the `/onboarding` route being ungated by middleware (any unauthenticated user can reach it), and the `updateOrgLogo` action lacking authorization checks. Five warnings cover a race condition in invite acceptance, a missing expiry on invite tokens, error logging leaking internal Supabase detail, and a sign-up flow that races to `/onboarding` before email confirmation.

---

## Critical Issues

### CR-01: Unauthenticated invite-accept endpoint allows `userId` spoofing (account takeover)

**File:** `canary-propos/src/app/api/invites/accept/route.ts:15-63`

**Issue:** `POST /api/invites/accept` accepts a `userId` from the request body and writes it directly to the `people` row — no authentication check is performed. Any anonymous caller who knows (or enumerates) a valid invite token can supply an arbitrary `userId`, linking any Supabase auth identity to the invite. Since the people row drives RLS and JWT claims, this grants the attacker the role and `org_id` of the invited person.

Invite tokens are UUIDs (128-bit), so brute-force is impractical, but tokens are transmitted in email links and could be leaked via Referer headers, browser history, or email forwarding. The endpoint must verify that the `userId` in the body actually matches the authenticated session making the request.

**Fix:**
```ts
// In route.ts — add session verification before the update
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  // ... parse body as before ...

  // Verify the caller IS the userId they claim to be
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.id !== parsed.data.userId) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  // ... rest of handler unchanged ...
}
```

---

### CR-02: Open redirect in auth callback routes via unvalidated `origin`

**File:** `canary-propos/src/app/auth/callback/route.ts:17,48` and `canary-propos/src/app/auth/confirm/route.ts:18,49`

**Issue:** Both routes construct the final redirect using `origin` extracted from `new URL(request.url)`. In Next.js middleware-proxied or header-manipulated requests, `request.url` may reflect a `Host` header controlled by the client. If an attacker tricks Supabase into generating a callback URL pointing at a malicious origin (e.g., via a phishing link), `new URL(redirectPath, origin)` redirects the authenticated session to an attacker-controlled domain — carrying the session cookie.

Concretely: `origin` is whatever is in `request.url`, which is assembled from the `Host` header in some deployment configurations. The fix is to validate that the final redirect target is within the known application origin.

**Fix:**
```ts
const APP_ORIGIN = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

// Replace:
return NextResponse.redirect(new URL(redirectPath, origin))

// With:
const safeRedirect = new URL(redirectPath, APP_ORIGIN)
return NextResponse.redirect(safeRedirect)
```
Apply the same fix in both `callback/route.ts` and `confirm/route.ts`.

---

### CR-03: `updateOrgLogo` action has no authorization check — any authenticated user can overwrite any org's logo

**File:** `canary-propos/src/app/onboarding/actions.ts:136-157`

**Issue:** `updateOrgLogo(orgId, logoPath)` accepts an `orgId` from the caller, verifies the user is authenticated, then issues an `.update()` scoped to that `orgId` with no check that the caller belongs to that org or holds a manager/admin role. The update goes through the user-level Supabase client (respects RLS), but the `orgId` parameter is entirely caller-controlled. If RLS does not enforce org membership on the `organizations` table's update policy, a user from one org can overwrite the logo of a different org simply by passing a different UUID.

Even if RLS catches it, the action surface is wrong — it should derive `orgId` from the authenticated session's JWT claims, never from user input.

**Fix:**
```ts
export async function updateOrgLogo(logoPath: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'You must be signed in.' }

  // Derive orgId from the authenticated session, not from caller input
  const orgId = user.app_metadata?.org_id as string | undefined
  if (!orgId) return { success: false, error: 'No organization found for your account.' }

  // Also enforce role
  const role = user.app_metadata?.role as string | undefined
  if (role !== 'manager' && role !== 'admin') {
    return { success: false, error: 'Only managers can update the organization logo.' }
  }

  const { error } = await supabase
    .from('organizations')
    .update({ logo_path: logoPath })
    .eq('id', orgId)
  // ...
}
```

---

### CR-04: `/onboarding` route is not gated by middleware — unauthenticated users can reach it

**File:** `canary-propos/src/middleware.ts:7-15`

**Issue:** `isProtectedPath()` checks for `/dashboard`, `/my-home`, `/portfolio`, `/jobs`, and `/admin` — but not `/onboarding`. An unauthenticated visitor navigating directly to `/onboarding` will not be redirected to `/login`. The onboarding page calls the `createOrganization` Server Action which does perform its own auth check and will return an error, but the page itself loads and renders the wizard UI, and any future onboarding steps added without their own checks would be reachable.

Additionally, authenticated users who already have an org should be redirected away from `/onboarding`, but that gating is also absent from middleware.

**Fix:**
```ts
function isProtectedPath(pathname: string): boolean {
  return (
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/my-home') ||
    pathname.startsWith('/portfolio') ||
    pathname.startsWith('/jobs') ||
    pathname.startsWith('/admin') ||
    pathname.startsWith('/onboarding')   // add this
  )
}
```

---

### CR-05: Logo upload path stored before file is uploaded — broken data written to DB on every logo step

**File:** `canary-propos/src/app/onboarding/page.tsx:45-65`

**Issue:** In `handleLogo()`, a `filePath` string is constructed and stored in `data.logoPath` with a note that "actual file object is not available here since LogoStep only passes the name." This `filePath` is then passed to `createOrganization()` and written to the `logo_path` column. The file was never actually uploaded to Supabase Storage — only a path string was computed. Any subsequent read of `logo_path` will produce a 404 from storage. This is a data integrity bug that silently persists a broken reference.

**Fix:** Either (a) `LogoStep` must complete the Supabase Storage upload itself and call `onNext` with the finalized storage path (not just the filename), or (b) the parent must pass the actual `File` object through state and upload it before calling `createOrganization`. The dead code path in `handleLogo` (where the file never uploads but a path is stored) must be removed.

---

### CR-06: Invite acceptance page calls `/api/invites/accept` before Supabase email confirmation completes

**File:** `canary-propos/src/app/invite/[token]/page.tsx:77-115`

**Issue:** `supabase.auth.signUp()` with email confirmation enabled returns a user object immediately but the account is unconfirmed. The code at line 96 reads `signUpData.user.id` and posts it to `/api/invites/accept`, linking the unconfirmed `user_id` to the people row and setting `active: true` and `invite_accepted_at`. If the user never confirms their email, the people row remains linked to an unconfirmed auth identity with `active: true`, which the Auth Hook will use to inject real JWT claims.

Supabase returns a session immediately for unconfirmed users in some configurations (e.g., when `autoconfirm` is enabled), but in a production config with confirmation required, `signUpData.session` will be null and `signUpData.user` will exist but be unconfirmed. The invite should only be accepted after email confirmation — ideally in the `/auth/callback` route where the confirmed session is available.

**Fix:** Check for a live session before calling accept:
```ts
if (signUpError || !signUpData.user || !signUpData.session) {
  // No immediate session → email confirmation required
  // Show "Check your email" state instead of immediately calling accept
  setState({ status: 'error', message: 'Please check your email to confirm your account.' })
  return
}
```
And wire the actual invite linkage into `/auth/callback` using state passed via the redirect URL or a pending-invite cookie.

---

## Warnings

### WR-01: Race condition in invite accept — TOCTOU between check and update

**File:** `canary-propos/src/app/api/invites/accept/route.ts:32-56`

**Issue:** The handler fetches the invite row (line 32-39), checks `invite_accepted_at` (line 41-43), then performs a separate `.update()` (line 47-56). Between the check and the update, a concurrent request with the same token could pass the check and also perform the update — creating a race that allows a token to be used twice. The `userId` from both requests would be written, with the last write winning, potentially linking the wrong user.

**Fix:** Use a conditional update that only succeeds if `invite_accepted_at IS NULL`:
```ts
const { data, error: updateError } = await admin
  .from('people')
  .update({ user_id: userId, invite_accepted_at: new Date().toISOString(), active: true, ... })
  .eq('id', person.id)
  .is('invite_accepted_at', null)   // atomic guard
  .select('id')
  .single()

if (!data) {
  return NextResponse.json({ error: 'Invite already accepted.' }, { status: 410 })
}
```

---

### WR-02: Invite tokens never expire — a token leaked today is valid indefinitely

**File:** `canary-propos/src/app/api/invites/route.ts:16-37` and `canary-propos/src/app/(manager)/people/actions.ts:79`

**Issue:** When an invite token is looked up, only `invite_accepted_at` is checked — there is no expiry. A token included in an email sent months ago, or one that appears in a phishing email, remains valid forever. This is a security gap: leaked tokens from old invites provide permanent unauthorized access paths.

**Fix:** Add an `invite_expires_at` timestamp to the `people` row (e.g., 7 days after `invite_sent_at`), set it in `inviteUser()`, and check it in both the GET and POST invite routes:
```ts
// In inviteUser() action:
invite_expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),

// In GET /api/invites:
if (person.invite_expires_at && new Date(person.invite_expires_at) < new Date()) {
  return NextResponse.json({ error: 'invite_expired' }, { status: 410 })
}
```

---

### WR-03: `console.error` in server actions logs raw Supabase error objects to production logs

**File:** `canary-propos/src/app/(manager)/people/actions.ts:99`, `canary-propos/src/app/(manager)/settings/actions.ts:72`, `canary-propos/src/app/api/invites/accept/route.ts:59`

**Issue:** Raw Supabase `PostgrestError` objects are logged via `console.error`. These objects contain `message`, `code`, `details`, and `hint` fields that expose internal database schema details (table names, constraint names, column names). In a production environment these logs go to Vercel's log drain and may be accessible to developers/support staff — or if log forwarding is misconfigured, to broader audiences. They also make it harder to detect anomalies since noise from expected errors (like duplicate key on re-invite) mixes with genuine failures.

**Fix:** Log a structured summary rather than the raw error object:
```ts
console.error('[inviteUser] upsert error', {
  code: upsertError.code,
  message: upsertError.message,
})
```

---

### WR-04: Sign-up page redirects to `/onboarding` without waiting for email confirmation

**File:** `canary-propos/src/app/(auth)/signup/page.tsx:53-54`

**Issue:** After `supabase.auth.signUp()`, the code immediately calls `router.push('/onboarding')`. When email confirmation is required (the production-correct Supabase config), the user has no confirmed session at this point. The onboarding page will render, and when `createOrganization` is called it will call `supabase.auth.getUser()` — which may return a user (Supabase returns the unconfirmed user object) but the JWT will lack confirmed status. This creates an inconsistent state where an org is created for an unconfirmed identity.

At minimum the code should check whether `signUpData.session` is null (indicating confirmation required) and render a "Check your email" screen before proceeding.

**Fix:**
```ts
const { data, error } = await supabase.auth.signUp({ ... })
if (error) { ... }

if (!data.session) {
  // Email confirmation required — do not proceed to onboarding yet
  setConfirmationSent(true)  // render a "check your inbox" state
  return
}

router.push('/onboarding')
```

---

### WR-05: `person_id` set to `null` in JWT claims during onboarding bootstrap — downstream code may assume it is populated

**File:** `canary-propos/src/app/onboarding/actions.ts:124-131`

**Issue:** After creating the org and the manager people row, `updateUserById` is called to inject JWT claims immediately. The `person_id` field is explicitly set to `null` with a comment that it "will be populated on next sign-in via Auth Hook lookup." Any code that reads `user.app_metadata.person_id` before the user signs out and back in will receive `null`. If such code performs a non-null assertion (`person_id!`) or passes `null` into a UUID column, it will either throw or silently write a null FK, both of which are bugs. The risk is not theoretical — the user is immediately redirected to `/dashboard` at line 127 without any sign-out/sign-in cycle.

**Fix:** Either query the `person_id` immediately after insert (Supabase returns the inserted row ID) and include it in the `updateUserById` call:
```ts
const { data: personRow } = await admin
  .from('people')
  .insert({ ... })
  .select('id')
  .single()

await admin.auth.admin.updateUserById(user.id, {
  app_metadata: { role: 'manager', org_id: org.id, person_id: personRow.id },
})
```

---

## Info

### IN-01: Onboarding invite step description mismatches actual implementation

**File:** `canary-propos/src/components/onboarding/steps/InviteStep.tsx:51-54`

**Issue:** The UI tells the user "They'll receive an email to join your organization as a **manager**." However, the `createOrganization` action does not send any invite at this step — it stores `inviteEmail` in the wizard state and passes it to the action, but `createOrganization` in `actions.ts` never sends an email or creates a people row for the invited email. The invite email field appears to be a stub that is accepted and then dropped silently.

**Fix:** Either implement invite sending inside `createOrganization` (call `inviteUser` with the email and role `'manager'`) or remove the invite step from the onboarding wizard until it is implemented.

---

### IN-02: `isProtectedPath` redirects wrong-role authenticated users to `/login` instead of their portal

**File:** `canary-propos/src/middleware.ts:57-81`

**Issue:** When an authenticated user navigates to the wrong portal (e.g., a tenant visiting `/dashboard`), they are redirected to `/login`. Since they are already signed in, they will be immediately bounced back to whatever their post-login default is. The correct behavior is to redirect them to their own portal (`/my-home` for a tenant), not `/login`. The current behavior creates a confusing redirect loop that passes through the login page unnecessarily.

**Fix:** Replace wrong-role redirects with the correct role-appropriate destination:
```ts
if (pathname.startsWith('/my-home') && role !== 'tenant') {
  const dest = ROLE_REDIRECT_MAP[role ?? ''] ?? '/login'
  return NextResponse.redirect(new URL(dest, request.url))
}
```

---

### IN-03: `console.error` debug artifact in production server action

**File:** `canary-propos/src/app/(manager)/people/actions.ts:99`

**Issue:** `console.error('[inviteUser] upsert error:', upsertError)` logs a raw error object. Beyond the schema exposure noted in WR-03, this is the only `console.error` that logs the entire error object rather than a summary. The others at least have the error in a named parameter position. This one directly concatenates the object into the log string via the second argument, which in Node.js causes full object serialization.

**Fix:** Already addressed by WR-03 fix above — restructure to log only `{ code, message }`.

---

_Reviewed: 2026-06-20_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
