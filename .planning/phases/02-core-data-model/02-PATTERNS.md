# Phase 2: Core Data Model - Pattern Map

**Mapped:** 2026-06-21
**Files analyzed:** 22 new/modified files
**Analogs found:** 22 / 22

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `supabase/migrations/0008_create_properties.sql` | migration | CRUD | `supabase/migrations/0005_rls_people.sql` | exact |
| `supabase/migrations/0009_create_portfolios.sql` | migration | CRUD | `supabase/migrations/0005_rls_people.sql` | exact |
| `supabase/migrations/0010_extend_units.sql` | migration | CRUD | `supabase/migrations/0007_units_plan_limit.sql` | exact |
| `supabase/migrations/0011_create_leases.sql` | migration | CRUD | `supabase/migrations/0005_rls_people.sql` | exact |
| `supabase/migrations/0012_alter_people_role.sql` | migration | transform | `supabase/migrations/0003_rls_helpers.sql` | role-match |
| `supabase/migrations/0013_update_storage_bucket.sql` | migration | config | `supabase/migrations/0006_storage_buckets.sql` | exact |
| `src/app/(manager)/people/page.tsx` (update) | page (RSC) | request-response | itself | exact |
| `src/app/(manager)/properties/page.tsx` | page (RSC) | request-response | `src/app/(manager)/people/page.tsx` | exact |
| `src/app/(manager)/properties/[id]/page.tsx` | page (RSC) | request-response | `src/app/(manager)/people/page.tsx` | role-match |
| `src/app/(manager)/leases/page.tsx` | page (RSC) | request-response | `src/app/(manager)/people/page.tsx` | exact |
| `src/app/(manager)/leases/[id]/page.tsx` | page (RSC) | request-response | `src/app/(manager)/people/page.tsx` | role-match |
| `src/app/(manager)/dashboard/page.tsx` (update) | page (RSC) | request-response | itself | exact |
| `src/app/(tenant)/my-home/page.tsx` (update) | page (RSC) | request-response | `src/app/(manager)/people/page.tsx` | role-match |
| `src/components/people/AddContactForm.tsx` | component | request-response | `src/components/people/InviteUserForm.tsx` | exact |
| `src/components/people/EditContactForm.tsx` | component | request-response | `src/components/people/InviteUserForm.tsx` | exact |
| `src/components/people/ContactsTab.tsx` | component | request-response | `src/app/(manager)/people/page.tsx` | exact |
| `src/components/properties/AddPropertyForm.tsx` | component | request-response | `src/components/people/InviteUserForm.tsx` | exact |
| `src/components/properties/AddUnitForm.tsx` | component | request-response | `src/components/people/InviteUserForm.tsx` | exact |
| `src/components/properties/PropertyPhotoUpload.tsx` | component | file-I/O | `src/components/people/InviteUserForm.tsx` | role-match |
| `src/components/leases/AddLeaseForm.tsx` | component | request-response | `src/components/people/InviteUserForm.tsx` | exact |
| `src/components/leases/LeaseDocUpload.tsx` | component | file-I/O | `src/components/people/InviteUserForm.tsx` | role-match |
| `src/components/leases/ExpiryAlertCallout.tsx` | component | request-response | `src/components/onboarding/SetupBanner.tsx` | role-match |
| `src/components/dashboard/SummaryCards.tsx` | component | request-response | `src/components/onboarding/SetupBanner.tsx` | role-match |
| `src/app/actions/contacts.ts` | server action | CRUD | `src/app/(manager)/people/actions.ts` | exact |
| `src/app/actions/properties.ts` | server action | CRUD | `src/app/(manager)/people/actions.ts` | exact |
| `src/app/actions/units.ts` | server action | CRUD | `src/app/(manager)/people/actions.ts` | exact |
| `src/app/actions/portfolios.ts` | server action | CRUD | `src/app/(manager)/people/actions.ts` | exact |
| `src/app/actions/leases.ts` | server action | CRUD + file-I/O | `src/app/(manager)/people/actions.ts` | exact |

---

## Pattern Assignments

### Migration files: `0008_create_properties.sql`, `0009_create_portfolios.sql`, `0011_create_leases.sql`

**Analog:** `canary-propos/supabase/migrations/0005_rls_people.sql`

