'use client'

/**
 * /discover — the unified discovery surface (Reformulation Wave 2).
 *
 * This is the single merge of the old /explore and /search products, which
 * were "the same thing built twice." One filtered result set is rendered
 * three ways (List / Map / Grid), driven by ONE 3-tier filter system
 * (DiscoverFilters) and ONE data engine (useDiscoverResults). Editorial
 * collections arrive here as PRESETS: a `?preset=`, `?accolade=`, or
 * `?cuisine=` param seeds the filter state and renders a CollectionHeader
 * band above the results, so "collections" are just pre-filled Discover
 * views rather than a parallel surface.
 *
 * URL is the source of truth (shareable): filters round-trip via
 * filtersToURL/fromURL, with `q` (query) and `sort` carried alongside.
 *
 * Map view in this wave is STATIC (a Google Static Maps tile centered on the
 * result set) — Wave 3 swaps in the interactive Google Maps JS API split-pane.
 */

import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  LayoutGrid,
  List as ListIcon,
  Map as MapIcon,
  Search,
  Utensils,
  ChevronDown,
} from 'lucide-react'
import RestaurantCard from '@/components/RestaurantCard'
import DiscoverFilters from '@/components/discover/DiscoverFilters'
import CollectionHeader from '@/components/explore/CollectionHeader'
import StaticMapTile from '@/components/StaticMapTile'
import SearchBar from '@/components/SearchBar'
import EmptyState from '@/components/EmptyState'
import { RestaurantCardSkeleton } from '@/components/LoadingSkeleton'
import useDiscoverResults, {
  RESULT_CAP,
  type SortKey,
} from '@/lib/hooks/useDiscoverResults'
import type { SearchFilters } from '@/components/search/SearchFiltersSidebar'
import {
  filtersFromURL,
  filtersToURL,
  isDefaultFilters,
} from '@/components/search/filterState'
import { EDITORIAL_COLLECTIONS } from '@/lib/collections/editorial'

/* ------------------------------------------------------------------ */
/*  View + sort config                                                 */
/* ------------------------------------------------------------------ */

type ViewMode = 'list' | 'map' | 'grid'

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'gastronome', label: 'Gastronome Score' },
  { key: 'google', label: 'Google rating' },
  { key: 'count', label: 'Review count' },
  { key: 'name', label: 'Name (A–Z)' },
]

function parseSortKey(v: string | null | undefined): SortKey {
  return v === 'google' || v === 'count' || v === 'name' ? v : 'gastronome'
}

function parseViewMode(v: string | null | undefined): ViewMode {
  return v === 'map' || v === 'grid' ? v : 'list'
}

/* ------------------------------------------------------------------ */
/*  Preset → filters + collection-header derivation                    */
/* ------------------------------------------------------------------ */

/**
 * Resolve the active editorial collection (if any) from the URL preset
 * params. Accepts `?preset=<slug>` (canonical), or the legacy explore
 * params `?accolade=` / `?cuisine=` which map onto the same collections.
 * Returns null when none match — Discover then renders the plain surface.
 */
function resolvePreset(params: URLSearchParams) {
  const preset = params.get('preset')?.trim()
  const accolade = params.get('accolade')?.trim()
  const cuisine = params.get('cuisine')?.trim()

  if (preset) {
    return EDITORIAL_COLLECTIONS.find((c) => c.slug === preset) ?? null
  }
  if (accolade) {
    return (
      EDITORIAL_COLLECTIONS.find(
        (c) =>
          (c.filter.kind === 'accolade' && c.filter.value === accolade) ||
          (c.filter.kind === 'algorithm' && c.filter.name === accolade)
      ) ?? null
    )
  }
  // A bare ?cuisine= without an editorial collection is still a valid filter,
  // but only surfaces a header when it matches a curated cuisine collection
  // (e.g. Brunch). Otherwise it's an ordinary cuisine facet, no band.
  if (cuisine) {
    return (
      EDITORIAL_COLLECTIONS.find(
        (c) =>
          c.filter.kind === 'cuisine' &&
          c.filter.value.toLowerCase() === cuisine.toLowerCase()
      ) ?? null
    )
  }
  return null
}

