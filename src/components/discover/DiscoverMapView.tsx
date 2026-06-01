'use client'

/**
 * DiscoverMapView — the full Beli-style map mode for /discover.
 *
 * A full-bleed interactive Google Map with score pins for the filtered
 * restaurant set, a search bar + light quick-filter chips floating over the
 * map, and a synced result list: a side panel on desktop, a draggable bottom
 * sheet on mobile. Selecting a pin highlights/scrolls its list row and
 * vice-versa. "Search this area" re-queries within the current viewport;
 * "Near me" recenters on geolocation.
 *
 * Data comes from the shared engine (useDiscoverResults) capped at
 * RESULT_CAP. The Maps JS key may be unset in local dev — RestaurantMap
 * degrades to a Static Maps tile, and this view keeps the list usable
 * alongside it, so nothing ever blanks.
 *
 * SHARED CONTRACT: default export, signature ({ city }: { city: string }).
 * All further state is read from the URL (useSearchParams) — the map's own
 * text query lives in `?mq=` (distinct from the shell's global `?q=`, which
 * switches to search-results mode) so the map stays in map mode while
 * filtering. Optional, with a safe empty default.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import {
  ChevronUp,
  Crosshair,
  MapPin,
  Search,
  Sparkles,
  Star,
  X,
} from 'lucide-react'
import RestaurantMap, { type MapBounds } from '@/components/discover/RestaurantMap'
import { MichelinStarIcon } from '@/components/brands/BrandIcons'
import { ScorePill } from '@/components/GastronomeScoreBadge'
import useDiscoverResults, {
  RESULT_CAP,
} from '@/lib/hooks/useDiscoverResults'
import type { SearchFilters } from '@/components/search/SearchFiltersSidebar'
import { DEFAULT_FILTERS } from '@/components/search/SearchFiltersSidebar'
import { gastronomeScore } from '@/lib/score'
import { getRestaurantPhotoUrl, isStockFallbackPhoto } from '@/lib/restaurant'
import type { Restaurant } from '@/types/database'

/* ------------------------------------------------------------------ */
/*  Quality steps — mirror DiscoverFilters' Min-GS → googleMinRating   */
/* ------------------------------------------------------------------ */

const QUALITY_STEPS: { label: string; googleMin: number }[] = [
  { label: 'Any', googleMin: 0 },
  { label: 'Good', googleMin: 4.0 },
  { label: 'Great', googleMin: 4.3 },
  { label: 'Best', googleMin: 4.6 },
]

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function hasCoords(r: Restaurant): boolean {
  return (
    typeof r.latitude === 'number' &&
    typeof r.longitude === 'number' &&
    Number.isFinite(r.latitude) &&
    Number.isFinite(r.longitude)
  )
}

/** Whether a restaurant falls inside a viewport box. */
function inBounds(r: Restaurant, b: MapBounds): boolean {
  if (!hasCoords(r)) return false
  const lat = r.latitude as number
  const lng = r.longitude as number
  return lat <= b.north && lat >= b.south && lng <= b.east && lng >= b.west
}

/* ================================================================== */
/*  Component                                                          */
/* ================================================================== */

