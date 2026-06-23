'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { TRANSITIONS, validateTransition } from '@/lib/work-orders/transitions'
import { notifyOwnerPendingApproval, sendVendorAssignmentNotifications } from '@/lib/work-orders/notifications'
import type { WorkOrderStatus } from '@/lib/work-orders/transitions'

// --- Action result type (shared pattern from contacts.ts) ---
export type ActionResult =
  | { success: true }
  | { success: false; error: string }

// --- Caller context helper (matches contacts.ts pattern) ---
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

// --- createWorkOrder ---
// Creates a new work order in draft status.
// All roles (manager, employee, tenant) may create.
// Tenants are scoped to their own org by ctx.person.org_id.
export async function createWorkOrder(data: {
  property_id: string
  unit_id?: string
  title: string
  description: string
  priority: 'low' | 'medium' | 'high' | 'urgent'
}): Promise<ActionResult> {
  const ctx = await getCallerContext()
  if (!ctx) {
    return { success: false, error: 'You must be signed in.' }
  }

  const { role } = ctx.person
  // T-05-06: all roles may create but they are scoped to their org_id
  if (
    !role?.includes('manager') &&
    !role?.includes('employee') &&
    !role?.includes('tenant') &&
    !role?.includes('admin')
  ) {
    return { success: false, error: 'You do not have permission to create work orders.' }
  }

  if (!data.property_id || !data.title?.trim() || !data.description?.trim()) {
    return { success: false, error: 'Property, title, and description are required.' }
  }

  const { error: insertError } = await ctx.supabase
    .from('work_orders')
    .insert({
      org_id: ctx.person.org_id,
      property_id: data.property_id,
      unit_id: data.unit_id ?? null,
      title: data.title.trim(),
      description: data.description.trim(),
      priority: data.priority,
      status: 'draft' as WorkOrderStatus,
      created_by: ctx.person.id,
    })

  if (insertError) {
    console.error('[createWorkOrder] insert error:', insertError)
    return { success: false, error: 'Failed to create work order. Please try again.' }
  }

  revalidatePath('/maintenance')
  return { success: true }
}

