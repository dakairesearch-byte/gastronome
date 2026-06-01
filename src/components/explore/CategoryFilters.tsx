'use client'

/**
 * CategoryFilters — sticky filter rail used at the top of every
 * filtered category page (Michelin Stars, Bib Gourmand, Eater 38,
 * James Beard Spotlight, Hidden Gems, Best for Brunch, Consensus
 * Picks). Replaces the previous "single Clear filters link" treatment
 * which left users with a wall of 100+ cards and no way to drill in.
 *
 * Filters surfaced (driven by which `accolade` is active):
 *   - City  — always shown, defaults to the user's profile.home_city
 *             (server-side; passed in via `currentCity`).
 *   - Stars — Michelin only. All / 1 / 2 / 3.
 *   - Cuisine — all categories except Consensus Picks.
 *               Cuisines list is computed server-side from the live
 *               filtered set so the dropdown only ever lists cuisines
 *               that actually have at least one match in this city.
 *   - Sort  — Top rated (default) / A–Z.
 *
 * All four write through to URL search params via next/navigation so
 * the page is shareable and the back button works correctly. The page
 * itself re-runs its server query on each navigation; this component
 * never holds local state for the filter values.
 */

import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState, useMemo } from 'react'
import { ChevronDown, Star, ArrowRight } from 'lucide-react'
import { exploreFacetsToSearchURL } from '@/components/search/filterState'

interface CategoryFiltersProps {
  cities: string[]
  cuisines: string[]
  currentCity: string
  currentAccolade: string | null
  currentStars: 1 | 2 | 3 | null
  currentCuisine: string | null
  currentSort: 'top' | 'az'
}

const SORT_LABELS: Record<CategoryFiltersProps['currentSort'], string> = {
  top: 'Top rated',
  az: 'A–Z',
}

// Accolade chips offered on a cuisine landing so the user can COMPOSE
// "French" → "French + Michelin" in a single tap instead of dead-ending
// on a bare cuisine facet (D6 cross-faceting). consensus_picks is omitted
// on purpose: it's a city-only algorithm that can't combine with cuisine.
const ACCOLADE_CHIPS: { value: string; label: string }[] = [
  { value: 'michelin_star', label: 'Michelin' },
  { value: 'bib_gourmand', label: 'Bib Gourmand' },
  { value: 'eater_38', label: 'Eater 38' },
  { value: 'james_beard', label: 'James Beard' },
]

