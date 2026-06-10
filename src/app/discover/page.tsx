'use client'

/**
 * /discover — the unified discovery surface (Reformulation v2).
 *
 * This is a THIN, legible shell. The old merged Discover put a List/Map/Grid
 * toggle plus a 3-tier filter stack all on one screen, which was "super hard
 * to follow." This rewrite splits Discover into TWO calm modes behind a single
 * persistent search:
 *
 *   - BROWSE (default) — the legible Top-10 Trending + editorial collections
 *     surface (<DiscoverBrowse>).
 *   - MAP — a full Beli-style interactive map (<DiscoverMapView>).
 *
 * A persistent global search input sits above both modes. The moment the user
 * types a query, search RESULTS take over the body (<DiscoverSearchResults>),
 * regardless of mode, so search is never buried behind a tab.
 *
 * URL is the source of truth (shareable):
 *   ?city=   active city (default via useCity / DEFAULT_CITY)
 *   ?q=      free-text search query (when present, search results win)
 *   ?mode=   browse | map (default browse)
 *   plus preset/accolade/cuisine params, preserved so Browse deep-links
 *   (/discover?accolade=michelin_star) keep working.
 *
 * The shell owns ONLY URL state + chrome. Each mode component reads any
 * further state it needs from the URL itself or self-fetches via
 * useDiscoverResults — the shell passes only { city } / { query, city }.
 */

