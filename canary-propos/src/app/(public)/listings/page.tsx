// src/app/(public)/listings/page.tsx
// Public listings browse page — shows all published listings for an org.
// Org is resolved from ?org=<slug> query param (dev) or subdomain (production, D-05).
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'
import Link from 'next/link'
import { notFound } from 'next/navigation'

function createAnonClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

interface PageProps {
  searchParams: Promise<{ org?: string }>
}

export default async function PublicListingsPage({ searchParams }: PageProps) {
  const { org: orgSlug } = await searchParams

  if (!orgSlug) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-16 text-center">
        <p className="text-stone-500">No organization specified.</p>
      </div>
    )
  }

  const supabase = createAnonClient()

  // Look up org by slug
  const { data: organization } = await supabase
    .from('organizations')
    .select('id, name, slug')
    .eq('slug', orgSlug)
    .single()

  if (!organization) notFound()

  // Fetch published listings with unit + property data
  const { data: listings } = await supabase
    .from('listings')
    .select(`
      id,
      listing_title,
      listing_description,
      display_rent,
      available_from,
      highlights,
      units (
        bedrooms,
        bathrooms,
        sq_footage,
        asking_rent,
        amenities,
        properties (
          street_address,
          city,
          province,
          photo_paths
        )
      )
    `)
    .eq('org_id', organization.id)
    .eq('status', 'published')
    .order('created_at', { ascending: false })

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-stone-900">
          Available rentals — {organization.name}
        </h1>
        <p className="mt-1 text-sm text-stone-500">
          {listings?.length ?? 0} unit{listings?.length !== 1 ? 's' : ''} available
        </p>
      </div>

      {!listings || listings.length === 0 ? (
        <div className="rounded-xl border border-stone-200 bg-white px-8 py-16 text-center">
          <p className="text-stone-500">No units are currently available. Check back soon.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {listings.map((listing) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const unit = listing.units as any
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const property = unit?.properties as any
            const rent = listing.display_rent ?? unit?.asking_rent

            return (
              <Link
                key={listing.id}
                href={`/listings/${listing.id}?org=${orgSlug}`}
                className="group block rounded-xl border border-stone-200 bg-white shadow-sm transition hover:shadow-md"
              >
                {/* Photo */}
                <div className="h-44 overflow-hidden rounded-t-xl bg-stone-100">
                  {property?.photo_paths?.[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={property.photo_paths[0]}
                      alt={listing.listing_title}
                      className="h-full w-full object-cover transition group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <svg className="h-10 w-10 text-stone-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9.75L12 3l9 6.75V21H3V9.75z" />
                      </svg>
                    </div>
                  )}
                </div>

                {/* Card body */}
                <div className="p-4">
                  <p className="text-lg font-semibold text-stone-900">{listing.listing_title}</p>
                  {property && (
                    <p className="mt-0.5 text-sm text-stone-500">
                      {property.street_address}, {property.city}
                    </p>
                  )}
                  <div className="mt-2 flex items-center gap-3 text-sm text-stone-600">
                    {unit?.bedrooms != null && <span>{unit.bedrooms} bd</span>}
                    {unit?.bathrooms != null && <span>{unit.bathrooms} ba</span>}
                    {unit?.sq_footage && <span>{unit.sq_footage} sqft</span>}
                  </div>
                  {rent && (
                    <p className="mt-2 text-base font-bold text-amber-600">
                      ${Number(rent).toLocaleString()}<span className="text-sm font-normal text-stone-500">/mo</span>
                    </p>
                  )}
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