**RLS policy structure** (lines 13–53 of analog — copy this pattern exactly for every new table):
```sql
-- SELECT: staff within org
CREATE POLICY "table_select_staff"
ON public.TABLE FOR SELECT TO authenticated
USING (
  org_id = (SELECT public.org_id())
  AND (SELECT public.user_role()) IN ('manager', 'employee', 'admin')
);

-- SELECT: admin cross-org
CREATE POLICY "table_select_admin"
ON public.TABLE FOR SELECT TO authenticated
USING ( (SELECT public.user_role()) = 'admin' );

-- INSERT: manager/admin only
CREATE POLICY "table_insert_manager"
ON public.TABLE FOR INSERT TO authenticated
WITH CHECK (
  org_id = (SELECT public.org_id())
  AND (SELECT public.user_role()) IN ('manager', 'admin')
);

-- UPDATE: USING + WITH CHECK both required
CREATE POLICY "table_update_manager"
ON public.TABLE FOR UPDATE TO authenticated
USING (
  org_id = (SELECT public.org_id())
  AND (SELECT public.user_role()) IN ('manager', 'admin')
)
WITH CHECK (
  org_id = (SELECT public.org_id())
  AND (SELECT public.user_role()) IN ('manager', 'admin')
);

-- DELETE: manager/admin only
CREATE POLICY "table_delete_manager"
ON public.TABLE FOR DELETE TO authenticated
USING (
  org_id = (SELECT public.org_id())
  AND (SELECT public.user_role()) IN ('manager', 'admin')
);
```

**Critical rule** (lines 1–6 of analog, comment block): Every `public.org_id()`, `public.user_role()`, `public.person_id()` call MUST be wrapped in `(SELECT ...)`. Never use bare function calls in USING/WITH CHECK clauses.

---

### Migration: `0013_update_storage_bucket.sql`

**Analog:** `canary-propos/supabase/migrations/0006_storage_buckets.sql`

**Bucket INSERT pattern** (lines 10–18 of analog):
```sql
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('org-assets', 'org-assets', false, 5242880, ARRAY['image/jpeg', ...])
ON CONFLICT (id) DO NOTHING;
```

**For Phase 2 — UPDATE the existing bucket** (not INSERT):
```sql
UPDATE storage.buckets
SET
  file_size_limit = 20971520,
  allowed_mime_types = ARRAY[
    'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml',
    'application/pdf'
  ]
WHERE id = 'org-assets';
```

**Storage SELECT policy pattern** (lines 27–35 of analog — path segment 1 = org_id):
```sql
CREATE POLICY "storage_select_staff"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'org-assets'
  AND (storage.foldername(name))[1] = (SELECT public.org_id())::text
  AND (SELECT public.user_role()) IN ('manager', 'employee', 'admin')
);
```

**New tenant lease policy** (add to 0013 — path segments: [1]=org_id, [2]='leases', [3]=lease_id):
```sql
CREATE POLICY "storage_select_tenant_lease"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'org-assets'
  AND (storage.foldername(name))[1] = (SELECT public.org_id())::text
  AND (SELECT public.user_role()) = 'tenant'
  AND (storage.foldername(name))[2] = 'leases'
  AND EXISTS (
    SELECT 1 FROM public.leases l
    WHERE l.id::text = (storage.foldername(name))[3]
      AND l.tenant_id = (SELECT public.person_id())
      AND l.org_id = (SELECT public.org_id())
  )
);
```

---

### RSC Page: `src/app/(manager)/properties/page.tsx` and `src/app/(manager)/leases/page.tsx`

**Analog:** `canary-propos/src/app/(manager)/people/page.tsx`

**Session + caller resolution pattern** (lines 10–26 — copy verbatim, change table names):
```typescript
const supabase = await createClient()
const { data: { user } } = await supabase.auth.getUser()
if (!user) redirect('/login')

const { data: callerPerson } = await supabase
  .from('people')
  .select('org_id, role')
  .eq('user_id', user.id)
  .eq('active', true)
  .single()

if (!callerPerson) redirect('/login')
```

**Data fetch pattern** (lines 29–33):
```typescript
const { data: items } = await supabase
  .from('TABLE')
  .select('id, col1, col2, ...')
  .eq('org_id', callerPerson.org_id)
  .order('created_at', { ascending: true })
```

**isManager gate** (line 43 — NOTE: after people.role migration to text[], use `.includes()`):
```typescript
// Phase 2: role is text[] after 0012 migration
const isManager = callerPerson.role?.includes('manager') || callerPerson.role?.includes('admin')
```

