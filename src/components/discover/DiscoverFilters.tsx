'use client'

/**
 * DiscoverFilters — the single 3-tier filter system for /discover.
 *
 * This REPLACES both the explore-page CategoryFilters and the search-page
 * SearchFiltersSidebar. It drives one `SearchFilters` object (the existing
 * type, reused verbatim) so the /discover data engine stays unchanged.
 *
 * Three tiers, from glanceable to exhaustive:
 *   1. QUICK-CHIP ROW — a single horizontally-scrollable row of the most
 *      common axes (City, top Accolade, Price-via-quality, Cuisine, Near me)
 *      plus an "All filters" button carrying an active-count badge.
 *   2. ALL-FILTERS SHEET — a panel (bottom sheet on mobile, centered card
 *      on desktop) with Cuisine + Accolades open, and the four raw
 *      Google/Yelp rating+review sliders collapsed under "Advanced".
 *   3. APPLIED-FACET CHIPS — removable chips for every active facet, so the
 *      result set is always legible and one tap clears any single facet.
 *
 * The Gastronome Score is promoted to a PRIMARY axis via a Min-GS segmented
 * control. Because the shared `SearchFilters` type carries no dedicated
 * gastronome-score field (and the engine sorts/filters on per-source
 * ratings), the segmented control drives `googleMinRating` — the dominant,
 * engine-backed term of the Gastronome Score — as an honest quality floor.
 * The precise per-source sliders live behind "Advanced".
 *
 * Garnet (var(--color-action)) marks every active/interactive surface.
 * Layout is deliberately calm: this is the anti-crowding centerpiece.
 */

import { useEffect, useRef, useState } from 'react'
import {
  Check,
  ChevronDown,
  MapPin,
  Search,
  SlidersHorizontal,
  Sparkles,
  X,
} from 'lucide-react'
import {
  BibGourmandIcon,
  EaterIcon,
  GoogleGIcon,
  JamesBeardIcon,
  MichelinStarIcon,
  YelpIcon,
} from '@/components/brands/BrandIcons'
import type { SearchFilters } from '@/components/search/SearchFiltersSidebar'
import {
  countActive,
  DEFAULT_FILTERS,
} from '@/components/search/SearchFiltersSidebar'
import { isDefaultFilters } from '@/components/search/filterState'

/** Available facet options the assembler feeds in from the data engine. */
export interface DiscoverFilterAvailable {
  cuisines: string[]
  cities: string[]
  neighborhoods: string[]
}

interface Props {
  filters: SearchFilters
  onChange: (next: SearchFilters) => void
  available: DiscoverFilterAvailable
  /** The globally-selected city, used to label the City quick-chip. */
  city?: string
}

/**
 * Min-Gastronome-Score steps. The Gastronome Score is a 0-10 number; the
 * engine-backed lever is the per-source rating floor, so each GS tier maps
 * to a Google rating floor (0-5). "Great" ~ 4.3+, "Exceptional" ~ 4.6+.
 */
const MIN_GS_STEPS: { label: string; googleMin: number }[] = [
  { label: 'Any', googleMin: 0 },
  { label: 'Good', googleMin: 4.0 },
  { label: 'Great', googleMin: 4.3 },
  { label: 'Best', googleMin: 4.6 },
]

const REVIEW_COUNT_STEPS = [0, 100, 250, 500, 1000, 2500, 5000, 10000]

function reviewCountLabel(n: number): string {
  if (n === 0) return 'Any'
  if (n >= 1000) return `${(n / 1000).toFixed(n % 1000 ? 1 : 0)}k+`
  return `${n}+`
}