export default function DiscoverMapView({ city }: { city: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  /* --------------- map-local text query (?mq=) --------------------- */
  // Seed from the URL so the view is shareable; debounce writes back so we
  // don't thrash history while typing. The shell's global `?q=` switches to
  // search-results mode, so the map uses its own param to stay in map mode.
  const urlMapQuery = searchParams.get('mq') ?? ''
  const [queryInput, setQueryInput] = useState(urlMapQuery)
  const [query, setQuery] = useState(urlMapQuery)

  // Reflect external URL changes (back/forward, city switch) into the input.
  useEffect(() => {
    setQueryInput(urlMapQuery)
    setQuery(urlMapQuery)
  }, [urlMapQuery])

  // Debounce the committed query (drives the engine) off the raw input.
  useEffect(() => {
    const t = setTimeout(() => setQuery(queryInput), 250)
    return () => clearTimeout(t)
  }, [queryInput])

  // Persist `mq` to the URL (replace, not push) on commit.
  useEffect(() => {
    const next = new URLSearchParams(searchParams.toString())
    if (query) next.set('mq', query)
    else next.delete('mq')
    const qs = next.toString()
    const current = searchParams.toString()
    if (qs !== current) {
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query])

  /* --------------- quick filters (local, map-scoped) -------------- */
  // The map keeps a slim subset of DiscoverFilters as state: city (from the
  // prop), a Quality floor, a Michelin toggle, and a cuisine chip set derived
  // from results. Heavier facets stay out of map mode to keep it legible.
  const [qualityIdx, setQualityIdx] = useState(0)
  const [michelinOnly, setMichelinOnly] = useState(false)
  const [cuisine, setCuisine] = useState<string | null>(null)

  const filters: SearchFilters = useMemo(
    () => ({
      ...DEFAULT_FILTERS,
      cities: city ? [city] : [],
      cuisines: cuisine ? [cuisine] : [],
      googleMinRating: QUALITY_STEPS[qualityIdx].googleMin,
      michelinStars: michelinOnly ? [1, 2, 3] : [],
    }),
    [city, cuisine, qualityIdx, michelinOnly]
  )

  const { restaurants, loading } = useDiscoverResults({
    filters,
    sort: 'gastronome',
    query,
  })

  /* --------------- "search this area" viewport filter ------------- */
  // When the user taps "Search this area", we clamp the visible set to the
  // current map bounds (client-side over the already-fetched, capped slice).
  // Panning afterwards re-arms the button; clearing returns to the full set.
  const [areaBounds, setAreaBounds] = useState<MapBounds | null>(null)
  const lastBoundsRef = useRef<MapBounds | null>(null)
  const [boundsMoved, setBoundsMoved] = useState(false)
  // Imperative recenter target for the map (driven by "Near me"). Passed to
  // RestaurantMap.centerOn so the single host-owned geolocation control both
  // moves the map and scopes the list.
  const [centerOn, setCenterOn] = useState<{ lat: number; lng: number } | null>(null)

  const handleBoundsChange = useCallback((b: MapBounds) => {
    lastBoundsRef.current = b
    setBoundsMoved(true)
  }, [])

  const visible = useMemo(() => {
    const located = restaurants.filter(hasCoords)
    if (!areaBounds) return located
    return located.filter((r) => inBounds(r, areaBounds))
  }, [restaurants, areaBounds])

  const handleSearchArea = useCallback(() => {
    if (lastBoundsRef.current) {
      setAreaBounds(lastBoundsRef.current)
      setBoundsMoved(false)
    }
  }, [])

  const clearArea = useCallback(() => {
    setAreaBounds(null)
    setBoundsMoved(false)
  }, [])

  /* --------------- pin ↔ row selection sync ----------------------- */
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const rowRefs = useRef<Map<string, HTMLElement>>(new Map())

  const handleSelect = useCallback((id: string) => {
    // RestaurantMap fires onSelect('') from its preview close button.
    setSelectedId(id || null)
  }, [])

  // Scroll the selected row into view in the list/sheet when a pin is tapped.
  useEffect(() => {
    if (!selectedId) return
    const el = rowRefs.current.get(selectedId)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [selectedId])

  // Clear a stale selection if the visible set no longer contains it.
  useEffect(() => {
    if (selectedId && !visible.some((r) => r.id === selectedId)) {
      setSelectedId(null)
    }
  }, [visible, selectedId])

  /* --------------- mobile bottom-sheet drag state ----------------- */
  // Three detents: peek (just the handle + count), half, and full. Draggable
  // via the grab handle; also tappable to cycle. Desktop ignores this.
  type Detent = 'peek' | 'half' | 'full'
  const [detent, setDetent] = useState<Detent>('half')
  const dragStartY = useRef<number | null>(null)

  const onHandlePointerDown = (e: React.PointerEvent) => {
    dragStartY.current = e.clientY
    ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
  }
  const onHandlePointerUp = (e: React.PointerEvent) => {
    if (dragStartY.current == null) return
    const dy = e.clientY - dragStartY.current
    dragStartY.current = null
    if (dy < -40) {
      // dragged up
      setDetent((d) => (d === 'peek' ? 'half' : 'full'))
    } else if (dy > 40) {
      // dragged down
      setDetent((d) => (d === 'full' ? 'half' : 'peek'))
    } else {
      // tap → cycle up
      setDetent((d) => (d === 'peek' ? 'half' : d === 'half' ? 'full' : 'peek'))
    }
  }

  const sheetHeight =
    detent === 'peek' ? '4.5rem' : detent === 'half' ? '45vh' : '85vh'

  /* --------------- cuisine chip options (from results) ------------ */
  const cuisineOptions = useMemo(() => {
    const counts = new Map<string, number>()
    for (const r of restaurants) {
      if (r.cuisine && r.cuisine !== 'Restaurant') {
        counts.set(r.cuisine, (counts.get(r.cuisine) ?? 0) + 1)
      }
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([c]) => c)
  }, [restaurants])

  /* ================================================================ */
  /*  Render                                                          */
  /* ================================================================ */

  const count = visible.length
  const capped = restaurants.length >= RESULT_CAP

  return (
    <div className="relative w-full" style={{ height: 'calc(100dvh - 7.5rem)' }}>
      {/* ---- floating search + quick chips (over the map) ---- */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex flex-col gap-2 p-3">
        <div className="pointer-events-auto mx-auto w-full max-w-2xl">
          <div
            className="flex items-center gap-2 rounded-full border px-3 py-2 shadow-md"
            style={{
              backgroundColor: 'var(--color-surface)',
              borderColor: 'var(--color-border)',
            }}
          >
            <Search size={16} style={{ color: 'var(--color-text-secondary)' }} />
            <input
              type="text"
              value={queryInput}
              onChange={(e) => setQueryInput(e.target.value)}
              placeholder={`Search the map in ${city}…`}
              aria-label="Search restaurants on the map"
              className="flex-1 bg-transparent text-sm outline-none"
              style={{ color: 'var(--color-text)' }}
            />
            {queryInput && (
              <button
                type="button"
                onClick={() => setQueryInput('')}
                aria-label="Clear search"
                className="rounded-full p-0.5 transition-opacity hover:opacity-70"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                <X size={15} />
              </button>
            )}
          </div>
        </div>

        {/* quick filter chips — slim subset, not the 3-tier wall */}
        <div className="pointer-events-auto mx-auto w-full max-w-2xl">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <Chip
              label={QUALITY_STEPS[qualityIdx].label === 'Any' ? 'Quality' : QUALITY_STEPS[qualityIdx].label}
              icon={<Sparkles size={13} />}
              active={qualityIdx > 0}
              onClick={() =>
                setQualityIdx((i) => (i + 1) % QUALITY_STEPS.length)
              }
            />
            <Chip
              label="Michelin"
              icon={<MichelinStarIcon size={12} title="Michelin" />}
              active={michelinOnly}
              onClick={() => setMichelinOnly((v) => !v)}
            />
            {cuisine && (
              <Chip
                label={cuisine}
                active
                onClick={() => setCuisine(null)}
                trailing={<X size={12} />}
              />
            )}
            {cuisineOptions
              .filter((c) => c !== cuisine)
              .map((c) => (
                <Chip
                  key={c}
                  label={c}
                  active={false}
                  onClick={() => setCuisine(c)}
                />
              ))}
          </div>
        </div>

        {/* "Search this area" — armed only after the viewport moves */}
        {(boundsMoved || areaBounds) && (
          <div className="pointer-events-auto mx-auto flex items-center gap-2">
            {boundsMoved && (
              <button
                type="button"
                onClick={handleSearchArea}
                className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-white shadow-md transition hover:opacity-90"
                style={{ backgroundColor: 'var(--color-action)' }}
              >
                <Search size={14} />
                Search this area
              </button>
            )}
            {areaBounds && (
              <button
                type="button"
                onClick={clearArea}
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-semibold shadow-md transition hover:opacity-90"
                style={{
                  backgroundColor: 'var(--color-surface)',
                  color: 'var(--color-text)',
                }}
              >
                <X size={14} />
                Clear area
              </button>
            )}
          </div>
        )}

        {/* Honesty notice: "Search this area" clamps the already-fetched, top-40
            slice to the viewport — it does NOT re-query the DB by geography, so
            a high-scoring city may hide lower-ranked places that are in view.
            Surface that rather than imply full geographic coverage. */}
        {areaBounds && capped && (
          <div className="pointer-events-auto mx-auto max-w-2xl">
            <p
              className="rounded-lg px-3 py-1.5 text-xs shadow-sm"
              style={{ backgroundColor: 'var(--color-surface)', color: 'var(--color-text-secondary)' }}
            >
              Showing the city&rsquo;s top {RESULT_CAP} by score within this area — refine
              filters to surface more.
            </p>
          </div>
        )}
      </div>

      {/* ---- desktop: map + side panel ; mobile: full map + sheet ---- */}
      <div className="flex h-full w-full">
        {/* Map (full-bleed; on desktop it shares with the side panel) */}
        <div className="relative h-full flex-1">
          <RestaurantMap
            restaurants={visible}
            selectedId={selectedId}
            onSelect={handleSelect}
            onBoundsChange={handleBoundsChange}
            hideSearchAreaButton
            hideNearMe
            centerOn={centerOn}
            renderPreview={(r, close) => (
              <PreviewCard restaurant={r} onClose={close} />
            )}
            className="h-full w-full"
          />

          {/* Near me — the SINGLE geolocation control (RestaurantMap's own
              crosshair is hidden via hideNearMe). Bottom-left so it clears the
              preview card (bottom-center). It both recenters the map (centerOn)
              and scopes the list to a box around the user. */}
          <div className="absolute bottom-4 left-3 z-10">
            <NearMeButton
              onLocate={(lat, lng) => {
                setCenterOn({ lat, lng })
                // Scope the list via a tiny bounds box so the area filter + map
                // converge on the user's location.
                const d = 0.03
                const b: MapBounds = {
                  north: lat + d,
                  south: lat - d,
                  east: lng + d,
                  west: lng - d,
                }
                lastBoundsRef.current = b
                setAreaBounds(b)
                setBoundsMoved(false)
              }}
            />
          </div>

          {/* result-count chip, top-left under the controls on desktop */}
          <div className="absolute left-3 top-32 z-10 hidden sm:block">
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold shadow-md"
              style={{
                backgroundColor: 'var(--color-surface)',
                color: 'var(--color-text)',
              }}
            >
              <MapPin size={13} style={{ color: 'var(--color-action)' }} />
              {loading ? 'Loading…' : `${count} place${count === 1 ? '' : 's'}`}
            </span>
          </div>
        </div>

        {/* Desktop side panel — synced list */}
        <aside
          className="hidden h-full w-80 flex-shrink-0 flex-col border-l lg:flex xl:w-96"
          style={{
            backgroundColor: 'var(--color-surface)',
            borderColor: 'var(--color-border)',
          }}
        >
          <ResultList
            restaurants={visible}
            loading={loading}
            selectedId={selectedId}
            onSelect={setSelectedId}
            rowRefs={rowRefs}
            capped={capped}
            count={count}
            onClearArea={areaBounds ? clearArea : undefined}
          />
        </aside>
      </div>

      {/* Mobile draggable bottom sheet — synced list */}
      <div
        className="absolute inset-x-0 bottom-0 z-30 flex flex-col rounded-t-3xl shadow-2xl transition-[height] duration-200 lg:hidden"
        style={{
          height: sheetHeight,
          backgroundColor: 'var(--color-surface)',
        }}
        role="dialog"
        aria-label="Map results"
      >
        {/* grab handle / header */}
        <button
          type="button"
          onPointerDown={onHandlePointerDown}
          onPointerUp={onHandlePointerUp}
          className="flex w-full flex-col items-center gap-1.5 px-4 pb-1 pt-2.5"
          aria-label={`${count} results — swipe up or down, or tap, to resize`}
        >
          <span
            className="h-1.5 w-10 rounded-full"
            style={{ backgroundColor: 'var(--color-border)' }}
          />
          <span
            className="flex items-center gap-1.5 text-sm font-semibold"
            style={{ color: 'var(--color-text)' }}
          >
            <ChevronUp
              size={15}
              className={detent === 'full' ? 'rotate-180 transition-transform' : 'transition-transform'}
              style={{ color: 'var(--color-action)' }}
            />
            {loading ? 'Loading…' : `${count} place${count === 1 ? '' : 's'}`}
          </span>
        </button>

        {detent !== 'peek' && (
          <div className="min-h-0 flex-1 overflow-hidden">
            <ResultList
              restaurants={visible}
              loading={loading}
              selectedId={selectedId}
              onSelect={(id) => {
                setSelectedId(id)
              }}
              rowRefs={rowRefs}
              capped={capped}
              count={count}
              onClearArea={areaBounds ? clearArea : undefined}
            />
          </div>
        )}
      </div>
    </div>
  )
}

/* ================================================================== */
/*  Subcomponents                                                      */
/* ================================================================== */

function Chip({
  label,
  icon,
  trailing,
  active,
  onClick,
}: {
  label: string
  icon?: React.ReactNode
  trailing?: React.ReactNode
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className="flex flex-shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold shadow-sm transition-colors"
      style={
        active
          ? {
              backgroundColor:
                'color-mix(in srgb, var(--color-action) 12%, var(--color-surface))',
              borderColor: 'var(--color-action)',
              color: 'var(--color-action)',
            }
          : {
              backgroundColor: 'var(--color-surface)',
              borderColor: 'var(--color-border)',
              color: 'var(--color-text)',
            }
      }
    >
      {icon}
      {label}
      {trailing}
    </button>
  )
}

function NearMeButton({
  onLocate,
}: {
  onLocate: (lat: number, lng: number) => void
}) {
  const [busy, setBusy] = useState(false)
  // User-facing error so a denied/unsupported geolocation doesn't look inert.
  const [error, setError] = useState<string | null>(null)
  const locate = () => {
    setError(null)
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setError("Location isn't available in this browser.")
      return
    }
    setBusy(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setBusy(false)
        onLocate(pos.coords.latitude, pos.coords.longitude)
      },
      () => {
        setBusy(false)
        setError("Couldn't access your location — check browser permissions.")
      },
      { enableHighAccuracy: true, timeout: 8000 }
    )
  }
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={locate}
        aria-label="Center map on my location"
        className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-md transition hover:opacity-90"
        style={{ color: 'var(--color-action)' }}
      >
        <Crosshair size={20} className={busy ? 'animate-pulse' : ''} />
      </button>
      {error && (
        <span
          role="status"
          aria-live="polite"
          className="max-w-[12rem] rounded-lg px-2.5 py-1.5 text-xs shadow-md"
          style={{ backgroundColor: 'var(--color-surface)', color: 'var(--color-text)' }}
        >
          {error}
        </span>
      )}
    </div>
  )
}

/** In-map preview card shown when a pin is selected. */
function PreviewCard({
  restaurant,
  onClose,
}: {
  restaurant: Restaurant
  onClose: () => void
}) {
  const score = gastronomeScore(restaurant)?.score ?? null
  const [imgFailed, setImgFailed] = useState(false)
  const photo = imgFailed ? null : getRestaurantPhotoUrl(restaurant)
  const isStock = isStockFallbackPhoto(photo)

  return (
    <div
      className="relative flex gap-3 overflow-hidden rounded-2xl border p-2.5 shadow-xl"
      style={{
        backgroundColor: 'var(--color-surface)',
        borderColor: 'var(--color-border)',
      }}
    >
      <Link
        href={`/restaurants/${restaurant.id}`}
        className="absolute inset-0 z-0"
        aria-label={restaurant.name}
      />
      <div
        className="relative z-[1] h-16 w-16 flex-shrink-0 overflow-hidden rounded-xl bg-gray-100"
        aria-hidden="true"
      >
        {photo ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photo}
              alt=""
              className="h-full w-full object-cover"
              loading="lazy"
              onError={() => setImgFailed(true)}
            />
            {isStock && (
              <span
                className="absolute bottom-0.5 left-0.5 rounded px-1 py-0.5 text-[8px] leading-none"
                style={{
                  backgroundColor: 'rgba(0,0,0,0.45)',
                  color: 'rgba(255,255,255,0.85)',
                }}
              >
                Stock
              </span>
            )}
          </>
        ) : (
          <div
            className="flex h-full w-full items-center justify-center text-xl font-light"
            style={{
              background:
                'linear-gradient(135deg, var(--color-skeleton-base) 0%, var(--color-skeleton-highlight) 100%)',
              color: 'var(--color-text-secondary)',
            }}
          >
            {restaurant.name.charAt(0).toUpperCase()}
          </div>
        )}
      </div>

      <div className="relative z-[1] min-w-0 flex-1 py-0.5">
        <h3
          className="truncate text-sm font-bold"
          style={{ color: 'var(--color-text)', fontFamily: 'var(--font-heading)' }}
          title={restaurant.name}
        >
          {restaurant.name}
        </h3>
        <div className="mt-1 flex items-center gap-2">
          <ScorePill score={score} size="sm" />
          {restaurant.cuisine && restaurant.cuisine !== 'Restaurant' && (
            <span
              className="truncate text-xs"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              {restaurant.cuisine}
            </span>
          )}
        </div>
        {(restaurant.neighborhood || restaurant.city) && (
          <p
            className="mt-1 flex items-center gap-1 truncate text-xs"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            <MapPin size={11} aria-hidden="true" />
            {restaurant.neighborhood || restaurant.city}
          </p>
        )}
      </div>

      <button
        type="button"
        onClick={(e) => {
          e.preventDefault()
          onClose()
        }}
        aria-label="Close preview"
        className="relative z-[2] h-7 w-7 flex-shrink-0 self-start rounded-full transition-colors hover:opacity-70"
        style={{ color: 'var(--color-text-secondary)' }}
      >
        <X size={16} className="mx-auto" />
      </button>
    </div>
  )
}