/**
 * Translate an editorial collection's filter into concrete SearchFilters
 * mutations, layered on top of a base (which already carries any city/query
 * facets). Mirrors exploreFacetsToSearchURL's accolade mapping so a preset
 * lands on the same engine predicates the old /search faceting used.
 *
 * `consensus_picks` is algorithm-backed and has no SearchFilters predicate;
 * we approximate it with a high quality floor so the preset still narrows the
 * set rather than 500ing. (Wave 4 rebuilds the true consensus surface.)
 */
function applyPresetToFilters(
  base: SearchFilters,
  collectionFilter: (typeof EDITORIAL_COLLECTIONS)[number]['filter']
): SearchFilters {
  const next: SearchFilters = { ...base }
  if (collectionFilter.kind === 'cuisine') {
    if (!next.cuisines.includes(collectionFilter.value))
      next.cuisines = [...next.cuisines, collectionFilter.value]
    return next
  }
  if (collectionFilter.kind === 'algorithm') {
    // consensus_picks — no exact predicate; approximate with a quality floor.
    next.googleMinRating = Math.max(next.googleMinRating, 4.3)
    return next
  }
  // accolade
  switch (collectionFilter.value) {
    case 'michelin_star':
      next.michelinStars = [1, 2, 3]
      break
    case 'bib_gourmand':
      next.bibGourmand = true
      break
    case 'james_beard':
      next.jamesBeard = 'winner'
      break
    case 'eater_38':
      next.eater38 = true
      break
    case 'hidden_gems':
      next.googleMinRating = Math.max(next.googleMinRating, 4.3)
      break
  }
  return next
}

/* ------------------------------------------------------------------ */
/*  Discover surface                                                   */
/* ------------------------------------------------------------------ */

function DiscoverContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  // `useSearchParams()` forces this component to render client-side (it sits
  // inside the page's Suspense boundary), so the lazy useState initializers
  // below run on the client with the real, live URL params — no separate
  // hydration effect is needed. didHydrate guards the URL-sync effect from
  // firing on the very first commit (which would just rewrite the same URL).
  const didHydrate = useRef(false)

  // Query + sort + view live outside the filter object so they don't pollute
  // filterState's serialization.
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '')
  const [sort, setSort] = useState<SortKey>(() =>
    parseSortKey(searchParams.get('sort'))
  )
  const [view, setView] = useState<ViewMode>(() =>
    parseViewMode(searchParams.get('view'))
  )

  // Initial filters: seed from the URL filter params, then layer any preset
  // mapping (accolade/cuisine/preset) on top so a deep-link like
  // /discover?accolade=michelin_star arrives pre-filtered.
  const [filters, setFilters] = useState<SearchFilters>(() => {
    const params = new URLSearchParams(searchParams.toString())
    const base = filtersFromURL(params)
    const preset = resolvePreset(params)
    return preset ? applyPresetToFilters(base, preset.filter) : base
  })

  // The preset/collection resolved from the URL at mount — drives the header
  // band. Held in state (not re-derived) because the URL-sync effect stops
  // re-emitting the preset params once they've seeded the filters. The band
  // is dismissed at RENDER time (derived `showPresetBand` below) when the user
  // clears every facet, so no setState-in-effect is needed.
  const [activePreset] = useState(() =>
    resolvePreset(new URLSearchParams(searchParams.toString()))
  )

  /* ----------------------------------------------------------------- */
  /*  URL sync on every filter / query / sort / view change             */
  /* ----------------------------------------------------------------- */
  useEffect(() => {
    if (!didHydrate.current) {
      didHydrate.current = true
      return
    }
    // Rebuild the URL from filters. We DON'T re-emit the preset params
    // (accolade/cuisine/preset) — once a preset seeds the filters, the
    // canonical state is the filter params themselves, so the band persists
    // via activePreset state, not the URL. This keeps a single source of
    // truth and lets the applied-facet chips clear the preset cleanly.
    const next = filtersToURL(filters)
    if (searchQuery.trim()) next.set('q', searchQuery.trim())
    if (sort !== 'gastronome') next.set('sort', sort)
    if (view !== 'list') next.set('view', view)
    const str = next.toString()
    const target = str ? `${pathname}?${str}` : pathname
    if (target !== `${pathname}${window.location.search}`) {
      router.replace(target, { scroll: false })
    }
  }, [filters, searchQuery, sort, view, pathname, router])

  // Show the preset band only while the seeded facets are still active —
  // once the user clears everything (Clear all), the band drops. Derived at
  // render so there's no state-syncing effect.
  const showPresetBand =
    activePreset != null &&
    !(isDefaultFilters(filters) && !searchQuery.trim())

  /* ----------------------------------------------------------------- */
  /*  Data engine                                                       */
  /* ----------------------------------------------------------------- */
  const { restaurants, dishes, neighborhoods, loading, total } =
    useDiscoverResults({ filters, sort, query: searchQuery })

  // Facet lists for DiscoverFilters. Cuisines + cities are loaded lazily;
  // neighborhoods come from the engine (city-scoped). We derive cuisines and
  // cities from the visible result set as a calm, dependency-free default —
  // the full facet load lives in the engine's own neighborhood query, and
  // building cuisine/city options from results keeps this page light.
  const availableCuisines = useMemo(
    () =>
      Array.from(
        new Set(restaurants.map((r) => r.cuisine).filter(Boolean) as string[])
      ).sort(),
    [restaurants]
  )
  const availableCities = useMemo(
    () =>
      Array.from(
        new Set(restaurants.map((r) => r.city).filter(Boolean) as string[])
      ).sort(),
    [restaurants]
  )

  const resultsCapped = restaurants.length >= RESULT_CAP
  const hasAnyResults = total > 0
  const activeCity = filters.cities[0]

  // Map center — first result with coordinates. Static tile in this wave.
  const mapCenter = useMemo(
    () =>
      restaurants.find(
        (r) =>
          typeof r.latitude === 'number' && typeof r.longitude === 'number'
      ),
    [restaurants]
  )

  /* ----------------------------------------------------------------- */
  /*  Render                                                            */
  /* ----------------------------------------------------------------- */

  const headerCount = showPresetBand ? restaurants.length : total

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--color-background)' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-5">
        {/* Heading — only on the plain (non-preset) surface; the preset band
            carries its own title. Keeps the surface calm and uncrowded. */}
        {!showPresetBand && (
          <div>
            <h1
              className="text-3xl sm:text-4xl"
              style={{
                fontFamily: 'var(--font-heading)',
                fontWeight: 600,
                letterSpacing: '-0.01em',
                color: 'var(--color-text)',
              }}
            >
              Discover
            </h1>
            <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>
              Search restaurants and dishes, filter by city, cuisine, and
              accolade, and view results as a list, map, or grid.
            </p>
          </div>
        )}

        {/* ONE search input */}
        <div className="max-w-2xl">
          <SearchBar
            placeholder={
              filters.mode === 'dishes'
                ? 'Search dishes — try "ramen" or "cacio e pepe"…'
                : 'Search restaurants, cuisines, cities, or dishes…'
            }
            initialValue={searchQuery}
            onSearch={setSearchQuery}
          />
        </div>

        {/* ONE 3-tier filter system */}
        <DiscoverFilters
          filters={filters}
          onChange={setFilters}
          available={{
            cuisines: availableCuisines,
            cities: availableCities,
            neighborhoods,
          }}
          city={activeCity}
        />

        {/* Collection preset band (collections-as-presets) */}
        {showPresetBand && activePreset && (
          <CollectionHeader
            eyebrow={activePreset.eyebrow}
            title={activePreset.title}
            description={activePreset.longDescription || activePreset.description}
            count={headerCount}
            rankBasis={activePreset.rankBasis}
            clearHref="/discover"
            brand={activePreset.brand}
            locality={activeCity}
          />
        )}

        {/* ONE results bar: count + view switch + sort */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
            {loading ? (
              'Searching…'
            ) : (
              <>
                <span className="font-semibold" style={{ color: 'var(--color-text)' }}>
                  {total}
                </span>{' '}
                {total === 1 ? 'result' : 'results'}
                {resultsCapped && (
                  <> · showing the top {RESULT_CAP} — narrow with filters to see more</>
                )}
              </>
            )}
          </p>

          <div className="flex items-center gap-2">
            {/* View switch */}
            <div
              className="inline-flex items-center gap-0.5 p-0.5 rounded-lg border"
              style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
              role="tablist"
              aria-label="Result view"
            >
              {(
                [
                  { key: 'list', label: 'List', Icon: ListIcon },
                  { key: 'map', label: 'Map', Icon: MapIcon },
                  { key: 'grid', label: 'Grid', Icon: LayoutGrid },
                ] as { key: ViewMode; label: string; Icon: typeof ListIcon }[]
              ).map(({ key, label, Icon }) => {
                const active = view === key
                return (
                  <button
                    key={key}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    aria-label={`${label} view`}
                    onClick={() => setView(key)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-md transition-colors"
                    style={
                      active
                        ? {
                            backgroundColor: 'var(--color-action)',
                            color: 'var(--color-on-action)',
                          }
                        : { color: 'var(--color-text-secondary)' }
                    }
                  >
                    <Icon size={14} />
                    <span className="hidden sm:inline">{label}</span>
                  </button>
                )
              })}
            </div>

            {/* Sort */}
            <div className="relative">
              <select
                aria-label="Sort results"
                value={sort}
                onChange={(e) => setSort(parseSortKey(e.target.value))}
                className="appearance-none text-xs font-semibold border rounded-lg pl-3 pr-7 py-1.5 cursor-pointer focus:outline-none"
                style={{
                  color: 'var(--color-text)',
                  backgroundColor: 'var(--color-surface)',
                  borderColor: 'var(--color-border)',
                }}
              >
                {SORT_OPTIONS.map((o) => (
                  <option key={o.key} value={o.key}>
                    {o.label}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={13}
                className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none"
                style={{ color: 'var(--color-text-secondary)' }}
              />
            </div>
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3].map((i) => (
              <RestaurantCardSkeleton key={i} />
            ))}
          </div>
        )}

        {/* Empty */}
        {!loading && !hasAnyResults && (
          <EmptyState
            icon={Search}
            tone={searchQuery || !isDefaultFilters(filters) ? 'attention' : 'neutral'}
            title={
              searchQuery || !isDefaultFilters(filters)
                ? 'No results found'
                : 'Start discovering'
            }
            description={
              searchQuery
                ? `No matches for “${searchQuery}”. Check the spelling or try a broader term, or loosen a filter.`
                : !isDefaultFilters(filters)
                ? 'Nothing matches the active filters. Try removing one.'
                : 'Search for a restaurant, cuisine, city, or dish — or pick a filter to get started.'
            }
          />
        )}

        {/* Results */}
        {!loading && hasAnyResults && (
          <div className="space-y-4">
            {/* Dishes (shown above restaurants in every view) */}
            {dishes.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 pt-1">
                  <div className="h-px flex-1" style={{ backgroundColor: 'var(--color-border)' }} />
                  <span className="text-xs font-medium flex items-center gap-1" style={{ color: 'var(--color-text-secondary)' }}>
                    <Utensils size={12} />
                    {searchQuery ? <>Dishes matching “{searchQuery}”</> : 'Top dishes'}
                  </span>
                  <div className="h-px flex-1" style={{ backgroundColor: 'var(--color-border)' }} />
                </div>
                {dishes.map((d, i) => (
                  <Link
                    key={`${d.restaurant.id}-${d.dish_name}-${i}`}
                    href={`/restaurants/${d.restaurant.id}`}
                    className="block rounded-lg border p-4 hover:shadow-md transition-shadow"
                    style={{
                      backgroundColor: 'var(--color-surface)',
                      borderColor: 'var(--color-border)',
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: 'var(--color-secondary)' }}
                      >
                        <Utensils size={18} style={{ color: 'var(--color-action)' }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-semibold truncate" style={{ color: 'var(--color-text)' }}>
                            {d.dish_name}
                          </p>
                          {d.isTopDish && (
                            <span
                              className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded flex-shrink-0"
                              style={{
                                color: 'var(--color-action)',
                                backgroundColor:
                                  'color-mix(in srgb, var(--color-action) 14%, var(--color-surface))',
                              }}
                            >
                              Top dish
                            </span>
                          )}
                        </div>
                        <p className="text-xs truncate" style={{ color: 'var(--color-text-secondary)' }}>
                          at {d.restaurant.name}
                          {d.restaurant.city ? ` · ${d.restaurant.city}` : ''}
                        </p>
                      </div>
                      {d.mention_count > 0 && (
                        <span
                          className="text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0"
                          style={{
                            color: 'var(--color-action)',
                            backgroundColor:
                              'color-mix(in srgb, var(--color-action) 10%, var(--color-surface))',
                          }}
                        >
                          {d.mention_count}{' '}
                          {d.mention_count === 1 ? 'mention' : 'mentions'}
                        </span>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            )}

            {/* Restaurants — rendered per view */}
            {restaurants.length > 0 && view === 'grid' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                {restaurants.map((r) => (
                  <RestaurantCard key={r.id} restaurant={r} variant="hero" />
                ))}
              </div>
            )}

            {restaurants.length > 0 && view === 'list' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {restaurants.map((r) => (
                  <RestaurantCard key={r.id} restaurant={r} variant="compact" />
                ))}
              </div>
            )}

            {restaurants.length > 0 && view === 'map' && (
              <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] gap-5">
                {/* Static map tile (interactive map ships in W3) */}
                <div
                  className="relative rounded-2xl border overflow-hidden h-64 lg:h-[calc(100vh-12rem)] lg:sticky lg:top-24"
                  style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-secondary)' }}
                >
                  {mapCenter ? (
                    <StaticMapTile
                      lat={mapCenter.latitude}
                      lng={mapCenter.longitude}
                      label={mapCenter.name}
                      zoom={12}
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-center px-6">
                      <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                        No mapped locations in this result set.
                      </p>
                    </div>
                  )}
                  <div
                    className="absolute bottom-2 left-2 right-2 text-[10px] text-center rounded-md px-2 py-1"
                    style={{
                      backgroundColor: 'color-mix(in srgb, var(--color-surface) 88%, transparent)',
                      color: 'var(--color-text-secondary)',
                    }}
                  >
                    Static preview · interactive map coming soon
                  </div>
                </div>
                {/* Result list beside the map */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  {restaurants.map((r) => (
                    <RestaurantCard key={r.id} restaurant={r} variant="compact" />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * Server shell before DiscoverContent hydrates — renders the heading and a
 * static input affordance so cold loads and crawlers get a real first paint
 * (mirrors loading.tsx structure, lighter).
 */
function DiscoverShell() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--color-background)' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        <h1
          className="text-3xl sm:text-4xl mb-2"
          style={{
            fontFamily: 'var(--font-heading)',
            fontWeight: 600,
            letterSpacing: '-0.01em',
            color: 'var(--color-text)',
          }}
        >
          Discover
        </h1>
        <p className="text-sm mb-6" style={{ color: 'var(--color-text-secondary)' }}>
          Search restaurants and dishes, filter, and view as a list, map, or grid.
        </p>
        <div className="animate-shimmer h-12 rounded-xl max-w-2xl" />
      </div>
    </div>
  )
}

export default function DiscoverPage() {
  return (
    <Suspense fallback={<DiscoverShell />}>
      <DiscoverContent />
    </Suspense>
  )
}
