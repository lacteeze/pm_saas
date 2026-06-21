// src/app/(manager)/dashboard/page.tsx
// Manager dashboard — renders SetupBanner above content when setup is incomplete (D-02)
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { SetupBanner } from '@/components/onboarding/SetupBanner'

export default async function DashboardPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Get caller's org to check setup status (D-02)
  const { data: person } = await supabase
    .from('people')
    .select('org_id')
    .eq('user_id', user.id)
    .eq('active', true)
    .single()

  let setupCompleted = true
  if (person?.org_id) {
    const { data: org } = await supabase
      .from('organizations')
      .select('setup_completed_at')
      .eq('id', person.org_id)
      .single()
    setupCompleted = !!org?.setup_completed_at
  }

  return (
    <div className="px-4 py-8 md:px-8">
      {/* SetupBanner renders above main content when setup_completed_at is null (D-02) */}
      <SetupBanner setupComplete={setupCompleted} />

      <h1 className="text-xl font-semibold text-stone-900">Dashboard</h1>
      <p className="mt-2 text-base text-stone-600">
        Welcome back. More features are coming soon.
      </p>
    </div>
  )
}
