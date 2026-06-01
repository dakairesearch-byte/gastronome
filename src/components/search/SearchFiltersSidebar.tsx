'use client'

/**
 * SearchFiltersSidebar — the faceted filter panel that lives on the left
 * side of /search on desktop and collapses into a sheet on mobile.
 *
 * The panel drives a single `filters` object that the parent page owns.
 * State is URL-backed in the parent (so filters survive refresh and are
 * shareable) with a localStorage mirror so that returning to /search with
 * a bare URL restores the last-used filters — matching the "sticky unless
 * reset" requirement.
 */

import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown, Search, Sliders, Star, X } from 'lucide-react'
import {
  BibGourmandIcon,
  EaterIcon,
  GoogleGIcon,
  JamesBeardIcon,
  MichelinStarIcon,
  YelpIcon,
} from '@/components/brands/BrandIcons'

export type SearchMode = 'all' | 'restaurants' | 'dishes'

export interface SearchFilters {
  mode: SearchMode
  cities: string[]
  neighborhoods: string[]
  cuisines: string[]
  googleMinRating: number
  googleMinReviews: number
  yelpMinRating: number
  yelpMinReviews: number
  /** Michelin star counts to allow: any of 1, 2, 3. Empty = no filter. */
  michelinStars: number[]
  /** True when the user wants Michelin Bib Gourmand restaurants. */
  bibGourmand: boolean
  jamesBeard: 'any' | 'winner' | 'nominee'
  eater38: boolean
}

export const DEFAULT_FILTERS: SearchFilters = {
  mode: 'all',
  cities: [],
  neighborhoods: [],
  cuisines: [],
  googleMinRating: 0,
  googleMinReviews: 0,
  yelpMinRating: 0,
  yelpMinReviews: 0,
  michelinStars: [],
  bibGourmand: false,
  jamesBeard: 'any',
  eater38: false,
}

// Review-count steps — chosen to span the range from casual spots (~50
// reviews) up to iconic NYC institutions (~10k) without an unusable slider.
const REVIEW_COUNT_STEPS = [0, 100, 250, 500, 1000, 2500, 5000, 10000]

function reviewCountLabel(n: number): string {
  if (n === 0) return 'Any'
  if (n >= 1000) return `${(n / 1000).toFixed(n % 1000 ? 1 : 0)}k+`
  return `${n}+`
}

interface Props {
  filters: SearchFilters
  onChange: (next: SearchFilters) => void
  onReset: () => void
  availableCities: string[]
  availableNeighborhoods: string[]
  availableCuisines: string[]
}

