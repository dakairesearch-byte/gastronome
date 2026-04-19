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

export type SearchMode = 'all' | 'restaurants' | 'dishes'

export interface SearchFilters {
  mode: SearchMode
  cities: string[]
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
  availableCuisines: string[]
}

export default function SearchFiltersSidebar({
  filters,
  onChange,
  onReset,
  availableCities,
  availableCuisines,
}: Props) {
  const set = <K extends keyof SearchFilters>(key: K, value: SearchFilters[K]) =>
    onChange({ ...filters, [key]: value })

  const activeCount = countActive(filters)

  return (
    <aside className="w-full lg:w-72 flex-shrink-0 space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2 uppercase tracking-wider">
          <Sliders size={14} />
          Filters
          {activeCount > 0 && (
            <span className="inline-flex items-center justify-center w-5 h-5 text-[10px] font-bold bg-emerald-500 text-white rounded-full">
              {activeCount}
            </span>
          )}
        </h2>
        {activeCount > 0 && (
          <button
            type="button"
            onClick={onReset}
            className="text-xs font-semibold text-gray-500 hover:text-emerald-600 transition-colors"
          >
            Reset all
          </button>
        )}
      </div>

      {/* Search mode */}
      <Section title="Looking for">
        <div className="grid grid-cols-3 gap-1 p-1 bg-gray-100 rounded-lg">
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
                className={`py-1.5 text-xs font-semibold rounded-md transition-colors ${
                  active
                    ? 'bg-white text-emerald-700 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {label}
              </button>
            )
          })}
        </div>
        <p className="text-[11px] text-gray-400 mt-1.5 leading-snug">
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
      <Section title="Google">
        <RatingSlider
          label="Min rating"
          value={filters.googleMinRating}
          max={5}
          step={0.1}
          onChange={(v) => set('googleMinRating', v)}
          iconColor="#4285F4"
        />
        <ReviewCountSlider
          label="Min reviews"
          value={filters.googleMinReviews}
          onChange={(v) => set('googleMinReviews', v)}
          iconColor="#4285F4"
          letter="G"
        />
      </Section>

      {/* Yelp */}
      <Section title="Yelp">
        <RatingSlider
          label="Min rating"
          value={filters.yelpMinRating}
          max={5}
          step={0.5}
          onChange={(v) => set('yelpMinRating', v)}
          iconColor="#D32323"
        />
        <ReviewCountSlider
          label="Min reviews"
          value={filters.yelpMinReviews}
          onChange={(v) => set('yelpMinReviews', v)}
          iconColor="#D32323"
          letter="Y"
        />
      </Section>

      {/* Accolades */}
      <Section title="Accolades">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-700">Michelin Stars</span>
            <div className="flex gap-1">
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
                    className={`px-2 py-1 rounded-md border text-[11px] font-bold transition-colors ${
                      active
                        ? 'bg-red-600 border-red-600 text-white'
                        : 'bg-white border-gray-200 text-gray-500 hover:bg-red-50 hover:border-red-200'
                    }`}
                  >
                    {n}★
                  </button>
                )
              })}
            </div>
          </div>

          <CheckRow
            label="Bib Gourmand"
            checked={filters.bibGourmand}
            onChange={(v) => set('bibGourmand', v)}
            accent="#C8102E"
          />

          <div className="flex items-center justify-between pt-1">
            <span className="text-xs font-semibold text-gray-700">James Beard</span>
            <div className="grid grid-cols-3 gap-1 p-0.5 bg-gray-100 rounded-md">
              {(
                [
                  { key: 'any', label: 'Any' },
                  { key: 'nominee', label: 'Nominee' },
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
                      active
                        ? 'bg-white text-amber-700 shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          </div>

          <CheckRow
            label="Eater 38"
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
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section>
      <h3 className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2">
        {title}
      </h3>
      {children}
    </section>
  )
}

function CheckRow({
  label,
  checked,
  onChange,
  accent,
}: {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
  accent: string
}) {
  return (
    <label className="flex items-center justify-between cursor-pointer group">
      <span className="text-xs font-semibold text-gray-700 group-hover:text-gray-900 transition-colors">
        {label}
      </span>
      <button
        type="button"
        role="checkbox"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className="relative w-9 h-5 rounded-full transition-colors flex-shrink-0"
        style={{
          backgroundColor: checked ? accent : '#E5E7EB',
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
}: {
  label: string
  value: number
  max: number
  step: number
  onChange: (v: number) => void
  iconColor: string
}) {
  const pct = (value / max) * 100
  return (
    <div className="mb-3">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[11px] font-semibold text-gray-600">{label}</span>
        <span className="inline-flex items-center gap-1 text-xs font-bold text-gray-900">
          <Star size={11} style={{ color: iconColor, fill: iconColor }} />
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
        className="w-full h-1 rounded-full appearance-none cursor-pointer accent-emerald-600"
        style={{
          background: `linear-gradient(to right, ${iconColor} 0%, ${iconColor} ${pct}%, #E5E7EB ${pct}%, #E5E7EB 100%)`,
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
  letter,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  iconColor: string
  letter: string
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
        <span className="text-[11px] font-semibold text-gray-600">{label}</span>
        <span className="inline-flex items-center gap-1 text-xs font-bold text-gray-900">
          <span
            className="inline-flex items-center justify-center rounded-full text-[9px] font-bold text-white"
            style={{ width: 14, height: 14, backgroundColor: iconColor }}
          >
            {letter}
          </span>
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
          background: `linear-gradient(to right, ${iconColor} 0%, ${iconColor} ${pct}%, #E5E7EB ${pct}%, #E5E7EB 100%)`,
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
            selected.length > 0
              ? 'bg-emerald-50 border-emerald-200 text-emerald-700 font-semibold'
              : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
          }`}
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
          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-50 py-1 max-h-72 overflow-y-auto">
            {searchable && options.length > 6 && (
              <div className="px-2 pb-1 pt-0.5 sticky top-0 bg-white border-b border-gray-100">
                <div className="relative">
                  <Search
                    size={12}
                    className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400"
                  />
                  <input
                    type="text"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    placeholder={`Search ${title.toLowerCase()}...`}
                    className="w-full pl-6 pr-2 py-1 text-xs border border-gray-200 rounded-md focus:outline-none focus:border-emerald-400"
                  />
                </div>
              </div>
            )}
            {filtered.length === 0 ? (
              <p className="px-3 py-2 text-xs text-gray-400">No matches</p>
            ) : (
              filtered.map((option) => {
                const isSelected = selected.includes(option)
                return (
                  <button
                    type="button"
                    key={option}
                    onClick={() => onToggle(option)}
                    className={`w-full flex items-center justify-between px-3 py-1.5 text-sm transition-colors ${
                      isSelected
                        ? 'bg-emerald-50 text-emerald-700 font-medium'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <span className="truncate">{option}</span>
                    {isSelected && (
                      <Check
                        size={14}
                        className="text-emerald-500 flex-shrink-0 ml-2"
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
                className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-md text-[11px] font-medium"
              >
                {v}
                <button
                  type="button"
                  onClick={() => onToggle(v)}
                  className="hover:text-emerald-900"
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