**Desktop table pattern** (lines 73–122 — copy structure verbatim):
```tsx
<div className="hidden overflow-hidden rounded-xl border border-stone-200 md:block">
  <table className="w-full text-sm">
    <thead className="bg-stone-50 text-left text-xs font-medium uppercase tracking-wider text-stone-500">
      <tr>
        <th className="px-4 py-3">Column Name</th>
        {/* ... */}
      </tr>
    </thead>
    <tbody className="divide-y divide-stone-100">
      {items.map((item) => (
        <tr key={item.id} className="bg-white hover:bg-stone-50">
          <td className="px-4 py-3 font-medium text-stone-900">{item.col}</td>
        </tr>
      ))}
    </tbody>
  </table>
</div>
```

**Mobile cards pattern** (lines 125–159 — copy structure verbatim):
```tsx
<div className="space-y-3 md:hidden">
  {items.map((item) => (
    <div key={item.id} className="rounded-xl border border-stone-200 bg-white p-4">
      <div className="mb-2 flex items-start justify-between">
        <div>
          <p className="font-medium text-stone-900">{item.primary}</p>
          <p className="text-sm text-stone-500">{item.secondary}</p>
        </div>
        {/* Badge or status */}
      </div>
    </div>
  ))}
</div>
```

**Empty state pattern** (lines 59–69):
```tsx
<div className="rounded-xl border border-dashed border-stone-200 px-8 py-16 text-center">
  <h2 className="mb-2 text-base font-semibold text-stone-900">No items yet</h2>
  <p className="mb-6 text-sm text-stone-500">Description of what to do.</p>
  {isManager && <ActionButton />}
</div>
```

**Page wrapper** (line 46):
```tsx
<div className="mx-auto max-w-4xl px-4 py-8 md:px-8">
```

---

### RSC Page: `src/app/(manager)/dashboard/page.tsx` (update)

**Analog:** `canary-propos/src/app/(manager)/dashboard/page.tsx` (the file itself)

**Current structure** (lines 1–44 — full file, read already):
- Session check → redirect('/login') if no user
- `people` row fetch for org_id (lines 18–24)
- Secondary data fetch using org_id (lines 26–31)
- JSX renders above existing content (lines 33–43)

**Phase 2 additions follow the same data fetch pattern** — add parallel queries using `Promise.all` after the person row is resolved:
```typescript
const orgId = person.org_id

const [
  { count: totalUnits },
  { count: occupiedUnits },
  { count: vacantUnits },
  { count: activeLeases },
] = await Promise.all([
  supabase.from('units').select('*', { count: 'exact', head: true }).eq('org_id', orgId),
  supabase.from('units').select('*', { count: 'exact', head: true }).eq('org_id', orgId).eq('status', 'occupied'),
  supabase.from('units').select('*', { count: 'exact', head: true }).eq('org_id', orgId).eq('status', 'vacant'),
  supabase.from('leases').select('*', { count: 'exact', head: true }).eq('org_id', orgId).eq('status', 'active'),
])
```

**Retain** the `SetupBanner` import and render (lines 5, 36) — it stays above new content.

---

### RSC Page: `src/app/(tenant)/my-home/page.tsx` (update)

**Analog:** `canary-propos/src/app/(manager)/people/page.tsx` (session pattern only)

Current file is a 14-line placeholder (no session check). Phase 2 replaces it entirely.

**Session + tenant data pattern** (copy session check from people/page.tsx lines 10–26, then):
```typescript
const { data: person } = await supabase
  .from('people')
  .select('id, org_id')
  .eq('user_id', user.id)
  .single()

const { data: lease } = await supabase
  .from('leases')
  .select(`
    id,
    start_date,
    end_date,
    monthly_rent,
    document_path,
    units!unit_id (
      unit_number,
      properties!property_id ( street_address, city, province )
    )
  `)
  .eq('tenant_id', person.id)
  .eq('status', 'active')
  .maybeSingle()
```

Note: `maybeSingle()` not `.single()` — tenant may not yet have a lease in the system.

---

### Client Component: `src/components/people/AddContactForm.tsx` and all `*Form.tsx`

**Analog:** `canary-propos/src/components/people/InviteUserForm.tsx`

**'use client' + imports pattern** (lines 1–13):
```typescript
'use client'

import { useState, useTransition } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
```

**State + form handler pattern** (lines 27–65):
```typescript
const [open, setOpen] = useState(false)
const [error, setError] = useState<string | null>(null)
const [isPending, startTransition] = useTransition()

function handleSubmit(e: React.FormEvent) {
  e.preventDefault()
  setError(null)
  startTransition(async () => {
    const result = await serverAction({ /* fields */ })
    if (result.success) {
      toast.success('Success message')
      setOpen(false)
    } else {
      setError(result.error)
    }
  })
}
```

