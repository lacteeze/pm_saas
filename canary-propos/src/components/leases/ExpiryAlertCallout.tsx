// src/components/leases/ExpiryAlertCallout.tsx
// Lease expiry alert callout — groups leases into 3 urgency buckets (UI-SPEC §Component Specifications)

interface ExpiryLease {
  id: string
  tenantName: string
  propertyUnit: string
  endDate: string
  daysUntilExpiry: number
}

interface ExpiryAlertCalloutProps {
  leases: ExpiryLease[]
}

interface BucketConfig {
  label: string
  bg: string
  border: string
  text: string
  badgeBg: string
  badgeText: string
}

const BUCKETS: Record<'critical' | 'warning' | 'notice', BucketConfig> = {
  critical: {
    label: 'Expiring within 30 days',
    bg: 'bg-red-50',
    border: 'border-red-200',
    text: 'text-red-700',
    badgeBg: 'bg-red-100',
    badgeText: 'text-red-700',
  },
  warning: {
    label: 'Expiring in 31–60 days',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    text: 'text-amber-700',
    badgeBg: 'bg-amber-100',
    badgeText: 'text-amber-700',
  },
  notice: {
    label: 'Expiring in 61–90 days',
    bg: 'bg-stone-50',
    border: 'border-stone-200',
    text: 'text-stone-600',
    badgeBg: 'bg-stone-100',
    badgeText: 'text-stone-600',
  },
}

export function ExpiryAlertCallout({ leases }: ExpiryAlertCalloutProps) {
  const critical = leases.filter((l) => l.daysUntilExpiry <= 30)
  const warning = leases.filter((l) => l.daysUntilExpiry > 30 && l.daysUntilExpiry <= 60)
  const notice = leases.filter((l) => l.daysUntilExpiry > 60 && l.daysUntilExpiry <= 90)

  const groups: Array<{ key: 'critical' | 'warning' | 'notice'; items: ExpiryLease[] }> = [
    { key: 'critical', items: critical },
    { key: 'warning', items: warning },
    { key: 'notice', items: notice },
  ]

  const hasAny = critical.length > 0 || warning.length > 0 || notice.length > 0
  if (!hasAny) return null

  return (
    <div className="mb-6 space-y-3">
      {groups.map(({ key, items }) => {
        if (items.length === 0) return null
        const cfg = BUCKETS[key]
        return (
          <div
            key={key}
            className={`rounded-lg border ${cfg.border} ${cfg.bg} px-4 py-3`}
          >
            <p className={`mb-2 text-sm font-semibold ${cfg.text}`}>
              {cfg.label} ({items.length})
            </p>
            <ul className="space-y-1">
              {items.map((lease) => (
                <li key={lease.id} className="flex items-center justify-between text-sm">
                  <span className={cfg.text}>
                    {lease.tenantName} — {lease.propertyUnit}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${cfg.badgeBg} ${cfg.badgeText}`}
                  >
                    {lease.daysUntilExpiry}d left · {lease.endDate}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )
      })}
    </div>
  )
}
