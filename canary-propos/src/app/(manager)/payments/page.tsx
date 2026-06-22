// src/app/(manager)/payments/page.tsx
// Manager payments overview — manual payment recording, expense recording, e-transfer suggestions
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { RecordPaymentDialog } from '@/components/payments/RecordPaymentDialog'
import { RecordExpenseDialog } from '@/components/payments/RecordExpenseDialog'
import { ETransferSuggestions } from '@/components/payments/ETransferSuggestions'

function formatCurrency(amount: number | null): string {
  if (amount == null) return '—'
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(amount)
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-CA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function methodLabel(method: string | null): string {
  switch (method) {
    case 'etransfer': return 'e-Transfer'
    case 'cheque': return 'Cheque'
    case 'cash': return 'Cash'
    case 'bank_transfer': return 'Bank Transfer'
    case 'stripe': return 'Stripe'
    default: return method ?? '—'
  }
}

function statusBadgeClass(status: string | null): string {
  if (status === 'recorded') return 'inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700'
  if (status === 'cleared') return 'inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700'
  if (status === 'failed') return 'inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700'
  return 'inline-flex items-center rounded-full bg-stone-100 px-2.5 py-0.5 text-xs font-medium text-stone-600'
}

export default async function PaymentsPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: callerPerson } = await supabase
    .from('people')
    .select('org_id, role')
    .eq('user_id', user.id)
    .eq('active', true)
    .single()

  if (!callerPerson) redirect('/login')

  const isManager = callerPerson.role?.includes('manager') || callerPerson.role?.includes('admin')
  if (!isManager) redirect('/dashboard')

  // Load leases with tenant name and property address
  const { data: rawLeases } = await supabase
    .from('leases')
    .select(`
      id, monthly_rent, status,
      people!tenant_id(first_name, last_name),
      units!unit_id(unit_number, properties!property_id(street_address, city))
    `)
    .eq('org_id', callerPerson.org_id)
    .eq('status', 'active')
    .order('created_at', { ascending: false })

  // Load properties
  const { data: rawProperties } = await supabase
    .from('properties')
    .select('id, street_address, city')
    .eq('org_id', callerPerson.org_id)
    .order('street_address', { ascending: true })

  // Load recent payments (last 30) with lease + tenant info
  const { data: rawPayments } = await supabase
    .from('payments')
    .select(`
      id, amount, method, status, notes, created_at,
      leases!lease_id(
        monthly_rent,
        people!tenant_id(first_name, last_name),
        units!unit_id(unit_number, properties!property_id(street_address, city))
      )
    `)
    .eq('org_id', callerPerson.org_id)
    .order('created_at', { ascending: false })
    .limit(30)

  // Shape leases for components
  const leases = (rawLeases ?? []).map((l) => {
    const tenant = l.people as { first_name: string | null; last_name: string | null } | null
    const unit = l.units as { unit_number: string | null; properties: { street_address: string; city: string } | null } | null
    const tenantName = tenant
      ? [tenant.first_name, tenant.last_name].filter(Boolean).join(' ') || 'Unknown Tenant'
      : 'Unknown Tenant'
    const address = unit?.properties
      ? `${unit.properties.street_address}${unit.unit_number ? ` Unit ${unit.unit_number}` : ''}, ${unit.properties.city}`
      : '—'
    return {
      id: l.id,
      tenant_name: tenantName,
      property_address: address,
      monthly_rent: l.monthly_rent ?? 0,
    }
  })

  // Shape properties for RecordExpenseDialog
  const properties = (rawProperties ?? []).map((p) => ({
    id: p.id,
    address: `${p.street_address}, ${p.city}`,
  }))

  // Shape payments for table
  type RawLease = {
    monthly_rent: number | null
    people: { first_name: string | null; last_name: string | null } | null
    units: { unit_number: string | null; properties: { street_address: string; city: string } | null } | null
  }

  const payments = (rawPayments ?? []).map((p) => {
    const lease = p.leases as RawLease | null
    const tenant = lease?.people ?? null
    const unit = lease?.units ?? null
    const tenantName = tenant
      ? [tenant.first_name, tenant.last_name].filter(Boolean).join(' ') || 'Unknown'
      : 'Unknown'
    const address = unit?.properties
      ? `${unit.properties.street_address}${unit.unit_number ? ` Unit ${unit.unit_number}` : ''}`
      : '—'
    return {
      id: p.id,
      amount: p.amount as number | null,
      method: p.method as string | null,
      status: p.status as string | null,
      created_at: p.created_at as string | null,
      tenant_name: tenantName,
      property_address: address,
    }
  })

  return (
    <div className="space-y-6 p-6">
      {/* Page heading + actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-stone-900">Payments</h1>
        <div className="flex gap-2">
          <RecordPaymentDialog leases={leases} />
          <RecordExpenseDialog properties={properties} />
        </div>
      </div>

      {/* e-Transfer suggestions */}
      <ETransferSuggestions leases={leases} />

      {/* Recent payments table */}
      <div className="rounded-lg border border-stone-200 bg-white">
        <div className="border-b border-stone-200 px-6 py-4">
          <h2 className="text-base font-semibold text-stone-800">Recent Payments</h2>
        </div>

        {payments.length === 0 ? (
          <p className="px-6 py-8 text-sm text-stone-500">No payments recorded yet.</p>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden overflow-x-auto sm:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-stone-100 bg-stone-50 text-left text-xs font-medium text-stone-500 uppercase tracking-wide">
                    <th className="px-6 py-3">Date</th>
                    <th className="px-6 py-3">Tenant</th>
                    <th className="px-6 py-3">Property</th>
                    <th className="px-6 py-3">Amount</th>
                    <th className="px-6 py-3">Method</th>
                    <th className="px-6 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {payments.map((p) => (
                    <tr key={p.id} className="hover:bg-stone-50">
                      <td className="px-6 py-4 text-stone-600">{formatDate(p.created_at)}</td>
                      <td className="px-6 py-4 font-medium text-stone-800">{p.tenant_name}</td>
                      <td className="px-6 py-4 text-stone-600">{p.property_address}</td>
                      <td className="px-6 py-4 font-medium text-stone-800">{formatCurrency(p.amount)}</td>
                      <td className="px-6 py-4 text-stone-600">{methodLabel(p.method)}</td>
                      <td className="px-6 py-4">
                        <span className={statusBadgeClass(p.status)}>{p.status ?? '—'}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <ul className="divide-y divide-stone-100 sm:hidden">
              {payments.map((p) => (
                <li key={p.id} className="px-4 py-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-stone-800">{p.tenant_name}</p>
                      <p className="text-xs text-stone-500">{p.property_address}</p>
                      <p className="mt-1 text-xs text-stone-400">{formatDate(p.created_at)} · {methodLabel(p.method)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-stone-800">{formatCurrency(p.amount)}</p>
                      <span className={statusBadgeClass(p.status)}>{p.status ?? '—'}</span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  )
}
