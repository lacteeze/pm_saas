// src/lib/work-orders/notifications.ts
// SERVER ONLY — never import in 'use client' files.
// Owner notification helpers for work order pending approval state.

import React from 'react'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/email/send'
import { OwnerApprovalEmail } from '@/lib/email/templates/OwnerApprovalEmail'

/**
 * notifyOwnerPendingApproval — sends an email notification to the property owner
 * when a work order enters 'pending_approval' status.
 *
 * Uses createAdminClient() because this runs server-side without the owner's session.
 * The in-app notification record creation is deferred to a future plan (Phase 5 v2).
 *
 * @param workOrderId - UUID of the work order
 * @param orgId - organization ID (for scoping)
 * @param propertyId - UUID of the property (to look up owner email)
 * @param estimatedCost - estimated cost in dollars
 * @param approveToken - UUID token for the approve action
 * @param declineToken - UUID token for the decline action
 */
export async function notifyOwnerPendingApproval(
  workOrderId: string,
  orgId: string,
  propertyId: string,
  estimatedCost: number,
  approveToken: string,
  declineToken: string
): Promise<void> {
  const adminSupabase = createAdminClient()

  // Look up the work order title and description
  const { data: wo } = await adminSupabase
    .from('work_orders')
    .select('title, description')
    .eq('id', workOrderId)
    .eq('org_id', orgId)
    .single()

  // Look up the property address and owner email via the property_owners join
  // properties → property_owners → people (owner)
  const { data: property } = await adminSupabase
    .from('properties')
    .select('address, city, province')
    .eq('id', propertyId)
    .eq('org_id', orgId)
    .single()

  // Find the owner person for this property (join via property_owners table)
  const { data: ownerLink } = await adminSupabase
    .from('property_owners')
    .select('person:people(email, first_name)')
    .eq('property_id', propertyId)
    .limit(1)
    .single()

  // If we can't find an owner email, log and skip — don't crash the work order flow
  const ownerEmail = (ownerLink?.person as { email?: string } | null)?.email
  if (!ownerEmail) {
    console.warn(
      `[notifyOwnerPendingApproval] No owner email found for property ${propertyId} — skipping notification`
    )
    return
  }

  const propertyAddress = property
    ? `${property.address}, ${property.city}, ${property.province}`
    : `Property ${propertyId}`

  const workOrderTitle = wo?.title ?? 'Maintenance Work Order'
  const workOrderDescription = wo?.description ?? ''

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.canarypm.ca'
  const approveUrl = `${baseUrl}/owner/approve/${approveToken}`
  const declineUrl = `${baseUrl}/owner/decline/${declineToken}`

  const template = React.createElement(OwnerApprovalEmail, {
    propertyAddress,
    workOrderTitle,
    workOrderDescription,
    estimatedCost,
    approveUrl,
    declineUrl,
  })

  const result = await sendEmail({
    to: ownerEmail,
    subject: `Action Required: Maintenance Approval Needed — ${propertyAddress}`,
    template,
  })

  if (!result.success) {
    // Log but don't throw — email failure should not block the work order status update
    console.error(
      `[notifyOwnerPendingApproval] Failed to send email to ${ownerEmail}:`,
      result.error
    )
  }

  // In-app notification record: deferred to Phase 5 v2 (notifications table not yet created)
  // When implemented, insert into notifications table with type='work_order_pending_approval',
  // target_user_id = owner's user_id, and a link back to /owner/approve/[token]
}