export default function SearchFiltersSidebar({
  filters,
  onChange,
  onReset,
  availableCities,
  availableNeighborhoods,
  availableCuisines,
}: Props) {
  const set = <K extends keyof SearchFilters>(key: K, value: SearchFilters[K]) =>
    onChange({ ...filters, [key]: value })

  const activeCount = countActive(filters)

  return (
    <aside className="w-full lg:w-72 flex-shrink-0 space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold flex items-center gap-2 uppercase tracking-wider" style={{ color: 'var(--color-text)' }}>
          <Sliders size={14} />
          Filters
          {activeCount > 0 && (
            <span
              className="inline-flex items-center justify-center w-5 h-5 text-[10px] font-bold rounded-full"
              style={{
                backgroundColor: 'var(--color-accent)',
                color: 'var(--color-surface)',
              }}
            >
              {activeCount}
            </span>
          )}
        </h2>
        {activeCount > 0 && (
          <button
            type="button"
            onClick={onReset}
            className="text-xs font-semibold transition-opacity hover:opacity-80"
            style={{ color: 'var(--color-accent)' }}
          >
            Reset all
          </button>
        )}
      </div>

      {/* Search mode */}
      <Section title="Looking for">
        <div
          className="grid grid-cols-3 gap-1 p-1 rounded-lg"
          style={{ backgroundColor: 'var(--color-background)' }}
        >
          {(
            [
              { key: 'all', label: 'All' },
              { key: 'restaurants', label: 'Places' },
              { key: 'dishes', label: 'Dishes' },
            ] as { key: SearchMode; label: string }[]
          ).map(({ key, label }) => {
            const active = filters.mode === key
            return (
              <button
                key={key}
                type="button"
                onClick={() => set('mode', key)}
                className="py-1.5 text-xs font-semibold rounded-md transition-colors"
                style={
                  active
                    ? {
                        backgroundColor: 'var(--color-surface)',
                        color: 'var(--color-accent)',
                        boxShadow: '0 1px 2px 0 rgba(0,0,0,0.05)',
                      }
                    : { color: 'var(--color-text-secondary)' }
                }
              >
                {label}
              </button>
            )
          })}
        </div>
        <p className="text-[11px] mt-1.5 leading-snug" style={{ color: 'var(--color-text-secondary)' }}>
          {filters.mode === 'dishes'
            ? 'Only specific dishes match — e.g. "cacio e pepe".'
            : filters.mode === 'restaurants'
            ? 'Only restaurants match — skip dish hits.'
            : 'Restaurants and dishes are both searched.'}
        </p>
      </Section>

      {/* City multiselect — only cities we actually cover */}
      <MultiSelect
        title="City"
        options={availableCities}
        selected={filters.cities}
        onToggle={(v) =>
          set(
            'cities',
            filters.cities.includes(v)
              ? filters.cities.filter((c) => c !== v)
              : [...filters.cities, v]
          )
        }
        emptyLabel="All covered cities"
        searchable
      />

      {/* Neighborhood multiselect — scoped to the selected city/cities by
          the parent facet load. Hidden when we have no neighborhood data to
          offer (e.g. no city selected and the unscoped list came back empty). */}
      {availableNeighborhoods.length > 0 && (
        <MultiSelect
          title="Neighborhood"
          options={availableNeighborhoods}
          selected={filters.neighborhoods}
          onToggle={(v) =>
            set(
              'neighborhoods',
              filters.neighborhoods.includes(v)
                ? filters.neighborhoods.filter((n) => n !== v)
                : [...filters.neighborhoods, v]
            )
          }
          emptyLabel="Any neighborhood"
          searchable
        />
      )}

      {/* Cuisine multiselect */}
      {availableCuisines.length > 0 && (
        <MultiSelect
          title="Cuisine"
          options={availableCuisines}
          selected={filters.cuisines}
          onToggle={(v) =>
            set(
              'cuisines',
              filters.cuisines.includes(v)
                ? filters.cuisines.filter((c) => c !== v)
                : [...filters.cuisines, v]
            )
          }
          emptyLabel="Any cuisine"
          searchable
        />
      )}

      {/* Google */}
      <Section
        title="Google"
        titleIcon={<GoogleGIcon size={12} title="Google" />}
      >
        <RatingSlider
          label="Min rating"
          value={filters.googleMinRating}
          max={5}
          step={0.1}
          onChange={(v) => set('googleMinRating', v)}
          iconColor="#4285F4"
          badge={<GoogleGIcon size={12} title="Google" />}
        />
        <ReviewCountSlider
          label="Min reviews"
          value={filters.googleMinReviews}
          onChange={(v) => set('googleMinReviews', v)}
          iconColor="#4285F4"
          badge={<GoogleGIcon size={12} title="Google" />}
        />
      </Section>

      {/* Yelp */}
      <Section title="Yelp" titleIcon={<YelpIcon size={12} title="Yelp" />}>
        <RatingSlider
          label="Min rating"
          value={filters.yelpMinRating}
          max={5}
          step={0.5}
          onChange={(v) => set('yelpMinRating', v)}
          iconColor="#D32323"
          badge={<YelpIcon size={12} title="Yelp" />}
        />
        <ReviewCountSlider
          label="Min reviews"
          value={filters.yelpMinReviews}
          onChange={(v) => set('yelpMinReviews', v)}
          iconColor="#D32323"
          badge={<YelpIcon size={12} title="Yelp" />}
        />
      </Section>

      {/* Accolades */}
      <Section title="Accolades">
        <div className="space-y-2.5">
          {/* Michelin stars — each button shows the rosette repeated N times. */}
          <div>
            <span className="text-xs font-semibold flex items-center gap-1.5 mb-1.5" style={{ color: 'var(--color-text)' }}>
              <MichelinStarIcon size={12} title="Michelin" />
              Michelin Stars
            </span>
            <div className="grid grid-cols-3 gap-1">
              {[1, 2, 3].map((n) => {
                const active = filters.michelinStars.includes(n)
                return (
                  <button
                    key={n}
                    type="button"
                    onClick={() =>
                      set(
                        'michelinStars',
                        active
                          ? filters.michelinStars.filter((s) => s !== n)
                          : [...filters.michelinStars, n]
                      )
                    }
                    aria-label={`${n} Michelin Star${n > 1 ? 's' : ''}`}
                    aria-pressed={active}
                    className={`flex items-center justify-center gap-0.5 px-1.5 py-1.5 rounded-md border transition-colors ${
                      active
                        ? 'bg-red-50 border-red-400'
                        : 'hover:bg-red-50 hover:border-red-200'
                    }`}
                    style={
                      active
                        ? undefined
                        : {
                            backgroundColor: 'var(--color-surface)',
                            borderColor: 'var(--color-border)',
                          }
                    }
                  >
                    {Array.from({ length: n }).map((_, i) => (
                      <MichelinStarIcon
                        key={i}
                        size={13}
                        color={active ? '#C8102E' : '#9CA3AF'}
                      />
                    ))}
                  </button>
                )
              })}
            </div>
          </div>

          <CheckRow
            label="Bib Gourmand"
            icon={<BibGourmandIcon size={14} title="Bib Gourmand" />}
            checked={filters.bibGourmand}
            onChange={(v) => set('bibGourmand', v)}
            accent="#C8102E"
          />

          <div className="pt-1">
            <span className="text-xs font-semibold flex items-center gap-1.5 mb-1.5" style={{ color: 'var(--color-text)' }}>
              <JamesBeardIcon size={14} title="James Beard" />
              James Beard
            </span>
            <div
              className="grid grid-cols-2 gap-1 p-0.5 rounded-md"
              style={{ backgroundColor: 'var(--color-background)' }}
            >
              {(
                [
                  { key: 'any', label: 'Any' },
                  // "Nominee" option removed for now — the
                  // `james_beard_nominated` column was dropped, and the
                  // backend silently treated "nominee" === "winner".
                  // Nominee/finalist/semifinalist now lives in
                  // `restaurant_jbf_history`; when that's joined into
                  // the filter, the option can come back. Until then,
                  // the UI must not lie about what it returns.
                  { key: 'winner', label: 'Winner' },
                ] as { key: 'any' | 'nominee' | 'winner'; label: string }[]
              ).map(({ key, label }) => {
                const active = filters.jamesBeard === key
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => set('jamesBeard', key)}
                    className={`px-2 py-1 text-[10px] font-semibold rounded transition-colors ${
                      active ? 'bg-white text-amber-800 shadow-sm' : ''
                    }`}
                    style={active ? undefined : { color: 'var(--color-text-secondary)' }}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          </div>

          <CheckRow
            label="Eater 38"
            icon={<EaterIcon size={14} title="Eater 38" />}
            checked={filters.eater38}
            onChange={(v) => set('eater38', v)}
            accent="#E85D1A"
          />
        </div>
      </Section>
    </aside>
  )
}

/* ------------------------------------------------------------------ */
/*  Subcomponents                                                      */
/* ------------------------------------------------------------------ */

function Section({
  title,
  titleIcon,
  children,
}: {
  title: string
  titleIcon?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section>
      <h3
        className="text-[11px] font-bold uppercase tracking-wider mb-2 flex items-center gap-1.5"
        style={{ color: 'var(--color-text-secondary)' }}
      >
        {titleIcon}
        {title}
      </h3>
      {children}
    </section>
  )
}

function CheckRow({
  label,
  icon,
  checked,
  onChange,
  accent,
}: {
  label: string
  icon?: React.ReactNode
  checked: boolean
  onChange: (v: boolean) => void
  accent: string
}) {
  return (
    <label className="flex items-center justify-between cursor-pointer group">
      <span className="text-xs font-semibold transition-colors flex items-center gap-1.5" style={{ color: 'var(--color-text)' }}>
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
          backgroundColor: checked ? accent : 'var(--color-border)',
        }}
      >
        <span
          className="absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform"
          style={{
            transform: checked ? 'translateX(18px)' : 'translateX(2px)',
          }}
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
  iconColor,
  badge,
}: {
  label: string
  value: number
  max: number
  step: number
  onChange: (v: number) => void
  iconColor: string
  badge?: React.ReactNode
}) {
  const pct = (value / max) * 100
  return (
    <div className="mb-3">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[11px] font-semibold" style={{ color: 'var(--color-text-secondary)' }}>{label}</span>
        <span className="inline-flex items-center gap-1 text-xs font-bold" style={{ color: 'var(--color-text)' }}>
          {badge ?? (
            <Star size={11} style={{ color: iconColor, fill: iconColor }} />
          )}
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
          accentColor: 'var(--color-accent)',
          background: `linear-gradient(to right, ${iconColor} 0%, ${iconColor} ${pct}%, var(--color-border) ${pct}%, var(--color-border) 100%)`,
        }}
      />
    </div>
  )
}