**Dialog trigger + button pattern** (lines 68–76):
```tsx
<Dialog open={open} onOpenChange={setOpen}>
  <DialogTrigger render={<span />} onClick={() => setOpen(true)}>
    <button
      type="button"
      className="inline-flex min-h-11 items-center justify-center rounded-md bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700"
    >
      {buttonLabel}
    </button>
  </DialogTrigger>
```

**Form input pattern** (lines 83–97 — Tailwind classes to copy exactly):
```tsx
<form onSubmit={handleSubmit} className="mt-2 space-y-4">
  <div>
    <label htmlFor="field-id" className="mb-1 block text-sm font-medium text-stone-700">
      Label
    </label>
    <input
      id="field-id"
      type="text"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-600"
    />
  </div>
```

**Submit button pattern** (lines 184–189):
```tsx
<button
  type="submit"
  disabled={isPending}
  className="mt-2 flex min-h-11 w-full items-center justify-center rounded-md bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-60"
>
  {isPending ? 'Saving...' : 'Save'}
</button>
```

**Error display pattern** (lines 178–182):
```tsx
{error && (
  <p className="text-sm text-red-600" role="alert">
    {error}
  </p>
)}
```

---

### Server Actions: `src/app/actions/contacts.ts`, `properties.ts`, `units.ts`, `portfolios.ts`, `leases.ts`

**Analog:** `canary-propos/src/app/(manager)/people/actions.ts`

**File header + imports pattern** (lines 1–10):
```typescript
'use server'

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
```

**ActionResult type** (lines 25–27 — copy verbatim into every actions file):
```typescript
export type ActionResult =
  | { success: true }
  | { success: false; error: string }
```

**getCallerContext helper** (lines 30–47 — copy verbatim, name it consistently):
```typescript
async function getCallerContext() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: person } = await supabase
    .from('people')
    .select('org_id, role')
    .eq('user_id', user.id)
    .eq('active', true)
    .single()

  if (!person) return null
  return { supabase, user, person }
}
```

**Action authz + validate + insert pattern** (lines 59–101 — the structural skeleton):
```typescript
export async function createThing(formData: FormDataType): Promise<ActionResult> {
  const ctx = await getCallerContext()
  if (!ctx) return { success: false, error: 'You must be signed in.' }

  // Authz: after 0012 migration, role is text[] — use includes()
  if (!ctx.person.role?.includes('manager') && !ctx.person.role?.includes('admin')) {
    return { success: false, error: 'Only managers can perform this action.' }
  }

  const parsed = Schema.safeParse(formData)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input.' }
  }

  const { error } = await ctx.supabase
    .from('table')
    .insert({ ...parsed.data, org_id: ctx.person.org_id })

  if (error) {
    console.error('[createThing] error:', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/section')
  return { success: true }
}
```

**Update pattern** (lines 157–199 — fetch target first, verify org, then update):
```typescript
export async function updateThing(id: string, formData: FormDataType): Promise<ActionResult> {
  const ctx = await getCallerContext()
  if (!ctx) return { success: false, error: 'You must be signed in.' }

  // Fetch to verify org membership (RLS also enforces, but explicit check improves error messages)
  const { data: target, error: fetchError } = await ctx.supabase
    .from('table')
    .select('id, org_id')
    .eq('id', id)
    .eq('org_id', ctx.person.org_id)
    .single()

  if (fetchError || !target) {
    return { success: false, error: 'Record not found.' }
  }

  const { error } = await ctx.supabase
    .from('table')
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('org_id', ctx.person.org_id)

  if (error) return { success: false, error: error.message }

  revalidatePath('/section')
  return { success: true }
}
```

**Admin client usage rule** (lines 202–206 of analog): Only call `createAdminClient()` when the user's JWT claims are absent or insufficient (e.g., system-level operations). For Phase 2 manager CRUD, `createClient()` (RLS-scoped) is sufficient.

---

### People page update: tabs, role[] changes

**Analog:** `canary-propos/src/app/(manager)/people/page.tsx`

**Lines to change after 0012 migration** (per RESEARCH.md §Migration Impact):

Line 43 — isManager check:
```typescript
// BEFORE (Phase 1):
const isManager = callerPerson.role === 'manager' || callerPerson.role === 'admin'
// AFTER (Phase 2, role is text[]):
const isManager = callerPerson.role?.includes('manager') || callerPerson.role?.includes('admin')
```

