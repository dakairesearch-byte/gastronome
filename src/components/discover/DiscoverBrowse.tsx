'use client'

/**
 * DiscoverBrowse — the DEFAULT, legible Discover surface.
 *
 * This is the "browse" half of the two-mode /discover reformulation. The
 * previous merged Discover put a List/Map/Grid toggle and three tiers of
 * filters on one screen, which the owner found "super hard to follow". This
 * surface deliberately does the opposite: a calm, magazine-style stack with
 * only two kinds of content, top to bottom —
 *
 *   1) Top 10 Trending for the active city (the loved editorial list + map
 *      panel, reused verbatim from explore/Top10Trending).
 *   2) Editorial collection rails — one compact card per EDITORIAL_COLLECTION,
 *      each deep-linking back into Discover (?preset=<slug>) so browsing never
 *      leaves the page shell.
 *
 * No filter rail, no view toggles, no competing controls — the page shell
 * (Agent 3) owns the persistent search + Browse|Map toggle above this. Map
 * lives in DiscoverMapView; search results live in DiscoverSearchResults.
 *
 * SHARED CONTRACT: default export DiscoverBrowse({ city }: { city: string }).
 */

import { useMemo } from 'react'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import Top10Trending from '@/components/explore/Top10Trending'
import useDiscoverResults from '@/lib/hooks/useDiscoverResults'
import { DEFAULT_FILTERS } from '@/components/search/SearchFiltersSidebar'
import {
  EDITORIAL_COLLECTIONS,
  type EditorialCollection,
} from '@/lib/collections/editorial'
import {
  MichelinStarIcon,
  JamesBeardIcon,
  EaterIcon,
} from '@/components/brands/BrandIcons'

/**
 * Brand mark fronting a collection card. Mirrors CollectionHeader's BrandMark
 * but at the smaller card scale and with no mark for the gastronome /
 * infatuation brands (no canonical asset in BrandIcons), keeping the awards
 * iconography subtle per the brief.
 */
function CollectionBrandMark({
  brand,
}: {
  brand: EditorialCollection['brand']
}) {
  switch (brand) {
    case 'michelin':
      return <MichelinStarIcon size={15} title="Michelin Guide" />
    case 'jbf':
      return <JamesBeardIcon size={15} title="James Beard Foundation" />
    case 'eater':
      return <EaterIcon size={15} title="Eater" />
    default:
      return null
  }
}

/**
 * A single editorial collection rail rendered as a calm, compact card.
 * Deep-links into Discover (?preset=<slug>) so the page shell can resolve the
 * preset without ever leaving the Discover route. The active city rides along
 * so the filtered view stays scoped to wherever the user is browsing.
 */
function CollectionCard({
  collection,
  city,
}: {
  collection: EditorialCollection
  city: string
}) {
  const href = `/discover?preset=${encodeURIComponent(
    collection.slug
  )}&city=${encodeURIComponent(city)}`

  return (
    <Link
      href={href}
      className="group flex flex-col justify-between gap-4 rounded-sm border p-5 transition-shadow hover:shadow-[var(--shadow-2)]"
      style={{
        backgroundColor: 'var(--color-surface)',
        borderColor: 'var(--color-border)',
        borderRadius: 'var(--r-card)',
      }}
    >
      <div>
        <div className="flex items-center gap-2">
          <CollectionBrandMark brand={collection.brand} />
          <span
            className="text-[10px] uppercase"
            style={{
              color: 'var(--color-text-secondary)',
              fontFamily: 'var(--font-body)',
              letterSpacing: '0.16em',
              fontWeight: 600,
            }}
          >
            {collection.curator}
          </span>
        </div>

        <h3
          className="mt-2 text-xl"
          style={{
            color: 'var(--color-text)',
            fontFamily: 'var(--font-heading)',
            fontWeight: 500,
            lineHeight: 1.15,
          }}
        >
          {collection.title}
        </h3>

        <p
          className="mt-2 text-sm"
          style={{
            color: 'var(--color-text-secondary)',
            fontFamily: 'var(--font-body)',
            lineHeight: 1.5,
          }}
        >
          {collection.description}
        </p>
      </div>

      <span
        className="inline-flex items-center gap-1.5 text-sm font-medium transition-opacity group-hover:opacity-80"
        style={{ color: 'var(--color-action)', fontFamily: 'var(--font-body)' }}
      >
        Explore the list
        <ArrowRight
          size={14}
          aria-hidden="true"
          className="transition-transform group-hover:translate-x-0.5"
        />
      </span>
    </Link>
  )
}

