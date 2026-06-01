'use client'

/**
 * DiscoverCollection — the resolved editorial-collection body of /discover.
 *
 * Rendered by the shell when a collection deep-link is active (?preset=<slug>,
 * or the legacy ?accolade= / ?cuisine= the home page + /explore redirect still
 * emit) and there is no free-text ?q. Restores the behavior the v2 rewrite
 * dropped: an "Explore the list" CTA now lands on the actual filtered list with
 * the curatorial CollectionHeader, instead of bouncing back to the unfiltered
 * Browse top-10.
 *
 * It fetches directly with the editorial predicates (applyEditorialFilter for
 * accolade/cuisine kinds; topConsensusPicks for the algorithm-backed
 * consensus_picks) so every predicate — including Hidden Gems' review ceiling
 * and the consensus scorer — resolves at full fidelity, not the lossy subset
 * SearchFilters can express. preserveOrder lists (Eater 38, JBF) keep DB order;
 * the rest rank by Gastronome Score.
 */

import { useEffect, useState } from 'react'
import { Search } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import CollectionHeader from '@/components/explore/CollectionHeader'
import RestaurantCard from '@/components/RestaurantCard'
import { RestaurantCardSkeleton } from '@/components/LoadingSkeleton'
import EmptyState from '@/components/EmptyState'
import {
  applyEditorialFilter,
  type EditorialCollection,
} from '@/lib/collections/editorial'
import { topConsensusPicks } from '@/lib/ranking/consensusPicks'
import { gastronomeScore } from '@/lib/score'
import type { Restaurant } from '@/types/database'

const MAX_RESULTS = 48

export default function DiscoverCollection({
  collection,
  city,
}: {
  collection: EditorialCollection
  city: string
}) {
  const [restaurants, setRestaurants] = useState<Restaurant[] | null>(null)

  useEffect(() => {
    let active = true
    const supabase = createClient()

    async function run() {
      try {
        // Algorithm-backed collections (consensus_picks) must call their
        // ranking function directly — applyEditorialFilter throws on this kind.
        if (collection.filter.kind === 'algorithm') {
          const rows = await topConsensusPicks(supabase, { city, limit: 24 })
          if (active) setRestaurants(rows)
          return
        }

        // accolade / cuisine kinds reduce to column predicates.
        const query = applyEditorialFilter(
          supabase.from('restaurants').select('*'),
          collection.filter,
          { city }
        )
        const { data } = await query.limit(120)
        let rows = (data ?? []) as Restaurant[]

        // Hand-ordered source lists (Eater 38, JBF) keep DB order; quality
        // collections rank by Gastronome Score.
        if (!collection.preserveOrder) {
          rows = rows
            .slice()
            .sort(
              (a, b) =>
                (gastronomeScore(b)?.score ?? 0) - (gastronomeScore(a)?.score ?? 0)
            )
        }

        if (active) setRestaurants(rows.slice(0, MAX_RESULTS))
      } catch {
        if (active) setRestaurants([])
      }
    }

    run()
    return () => {
      active = false
    }
  }, [collection, city])

  const loading = restaurants === null
  const count = restaurants?.length ?? 0

  return (
    <div className="space-y-6">
      <CollectionHeader
        eyebrow={collection.eyebrow}
        title={collection.title}
        description={collection.longDescription}
        count={count}
        rankBasis={collection.rankBasis}
        clearHref={`/discover?city=${encodeURIComponent(city)}`}
        brand={collection.brand}
        locality={city}
      />

      {/* "How we score" — the scoring mechanics, surfaced as a quiet disclosure
          rather than inline copy (the data model carries it; v1 never showed
          it). */}
      {collection.howWeScore && (
        <details
          className="max-w-2xl rounded-lg border px-4 py-3"
          style={{
            backgroundColor: 'var(--color-surface)',
            borderColor: 'var(--color-border)',
          }}
        >
          <summary
            className="cursor-pointer text-sm font-semibold"
            style={{ color: 'var(--color-text)' }}
          >
            How we score this list
          </summary>
          <p
            className="mt-2 text-sm"
            style={{ color: 'var(--color-text-secondary)', lineHeight: 1.5 }}
          >
            {collection.howWeScore}
          </p>
        </details>
      )}

      {loading ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <RestaurantCardSkeleton key={i} />
          ))}
        </div>
      ) : count === 0 ? (
        <EmptyState
          icon={Search}
          tone="attention"
          title="Nothing here yet"
          description={`No ${collection.title} picks in ${city} yet. Try another city or browse a different collection.`}
        />
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {restaurants!.map((r) => (
            <RestaurantCard key={r.id} restaurant={r} variant="compact" />
          ))}
        </div>
      )}
    </div>
  )
}