export default function DiscoverFilters({
  filters,
  onChange,
  available,
  city,
}: Props) {
  const [sheetOpen, setSheetOpen] = useState(false)
  const activeCount = countActive(filters)

  const set = <K extends keyof SearchFilters>(
    key: K,
    value: SearchFilters[K]
  ) => onChange({ ...filters, [key]: value })

  const toggleInArray = (key: 'cities' | 'neighborhoods' | 'cuisines', v: string) =>
    set(
      key,
      filters[key].includes(v)
        ? filters[key].filter((x) => x !== v)
        : [...filters[key], v]
    )

  const reset = () => onChange({ ...DEFAULT_FILTERS })

  // Which Min-GS step the current googleMinRating corresponds to.
  const activeGsIdx = (() => {
    let idx = 0
    for (let i = MIN_GS_STEPS.length - 1; i >= 0; i--) {
      if (filters.googleMinRating >= MIN_GS_STEPS[i].googleMin) {
        idx = i
        break
      }
    }
    return idx
  })()

  const appliedFacets = buildAppliedFacets(filters)

  return (
    <div className="space-y-3">
      {/* ---------------------------------------------------------------- */}
      {/* Tier 1 — quick-chip row                                          */}
      {/* ---------------------------------------------------------------- */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 -mb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {/* All filters — opens the sheet; badge shows active count. */}
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          className="flex items-center gap-1.5 flex-shrink-0 px-3 py-2 rounded-full border text-sm font-semibold transition-colors"
          style={
            activeCount > 0
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
          <SlidersHorizontal size={14} />
          All filters
          {activeCount > 0 && (
            <span
              className="inline-flex items-center justify-center min-w-5 h-5 px-1 text-[10px] font-bold rounded-full"
              style={{
                backgroundColor: 'var(--color-action)',
                color: 'var(--color-surface)',
              }}
            >
              {activeCount}
            </span>
          )}
        </button>

        {/* City */}
        <QuickDropdown
          label="City"
          icon={<MapPin size={13} />}
          value={
            filters.cities.length === 0
              ? city || 'Any city'
              : filters.cities.length === 1
              ? filters.cities[0]
              : `${filters.cities.length} cities`
          }
          active={filters.cities.length > 0}
          options={available.cities}
          selected={filters.cities}
          onToggle={(v) => toggleInArray('cities', v)}
        />

        {/* Top accolade — Michelin (single highest-signal accolade chip) */}
        <QuickToggleChip
          label="Michelin"
          icon={<MichelinStarIcon size={12} title="Michelin" />}
          active={filters.michelinStars.length > 0}
          onClick={() =>
            set('michelinStars', filters.michelinStars.length > 0 ? [] : [1, 2, 3])
          }
        />

        {/* Price proxy = quality floor (Min-GS) */}
        <QuickDropdown
          label="Quality"
          icon={<Sparkles size={13} />}
          value={MIN_GS_STEPS[activeGsIdx].label}
          active={activeGsIdx > 0}
          mode="single"
          singleOptions={MIN_GS_STEPS.map((s) => s.label)}
          singleSelected={MIN_GS_STEPS[activeGsIdx].label}
          onSelectSingle={(label) => {
            const step = MIN_GS_STEPS.find((s) => s.label === label)
            if (step) set('googleMinRating', step.googleMin)
          }}
        />

        {/* Cuisine */}
        <QuickDropdown
          label="Cuisine"
          value={
            filters.cuisines.length === 0
              ? 'Any cuisine'
              : filters.cuisines.length === 1
              ? filters.cuisines[0]
              : `${filters.cuisines.length} cuisines`
          }
          active={filters.cuisines.length > 0}
          options={available.cuisines}
          selected={filters.cuisines}
          onToggle={(v) => toggleInArray('cuisines', v)}
        />

        {/* Near me — neighborhood proxy; opens the sheet's neighborhood block */}
        {available.neighborhoods.length > 0 && (
          <QuickDropdown
            label="Neighborhood"
            icon={<MapPin size={13} />}
            value={
              filters.neighborhoods.length === 0
                ? 'Any area'
                : filters.neighborhoods.length === 1
                ? filters.neighborhoods[0]
                : `${filters.neighborhoods.length} areas`
            }
            active={filters.neighborhoods.length > 0}
            options={available.neighborhoods}
            selected={filters.neighborhoods}
            onToggle={(v) => toggleInArray('neighborhoods', v)}
          />
        )}
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* Tier 3 — applied-facet chips                                     */}
      {/* ---------------------------------------------------------------- */}
      {appliedFacets.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {appliedFacets.map((facet) => (
            <span
              key={facet.id}
              className="inline-flex items-center gap-1 pl-2.5 pr-1.5 py-1 rounded-full text-xs font-semibold"
              style={{
                backgroundColor:
                  'color-mix(in srgb, var(--color-action) 14%, var(--color-surface))',
                color: 'var(--color-action)',
              }}
            >
              {facet.label}
              <button
                type="button"
                aria-label={`Remove ${facet.label}`}
                onClick={() => onChange(facet.remove(filters))}
                className="transition-opacity hover:opacity-70"
              >
                <X size={12} />
              </button>
            </span>
          ))}
          {!isDefaultFilters(filters) && (
            <button
              type="button"
              onClick={reset}
              className="text-xs font-semibold ml-0.5 transition-opacity hover:opacity-80"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              Clear all
            </button>
          )}
        </div>
      )}

      {/* ---------------------------------------------------------------- */}
      {/* Tier 2 — all-filters sheet                                       */}
      {/* ---------------------------------------------------------------- */}
      {sheetOpen && (
        <FilterSheet
          onClose={() => setSheetOpen(false)}
          activeCount={activeCount}
          onReset={reset}
          isDefault={isDefaultFilters(filters)}
        >
          {/* Gastronome quality — primary axis, segmented control */}
          <SheetSection title="Gastronome quality">
            <Segmented
              options={MIN_GS_STEPS.map((s) => s.label)}
              value={MIN_GS_STEPS[activeGsIdx].label}
              onChange={(label) => {
                const step = MIN_GS_STEPS.find((s) => s.label === label)
                if (step) set('googleMinRating', step.googleMin)
              }}
            />
            <p
              className="text-[11px] mt-1.5 leading-snug"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              Filters by the unified Gastronome Score floor. Fine-tune each
              source below under Advanced.
            </p>
          </SheetSection>

          {/* Cuisine — open by default */}
          {available.cuisines.length > 0 && (
            <SheetSection title="Cuisine">
              <ChipGrid
                options={available.cuisines}
                selected={filters.cuisines}
                onToggle={(v) => toggleInArray('cuisines', v)}
              />
            </SheetSection>
          )}

          {/* Neighborhood */}
          {available.neighborhoods.length > 0 && (
            <SheetSection title="Neighborhood">
              <ChipGrid
                options={available.neighborhoods}
                selected={filters.neighborhoods}
                onToggle={(v) => toggleInArray('neighborhoods', v)}
              />
            </SheetSection>
          )}

          {/* Accolades — open by default */}
          <SheetSection title="Accolades">
            <div className="space-y-3">
              <div>
                <span
                  className="text-xs font-semibold flex items-center gap-1.5 mb-1.5"
                  style={{ color: 'var(--color-text)' }}
                >
                  <MichelinStarIcon size={12} title="Michelin" />
                  Michelin Stars
                </span>
                <div className="grid grid-cols-3 gap-1.5">
                  {[1, 2, 3].map((n) => {
                    const active = filters.michelinStars.includes(n)
                    return (
                      <button
                        key={n}
                        type="button"
                        aria-label={`${n} Michelin Star${n > 1 ? 's' : ''}`}
                        aria-pressed={active}
                        onClick={() =>
                          set(
                            'michelinStars',
                            active
                              ? filters.michelinStars.filter((s) => s !== n)
                              : [...filters.michelinStars, n]
                          )
                        }
                        className="flex items-center justify-center gap-0.5 px-1.5 py-2 rounded-lg border transition-colors"
                        style={
                          active
                            ? {
                                backgroundColor:
                                  'color-mix(in srgb, var(--color-action) 12%, var(--color-surface))',
                                borderColor: 'var(--color-action)',
                              }
                            : {
                                backgroundColor: 'var(--color-surface)',
                                borderColor: 'var(--color-border)',
                              }
                        }
                      >
                        {Array.from({ length: n }).map((_, i) => (
                          <MichelinStarIcon
                            key={i}
                            size={14}
                            color={active ? '#C8102E' : '#9CA3AF'}
                          />
                        ))}
                      </button>
                    )
                  })}
                </div>
              </div>

              <ToggleRow
                label="Bib Gourmand"
                icon={<BibGourmandIcon size={14} title="Bib Gourmand" />}
                checked={filters.bibGourmand}
                onChange={(v) => set('bibGourmand', v)}
              />

              <div>
                <span
                  className="text-xs font-semibold flex items-center gap-1.5 mb-1.5"
                  style={{ color: 'var(--color-text)' }}
                >
                  <JamesBeardIcon size={14} title="James Beard" />
                  James Beard
                </span>
                <Segmented
                  options={['Any', 'Winner']}
                  value={filters.jamesBeard === 'winner' ? 'Winner' : 'Any'}
                  onChange={(v) =>
                    set('jamesBeard', v === 'Winner' ? 'winner' : 'any')
                  }
                />
              </div>

              <ToggleRow
                label="Eater 38"
                icon={<EaterIcon size={14} title="Eater 38" />}
                checked={filters.eater38}
                onChange={(v) => set('eater38', v)}
              />
            </div>
          </SheetSection>

          {/* Advanced — raw per-source sliders, collapsed */}
          <Disclosure title="Advanced">
            <div className="space-y-4 pt-1">
              <div>
                <h4
                  className="text-[11px] font-bold uppercase tracking-wider mb-2 flex items-center gap-1.5"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  <GoogleGIcon size={12} title="Google" />
                  Google
                </h4>
                <RatingSlider
                  label="Min rating"
                  value={filters.googleMinRating}
                  max={5}
                  step={0.1}
                  onChange={(v) => set('googleMinRating', v)}
                  badge={<GoogleGIcon size={12} title="Google" />}
                />
                <ReviewCountSlider
                  label="Min reviews"
                  value={filters.googleMinReviews}
                  onChange={(v) => set('googleMinReviews', v)}
                  badge={<GoogleGIcon size={12} title="Google" />}
                />
              </div>
              <div>
                <h4
                  className="text-[11px] font-bold uppercase tracking-wider mb-2 flex items-center gap-1.5"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  <YelpIcon size={12} title="Yelp" />
                  Yelp
                </h4>
                <RatingSlider
                  label="Min rating"
                  value={filters.yelpMinRating}
                  max={5}
                  step={0.5}
                  onChange={(v) => set('yelpMinRating', v)}
                  badge={<YelpIcon size={12} title="Yelp" />}
                />
                <ReviewCountSlider
                  label="Min reviews"
                  value={filters.yelpMinReviews}
                  onChange={(v) => set('yelpMinReviews', v)}
                  badge={<YelpIcon size={12} title="Yelp" />}
                />
              </div>
            </div>
          </Disclosure>
        </FilterSheet>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Applied-facet model                                                */
/* ------------------------------------------------------------------ */

interface AppliedFacet {
  id: string
  label: string
  remove: (f: SearchFilters) => SearchFilters
}

function buildAppliedFacets(f: SearchFilters): AppliedFacet[] {
  const facets: AppliedFacet[] = []

  for (const c of f.cities)
    facets.push({
      id: `city:${c}`,
      label: c,
      remove: (cur) => ({ ...cur, cities: cur.cities.filter((x) => x !== c) }),
    })
  for (const n of f.neighborhoods)
    facets.push({
      id: `nbhd:${n}`,
      label: n,
      remove: (cur) => ({
        ...cur,
        neighborhoods: cur.neighborhoods.filter((x) => x !== n),
      }),
    })
  for (const c of f.cuisines)
    facets.push({
      id: `cuisine:${c}`,
      label: c,
      remove: (cur) => ({
        ...cur,
        cuisines: cur.cuisines.filter((x) => x !== c),
      }),
    })
  for (const s of f.michelinStars)
    facets.push({
      id: `michelin:${s}`,
      label: `Michelin ${s}★`,
      remove: (cur) => ({
        ...cur,
        michelinStars: cur.michelinStars.filter((x) => x !== s),
      }),
    })
  if (f.bibGourmand)
    facets.push({
      id: 'bib',
      label: 'Bib Gourmand',
      remove: (cur) => ({ ...cur, bibGourmand: false }),
    })
  if (f.jamesBeard !== 'any')
    facets.push({
      id: 'jb',
      label: 'James Beard Winner',
      remove: (cur) => ({ ...cur, jamesBeard: 'any' }),
    })
  if (f.eater38)
    facets.push({
      id: 'eater38',
      label: 'Eater 38',
      remove: (cur) => ({ ...cur, eater38: false }),
    })
  if (f.googleMinRating > 0) {
    const step = MIN_GS_STEPS.find((s) => s.googleMin === f.googleMinRating)
    facets.push({
      id: 'gs',
      label: step ? `Quality: ${step.label}` : `Google ${f.googleMinRating.toFixed(1)}+`,
      remove: (cur) => ({ ...cur, googleMinRating: 0 }),
    })
  }
  if (f.googleMinReviews > 0)
    facets.push({
      id: 'greviews',
      label: `Google ${reviewCountLabel(f.googleMinReviews)} reviews`,
      remove: (cur) => ({ ...cur, googleMinReviews: 0 }),
    })
  if (f.yelpMinRating > 0)
    facets.push({
      id: 'yrating',
      label: `Yelp ${f.yelpMinRating.toFixed(1)}+`,
      remove: (cur) => ({ ...cur, yelpMinRating: 0 }),
    })
  if (f.yelpMinReviews > 0)
    facets.push({
      id: 'yreviews',
      label: `Yelp ${reviewCountLabel(f.yelpMinReviews)} reviews`,
      remove: (cur) => ({ ...cur, yelpMinReviews: 0 }),
    })

  return facets
}

/* ------------------------------------------------------------------ */
/*  Tier-1 chip primitives                                             */
/* ------------------------------------------------------------------ */

function quickChipStyle(active: boolean): React.CSSProperties {
  return active
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

function QuickToggleChip({
  label,
  icon,
  active,
  onClick,
}: {
  label: string
  icon?: React.ReactNode
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className="flex items-center gap-1.5 flex-shrink-0 px-3 py-2 rounded-full border text-sm font-semibold transition-colors"
      style={quickChipStyle(active)}
    >
      {icon}
      {label}
    </button>
  )
}

function QuickDropdown({
  label,
  icon,
  value,
  active,
  options,
  selected,
  onToggle,
  mode = 'multi',
  singleOptions,
  singleSelected,
  onSelectSingle,
}: {
  label: string
  icon?: React.ReactNode
  value: string
  active: boolean
  options?: string[]
  selected?: string[]
  onToggle?: (v: string) => void
  mode?: 'multi' | 'single'
  singleOptions?: string[]
  singleSelected?: string
  onSelectSingle?: (v: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function click(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', click)
    return () => document.removeEventListener('mousedown', click)
  }, [])

  const list = mode === 'single' ? singleOptions ?? [] : options ?? []
  const filtered = query
    ? list.filter((o) => o.toLowerCase().includes(query.toLowerCase()))
    : list

  return (
    <div className="relative flex-shrink-0" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 px-3 py-2 rounded-full border text-sm font-semibold transition-colors whitespace-nowrap"
        style={quickChipStyle(active)}
      >
        {icon}
        {value}
        <ChevronDown
          size={13}
          className={`transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <div
          className="absolute top-full left-0 mt-1.5 w-56 max-h-72 overflow-y-auto border rounded-2xl shadow-lg z-50 py-1"
          style={{
            backgroundColor: 'var(--color-surface)',
            borderColor: 'var(--color-border)',
          }}
        >
          {mode === 'multi' && list.length > 6 && (
            <div
              className="px-2 pb-1 pt-0.5 sticky top-0 border-b"
              style={{
                backgroundColor: 'var(--color-surface)',
                borderColor: 'var(--color-border)',
              }}
            >
              <div className="relative">
                <Search
                  size={12}
                  className="absolute left-2 top-1/2 -translate-y-1/2"
                  style={{ color: 'var(--color-text-secondary)' }}
                />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={`Search ${label.toLowerCase()}...`}
                  className="w-full pl-6 pr-2 py-1 text-xs border rounded-md focus:outline-none"
                  style={{
                    borderColor: 'var(--color-border)',
                    backgroundColor: 'var(--color-surface)',
                    color: 'var(--color-text)',
                  }}
                />
              </div>
            </div>
          )}
          {filtered.length === 0 ? (
            <p
              className="px-3 py-2 text-xs"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              No matches
            </p>
          ) : (
            filtered.map((option) => {
              const isSel =
                mode === 'single'
                  ? singleSelected === option
                  : (selected ?? []).includes(option)
              return (
                <button
                  type="button"
                  key={option}
                  onClick={() => {
                    if (mode === 'single') {
                      onSelectSingle?.(option)
                      setOpen(false)
                    } else {
                      onToggle?.(option)
                    }
                  }}
                  className="w-full flex items-center justify-between px-3 py-1.5 text-sm transition-colors"
                  style={
                    isSel
                      ? {
                          backgroundColor:
                            'color-mix(in srgb, var(--color-action) 12%, var(--color-surface))',
                          color: 'var(--color-action)',
                        }
                      : { color: 'var(--color-text)' }
                  }
                >
                  <span className="truncate">{option}</span>
                  {isSel && (
                    <Check
                      size={14}
                      className="flex-shrink-0 ml-2"
                      style={{ color: 'var(--color-action)' }}
                    />
                  )}
                </button>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Tier-2 sheet + section primitives                                  */
/* ------------------------------------------------------------------ */

function FilterSheet({
  children,
  onClose,
  activeCount,
  onReset,
  isDefault,
}: {
  children: React.ReactNode
  onClose: () => void
  activeCount: number
  onReset: () => void
  isDefault: boolean
}) {
  useEffect(() => {
    function key(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', key)
    return () => document.removeEventListener('keydown', key)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-[60] flex sm:items-center sm:justify-center items-end">
      {/* Scrim */}
      <button
        type="button"
        aria-label="Close filters"
        onClick={onClose}
        className="absolute inset-0"
        style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
      />
      {/* Panel — bottom sheet on mobile, centered card on desktop */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="All filters"
        className="relative w-full sm:max-w-lg max-h-[85vh] flex flex-col rounded-t-3xl sm:rounded-3xl shadow-xl"
        style={{ backgroundColor: 'var(--color-surface)' }}
      >
        <div
          className="flex items-center justify-between px-5 py-3.5 border-b flex-shrink-0"
          style={{ borderColor: 'var(--color-border)' }}
        >
          <h2
            className="text-base font-bold flex items-center gap-2"
            style={{ color: 'var(--color-text)' }}
          >
            <SlidersHorizontal size={16} />
            All filters
            {activeCount > 0 && (
              <span
                className="inline-flex items-center justify-center min-w-5 h-5 px-1 text-[10px] font-bold rounded-full"
                style={{
                  backgroundColor: 'var(--color-action)',
                  color: 'var(--color-surface)',
                }}
              >
                {activeCount}
              </span>
            )}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 rounded-full transition-colors hover:opacity-70"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-4 space-y-5 flex-1">
          {children}
        </div>

        <div
          className="flex items-center justify-between gap-3 px-5 py-3.5 border-t flex-shrink-0"
          style={{ borderColor: 'var(--color-border)' }}
        >
          <button
            type="button"
            onClick={onReset}
            disabled={isDefault}
            className="text-sm font-semibold transition-opacity disabled:opacity-30 hover:opacity-80"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            Clear all
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-full text-sm font-bold transition-opacity hover:opacity-90"
            style={{
              backgroundColor: 'var(--color-action)',
              color: 'var(--color-surface)',
            }}
          >
            Show results
          </button>
        </div>
      </div>
    </div>
  )
}

function SheetSection({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section>
      <h3
        className="text-[11px] font-bold uppercase tracking-wider mb-2"
        style={{ color: 'var(--color-text-secondary)' }}
      >
        {title}
      </h3>
      {children}
    </section>
  )
}

function Disclosure({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  return (
    <section
      className="border-t pt-3"
      style={{ borderColor: 'var(--color-border)' }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-center justify-between"
      >
        <span
          className="text-[11px] font-bold uppercase tracking-wider"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          {title}
        </span>
        <ChevronDown
          size={15}
          className={`transition-transform ${open ? 'rotate-180' : ''}`}
          style={{ color: 'var(--color-text-secondary)' }}
        />
      </button>
      {open && <div className="mt-2">{children}</div>}
    </section>
  )
}

function Segmented({
  options,
  value,
  onChange,
}: {
  options: string[]
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div
      className="grid gap-1 p-1 rounded-xl"
      style={{
        gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))`,
        backgroundColor: 'var(--color-background)',
      }}
    >
      {options.map((opt) => {
        const active = value === opt
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            aria-pressed={active}
            className="py-1.5 text-xs font-semibold rounded-lg transition-colors"
            style={
              active
                ? {
                    backgroundColor: 'var(--color-surface)',
                    color: 'var(--color-action)',
                    boxShadow: '0 1px 2px 0 rgba(0,0,0,0.06)',
                  }
                : { color: 'var(--color-text-secondary)' }
            }
          >
            {opt}
          </button>
        )
      })}
    </div>
  )
}

function ChipGrid({
  options,
  selected,
  onToggle,
}: {
  options: string[]
  selected: string[]
  onToggle: (v: string) => void
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => {
        const active = selected.includes(opt)
        return (
          <button
            key={opt}
            type="button"
            aria-pressed={active}
            onClick={() => onToggle(opt)}
            className="px-3 py-1.5 rounded-full border text-xs font-semibold transition-colors"
            style={quickChipStyle(active)}
          >
            {opt}
          </button>
        )
      })}
    </div>
  )
}

function ToggleRow({
  label,
  icon,
  checked,
  onChange,
}: {
  label: string
  icon?: React.ReactNode
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <label className="flex items-center justify-between cursor-pointer">
      <span
        className="text-xs font-semibold flex items-center gap-1.5"
        style={{ color: 'var(--color-text)' }}
      >
        {icon}
        {label}
      </span>
      <button
        type="button"
        role="checkbox"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className="relative w-9 h-5 rounded-full transition-colors flex-shrink-0"
        style={{
          backgroundColor: checked ? 'var(--color-action)' : 'var(--color-border)',
        }}
      >
        <span
          className="absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform"
          style={{ transform: checked ? 'translateX(18px)' : 'translateX(2px)' }}
        />
      </button>
    </label>
  )
}

function RatingSlider({
  label,
  value,
  max,
  step,
  onChange,
  badge,
}: {
  label: string
  value: number
  max: number
  step: number
  onChange: (v: number) => void
  badge?: React.ReactNode
}) {
  const pct = (value / max) * 100
  return (
    <div className="mb-3">
      <div className="flex items-center justify-between mb-1.5">
        <span
          className="text-[11px] font-semibold"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          {label}
        </span>
        <span
          className="inline-flex items-center gap-1 text-xs font-bold"
          style={{ color: 'var(--color-text)' }}
        >
          {badge}
          {value === 0 ? 'Any' : `${value.toFixed(1)}+`}
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-1 rounded-full appearance-none cursor-pointer"
        style={{
          accentColor: 'var(--color-action)',
          background: `linear-gradient(to right, var(--color-action) 0%, var(--color-action) ${pct}%, var(--color-border) ${pct}%, var(--color-border) 100%)`,
        }}
      />
    </div>
  )
}

function ReviewCountSlider({
  label,
  value,
  onChange,
  badge,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  badge?: React.ReactNode
}) {
  const idx = REVIEW_COUNT_STEPS.findIndex((s) => s === value)
  const safeIdx = idx === -1 ? 0 : idx
  const pct = (safeIdx / (REVIEW_COUNT_STEPS.length - 1)) * 100
  return (
    <div className="mb-1">
      <div className="flex items-center justify-between mb-1.5">
        <span
          className="text-[11px] font-semibold"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          {label}
        </span>
        <span
          className="inline-flex items-center gap-1 text-xs font-bold"
          style={{ color: 'var(--color-text)' }}
        >
          {badge}
          {reviewCountLabel(value)}
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={REVIEW_COUNT_STEPS.length - 1}
        step={1}
        value={safeIdx}
        onChange={(e) =>
          onChange(REVIEW_COUNT_STEPS[parseInt(e.target.value, 10)])
        }
        className="w-full h-1 rounded-full appearance-none cursor-pointer"
        style={{
          accentColor: 'var(--color-action)',
          background: `linear-gradient(to right, var(--color-action) 0%, var(--color-action) ${pct}%, var(--color-border) ${pct}%, var(--color-border) 100%)`,
        }}
      />
    </div>
  )
}
