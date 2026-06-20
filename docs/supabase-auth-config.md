# Supabase Auth Hook Registration

## Overview

The `custom_access_token_hook` function exists in the database (migration `0003_rls_helpers.sql`)
but must be registered as the active Custom Access Token hook in the Supabase Dashboard. This
step cannot be performed via migration — it requires a one-time click in the Auth settings.

## Why This Matters

The Auth Hook fires at every sign-in and injects three custom claims into the JWT `app_metadata`:

- `org_id` — the user's organization UUID
- `role` — the user's role (`admin`, `manager`, `employee`, `tenant`, `owner`, `vendor`)
- `person_id` — the user's `public.people.id` UUID

All RLS policies on every table call `public.org_id()`, `public.user_role()`, and
`public.person_id()`, which read these claims. **If the hook is not registered, all RLS
policies return NULL for these values and every authenticated query returns zero rows
(or is denied).**

## Registration Checklist

1. Open the Supabase Dashboard for the `ca-central-1` project.

2. Navigate to: **Authentication → Hooks (Beta)**

3. Under the **"Custom Access Token"** section, click **"Add hook"** (or enable the toggle).

4. Select the hook function:
   - Schema: `public`
   - Function: `custom_access_token_hook`

5. Click **"Save"** (or **"Enable"**).

6. Verify the hook shows as **Enabled** with a green status indicator.

## Verification

After enabling the hook, sign in as any test user and inspect the JWT:

```bash
# Decode the access token (requires a valid session)
# In the browser console after sign-in:
const { data: { session } } = await supabase.auth.getSession()
console.log(JSON.parse(atob(session.access_token.split('.')[1])).app_metadata)
# Expected output:
# { org_id: "<uuid>", role: "manager", person_id: "<uuid>" }
```

If `app_metadata` is empty or missing these keys, the hook is not firing. Double-check
that the function is selected and saved correctly.

## Notes

- This is a one-time setup per Supabase project. It survives re-deployments and schema pushes.
- The hook function is `public.custom_access_token_hook` (not `auth.custom_access_token_hook`)
  because Supabase restricts write access to the `auth` schema for user-defined functions.
- If you reset the project or create a new Supabase project, this registration step must be
  repeated.
- The hook is granted `EXECUTE` to `supabase_auth_admin` only; `authenticated`, `anon`,
  and `public` roles have REVOKE on it (enforced in migration `0003_rls_helpers.sql`).