// --- updateWorkOrderStatus ---
// Validates and applies a status transition. Enforces the $500 gate.
// On 'completed': auto-creates an expense record if vendor_cost + billed_amount are present.
// T-05-04: all status mutations go through this action — no direct .update({ status }) elsewhere.
export async function updateWorkOrderStatus(
  workOrderId: string,
  newStatus: WorkOrderStatus,
  extraData?: {
    assigned_vendor_id?: string
    estimated_cost?: number
    vendor_cost?: number
    billed_amount?: number
    owner_decline_note?: string
  }
): Promise<ActionResult> {
  const ctx = await getCallerContext()
  if (!ctx) {
    return { success: false, error: 'You must be signed in.' }
  }

  // Fetch current work order — scoped to org_id (defense in depth with RLS)
  const { data: wo, error: fetchError } = await ctx.supabase
    .from('work_orders')
    .select('id, status, org_id, property_id, title, description, created_by, estimated_cost, vendor_cost, billed_amount, assigned_vendor_id, vendor_token')
    .eq('id', workOrderId)
    .eq('org_id', ctx.person.org_id)
    .single()

  if (fetchError || !wo) {
    return { success: false, error: 'Work order not found.' }
  }

  // --- $500 gate (D-03, D-04) ---
  // When assigning and estimated_cost > 500, substitute pending_approval
  let actualNewStatus: WorkOrderStatus = newStatus
  if (
    newStatus === 'assigned' &&
    (extraData?.estimated_cost ?? 0) > 500
  ) {
    actualNewStatus = 'pending_approval'
  }

  // Validate transition against state machine
  const validation = validateTransition(
    wo.status as WorkOrderStatus,
    actualNewStatus,
    ctx.person.role ?? []
  )
  if (!validation.valid) {
    return { success: false, error: validation.error }
  }

  // --- Build update payload ---
  const updatePayload: Record<string, unknown> = {
    status: actualNewStatus,
    updated_at: new Date().toISOString(),
  }

  if (extraData?.assigned_vendor_id !== undefined) {
    updatePayload.assigned_vendor_id = extraData.assigned_vendor_id
  }
  if (extraData?.estimated_cost !== undefined) {
    updatePayload.estimated_cost = extraData.estimated_cost
  }
  if (extraData?.vendor_cost !== undefined) {
    updatePayload.vendor_cost = extraData.vendor_cost
  }
  if (extraData?.billed_amount !== undefined) {
    updatePayload.billed_amount = extraData.billed_amount
  }
  if (extraData?.owner_decline_note !== undefined) {
    updatePayload.owner_decline_note = extraData.owner_decline_note
  }

  // --- Owner approval token generation (T-05-05) ---
  // Tokens generated when entering pending_approval; nullified on use.
  let approveToken: string | undefined
  let declineToken: string | undefined
  if (actualNewStatus === 'pending_approval') {
    approveToken = crypto.randomUUID()
    declineToken = crypto.randomUUID()
    updatePayload.owner_approve_token = approveToken
    updatePayload.owner_decline_token = declineToken
  }

  // --- Apply status update (scoped by org_id — defense in depth) ---
  const { error: updateError } = await ctx.supabase
    .from('work_orders')
    .update(updatePayload)
    .eq('id', workOrderId)
    .eq('org_id', ctx.person.org_id)

  if (updateError) {
    console.error('[updateWorkOrderStatus] update error:', updateError)
    return { success: false, error: 'Failed to update work order status. Please try again.' }
  }

  // --- Post-transition side effects ---

  // 1. Owner notification on pending_approval (D-04)
  if (actualNewStatus === 'pending_approval' && approveToken && declineToken) {
    const costForNotification = extraData?.estimated_cost ?? (wo.estimated_cost as number) ?? 0
    notifyOwnerPendingApproval(
      workOrderId,
      ctx.person.org_id,
      wo.property_id,
      costForNotification,
      approveToken,
      declineToken
    ).catch((err) => {
      // Fire-and-forget — log but don't fail the action
      console.error('[updateWorkOrderStatus] owner notification failed:', err)
    })
  }

  // 2. Vendor assignment notification: SMS + email (D-11, D-12, Plan 05-04)
  if (actualNewStatus === 'assigned') {
    const vendorId = extraData?.assigned_vendor_id ?? (wo.assigned_vendor_id as string | null)
    const vendorToken = wo.vendor_token as string | null
    if (vendorId && vendorToken) {
      sendVendorAssignmentNotifications(
        workOrderId,
        ctx.person.org_id,
        vendorId,
        wo.property_id,
        wo.title,
        (wo.description as string) ?? '',
        vendorToken
      ).catch((err) => {
        // Fire-and-forget — log but don't fail the action
        console.error('[updateWorkOrderStatus] vendor notification failed:', err)
      })
    }
  }

  // 3. Expense auto-creation on completed (D-14, MAINT-09)
  if (actualNewStatus === 'completed') {
    const vendorCost = extraData?.vendor_cost ?? (wo.vendor_cost as number | null)
    const billedAmount = extraData?.billed_amount ?? (wo.billed_amount as number | null)

    if (vendorCost != null && billedAmount != null) {
      const today = new Date().toISOString().slice(0, 10) // YYYY-MM-DD
      const { error: expenseError } = await ctx.supabase
        .from('expenses')
        .insert({
          org_id: ctx.person.org_id,
          property_id: wo.property_id,
          description: `Work order: ${wo.title}`,
          expense_date: today,
          vendor_cost: vendorCost,
          billed_amount: billedAmount,
          created_by: wo.created_by ?? null,
        })

      if (expenseError) {
        // Log but don't fail — expense creation is a side effect, not the primary action
        console.error('[updateWorkOrderStatus] expense insert error:', expenseError)
      }
    }
  }

  revalidatePath('/maintenance')
  return { success: true }
}