Line 94 — role display:
```typescript
// BEFORE:
{person.role}
// AFTER:
{person.role?.join(', ')}
```

Line 141 — mobile card isManager check:
```typescript
// BEFORE:
callerPerson.role === 'manager'
// AFTER:
callerPerson.role?.includes('manager')
```

**Tabs wrapper pattern** (shadcn Tabs — wrap existing content as first tab, add ContactsTab as second):
```tsx
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

// In JSX:
<Tabs defaultValue="team">
  <TabsList>
    <TabsTrigger value="team">Team</TabsTrigger>
    <TabsTrigger value="contacts">Contacts</TabsTrigger>
  </TabsList>
  <TabsContent value="team">
    {/* existing people list JSX unchanged */}
  </TabsContent>
  <TabsContent value="contacts">
    <ContactsTab orgId={callerPerson.org_id} isManager={isManager} contacts={contacts} />
  </TabsContent>
</Tabs>
```

**Contacts query** (add to people/page.tsx RSC data fetches):
```typescript
const { data: contacts } = await supabase
  .from('people')
  .select('id, email, first_name, last_name, phone, role, active')
  .eq('org_id', callerPerson.org_id)
  .overlaps('role', ['tenant', 'owner', 'vendor'])
  .eq('active', true)
  .order('created_at', { ascending: true })
```

---

## Shared Patterns

### Session + Caller Resolution (RSC pages)
**Source:** `canary-propos/src/app/(manager)/people/page.tsx` lines 10–26
**Apply to:** All new RSC pages in `(manager)/` and `(tenant)/`
```typescript
const supabase = await createClient()
const { data: { user } } = await supabase.auth.getUser()
if (!user) redirect('/login')

const { data: callerPerson } = await supabase
  .from('people')
  .select('org_id, role')
  .eq('user_id', user.id)
  .eq('active', true)
  .single()

if (!callerPerson) redirect('/login')
```

### Server Action Auth Pattern
**Source:** `canary-propos/src/app/(manager)/people/actions.ts` lines 30–65
**Apply to:** All files in `src/app/actions/`
- Always use `getCallerContext()` helper at top of every action
- After 0012 migration, all role checks use `role?.includes('manager')` not `role === 'manager'`
- Always return typed `ActionResult` union

### RLS Helper Call Wrapping
**Source:** `canary-propos/supabase/migrations/0005_rls_people.sql` (comment, lines 1–6)
**Apply to:** All migration files with RLS policies
Every helper call in USING/WITH CHECK must be wrapped: `(SELECT public.org_id())`, `(SELECT public.user_role())`, `(SELECT public.person_id())`. Never bare `public.org_id()`.

### Storage Path Convention
**Source:** `canary-propos/supabase/migrations/0006_storage_buckets.sql` lines 1–5 (comment)
**Apply to:** `PropertyPhotoUpload.tsx`, `LeaseDocUpload.tsx`, `leases.ts` action
- Property photos: `{org_id}/properties/{property_id}/photos/{filename}`
- Lease docs: `{org_id}/leases/{lease_id}/{filename}`
- First segment is always org_id — enforced by existing storage RLS policy

### Toast Feedback Pattern
**Source:** `canary-propos/src/components/people/InviteUserForm.tsx` lines 51–64
**Apply to:** All client-side form components
```typescript
if (result.success) {
  toast.success('Success message')
  setOpen(false)
} else {
  setError(result.error)
}
```

### Supabase Join Disambiguation Syntax
**Source:** RESEARCH.md §Pitfall 6
**Apply to:** All RSC queries joining leases, units, properties, people
When a table has multiple FKs to the same referenced table, use the column-name hint:
```typescript
.select(`
  people!tenant_id ( first_name, last_name ),
  units!unit_id ( unit_number, properties!property_id ( street_address ) )
`)
```

### revalidatePath After Mutations
**Source:** `canary-propos/src/app/(manager)/people/actions.ts` (used throughout)
**Apply to:** All server actions that mutate data
Call `revalidatePath('/section')` before `return { success: true }` so the RSC list auto-refreshes.

---

## No Analog Found

All Phase 2 files have close analogs in the codebase. No files require falling back to RESEARCH.md patterns exclusively.

---

## Metadata

**Analog search scope:** `canary-propos/src/`, `canary-propos/supabase/migrations/`
**Files scanned:** 7 analog files read directly
**Pattern extraction date:** 2026-06-21
