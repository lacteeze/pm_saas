'use server'

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { CANADIAN_PROVINCES } from '@/lib/constants/provinces'

// --- Zod schemas for server-side validation (T-05-03) ---

const provinceCodes = CANADIAN_PROVINCES.map((p) => p.value) as [string, ...string[]]

const orgNameSchema = z.object({
  name: z.string().min(2, 'Organization name must be at least 2 characters').max(80, 'Organization name must be 80 characters or fewer'),
})

const provinceSchema = z.object({
  province: z.enum(provinceCodes, { error: 'Please select a valid Canadian province or territory' }),
})

const inviteEmailSchema = z.object({
  email: z.string().email('Please enter a valid email address').optional().or(z.literal('')),
})

// --- Helper: generate slug from org name ---
function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60)
}

// --- Action result type ---
export type ActionResult =
  | { success: true; orgId?: string }
  | { success: false; error: string }

// --- createOrganization: inserts org + manager person row (FOUND-01) ---
export async function createOrganization(formData: {
  name: string
  province: string
  logoPath?: string | null
  inviteEmail?: string | null
}): Promise<ActionResult> {
  const supabase = await createClient()

  // Verify user is authenticated
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'You must be signed in to create an organization.' }
  }

  // Validate org name
  const nameResult = orgNameSchema.safeParse({ name: formData.name })
  if (!nameResult.success) {
    return { success: false, error: nameResult.error.issues[0]?.message ?? 'Invalid organization name.' }
  }

  // Validate province
  const provinceResult = provinceSchema.safeParse({ province: formData.province })
  if (!provinceResult.success) {
    return { success: false, error: provinceResult.error.issues[0]?.message ?? 'Invalid province.' }
  }

  // Validate invite email (optional)
  const inviteResult = inviteEmailSchema.safeParse({ email: formData.inviteEmail ?? '' })
  if (!inviteResult.success) {
    return { success: false, error: inviteResult.error.issues[0]?.message ?? 'Invalid invite email.' }
  }

  const hasSkippedOptionalSteps =
    !formData.logoPath && (!formData.inviteEmail || formData.inviteEmail.trim() === '')

  // Generate a unique slug
  const baseSlug = slugify(formData.name)
  const slug = `${baseSlug}-${Date.now().toString(36)}`

  // Insert organization
  const { data: org, error: orgError } = await supabase
    .from('organizations')
    .insert({
      name: formData.name.trim(),
      slug,
      province: formData.province,
      logo_path: formData.logoPath ?? null,
      // setup_completed_at: set only when no steps were skipped (D-02)
      setup_completed_at: hasSkippedOptionalSteps ? null : new Date().toISOString(),
    })
    .select('id')
    .single()

  if (orgError || !org) {
    return {
      success: false,
      error: 'Something went wrong creating your organization. Please try again.',
    }
  }

  // Insert manager people row (FOUND-01)
  const { error: personError } = await supabase.from('people').insert({
    user_id: user.id,
    org_id: org.id,
    role: 'manager',
    email: user.email ?? '',
    invite_accepted_at: new Date().toISOString(),
  })

  if (personError) {
    return {
      success: false,
      error: 'Organization created but failed to set up your account. Please contact support.',
    }
  }

  return { success: true, orgId: org.id }
}

// --- updateOrgLogo: update logo_path on an existing org ---
export async function updateOrgLogo(orgId: string, logoPath: string): Promise<ActionResult> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'You must be signed in.' }
  }

  const { error } = await supabase
    .from('organizations')
    .update({ logo_path: logoPath })
    .eq('id', orgId)

  if (error) {
    return { success: false, error: 'Failed to save logo. Please try again.' }
  }

  return { success: true }
}
