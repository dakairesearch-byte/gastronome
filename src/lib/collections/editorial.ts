/**
 * Editorial collection definitions.
 *
 * Each collection is a curated category we expose to users on the explore
 * page (and, for the dedicated editorial routes, on /collections/editorial/<slug>).
 * Most collections are simple filters — Michelin star, Eater 38, Bib
 * Gourmand — that map directly onto a column predicate via
 * `applyEditorialFilter` below. The exceptions are listed in
 * specialCases below: collections that need a real ranking algorithm,
 * not a filter.
 *
 * `consensus_picks` is the canonical special case: it's scored by
 * `topConsensusPicks()` in `lib/ranking/consensusPicks.ts`, not by a
 * column predicate. Routes that surface this collection must call the
 * scorer directly and SHOULD NOT pass the slug through
 * `applyEditorialFilter` — the function explicitly leaves that case
 * unhandled to make accidental fall-through visible.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Restaurant } from '@/types/database'

export interface EditorialCollection {
  slug: string
  title: string
  description: string
  longDescription: string
  filter: EditorialFilter
  /** Stock or hand-picked image used on the collection card. */
  image?: string
}

/**
 * What kind of restaurant predicate this collection runs.
 *
 *  - `accolade` / `cuisine` — passes through to applyEditorialFilter and
 *    becomes a `.eq()` / `.gt()` / `.ilike()` against the candidates table.
 *  - `algorithm` — does NOT use applyEditorialFilter; the route must call
 *    the named ranking function directly.
 */
export type EditorialFilter =
  | { kind: 'accolade'; value: string }
  | { kind: 'cuisine'; value: string }
  | { kind: 'algorithm'; name: 'consensus_picks' }

export const EDITORIAL_COLLECTIONS: EditorialCollection[] = [
  {
    slug: 'consensus-picks',
    title: 'Consensus Picks',
    description:
      'The rare places where Google, Yelp, TikTok, and Instagram all agree.',
    longDescription:
      'Restaurants where all four signals — Google ratings, Yelp ratings, TikTok buzz, and Instagram engagement — converge. Scored by a weighted composite (30% Google, 30% Yelp, 20% TikTok, 20% Instagram) with log-normalized social signals and a quality floor. Capped at 20. This is a category only Gastronome can offer since no other platform combines review ratings with social engagement data.',
    filter: { kind: 'algorithm', name: 'consensus_picks' },
    image:
      'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=600&q=80',
  },
  {
    slug: 'michelin-stars',
    title: 'Michelin Stars',
    description: 'Every starred table in this city, one tap away.',
    longDescription:
      'Every Michelin-starred restaurant in the city, sourced from the official 2025 Guide. Includes 1-, 2-, and 3-star designations.',
    filter: { kind: 'accolade', value: 'michelin_star' },
    image:
      'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=600&q=80',
  },
  {
    slug: 'bib-gourmand',
    title: 'Bib Gourmand',
    description:
      'Michelin-recommended value cooking that punches above its price.',
    longDescription:
      'Michelin Guide Bib Gourmand selections — the inspectors\' picks for restaurants serving high-quality food at moderate prices.',
    filter: { kind: 'accolade', value: 'bib_gourmand' },
    image:
      'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600&q=80',
  },
  {
    slug: 'james-beard',
    title: 'James Beard Spotlight',
    description:
      'Restaurants and chefs recognized by the James Beard Foundation.',
    longDescription:
      'James Beard Award winners — the most prestigious recognition in American food, awarded annually to chefs and restaurants for culinary excellence.',
    filter: { kind: 'accolade', value: 'james_beard' },
    image:
      'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=600&q=80',
  },
  {
    slug: 'eater-38',
    title: 'Eater 38',
    description:
      "Eater's essential list of the city's must-try restaurants.",
    longDescription:
      'Eater\'s 38 essential restaurants in the city, updated quarterly by their local editors.',
    filter: { kind: 'accolade', value: 'eater_38' },
    image:
      'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=600&q=80',
  },
]

export function getEditorialCollectionBySlug(
  slug: string,
): EditorialCollection | null {
  return EDITORIAL_COLLECTIONS.find((c) => c.slug === slug) ?? null
}

/**
 * Apply an editorial filter to a Supabase restaurants query.
 *
 * Used for the `accolade` and `cuisine` filter kinds — these all reduce
 * to one or two column predicates against the restaurants table.
 *
 * The `algorithm` filter kind is intentionally unhandled here: routes
 * that surface algorithm-backed collections (consensus_picks) MUST call
 * the corresponding ranking function directly and not pass the slug
 * through this helper. We throw rather than silently falling through so
 * forgetting to wire up the ranking function fails loudly in development.
 *
 * consensus_picks is handled by topConsensusPicks() in
 * lib/ranking/consensusPicks.ts and should not go through this generic
 * filter path.
 */
export function applyEditorialFilter<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Q extends { ilike: any; gt: any; eq: any; gte: any; lte: any; or: any },
>(query: Q, filter: EditorialFilter, opts: { city?: string } = {}): Q {
  let q: Q = query
  if (opts.city) {
    q = q.ilike('city', opts.city)
  }
  if (filter.kind === 'cuisine') {
    return q.ilike('cuisine', filter.value)
  }
  if (filter.kind === 'accolade') {
    switch (filter.value) {
      case 'michelin_star':
        return q.gt('michelin_stars', 0)
      case 'bib_gourmand':
        return q.eq('michelin_designation', 'bib_gourmand')
      case 'james_beard':
        // james_beard_nominated column was dropped — winners only.
        return q.eq('james_beard_winner', true)
      case 'eater_38':
        return q.eq('eater_38', true)
      default:
        throw new Error(
          `applyEditorialFilter: unknown accolade "${filter.value}"`,
        )
    }
  }
  // filter.kind === 'algorithm'
  throw new Error(
    `applyEditorialFilter: algorithm-backed collection "${filter.name}" must call its ranking function directly, not this filter helper.`,
  )
}

/**
 * Convenience wrapper for routes that need the algorithm-vs-filter split
 * but want a single call site. Returns the Restaurant rows for the
 * collection in the active city. Algorithm-backed collections call the
 * appropriate ranker; filter-backed collections build a Supabase query
 * and execute it.
 */
export async function fetchEditorialCollectionRows(
  supabase: SupabaseClient<Database>,
  collection: EditorialCollection,
  opts: { city: string; limit?: number },
): Promise<Restaurant[]> {
  if (collection.filter.kind === 'algorithm') {
    if (collection.filter.name === 'consensus_picks') {
      const { topConsensusPicks } = await import(
        '@/lib/ranking/consensusPicks'
      )
      return topConsensusPicks(supabase, {
        city: opts.city,
        limit: opts.limit ?? 20,
      })
    }
    throw new Error(
      `fetchEditorialCollectionRows: unimplemented algorithm "${collection.filter.name}"`,
    )
  }
  let query = supabase
    .from('restaurants')
    .select('*')
    .order('google_rating', { ascending: false, nullsFirst: false })
    .limit(opts.limit ?? 500)
  query = applyEditorialFilter(query, collection.filter, { city: opts.city })
  const { data, error } = await query
  if (error) throw new Error(`editorial fetch: ${error.message}`)
  return (data ?? []) as Restaurant[]
}
