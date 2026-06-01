/**
 * Editorial collection definitions — the single source of truth.
 *
 * Every curated category the app exposes (home Editorial Picks and the
 * Explore collection grid) is defined here exactly once. There is NO
 * dedicated route: a collection is just a saved /explore?accolade=... (or
 * ?cuisine=...) query plus the curatorial chrome (eyebrow, curator,
 * rankBasis) that the CollectionHeader band renders on arrival.
 *
 * Most collections reduce to a column predicate via `applyEditorialFilter`
 * below — Michelin star, Bib Gourmand, Eater 38, James Beard, Hidden Gems,
 * Brunch. The one exception is `consensus_picks`: it is scored by
 * `topConsensusPicks()` in `lib/ranking/consensusPicks.ts`, not by a
 * column predicate. Routes that surface it must call the scorer directly;
 * `applyEditorialFilter` deliberately throws on the `algorithm` kind so an
 * accidental fall-through fails loudly.
 *
 * Ranking note: ordered editorial lists (Eater 38, James Beard) carry a
 * `preserveOrder` flag. Consumers MUST NOT re-sort these by google_rating —
 * doing so destroys the curation. Filter-backed quality collections
 * (Michelin, Bib, Hidden Gems, Brunch) are fine to rank by Gastronome
 * Score.
 */

/** Brand whose mark/wordmark fronts the collection (drives BrandIcons). */
export type CollectionBrand =
  | 'michelin'
  | 'jbf'
  | 'eater'
  | 'infatuation'
  | 'gastronome'

export interface EditorialCollection {
  /** Stable slug; also the COLLECTIONS card id on Explore. */
  slug: string
  title: string
  /** One-line teaser used on the collection card. */
  description: string
  /** Fuller blurb shown in the CollectionHeader band on the results page. */
  longDescription: string
  /** Authority label, e.g. "The Michelin Guide", "Eater", "Gastronome". */
  curator: string
  /** Uppercase eyebrow for the header band, e.g. "THE MICHELIN GUIDE 2025". */
  eyebrow: string
  /** Brand mark to show, if any. */
  brand: CollectionBrand
  /** Human-readable sort basis, e.g. "Ranked by Gastronome Score". */
  rankBasis: string
  /**
   * Optional "How we score" detail — the scoring mechanics moved out of the
   * teaser copy so the description can assert a reason to GO. Consumers may
   * surface this behind a disclosure ("How we score") rather than inline.
   */
  howWeScore?: string
  /**
   * True for hand-ordered source lists (Eater 38, JBF) that must keep
   * their published order — never re-sort by google_rating.
   */
  preserveOrder: boolean
  /** The predicate this collection maps to. */
  filter: EditorialFilter
  /** Stock or hand-picked image used on the collection card. */
  image?: string
}

