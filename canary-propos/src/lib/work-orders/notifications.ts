// src/lib/work-orders/notifications.ts
// SERVER ONLY — never import in 'use client' files.
// Owner notification helpers for work order pending approval state.

import { createElement } from 'react'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/email/send'

// --- Email template (inline — no JSX needed for simple HTML) ---
function renderPendingApprovalEmail(opts: {
  propertyAddress: string
  workOrderTitle: string
  estimatedCost: number
  approveUrl: string
  declineUrl: string
}): React.ReactElement {
  const { propertyAddress, workOrderTitle, estimatedCost, approveUrl, declineUrl } = opts

  // Build a minimal React element tree compatible with @react-email/components render()
  return createElement(
    'html',
    null,
    createElement(
      'body',
      { style: { fontFamily: 'Arial, sans-serif', maxWidth: '600px', margin: '0 auto', padding: '20px' } },
      createElement('h2', { style: { color: '#1a1a1a' } }, 'Maintenance Approval Required'),
      createElement(
        'p',
        null,
        'A maintenance work order for one of your properties requires your approval before work can begin.'
      ),
      createElement(
        'table',
        { style: { borderCollapse: 'collapse', width: '100%', marginBottom: '24px' } },
        createElement(
          'tbody',
          null,
          createElement(
            'tr',
            null,
            createElement('td', { style: { padding: '8px 0', fontWeight: 'bold', width: '160px' } }, 'Property:'),
            createElement('td', { style: { padding: '8px 0' } }, propertyAddress)
          ),
          createElement(
            'tr',
            null,
            createElement('td', { style: { padding: '8px 0', fontWeight: 'bold' } }, 'Work Order:'),
            createElement('td', { style: { padding: '8px 0' } }, workOrderTitle)
          ),
          createElement(
            'tr',
            null,
            createElement('td', { style: { padding: '8px 0', fontWeight: 'bold' } }, 'Estimated Cost:'),
            createElement('td', { style: { padding: '8px 0' } }, `$${estimatedCost.toFixed(2)}`)
          )
        )
      ),
      createElement(
        'p',
        { style: { marginBottom: '16px' } },
        'Please review and respond below:'
      ),
      createElement(
        'div',
        { style: { display: 'flex', gap: '12px' } },
        createElement(
          'a',
          {
            href: approveUrl,
            style: {
              display: 'inline-block',
              padding: '12px 24px',
              backgroundColor: '#16a34a',
              color: '#ffffff',
              textDecoration: 'none',
              borderRadius: '6px',
              fontWeight: 'bold',
              marginRight: '12px',
            },
          },
          'Approve Work Order'
        ),
        createElement(
          'a',
          {
            href: declineUrl,
            style: {
              display: 'inline-block',
              padding: '12px 24px',
              backgroundColor: '#dc2626',
              color: '#ffffff',
              textDecoration: 'none',
              borderRadius: '6px',
              fontWeight: 'bold',
            },
          },
          'Decline Work Order'
        )
      ),
      createElement(
        'p',
        { style: { marginTop: '32px', fontSize: '12px', color: '#6b7280' } },
        'This approval request was sent by Canary PropOS. If you have questions, contact your property manager.'
      )
    )
  ) as React.ReactElement
}

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

  // Look up the work order title
  const { data: wo } = await adminSupabase
    .from('work_orders')
    .select('title')
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

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.canarypm.ca'
  const approveUrl = `${baseUrl}/owner/approve/${approveToken}`
  const declineUrl = `${baseUrl}/owner/decline/${declineToken}`

  const template = renderPendingApprovalEmail({
    propertyAddress,
    workOrderTitle,
    estimatedCost,
    approveUrl,
    declineUrl,
  })

  const result = await sendEmail({
    to: ownerEmail,
    subject: `Approval Required: ${workOrderTitle} — Est. $${estimatedCost.toFixed(2)}`,
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
