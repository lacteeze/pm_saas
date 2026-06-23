'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

// --- Action result type ---
export type ActionResult =
  | { success: true; id?: string }
  | { success: false; error: string }

// --- Helper: resolve the caller's org + role ---
async function getCallerContext() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const { data: person } = await supabase
    .from('people')
    .select('id, org_id, role')
    .eq('user_id', user.id)
    .eq('active', true)
    .single()

  if (!person) return null
  return { supabase, user, person }
}

// --- Schema ---
const createWorkOrderSchema = z.object({
  property_id: z.string().uuid('Invalid property ID'),
  unit_id: z.string().uuid('Invalid unit ID').optional(),
  title: z.string().min(3, 'Title must be at least 3 characters'),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  priority: z.enum(['low', 'medium', 'high', 'urgent']),
})

// --- createWorkOrder ---
// Called by both managers (from /maintenance/new) and tenants (from /my-home/maintenance/new).
// Tenants must have role includes 'tenant'. org_id is always resolved from session — never from input.
export async function createWorkOrder(data: {
  property_id: string
  unit_id?: string
  title: string
  description: string
  priority: 'low' | 'medium' | 'high' | 'urgent'
}): Promise<ActionResult> {
  const ctx = await getCallerContext()
  if (!ctx) return { success: false, error: 'You must be signed in.' }

  const isManager = ctx.person.role.includes('manager') || ctx.person.role.includes('admin')
  const isTenant = ctx.person.role.includes('tenant')
  if (!isManager && !isTenant) {
    return { success: false, error: 'You do not have permission to create work orders.' }
  }

  const parsed = createWorkOrderSchema.safeParse(data)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input.' }
  }

  // T-05-21: org_id resolved from session, not form input
  const { error: insertError, data: inserted } = await ctx.supabase
    .from('work_orders')
    .insert({
      org_id: ctx.person.org_id,
      property_id: parsed.data.property_id,
      unit_id: parsed.data.unit_id ?? null,
      title: parsed.data.title,
      description: parsed.data.description,
      priority: parsed.data.priority,
      status: 'draft',
      created_by: ctx.person.id,
    })
    .select('id')
    .single()

  if (insertError) {
    console.error('[createWorkOrder] insert error:', insertError)
    return { success: false, error: 'Failed to create work order. Please try again.' }
  }

  revalidatePath('/maintenance')
  revalidatePath('/my-home/maintenance')
  return { success: true, id: inserted.id }
}