/**
 * What kind of restaurant predicate this collection runs.
 *
 *  - `accolade` / `cuisine` — passes through to applyEditorialFilter and
 *    becomes a `.eq()` / `.gt()` / `.gte()` / `.ilike()` against the
 *    restaurants table.
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
    title: 'The Consensus',
    description:
      'The places the critics, the crowd, and the feed all agree on. Almost nothing makes this list.',
    longDescription:
      'When Google, Yelp, TikTok, and Instagram point at the same table, that table is a sure thing. These are the restaurants every signal endorses at once — the rare overlap where reviewers and the internet stop arguing. Book one and you will not be wrong.',
    curator: 'Gastronome',
    eyebrow: 'GASTRONOME EDITORIAL',
    brand: 'gastronome',
    rankBasis: 'Ranked by cross-platform consensus',
    howWeScore:
      'A weighted composite of every signal — 30% Google, 30% Yelp, 20% TikTok, 20% Instagram — with social numbers log-normalized and a quality floor applied, then capped at the top 20. No other platform combines review ratings with social engagement this way.',
    preserveOrder: true,
    filter: { kind: 'algorithm', name: 'consensus_picks' },
    image:
      'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=600&q=80',
  },
  {
    slug: 'hidden-gems',
    title: 'Hidden Gems',
    description: 'The neighborhood favorites that have not gone viral yet. Get there first.',
    longDescription:
      'Quietly excellent restaurants the crowds have not found — beloved by the few who know, still easy to get into. Eat here now, before the line shows up.',
    curator: 'Gastronome',
    eyebrow: 'GASTRONOME EDITORIAL',
    brand: 'gastronome',
    rankBasis: 'Ranked by Gastronome Score',
    howWeScore:
      'A Google rating of 4.3 or better paired with fewer than 500 reviews — high praise, low profile. That gap is where the gems hide.',
    preserveOrder: false,
    filter: { kind: 'accolade', value: 'hidden_gems' },
    image:
      'https://images.unsplash.com/photo-1627900440398-5db32dba8db1?w=600&q=80',
  },
  {
    slug: 'michelin-stars',
    title: 'Michelin Stars',
    description: 'The starred tables, for the nights that matter most.',
    longDescription:
      'Every starred restaurant in the city, straight from the inspectors — one, two, and three stars. When the occasion calls for the best, this is where it lives.',
    curator: 'The Michelin Guide',
    eyebrow: 'THE MICHELIN GUIDE 2025',
    brand: 'michelin',
    rankBasis: 'Source: Michelin Guide 2025',
    preserveOrder: false,
    filter: { kind: 'accolade', value: 'michelin_star' },
    image:
      'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=600&q=80',
  },
  {
    slug: 'bib-gourmand',
    title: 'Bib Gourmand',
    description:
      'Michelin-level cooking at a price you can actually book on a Tuesday.',
    longDescription:
      'The inspectors keep a separate list for the places that overdeliver — serious food, sane prices. This is where the value lives, with Michelin standing behind every pick.',
    curator: 'The Michelin Guide',
    eyebrow: 'THE MICHELIN GUIDE 2025',
    brand: 'michelin',
    rankBasis: 'Source: Michelin Guide 2025',
    preserveOrder: false,
    filter: { kind: 'accolade', value: 'bib_gourmand' },
    image:
      'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600&q=80',
  },
  {
    slug: 'james-beard',
    title: 'James Beard Spotlight',
    description:
      "American cooking at its peak — the kitchens that took home the country's top food award.",
    longDescription:
      'The James Beard Award is the highest honor in American food, and these are the winners. Going here means eating the work that the field itself decided was the best.',
    curator: 'James Beard Foundation',
    eyebrow: 'JAMES BEARD FOUNDATION',
    brand: 'jbf',
    rankBasis: 'Source: James Beard Foundation',
    preserveOrder: true,
    filter: { kind: 'accolade', value: 'james_beard' },
    image:
      'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=600&q=80',
  },
  {
    slug: 'eater-38',
    title: 'Eater 38',
    description: "The 38 restaurants Eater says define eating in this city right now.",
    longDescription:
      "Eater's local editors keep one running answer to 'where should I eat here' — 38 spots, no filler, refreshed every quarter. Work your way down it and you will know the city.",
    curator: 'Eater',
    eyebrow: 'EATER 38',
    brand: 'eater',
    rankBasis: "Source: Eater's essential 38",
    preserveOrder: true,
    filter: { kind: 'accolade', value: 'eater_38' },
    image:
      'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=600&q=80',
  },
  {
    slug: 'brunch',
    title: 'Best for Brunch',
    description: 'The long, late, lingering-table kind of morning. These are the rooms for it.',
    longDescription:
      'Brunch worth getting out of bed for — the spots built for a slow weekend, a second coffee, and nowhere to be. Bring the group; stay too long.',
    curator: 'Gastronome',
    eyebrow: 'GASTRONOME EDITORIAL',
    brand: 'gastronome',
    rankBasis: 'Ranked by Gastronome Score',
    preserveOrder: false,
    filter: { kind: 'cuisine', value: 'Brunch' },
    image:
      'https://images.unsplash.com/photo-1516061821-2ac22e822d3f?w=600&q=80',
  },
]

export function getEditorialCollectionBySlug(
  slug: string,
): EditorialCollection | null {
  return EDITORIAL_COLLECTIONS.find((c) => c.slug === slug) ?? null
}

/**
 * Resolve a collection from the live /explore query params. Returns the
 * matching collection so a results page can render the right
 * CollectionHeader (eyebrow / curator / rankBasis) instead of a bare
 * title. `accolade` is matched first, then `cuisine` (case-insensitive).
 */
export function getEditorialCollectionByFilter(params: {
  accolade?: string | null
  cuisine?: string | null
}): EditorialCollection | null {
  const accolade = params.accolade?.trim() || null
  const cuisine = params.cuisine?.trim() || null
  if (accolade) {
    return (
      EDITORIAL_COLLECTIONS.find(
        (c) =>
          (c.filter.kind === 'accolade' && c.filter.value === accolade) ||
          (c.filter.kind === 'algorithm' && c.filter.name === accolade),
      ) ?? null
    )
  }
  if (cuisine) {
    return (
      EDITORIAL_COLLECTIONS.find(
        (c) =>
          c.filter.kind === 'cuisine' &&
          c.filter.value.toLowerCase() === cuisine.toLowerCase(),
      ) ?? null
    )
  }
  return null
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
      case 'hidden_gems':
        // Quality floor + obscurity ceiling: great ratings, few reviews.
        return q.gte('google_rating', 4.3).lte('google_review_count', 500)
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
