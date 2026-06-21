// src/components/leases/ExpiryAlertCallout.tsx
// Displays expiry alert callout for leases expiring within 90 days, grouped by urgency.

import Link from 'next/link'

export interface ExpiringLease {
  id: string
  tenantName: string
  unitDisplay: string
  endDate: string
  daysUntilExpiry: number
}

interface ExpiryAlertCalloutProps {
  expiringLeases: ExpiringLease[]
}

function urgencyGroup(daysLeft: number): 'critical' | 'warning' | 'notice' {
  if (daysLeft <= 30) return 'critical'
  if (daysLeft <= 60) return 'warning'
  return 'notice'
}

const groupConfig = {
  critical: {
    label: 'Expiring within 30 days',
    bg: 'bg-red-50',
    border: 'border-red-200',
    dot: 'bg-red-500',
    text: 'text-red-800',
    sub: 'text-red-600',
  },
  warning: {
    label: 'Expiring within 31–60 days',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    dot: 'bg-amber-500',
    text: 'text-amber-800',
    sub: 'text-amber-600',
  },
  notice: {
    label: 'Expiring within 61–90 days',
    bg: 'bg-yellow-50',
    border: 'border-yellow-200',
    dot: 'bg-yellow-400',
    text: 'text-yellow-800',
    sub: 'text-yellow-600',
  },
}

export function ExpiryAlertCallout({ expiringLeases }: ExpiryAlertCalloutProps) {
  if (expiringLeases.length === 0) return null

  const groups = {
    critical: expiringLeases.filter((l) => urgencyGroup(l.daysUntilExpiry) === 'critical'),
    warning: expiringLeases.filter((l) => urgencyGroup(l.daysUntilExpiry) === 'warning'),
    notice: expiringLeases.filter((l) => urgencyGroup(l.daysUntilExpiry) === 'notice'),
  }

  return (
    <div className="mb-6 space-y-3">
      {(['critical', 'warning', 'notice'] as const).map((level) => {
        const leases = groups[level]
        if (leases.length === 0) return null
        const cfg = groupConfig[level]
        return (
          <div
            key={level}
            className={`rounded-xl border ${cfg.border} ${cfg.bg} px-4 py-3`}
          >
            <div className="mb-2 flex items-center gap-2">
              <span className={`h-2 w-2 shrink-0 rounded-full ${cfg.dot}`} />
              <p className={`text-sm font-semibold ${cfg.text}`}>{cfg.label}</p>
            </div>
            <ul className="space-y-1">
              {leases.map((lease) => (
                <li key={lease.id} className="flex items-center justify-between text-sm">
                  <span className={cfg.sub}>
                    {lease.tenantName} — {lease.unitDisplay}
                  </span>
                  <Link
                    href={`/leases/${lease.id}`}
                    className={`font-medium underline underline-offset-2 ${cfg.text} hover:opacity-80`}
                  >
                    {lease.daysUntilExpiry}d left
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )
      })}
    </div>
  )
}
