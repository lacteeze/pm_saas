// src/app/(manager)/settings/page.tsx
// Org settings: name, logo, province (UI-SPEC §5, ORGS-04)
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { OrgSettingsForm } from '@/components/settings/OrgSettingsForm'

export default async function SettingsPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Get caller's org
  const { data: person } = await supabase
    .from('people')
    .select('org_id, role')
    .eq('user_id', user.id)
    .eq('active', true)
    .single()

  if (!person) redirect('/login')

  const { data: org } = await supabase
    .from('organizations')
    .select('id, name, province, logo_path')
    .eq('id', person.org_id)
    .single()

  if (!org) redirect('/login')

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 md:px-8">
      <h1 className="mb-8 text-xl font-semibold text-stone-900">Organization Settings</h1>
      <OrgSettingsForm
        orgId={org.id}
        initialName={org.name}
        initialProvince={org.province}
        initialLogoPath={org.logo_path}
      />
    </div>
  )
}