export default function DiscoverBrowse({ city }: { city: string }) {
  // Quality-biased, city-scoped slice from the single Discover data engine.
  // No free-text query and default filters except the city, so this returns
  // the top restaurants in the active city ordered by Gastronome Score. We
  // feed the strongest 10 into Top10Trending as its `restaurants` prop (the
  // component is agnostic to the ranking — it renders whatever list it's
  // handed). Rows here carry no trending_counts, so Top10Trending honestly
  // labels them "Also highly rated" rather than faking trending signals.
  const filters = useMemo(
    () => ({ ...DEFAULT_FILTERS, cities: city ? [city] : [] }),
    [city]
  )
  const { restaurants, loading } = useDiscoverResults({
    filters,
    sort: 'gastronome',
    query: '',
  })

  const topTen = useMemo(() => restaurants.slice(0, 10), [restaurants])

  return (
    <div className="space-y-16">
      {/* --- Top 10 Trending --- */}
      <section aria-label={`Top trending restaurants in ${city}`}>
        {loading && topTen.length === 0 ? (
          <TrendingSkeleton city={city} />
        ) : topTen.length > 0 ? (
          <Top10Trending city={city} restaurants={topTen} />
        ) : (
          <EmptyState city={city} />
        )}
      </section>

      {/* --- Editorial collection rails --- */}
      <section aria-label="Editorial collections">
        <div className="mb-6">
          <span
            className="text-xs uppercase"
            style={{
              color: 'var(--color-action)',
              fontFamily: 'var(--font-body)',
              fontWeight: 500,
              letterSpacing: '0.04em',
            }}
          >
            Collections
          </span>
          <h2
            className="mt-2 text-2xl"
            style={{
              color: 'var(--color-text)',
              fontFamily: 'var(--font-heading)',
              fontWeight: 600,
              letterSpacing: '-0.01em',
              lineHeight: 1.2,
            }}
          >
            Browse by collection
          </h2>
          <p
            className="mt-1 max-w-2xl text-sm"
            style={{
              color: 'var(--color-text-secondary)',
              fontFamily: 'var(--font-body)',
              lineHeight: 1.5,
            }}
          >
            Curated lists from the Michelin Guide, Eater, the James Beard
            Foundation, and Gastronome — hand-picked ways into {city}.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {EDITORIAL_COLLECTIONS.map((collection) => (
            <CollectionCard
              key={collection.slug}
              collection={collection}
              city={city}
            />
          ))}
        </div>
      </section>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Loading + empty states                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Skeleton for the trending block while the first city slice loads. Mirrors
 * the two-column list + map rhythm so the page doesn't jump when data lands.
 */
function TrendingSkeleton({ city }: { city: string }) {
  return (
    <div>
      <div className="mb-6">
        <span
          className="text-xs uppercase"
          style={{
            color: 'var(--color-action)',
            fontFamily: 'var(--font-body)',
            fontWeight: 500,
            letterSpacing: '0.04em',
          }}
        >
          {city.toUpperCase()}
        </span>
        <div
          className="mt-2 h-7 w-48 rounded-sm"
          style={{ backgroundColor: 'var(--color-skeleton-base, #EDEAE3)' }}
          aria-hidden="true"
        />
      </div>
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
        <ol className="flex flex-col">
          {Array.from({ length: 6 }).map((_, i) => (
            <li
              key={i}
              className="flex items-center gap-4 border-b py-4"
              style={{ borderColor: 'var(--color-border)' }}
            >
              <span
                className="h-7 w-7 flex-shrink-0 rounded-full"
                style={{ backgroundColor: 'var(--color-skeleton-base, #EDEAE3)' }}
              />
              <div className="flex-1 space-y-2">
                <div
                  className="h-4 w-2/3 rounded"
                  style={{ backgroundColor: 'var(--color-skeleton-base, #EDEAE3)' }}
                />
                <div
                  className="h-3 w-1/3 rounded"
                  style={{ backgroundColor: 'var(--color-skeleton-base, #EDEAE3)' }}
                />
              </div>
            </li>
          ))}
        </ol>
        <div
          className="hidden rounded-sm lg:block"
          style={{
            backgroundColor: 'var(--color-surface-alt, #EFEAE1)',
            minHeight: '520px',
          }}
          aria-hidden="true"
        />
      </div>
      <span className="sr-only">Loading trending restaurants in {city}</span>
    </div>
  )
}

/**
 * Empty state when no restaurants resolve for the active city (sparse data).
 * Keeps the editorial collections below reachable rather than dead-ending.
 */
function EmptyState({ city }: { city: string }) {
  return (
    <div
      className="rounded-sm border px-6 py-12 text-center"
      style={{
        backgroundColor: 'var(--color-surface)',
        borderColor: 'var(--color-border)',
        borderRadius: 'var(--r-card)',
      }}
    >
      <h2
        className="text-xl"
        style={{
          color: 'var(--color-text)',
          fontFamily: 'var(--font-heading)',
          fontWeight: 500,
        }}
      >
        No trending restaurants in {city} yet
      </h2>
      <p
        className="mx-auto mt-2 max-w-md text-sm"
        style={{
          color: 'var(--color-text-secondary)',
          fontFamily: 'var(--font-body)',
          lineHeight: 1.5,
        }}
      >
        We&rsquo;re still gathering signals for this city. Browse a curated
        collection below, or search for a specific place.
      </p>
    </div>
  )
}
