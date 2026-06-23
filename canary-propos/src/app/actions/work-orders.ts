'use server'
// src/app/actions/work-orders.ts
// Server actions for work order lifecycle — stub for 05-03 UI compilation.
// 05-02 provides the full implementation with expense auto-creation, owner notifications, etc.

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { WorkOrderStatus } from '@/lib/work-orders/transitions'
import { validateTransition } from '@/lib/work-orders/transitions'

export type ActionResult = { success: true } | { success: false; error: string }

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
  return { supabase, user, person: { ...person, role: (person.role ?? []) as string[] } }
}

export interface CreateWorkOrderData {
  property_id: string
  unit_id?: string | null
  title: string
  description: string
  priority: 'low' | 'medium' | 'high' | 'urgent'
}

export async function createWorkOrder(data: CreateWorkOrderData): Promise<ActionResult> {
  const ctx = await getCallerContext()
  if (!ctx) return { success: false, error: 'Not authenticated' }
  if (!ctx.person.role.includes('manager') && !ctx.person.role.includes('admin')) {
    return { success: false, error: 'Insufficient permissions' }
  }

  const { error } = await ctx.supabase.from('work_orders').insert({
    org_id: ctx.person.org_id,
    property_id: data.property_id,
    unit_id: data.unit_id ?? null,
    title: data.title,
    description: data.description,
    priority: data.priority,
    status: 'draft' as WorkOrderStatus,
    created_by: ctx.person.id,
  })

  if (error) return { success: false, error: error.message }

  revalidatePath('/maintenance')
  return { success: true }
}

export interface UpdateWorkOrderStatusData {
  vendor_id?: string
  estimated_cost?: number
  vendor_cost?: number
  billed_amount?: number
  decline_note?: string
}

export async function updateWorkOrderStatus(
  id: string,
  newStatus: WorkOrderStatus,
  extraData?: UpdateWorkOrderStatusData
): Promise<ActionResult> {
  const ctx = await getCallerContext()
  if (!ctx) return { success: false, error: 'Not authenticated' }

  // Fetch current work order to validate transition
  const { data: workOrder, error: fetchError } = await ctx.supabase
    .from('work_orders')
    .select('id, status, org_id, property_id')
    .eq('id', id)
    .eq('org_id', ctx.person.org_id)
    .single()

  if (fetchError || !workOrder) return { success: false, error: 'Work order not found' }

  const validation = validateTransition(
    workOrder.status as WorkOrderStatus,
    newStatus,
    ctx.person.role
  )
  if (!validation.valid) return { success: false, error: validation.error ?? 'Invalid transition' }

  // Build update payload
  const updatePayload: Record<string, unknown> = { status: newStatus }
  if (extraData?.vendor_id) updatePayload.assigned_vendor_id = extraData.vendor_id
  if (extraData?.estimated_cost != null) updatePayload.estimated_cost = extraData.estimated_cost
  if (extraData?.vendor_cost != null) updatePayload.vendor_cost = extraData.vendor_cost
  if (extraData?.billed_amount != null) updatePayload.billed_amount = extraData.billed_amount
  if (extraData?.decline_note) updatePayload.owner_decline_note = extraData.decline_note

  const { error: updateError } = await ctx.supabase
    .from('work_orders')
    .update(updatePayload)
    .eq('id', id)
    .eq('org_id', ctx.person.org_id)

  if (updateError) return { success: false, error: updateError.message }

  // TODO (05-02): Add expense auto-creation on 'completed', owner notification on 'pending_approval'

  revalidatePath('/maintenance')
  revalidatePath(`/maintenance/${id}`)
  return { success: true }
}
