'use server'

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { CANADIAN_PROVINCES } from '@/lib/constants/provinces'

const provinceCodes = CANADIAN_PROVINCES.map((p) => p.value) as [string, ...string[]]

const updateOrgSchema = z.object({
  name: z.string().min(2, 'Organization name must be at least 2 characters').max(80, 'Organization name must be 80 characters or fewer'),
  province: z.enum(provinceCodes, { error: 'Please select a valid Canadian province or territory' }),
  logoPath: z.string().nullable().optional(),
})

export type UpdateOrgResult =
  | { success: true }
  | { success: false; error: string }

// --- Helper: resolve caller context ---
async function getCallerContext() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: person } = await supabase
    .from('people')
    .select('org_id, role')
    .eq('user_id', user.id)
    .eq('active', true)
    .single()

  if (!person) return null
  return { supabase, person }
}

// --- updateOrgProfile: saves org name / province / logo (ORGS-04) ---
export async function updateOrgProfile(formData: {
  name: string
  province: string
  logoPath?: string | null
}): Promise<UpdateOrgResult> {
  const ctx = await getCallerContext()
  if (!ctx) {
    return { success: false, error: 'You must be signed in.' }
  }

  // Authz: only manager/admin (T-06-03)
  if (!ctx.person.role?.includes('manager') && !ctx.person.role?.includes('admin')) {
    return { success: false, error: 'Only managers can update organization settings.' }
  }

  const parsed = updateOrgSchema.safeParse(formData)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input.' }
  }

  const { name, province, logoPath } = parsed.data

  const { error } = await ctx.supabase
    .from('organizations')
    .update({
      name: name.trim(),
      province,
      updated_at: new Date().toISOString(),
      ...(logoPath !== undefined ? { logo_path: logoPath } : {}),
    })
    .eq('id', ctx.person.org_id)

  if (error) {
    console.error('[updateOrgProfile] error:', error)
    return { success: false, error: 'Failed to save changes. Please try again.' }
  }

  return { success: true }
}

// --- markSetupComplete: sets setup_completed_at (D-02) ---
export async function markSetupComplete(): Promise<UpdateOrgResult> {
  const ctx = await getCallerContext()
  if (!ctx) {
    return { success: false, error: 'You must be signed in.' }
  }

  if (!ctx.person.role?.includes('manager') && !ctx.person.role?.includes('admin')) {
    return { success: false, error: 'Only managers can complete setup.' }
  }

  const { error } = await ctx.supabase
    .from('organizations')
    .update({ setup_completed_at: new Date().toISOString() })
    .eq('id', ctx.person.org_id)

  if (error) {
    return { success: false, error: 'Failed to mark setup complete.' }
  }

  return { success: true }
}