import { Suspense, useCallback, useEffect, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { LayoutGrid, Map as MapIcon, Search, X } from 'lucide-react'
import DiscoverBrowse from '@/components/discover/DiscoverBrowse'
import DiscoverMapView from '@/components/discover/DiscoverMapView'
import DiscoverSearchResults from '@/components/discover/DiscoverSearchResults'
import DiscoverCollection from '@/components/discover/DiscoverCollection'
import {
  getEditorialCollectionBySlug,
  getEditorialCollectionByFilter,
  type EditorialCollection,
} from '@/lib/collections/editorial'
import { DEFAULT_CITY } from '@/lib/hooks/useCity'

/* ------------------------------------------------------------------ */
/*  Mode config                                                        */
/* ------------------------------------------------------------------ */

type Mode = 'browse' | 'map'

function parseMode(v: string | null | undefined): Mode {
  return v === 'map' ? 'map' : 'browse'
}

/* ------------------------------------------------------------------ */
/*  Shell                                                              */
/* ------------------------------------------------------------------ */

function DiscoverShellContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  // Resolved active city: ?city= wins; falls back to DEFAULT_CITY. (We read it
  // straight off the URL rather than useCity() so the shell stays a pure
  // URL→render function; the global Navigation switcher still drives ?city=.)
  const city = searchParams.get('city')?.trim() || DEFAULT_CITY

  const query = searchParams.get('q') ?? ''
  const mode = parseMode(searchParams.get('mode'))

  // Editorial collection deep-link: ?preset=<slug> (Browse cards) or the legacy
  // ?accolade= / ?cuisine= (home Editorial Picks + the /explore→/discover
  // redirect). Resolve to a collection so the shell renders the actual filtered
  // list + CollectionHeader instead of bouncing to the unfiltered Browse view.
  const preset = searchParams.get('preset')
  const accolade = searchParams.get('accolade')
  const cuisineParam = searchParams.get('cuisine')?.trim() || null
  // Cuisines without a canonical collection (e.g. the home page's
  // ?cuisine=French / ?cuisine=Sandwiches tiles) previously resolved to
  // null and dead-ended on the unfiltered Browse view. Synthesize a
  // minimal cuisine collection so the deep-link still lands on the
  // filtered list it advertised.
  const fallbackCuisineCollection: EditorialCollection | null = cuisineParam
    ? {
        slug: `cuisine-${cuisineParam.toLowerCase()}`,
        title: cuisineParam,
        description: `${cuisineParam} restaurants in this city.`,
        longDescription: `${cuisineParam} restaurants in this city, ranked by Gastronome Score.`,
        curator: 'Gastronome',
        eyebrow: 'GASTRONOME EDITORIAL',
        brand: 'gastronome',
        rankBasis: 'Ranked by Gastronome Score',
        preserveOrder: false,
        filter: { kind: 'cuisine', value: cuisineParam },
      }
    : null
  const collection =
    (preset ? getEditorialCollectionBySlug(preset) : null) ??
    getEditorialCollectionByFilter({ accolade, cuisine: cuisineParam }) ??
    fallbackCuisineCollection

  // Local, controlled mirror of the query so typing is instant; the URL is
  // updated (debounced) so the result body and shareable link stay in sync.
  const [draft, setDraft] = useState(query)

  // Keep the input in sync when the URL changes from outside (back/forward,
  // a city switch, a deep-link). Only overwrite when they actually diverge so
  // we don't clobber mid-typing.
  useEffect(() => {
    setDraft((prev) => (prev === query ? prev : query))
  }, [query])

  /**
   * Write a partial set of params onto the current URL, preserving everything
   * else (city, preset/accolade/cuisine deep-link params, mode). Passing a
   * null/empty value deletes the key. Uses replace + scroll:false so search
   * typing doesn't spam history or jump the page.
   */
  const patchParams = useCallback(
    (patch: Record<string, string | null>) => {
      const next = new URLSearchParams(searchParams.toString())
      for (const [k, v] of Object.entries(patch)) {
        if (v == null || v === '') next.delete(k)
        else next.set(k, v)
      }
      const str = next.toString()
      router.replace(str ? `${pathname}?${str}` : pathname, { scroll: false })
    },
    [searchParams, router, pathname]
  )

  // Debounce the URL write for the query so each keystroke doesn't replace().
  useEffect(() => {
    const trimmed = draft.trim()
    if (trimmed === query) return
    const t = setTimeout(() => patchParams({ q: trimmed || null }), 250)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft])

  const clearQuery = useCallback(() => {
    setDraft('')
    patchParams({ q: null })
  }, [patchParams])

  const searching = query.trim().length > 0

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--color-background)' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-5">
        {/* Header: title + active city */}
        <div className="flex items-end justify-between gap-3 flex-wrap">
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
              Browse what&rsquo;s trending in{' '}
              <span style={{ color: 'var(--color-text)', fontWeight: 600 }}>{city}</span>, or
              search across everything.
            </p>
          </div>
        </div>

        {/* Persistent global search — always visible above the mode content */}
        <form
          role="search"
          onSubmit={(e) => {
            e.preventDefault()
            patchParams({ q: draft.trim() || null })
          }}
          className="relative max-w-2xl"
        >
          <Search
            size={18}
            aria-hidden="true"
            className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
            style={{ color: 'var(--color-text-secondary)' }}
          />
          <input
            type="search"
            inputMode="search"
            enterKeyHint="search"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Search restaurants, dishes, neighborhoods…"
            aria-label="Search restaurants, dishes, neighborhoods"
            className="w-full pl-10 pr-10 py-3 rounded-xl transition focus:outline-none"
            style={{
              color: 'var(--color-text)',
              backgroundColor: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              fontFamily: 'var(--font-body)',
            }}
          />
          {draft && (
            <button
              type="button"
              onClick={clearQuery}
              aria-label="Clear search"
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 transition-colors"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              <X size={16} aria-hidden="true" />
            </button>
          )}
        </form>

        {/* Browse | Map toggle — always visible. De-emphasized (neither
            pressed) while a search query or a collection deep-link overrides
            the mode body; clicking a tab clears both and returns to it. */}
        <div className="flex items-center gap-3">
          <div
            className="inline-flex items-center gap-0.5 p-0.5 rounded-lg border"
            style={{
              borderColor: 'var(--color-border)',
              backgroundColor: 'var(--color-surface)',
            }}
            role="group"
            aria-label="Discover mode"
          >
            {(
              [
                { key: 'browse', label: 'Browse', Icon: LayoutGrid },
                { key: 'map', label: 'Map', Icon: MapIcon },
              ] as { key: Mode; label: string; Icon: typeof LayoutGrid }[]
            ).map(({ key, label, Icon }) => {
              const active = !searching && !collection && mode === key
              return (
                <button
                  key={key}
                  type="button"
                  aria-pressed={active}
                  aria-label={`${label} mode`}
                  onClick={() => {
                    // One coalesced URL patch: clear the query + any collection
                    // deep-link AND set the mode in a single replace(), so the
                    // two writes can't clobber each other off the same snapshot.
                    setDraft('')
                    patchParams({
                      q: null,
                      preset: null,
                      accolade: null,
                      cuisine: null,
                      mode: key === 'browse' ? null : key,
                    })
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors"
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
                  <span>{label}</span>
                </button>
              )
            })}
          </div>

          {searching ? (
            <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
              Showing search results ·{' '}
              <button
                type="button"
                onClick={clearQuery}
                className="font-semibold underline-offset-2 hover:underline"
                style={{ color: 'var(--color-action)' }}
              >
                back to {mode === 'map' ? 'map' : 'browse'}
              </button>
            </span>
          ) : collection ? (
            <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
              Viewing a collection ·{' '}
              <button
                type="button"
                onClick={() =>
                  patchParams({ preset: null, accolade: null, cuisine: null })
                }
                className="font-semibold underline-offset-2 hover:underline"
                style={{ color: 'var(--color-action)' }}
              >
                back to browse
              </button>
            </span>
          ) : null}
        </div>

        {/* Body — render priority: search query > collection deep-link >
            map mode > browse (default). */}
        {searching ? (
          <DiscoverSearchResults query={query} city={city} />
        ) : collection ? (
          <DiscoverCollection collection={collection} city={city} />
        ) : mode === 'map' ? (
          <DiscoverMapView city={city} />
        ) : (
          <DiscoverBrowse city={city} />
        )}
      </div>
    </div>
  )
}

/**
 * Server/prerender shell before DiscoverShellContent hydrates — renders the
 * heading and a static input affordance so cold loads and crawlers get a real
 * first paint (mirrors loading.tsx, lighter). Required because
 * DiscoverShellContent calls useSearchParams (Next 16 CSR-bailout rule).
 */
function DiscoverShellFallback() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--color-background)' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-5">
        <div>
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
          <div className="animate-shimmer h-4 w-80 max-w-full rounded" />
        </div>
        <div className="animate-shimmer h-12 rounded-xl max-w-2xl" />
        <div className="animate-shimmer h-9 w-44 rounded-lg" />
      </div>
    </div>
  )
}

export default function DiscoverPage() {
  return (
    <Suspense fallback={<DiscoverShellFallback />}>
      <DiscoverShellContent />
    </Suspense>
  )
}