export default function CategoryFilters({
  cities,
  cuisines,
  currentCity,
  currentAccolade,
  currentStars,
  currentCuisine,
  currentSort,
}: CategoryFiltersProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  // Stars filter only makes sense for the Michelin Stars page. Cuisine
  // filter is hidden for Consensus Picks because that algorithm is
  // city-only (capped at 20 by the ranker — adding cuisine on top would
  // shrink the list below the threshold of usefulness).
  //
  // showCuisine previously gated on `currentAccolade !== 'consensus_picks'`,
  // which meant a cuisine LANDING (accolade null, cuisine set) still showed
  // the picker — fine — but more importantly the rail offered no way to
  // ADD an accolade on top of a cuisine, so "French" was a dead-end facet.
  // We now: (a) keep the cuisine picker on every non-consensus page, and
  // (b) surface accolade chips whenever a cuisine is active so the two
  // compose ("French" -> "French + Michelin"). The chips are also shown on
  // a bare cuisine landing (no accolade yet) — that's the whole point.
  const showStars = currentAccolade === 'michelin_star'
  const showCuisine =
    currentAccolade !== 'consensus_picks' && cuisines.length > 0
  // Cross-faceting affordance: offer accolade chips once the user is on a
  // cuisine page (with or without an accolade already applied). Hidden on
  // pure-accolade pages (no cuisine) to avoid duplicating the primary
  // category, and on consensus_picks which can't combine.
  const showAccoladeChips =
    Boolean(currentCuisine) && currentAccolade !== 'consensus_picks'

  function navigateWith(updates: Record<string, string | null>) {
    const next = new URLSearchParams(searchParams.toString())
    for (const [k, v] of Object.entries(updates)) {
      if (v == null || v === '') next.delete(k)
      else next.set(k, v)
    }
    router.push(`/explore?${next.toString()}`)
  }

  return (
    <div
      className="sticky top-16 md:top-20 z-30 border-b backdrop-blur-md"
      style={{
        backgroundColor: 'rgba(255,255,255,0.92)',
        borderColor: 'var(--color-border)',
      }}
    >
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-3 flex flex-wrap items-center gap-3">
        <CityPicker
          cities={cities}
          value={currentCity}
          onChange={(c) => navigateWith({ city: c })}
        />

        {showStars && (
          <StarsPicker
            value={currentStars}
            onChange={(s) =>
              navigateWith({ stars: s == null ? null : String(s) })
            }
          />
        )}

        {showCuisine && (
          <Dropdown
            label="Cuisine"
            value={currentCuisine ?? 'All'}
            options={['All', ...cuisines]}
            onChange={(v) => navigateWith({ cuisine: v === 'All' ? null : v })}
          />
        )}

        {/* Accolade cross-faceting chips. On a cuisine page these let the
            user layer an accolade on top ("French" -> "French + Michelin")
            in one tap. Tapping the active chip clears the accolade (toggles
            back to the pure cuisine view). Stars reset when the accolade
            changes so we don't carry a stale ★★★ onto a non-Michelin chip. */}
        {showAccoladeChips && (
          <div
            className="inline-flex items-center rounded-full border bg-white p-0.5 gap-0.5"
            style={{ borderColor: 'var(--color-border)' }}
            role="group"
            aria-label="Add an accolade filter"
          >
            <span
              className="text-[10px] uppercase font-medium px-3"
              style={{
                letterSpacing: '0.14em',
                color: 'var(--color-text-secondary)',
              }}
            >
              Accolade
            </span>
            {ACCOLADE_CHIPS.map((chip) => {
              const active = currentAccolade === chip.value
              return (
                <button
                  key={chip.value}
                  type="button"
                  aria-pressed={active}
                  onClick={() =>
                    navigateWith({
                      accolade: active ? null : chip.value,
                      // Stars only apply to Michelin; clear on any switch.
                      stars: null,
                    })
                  }
                  className="px-2.5 py-1 rounded-full text-xs transition-colors"
                  style={
                    active
                      ? {
                          backgroundColor: 'var(--color-text)',
                          color: 'var(--color-background)',
                        }
                      : { color: 'var(--color-text-secondary)' }
                  }
                >
                  {chip.label}
                </button>
              )
            })}
          </div>
        )}

        <Dropdown
          label="Sort"
          value={SORT_LABELS[currentSort]}
          options={['Top rated', 'A–Z']}
          onChange={(v) =>
            navigateWith({ sort: v === 'A–Z' ? 'az' : null })
          }
        />

        {/* Escalate the rail's current facets into the full faceted search
            engine instead of dead-ending on this category page. */}
        <a
          href={exploreFacetsToSearchURL({
            city: currentCity || undefined,
            cuisine: currentCuisine ?? undefined,
            accolade: currentAccolade ?? undefined,
            stars: currentStars ?? undefined,
          })}
          className="ml-auto inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-medium transition-colors hover:opacity-90"
          style={{
            color: 'var(--color-primary)',
          }}
        >
          Refine in search
          <ArrowRight size={14} aria-hidden />
        </a>
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Sub-components                                                              */
/* -------------------------------------------------------------------------- */

function CityPicker({
  cities,
  value,
  onChange,
}: {
  cities: string[]
  value: string
  onChange: (city: string) => void
}) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handle(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handle)
      document.removeEventListener('keydown', handleKey)
    }
  }, [open])

  // City list might be missing the active city on first paint if the
  // URL param refers to a city not yet in the cities table — keep the
  // active value visible at the top so the user always sees what's
  // currently selected.
  const merged = useMemo(() => {
    const all = cities.includes(value) ? cities : [value, ...cities]
    return all
  }, [cities, value])

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="inline-flex items-center gap-2 px-3 py-2 rounded-full border bg-white hover:border-gray-300 transition-colors text-sm"
        style={{ borderColor: 'var(--color-border)' }}
      >
        <span
          className="text-[10px] uppercase font-medium"
          style={{
            letterSpacing: '0.14em',
            color: 'var(--color-text-secondary)',
          }}
        >
          City
        </span>
        <span className="font-medium text-gray-900">{value}</span>
        <ChevronDown
          size={14}
          className="transition-transform"
          style={{
            transform: open ? 'rotate(180deg)' : 'rotate(0)',
          }}
        />
      </button>
      {open && (
        <div
          role="listbox"
          className="absolute top-full left-0 mt-2 min-w-[220px] max-h-[60vh] overflow-y-auto bg-white border rounded-lg shadow-lg z-40"
          style={{ borderColor: 'var(--color-border)' }}
        >
          {merged.map((c) => (
            <button
              key={c}
              type="button"
              role="option"
              aria-selected={c === value}
              onClick={() => {
                onChange(c)
                setOpen(false)
              }}
              className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50"
              style={{
                backgroundColor:
                  c === value ? 'var(--color-surface)' : 'transparent',
                color: 'var(--color-text)',
              }}
            >
              {c}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function StarsPicker({
  value,
  onChange,
}: {
  value: 1 | 2 | 3 | null
  onChange: (stars: 1 | 2 | 3 | null) => void
}) {
  // Render All/★/★★/★★★ as a segmented control. This is a much faster
  // selection model than a dropdown for a 4-option set, and keeps the
  // visual language close to the Michelin Guide's own UI.
  const options: { key: '*' | '1' | '2' | '3'; label: React.ReactNode; value: 1 | 2 | 3 | null }[] = [
    { key: '*', label: 'All', value: null },
    {
      key: '1',
      label: <Star size={12} className="fill-current" aria-hidden />,
      value: 1,
    },
    {
      key: '2',
      label: (
        <span className="inline-flex">
          <Star size={12} className="fill-current" aria-hidden />
          <Star size={12} className="fill-current" aria-hidden />
        </span>
      ),
      value: 2,
    },
    {
      key: '3',
      label: (
        <span className="inline-flex">
          <Star size={12} className="fill-current" aria-hidden />
          <Star size={12} className="fill-current" aria-hidden />
          <Star size={12} className="fill-current" aria-hidden />
        </span>
      ),
      value: 3,
    },
  ]

  return (
    <div
      className="inline-flex items-center rounded-full border bg-white p-0.5 gap-0.5"
      style={{ borderColor: 'var(--color-border)' }}
      role="radiogroup"
      aria-label="Filter by Michelin star count"
    >
      <span
        className="text-[10px] uppercase font-medium px-3"
        style={{
          letterSpacing: '0.14em',
          color: 'var(--color-text-secondary)',
        }}
      >
        Stars
      </span>
      {options.map((o) => {
        const active = value === o.value
        return (
          <button
            key={o.key}
            type="button"
            role="radio"
            aria-checked={active}
            aria-pressed={active}
            onClick={() => onChange(o.value)}
            className={`px-2.5 py-1 rounded-full text-xs transition-colors ${
              active
                ? 'bg-red-600 text-white'
                : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

function Dropdown({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: string[]
  onChange: (v: string) => void
}) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handle(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handle)
      document.removeEventListener('keydown', handleKey)
    }
  }, [open])

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="inline-flex items-center gap-2 px-3 py-2 rounded-full border bg-white hover:border-gray-300 transition-colors text-sm"
        style={{ borderColor: 'var(--color-border)' }}
      >
        <span
          className="text-[10px] uppercase font-medium"
          style={{
            letterSpacing: '0.14em',
            color: 'var(--color-text-secondary)',
          }}
        >
          {label}
        </span>
        <span className="font-medium text-gray-900">{value}</span>
        <ChevronDown
          size={14}
          className="transition-transform"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0)' }}
        />
      </button>
      {open && (
        <div
          role="listbox"
          className="absolute top-full left-0 mt-2 min-w-[200px] max-h-[60vh] overflow-y-auto bg-white border rounded-lg shadow-lg z-40"
          style={{ borderColor: 'var(--color-border)' }}
        >
          {options.map((o) => (
            <button
              key={o}
              type="button"
              role="option"
              aria-selected={o === value}
              onClick={() => {
                onChange(o)
                setOpen(false)
              }}
              className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50"
              style={{
                backgroundColor:
                  o === value ? 'var(--color-surface)' : 'transparent',
                color: 'var(--color-text)',
              }}
            >
              {o}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