/** Synced result list — shared by the desktop panel and the mobile sheet. */
function ResultList({
  restaurants,
  loading,
  selectedId,
  onSelect,
  rowRefs,
  capped,
  count,
  onClearArea,
}: {
  restaurants: Restaurant[]
  loading: boolean
  selectedId: string | null
  onSelect: (id: string) => void
  rowRefs: React.MutableRefObject<Map<string, HTMLElement>>
  capped: boolean
  count: number
  onClearArea?: () => void
}) {
  if (loading && restaurants.length === 0) {
    return (
      <div className="space-y-3 p-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-20 animate-pulse rounded-xl"
            style={{ backgroundColor: 'var(--color-skeleton-base)' }}
          />
        ))}
      </div>
    )
  }

  if (restaurants.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
        <MapPin size={28} style={{ color: 'var(--color-text-secondary)' }} />
        <p className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
          No places in view
        </p>
        <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
          Try zooming out, clearing filters, or searching a different area.
        </p>
        {onClearArea && (
          <button
            type="button"
            onClick={onClearArea}
            className="mt-1 rounded-full px-4 py-1.5 text-xs font-semibold text-white"
            style={{ backgroundColor: 'var(--color-action)' }}
          >
            Clear area
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto overscroll-contain px-3 py-2">
      <p
        className="px-1 pb-2 pt-1 text-[11px] font-bold uppercase tracking-wider"
        style={{ color: 'var(--color-text-secondary)' }}
      >
        {count} place{count === 1 ? '' : 's'}
        {capped && ' · top results'}
      </p>
      <ul className="space-y-1.5">
        {restaurants.map((r) => (
          <ResultRow
            key={r.id}
            restaurant={r}
            selected={r.id === selectedId}
            onSelect={onSelect}
            rowRefs={rowRefs}
          />
        ))}
      </ul>
    </div>
  )
}

function ResultRow({
  restaurant,
  selected,
  onSelect,
  rowRefs,
}: {
  restaurant: Restaurant
  selected: boolean
  onSelect: (id: string) => void
  rowRefs: React.MutableRefObject<Map<string, HTMLElement>>
}) {
  const score = gastronomeScore(restaurant)?.score ?? null
  const [imgFailed, setImgFailed] = useState(false)
  const photo = imgFailed ? null : getRestaurantPhotoUrl(restaurant)

  return (
    <li
      ref={(el) => {
        if (el) rowRefs.current.set(restaurant.id, el)
        else rowRefs.current.delete(restaurant.id)
      }}
    >
      <div
        className="relative flex cursor-pointer gap-3 rounded-xl border p-2 transition-colors"
        style={
          selected
            ? {
                backgroundColor:
                  'color-mix(in srgb, var(--color-action) 8%, var(--color-surface))',
                borderColor: 'var(--color-action)',
              }
            : {
                backgroundColor: 'var(--color-surface)',
                borderColor: 'transparent',
              }
        }
        onMouseEnter={() => onSelect(restaurant.id)}
        onClick={() => onSelect(restaurant.id)}
      >
        {/* Detail-page link covers the row but leaves the hover/select
            behavior intact (the wrapping div handles select on hover/click;
            this anchor is the navigation affordance). */}
        <Link
          href={`/restaurants/${restaurant.id}`}
          className="absolute inset-0 z-0"
          aria-label={`View ${restaurant.name}`}
          // Keyboard parity with mouse hover: focusing the row's link selects
          // it, so keyboard/SR users drive the pin↔row sync too (Enter still
          // navigates to the detail page via the link's default action).
          onFocus={() => onSelect(restaurant.id)}
          onClick={(e) => {
            // Let select fire, then navigate — but don't block navigation.
            e.stopPropagation()
          }}
        />
        <div
          className="relative z-[1] h-14 w-14 flex-shrink-0 overflow-hidden rounded-lg bg-gray-100"
          aria-hidden="true"
        >
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photo}
              alt=""
              className="h-full w-full object-cover"
              loading="lazy"
              onError={() => setImgFailed(true)}
            />
          ) : (
            <div
              className="flex h-full w-full items-center justify-center text-lg font-light"
              style={{
                background:
                  'linear-gradient(135deg, var(--color-skeleton-base) 0%, var(--color-skeleton-highlight) 100%)',
                color: 'var(--color-text-secondary)',
              }}
            >
              {restaurant.name.charAt(0).toUpperCase()}
            </div>
          )}
        </div>

        <div className="relative z-[1] min-w-0 flex-1 py-0.5">
          <h4
            className="truncate text-sm font-semibold"
            style={{ color: 'var(--color-text)' }}
            title={restaurant.name}
          >
            {restaurant.name}
          </h4>
          <div className="mt-1 flex items-center gap-2">
            <ScorePill score={score} size="sm" />
            {restaurant.cuisine && restaurant.cuisine !== 'Restaurant' && (
              <span
                className="truncate text-xs"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                {restaurant.cuisine}
              </span>
            )}
          </div>
          {restaurant.neighborhood && (
            <p
              className="mt-0.5 flex items-center gap-1 truncate text-xs"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              <MapPin size={10} aria-hidden="true" />
              {restaurant.neighborhood}
            </p>
          )}
        </div>

        {(restaurant.michelin_stars ?? 0) > 0 && (
          <Star
            size={14}
            className="relative z-[1] mt-1 flex-shrink-0"
            style={{ color: 'var(--color-action)', fill: 'var(--color-action)' }}
            aria-label="Michelin starred"
          />
        )}
      </div>
    </li>
  )
}