// --- updateViaVendorToken ---
// Allows non-portal vendors to update work order status via a no-login token link.
// Uses admin client — no user session on the vendor no-login route.
// T-05-07: parameter type restricted to in_progress | completed.
export async function updateViaVendorToken(
  vendorToken: string,
  newStatus: 'in_progress' | 'completed',
  invoiceAmount?: number
): Promise<ActionResult> {
  if (!vendorToken?.trim()) {
    return { success: false, error: 'Invalid vendor token.' }
  }

  // Use admin client — vendor no-login route has no session (D-09)
  const adminSupabase = createAdminClient()

  // Look up work order by vendor_token (D-07: UUID is the credential)
  const { data: wo, error: fetchError } = await adminSupabase
    .from('work_orders')
    .select('id, status, org_id, property_id, title, created_by, vendor_cost, billed_amount')
    .eq('vendor_token', vendorToken)
    .neq('status', 'closed')
    .single()

  if (fetchError || !wo) {
    return { success: false, error: 'Work order not found or no longer active.' }
  }

  // T-05-07: validate state transition for vendor_token role
  const validation = validateTransition(
    wo.status as WorkOrderStatus,
    newStatus as WorkOrderStatus,
    ['vendor_token']
  )
  if (!validation.valid) {
    return { success: false, error: validation.error }
  }

  // --- Build update payload ---
  const updatePayload: Record<string, unknown> = {
    status: newStatus,
    updated_at: new Date().toISOString(),
  }

  if (newStatus === 'completed' && invoiceAmount != null) {
    updatePayload.vendor_cost = invoiceAmount
  }

  const { error: updateError } = await adminSupabase
    .from('work_orders')
    .update(updatePayload)
    .eq('id', wo.id)
    .eq('org_id', wo.org_id) // defense in depth even with admin client

  if (updateError) {
    console.error('[updateViaVendorToken] update error:', updateError)
    return { success: false, error: 'Failed to update work order. Please try again.' }
  }

  // Note on expense creation for vendor flow (plan specification, D-14):
  // When vendor marks completed and sets invoiceAmount → vendor_cost is recorded.
  // billed_amount is set later by the manager (markup). Expense INSERT is deferred
  // to the manager's updateWorkOrderStatus call that sets billed_amount.
  // This prevents an incomplete expense record (no billed_amount) from being created.

  revalidatePath(`/vendor/jobs/${vendorToken}`)
  return { success: true }
}

// --- declineWorkOrderViaToken ---
// Allows property owners to decline a high-cost work order via the no-login decline link.
// Uses admin client — owner has no portal session on this route (D-09).
// T-05-16: token is the credential; both tokens nullified atomically with status update.
export async function declineWorkOrderViaToken(
  declineToken: string,
  note?: string
): Promise<ActionResult> {
  if (!declineToken?.trim()) {
    return { success: false, error: 'Invalid decline token.' }
  }

  // Use admin client — owner no-login route has no session
  const adminSupabase = createAdminClient()

  // Look up work order by decline token with status guard
  const { data: wo, error: fetchError } = await adminSupabase
    .from('work_orders')
    .select('id, status, org_id')
    .eq('owner_decline_token', declineToken)
    .eq('status', 'pending_approval')
    .single()

  if (fetchError || !wo) {
    return { success: false, error: 'This link has already been used or is no longer valid.' }
  }

  // Atomic update: transition to closed + nullify both tokens + optional decline note.
  // .eq('status', 'pending_approval') guard prevents double-fire (T-05-16).
  const updatePayload: Record<string, unknown> = {
    status: 'closed',
    owner_approve_token: null,
    owner_decline_token: null,
    updated_at: new Date().toISOString(),
  }
  if (note?.trim()) {
    updatePayload.owner_decline_note = note.trim()
  }

  const { error: updateError } = await adminSupabase
    .from('work_orders')
    .update(updatePayload)
    .eq('id', wo.id)
    .eq('status', 'pending_approval') // race condition guard

  if (updateError) {
    console.error('[declineWorkOrderViaToken] update error:', updateError)
    return { success: false, error: 'Failed to process decline. Please try again.' }
  }

  return { success: true }
}