function ReviewCountSlider({
  label,
  value,
  onChange,
  iconColor,
  badge,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  iconColor: string
  badge?: React.ReactNode
}) {
  // Snap to the discrete REVIEW_COUNT_STEPS so the slider feels decisive.
  const idx = Math.max(
    0,
    REVIEW_COUNT_STEPS.findIndex((s) => s === value)
  )
  const safeIdx = idx === -1 ? 0 : idx
  const pct = (safeIdx / (REVIEW_COUNT_STEPS.length - 1)) * 100
  return (
    <div className="mb-3">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[11px] font-semibold" style={{ color: 'var(--color-text-secondary)' }}>{label}</span>
        <span className="inline-flex items-center gap-1 text-xs font-bold" style={{ color: 'var(--color-text)' }}>
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
        onChange={(e) => onChange(REVIEW_COUNT_STEPS[parseInt(e.target.value, 10)])}
        className="w-full h-1 rounded-full appearance-none cursor-pointer"
        style={{
          accentColor: 'var(--color-accent)',
          background: `linear-gradient(to right, ${iconColor} 0%, ${iconColor} ${pct}%, var(--color-border) ${pct}%, var(--color-border) 100%)`,
        }}
      />
    </div>
  )
}

function MultiSelect({
  title,
  options,
  selected,
  onToggle,
  emptyLabel,
  searchable,
}: {
  title: string
  options: string[]
  selected: string[]
  onToggle: (v: string) => void
  emptyLabel: string
  searchable?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function click(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', click)
    return () => document.removeEventListener('mousedown', click)
  }, [])

  const filtered = filter
    ? options.filter((o) => o.toLowerCase().includes(filter.toLowerCase()))
    : options

  return (
    <Section title={title}>
      <div className="relative" ref={ref}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={`w-full flex items-center justify-between px-3 py-2 text-sm rounded-lg border transition-colors ${
            selected.length > 0 ? 'font-semibold' : ''
          }`}
          style={
            selected.length > 0
              ? {
                  backgroundColor: 'color-mix(in srgb, var(--color-accent) 12%, var(--color-surface))',
                  borderColor: 'var(--color-accent)',
                  color: 'var(--color-accent)',
                }
              : {
                  backgroundColor: 'var(--color-surface)',
                  borderColor: 'var(--color-border)',
                  color: 'var(--color-text)',
                }
          }
        >
          <span className="truncate">
            {selected.length === 0
              ? emptyLabel
              : selected.length <= 2
              ? selected.join(', ')
              : `${selected.length} selected`}
          </span>
          <ChevronDown
            size={14}
            className={`transition-transform flex-shrink-0 ml-2 ${
              open ? 'rotate-180' : ''
            }`}
          />
        </button>
        {open && (
          <div
            className="absolute top-full left-0 right-0 mt-1 border rounded-xl shadow-lg z-50 py-1 max-h-72 overflow-y-auto"
            style={{
              backgroundColor: 'var(--color-surface)',
              borderColor: 'var(--color-border)',
            }}
          >
            {searchable && options.length > 6 && (
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
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    placeholder={`Search ${title.toLowerCase()}...`}
                    className="w-full pl-6 pr-2 py-1 text-xs border rounded-md focus:outline-none transition-colors"
                    style={{
                      borderColor: 'var(--color-border)',
                      backgroundColor: 'var(--color-surface)',
                      color: 'var(--color-text)',
                    }}
                    onFocus={(e) =>
                      (e.currentTarget.style.borderColor = 'var(--color-accent)')
                    }
                    onBlur={(e) =>
                      (e.currentTarget.style.borderColor = 'var(--color-border)')
                    }
                  />
                </div>
              </div>
            )}
            {filtered.length === 0 ? (
              <p className="px-3 py-2 text-xs" style={{ color: 'var(--color-text-secondary)' }}>No matches</p>
            ) : (
              filtered.map((option) => {
                const isSelected = selected.includes(option)
                return (
                  <button
                    type="button"
                    key={option}
                    onClick={() => onToggle(option)}
                    className={`w-full flex items-center justify-between px-3 py-1.5 text-sm transition-colors ${
                      isSelected ? 'font-medium' : ''
                    }`}
                    style={
                      isSelected
                        ? {
                            backgroundColor: 'color-mix(in srgb, var(--color-accent) 12%, var(--color-surface))',
                            color: 'var(--color-accent)',
                          }
                        : { color: 'var(--color-text)' }
                    }
                  >
                    <span className="truncate">{option}</span>
                    {isSelected && (
                      <Check
                        size={14}
                        className="flex-shrink-0 ml-2"
                        style={{ color: 'var(--color-accent)' }}
                      />
                    )}
                  </button>
                )
              })
            )}
          </div>
        )}
        {selected.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {selected.map((v) => (
              <span
                key={v}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium"
                style={{
                  backgroundColor: 'color-mix(in srgb, var(--color-accent) 18%, var(--color-surface))',
                  color: 'var(--color-accent)',
                }}
              >
                {v}
                <button
                  type="button"
                  onClick={() => onToggle(v)}
                  className="transition-opacity hover:opacity-70"
                >
                  <X size={10} />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
    </Section>
  )
}

/* ------------------------------------------------------------------ */
/*  Helpers exported for parent parity                                 */
/* ------------------------------------------------------------------ */

export function countActive(f: SearchFilters): number {
  let n = 0
  if (f.mode !== 'all') n++
  if (f.cities.length) n++
  if (f.neighborhoods.length) n++
  if (f.cuisines.length) n++
  if (f.googleMinRating > 0) n++
  if (f.googleMinReviews > 0) n++
  if (f.yelpMinRating > 0) n++
  if (f.yelpMinReviews > 0) n++
  if (f.michelinStars.length) n++
  if (f.bibGourmand) n++
  if (f.jamesBeard !== 'any') n++
  if (f.eater38) n++
  return n
}
