// src/lib/work-orders/transitions.ts
// State machine for work order lifecycle — single source of truth for valid transitions.
// Created as interface stub for 05-03 UI; 05-02 provides the full implementation.

export type WorkOrderStatus =
  | 'draft'
  | 'submitted'
  | 'assigned'
  | 'in_progress'
  | 'pending_approval'
  | 'approved'
  | 'completed'
  | 'closed'

export type WorkOrderPriority = 'low' | 'medium' | 'high' | 'urgent'

export interface TransitionConfig {
  allowedFrom: WorkOrderStatus[]
  allowedRoles: string[]
  label: string
  requiresData?: string[]
}

// TRANSITIONS[toStatus] = config for moving INTO that status
export const TRANSITIONS: Record<WorkOrderStatus, TransitionConfig> = {
  draft: {
    allowedFrom: [],
    allowedRoles: [],
    label: 'Draft',
  },
  submitted: {
    allowedFrom: ['draft'],
    allowedRoles: ['manager', 'admin'],
    label: 'Submit Work Order',
  },
  assigned: {
    allowedFrom: ['submitted', 'approved'],
    allowedRoles: ['manager', 'admin'],
    label: 'Assign Vendor',
    requiresData: ['vendor_id', 'estimated_cost'],
  },
  pending_approval: {
    allowedFrom: ['submitted'],
    allowedRoles: ['manager', 'admin'],
    label: 'Pending Owner Approval',
  },
  in_progress: {
    allowedFrom: ['assigned'],
    allowedRoles: ['manager', 'admin', 'vendor'],
    label: 'Mark In Progress',
  },
  approved: {
    allowedFrom: ['pending_approval'],
    allowedRoles: ['owner', 'manager', 'admin'],
    label: 'Approve',
  },
  completed: {
    allowedFrom: ['in_progress'],
    allowedRoles: ['manager', 'admin', 'vendor'],
    label: 'Mark Completed',
    requiresData: ['vendor_cost', 'billed_amount'],
  },
  closed: {
    allowedFrom: ['completed', 'pending_approval'],
    allowedRoles: ['manager', 'admin'],
    label: 'Close Work Order',
  },
}

export function validateTransition(
  currentStatus: WorkOrderStatus,
  newStatus: WorkOrderStatus,
  callerRoles: string[]
): { valid: boolean; error?: string } {
  const config = TRANSITIONS[newStatus]
  if (!config.allowedFrom.includes(currentStatus)) {
    return { valid: false, error: `Cannot transition from ${currentStatus} to ${newStatus}` }
  }
  const hasRole = callerRoles.some((r) => config.allowedRoles.includes(r))
  if (!hasRole) {
    return { valid: false, error: `Insufficient role for transition to ${newStatus}` }
  }
  return { valid: true }
}
