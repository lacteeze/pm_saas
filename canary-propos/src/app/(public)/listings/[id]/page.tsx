// src/app/(public)/listings/[id]/page.tsx
// Public listing detail page — no auth required.
// Shows full listing info: photos, unit details, highlights, amenities,
// Google Maps embed, and CTA anchors for inquiry/apply forms (added in plan 03-05).
import { headers } from 'next/headers'
import Link from 'next/link'
import { getOrgBySlug } from '@/lib/orgs'
import { createPublicClient } from '@/lib/supabase/public'

interface Props {
  params: Promise<{ id: string }>
}

function formatCAD(amount: number): string {
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
    maximumFractionDigits: 0,
  }).format(amount)
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-CA', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

export default async function ListingDetailPage({ params }: Props) {
  const { id } = await params
  const headersList = await headers()
  const slug = headersList.get('x-org-slug') ?? ''

  const org = await getOrgBySlug(slug)

  if (!org) {
    return (
      <div className="py-16 text-center">
        <h1 className="text-2xl font-semibold text-stone-800 mb-2">Listing not found</h1>
        <p className="text-stone-500">This listing is no longer available.</p>
      </div>
    )
  }

  const supabase = createPublicClient()
  const { data: listing } = await supabase
    .from('listings')
    .select(
      `id, listing_title, listing_description, highlights, display_rent,
       available_from, status,
       units!unit_id(id, bedrooms, bathrooms, sq_footage, asking_rent, amenities,
         properties!property_id(id, street_address, city, province, photo_paths))`
    )
    .eq('id', id)
    .eq('status', 'published')
    .eq('org_id', org.id)
    .single()

  if (!listing) {
    return (
      <div className="py-16 text-center">
        <h1 className="text-2xl font-semibold text-stone-800 mb-2">Listing not found</h1>
        <p className="text-stone-500">
          This listing is no longer available or has been removed.
        </p>
        <Link
          href={`/listings${slug ? `?org=${slug}` : ''}`}
          className="mt-4 inline-block text-sm text-stone-600 hover:underline"
        >
          ← Back to all listings
        </Link>
      </div>
    )
  }

  // Type the joined result
  const unit = listing.units as {
    id: string
    bedrooms: number
    bathrooms: number
    sq_footage: number | null
    asking_rent: number | null
    amenities: string[] | null
    properties: {
      id: string
      street_address: string
      city: string
      province: string
      photo_paths: string[] | null
    } | null
  } | null

  const property = unit?.properties ?? null
  const rent = listing.display_rent ?? unit?.asking_rent ?? null

  const storageBase = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/org-assets`
  const photoUrls: string[] =
    property?.photo_paths?.map((p) => `${storageBase}/${p}`) ?? []

  const address = property
    ? `${property.street_address}, ${property.city}, ${property.province}`
    : null

  const mapsKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY
  const showMap = !!(address && mapsKey)

  return (
    <div>
      {/* Back link */}
      <Link
        href={`/listings${slug ? `?org=${slug}` : ''}`}
        className="text-sm text-stone-500 hover:text-stone-800 transition-colors mb-6 inline-block"
      >
        ← All listings
      </Link>

      {/* Main layout: two-column on desktop, stacked on mobile */}
      <div className="lg:grid lg:grid-cols-2 lg:gap-10">

        {/* Left: Photo gallery */}
        <div className="mb-8 lg:mb-0">
          {photoUrls.length > 0 ? (
            <div>
              {/* Main photo */}
              <div className="rounded-xl overflow-hidden h-72 sm:h-96 bg-stone-100 mb-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photoUrls[0]}
                  alt={listing.listing_title}
                  className="h-full w-full object-cover"
                />
              </div>
              {/* Thumbnails */}
              {photoUrls.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {photoUrls.slice(1).map((url, i) => (
                    <div
                      key={i}
                      className="flex-shrink-0 w-20 h-16 rounded-lg overflow-hidden bg-stone-100"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={url}
                        alt={`Photo ${i + 2}`}
                        className="h-full w-full object-cover"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-xl h-72 sm:h-96 bg-stone-100 flex items-center justify-center text-stone-300 text-6xl">
              🏠
            </div>
          )}
        </div>

        {/* Right: Listing details */}
        <div>
          {/* Title + price */}
          <h1 className="text-2xl font-bold text-stone-900 mb-1 leading-tight">
            {listing.listing_title}
          </h1>

          <p className="text-2xl font-semibold text-stone-700 mb-4">
            {rent ? `${formatCAD(rent)}/mo` : 'Price on request'}
          </p>

          {/* Available from */}
          {listing.available_from && (
            <p className="text-sm text-stone-500 mb-4">
              Available from{' '}
              <span className="font-medium text-stone-700">
                {formatDate(listing.available_from)}
              </span>
            </p>
          )}

          {/* Unit stats */}
          {unit && (
            <div className="flex gap-6 mb-5 text-stone-700">
              <div className="text-center">
                <p className="text-xl font-semibold">{unit.bedrooms}</p>
                <p className="text-xs text-stone-500 uppercase tracking-wide">
                  Bed{unit.bedrooms !== 1 ? 's' : ''}
                </p>
              </div>
              <div className="text-center">
                <p className="text-xl font-semibold">{unit.bathrooms}</p>
                <p className="text-xs text-stone-500 uppercase tracking-wide">
                  Bath{unit.bathrooms !== 1 ? 's' : ''}
                </p>
              </div>
              {unit.sq_footage && (
                <div className="text-center">
                  <p className="text-xl font-semibold">{unit.sq_footage}</p>
                  <p className="text-xs text-stone-500 uppercase tracking-wide">Sq ft</p>
                </div>
              )}
            </div>
          )}

          {/* Highlights */}
          {listing.highlights && listing.highlights.length > 0 && (
            <div className="mb-5">
              <h2 className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-2">
                Highlights
              </h2>
              <div className="flex flex-wrap gap-2">
                {listing.highlights.map((h, i) => (
                  <span
                    key={i}
                    className="bg-amber-50 text-amber-800 border border-amber-200 text-xs font-medium px-3 py-1 rounded-full"
                  >
                    {h}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Amenities */}
          {unit?.amenities && unit.amenities.length > 0 && (
            <div className="mb-5">
              <h2 className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-1">
                Amenities
              </h2>
              <p className="text-sm text-stone-600">{unit.amenities.join(', ')}</p>
            </div>
          )}

          {/* Description */}
          {listing.listing_description && (
            <div className="mb-6">
              <h2 className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-2">
                About this unit
              </h2>
              <p className="text-sm text-stone-700 leading-relaxed whitespace-pre-line">
                {listing.listing_description}
              </p>
            </div>
          )}

          {/* CTA buttons */}
          <div className="flex gap-3 flex-wrap">
            <a
              href="#inquiry-form"
              className="px-5 py-2.5 rounded-lg bg-stone-800 text-white text-sm font-medium hover:bg-stone-700 transition-colors"
            >
              Request a showing
            </a>
            <a
              href="#apply-form"
              className="px-5 py-2.5 rounded-lg border border-stone-300 text-stone-700 text-sm font-medium hover:bg-stone-50 transition-colors"
            >
              Apply now
            </a>
          </div>
        </div>
      </div>

      {/* Section 3: Map */}
      {address && (
        <div className="mt-10">
          <h2 className="text-sm font-semibold text-stone-500 uppercase tracking-wide mb-3">
            Location
          </h2>
          <p className="text-sm text-stone-600 mb-3">{address}</p>
          {showMap ? (
            <div className="rounded-xl overflow-hidden border border-stone-200">
              <iframe
                src={`https://www.google.com/maps/embed/v1/place?key=${mapsKey}&q=${encodeURIComponent(address)}`}
                width="100%"
                height="300"
                style={{ border: 0 }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                title="Property location"
              />
            </div>
          ) : (
            <div className="rounded-xl border border-stone-200 h-40 bg-stone-50 flex items-center justify-center text-sm text-stone-400">
              Map not available in development (set NEXT_PUBLIC_GOOGLE_MAPS_KEY to enable)
            </div>
          )}
        </div>
      )}

      {/* Anchor targets for inquiry/apply forms — populated in plan 03-05 */}
      <div id="inquiry-form" className="mt-16" />
      <div id="apply-form" className="mt-4" />
    </div>
  )
}
