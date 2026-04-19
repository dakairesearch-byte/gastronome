/**
 * Serialization helpers for the search filter state.
 *
 * We keep filters in three synchronized places:
 *   1. React state (authoritative during the page lifecycle)
 *   2. URL search params (shareable, survives refresh)
 *   3. localStorage mirror (so returning to /search with a bare URL
 *      restores the last-used filter set — the "sticky" requirement)
 *
 * Reset clears all three. Any filter change updates all three.
 */

import type { SearchFilters } from './SearchFiltersSidebar'
import { DEFAULT_FILTERS } from './SearchFiltersSidebar'

export const STORAGE_KEY = 'gastronome_search_filters_v1'

function parseCSV(v: string | null | undefined): string[] {
  if (!v) return []
  return v
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

function parseNumberCSV(v: string | null | undefined): number[] {
  return parseCSV(v)
    .map((s) => Number(s))
    .filter((n) => Number.isFinite(n))
}

function parseFloatSafe(
  v: string | null | undefined,
  fallback: number,
  min = 0,
  max = Number.POSITIVE_INFINITY
): number {
  if (!v) return fallback
  const n = parseFloat(v)
  if (!Number.isFinite(n)) return fallback
  return Math.max(min, Math.min(max, n))
}

export function filtersFromURL(params: URLSearchParams): SearchFilters {
  const mode = params.get('mode')
  const jb = params.get('jb')
  return {
    mode: mode === 'restaurants' || mode === 'dishes' ? mode : 'all',
    cities: parseCSV(params.get('city')),
    cuisines: parseCSV(params.get('cuisine')),
    googleMinRating: parseFloatSafe(params.get('googleMin'), 0, 0, 5),
    googleMinReviews: parseFloatSafe(params.get('googleReviews'), 0, 0, 100000),
    yelpMinRating: parseFloatSafe(params.get('yelpMin'), 0, 0, 5),
    yelpMinReviews: parseFloatSafe(params.get('yelpReviews'), 0, 0, 100000),
    michelinStars: parseNumberCSV(params.get('michelin')).filter((n) =>
      [1, 2, 3].includes(n)
    ),
    bibGourmand: params.get('bib') === '1',
    jamesBeard: jb === 'winner' || jb === 'nominee' ? jb : 'any',
    eater38: params.get('eater38') === '1',
  }
}

/**
 * Build the URL search params reflecting `filters` on top of `base` (which
 * typically holds the current `q=` query). Default values are omitted to
 * keep the URL clean.
 */
export function filtersToURL(
  filters: SearchFilters,
  base?: URLSearchParams
): URLSearchParams {
  const next = new URLSearchParams(base?.toString() ?? '')
  // Reset filter params first so toggling off actually clears them.
  for (const key of [
    'mode',
    'city',
    'cuisine',
    'googleMin',
    'googleReviews',
    'yelpMin',
    'yelpReviews',
    'michelin',
    'bib',
    'jb',
    'eater38',
  ]) {
    next.delete(key)
  }
  if (filters.mode !== 'all') next.set('mode', filters.mode)
  if (filters.cities.length) next.set('city', filters.cities.join(','))
  if (filters.cuisines.length) next.set('cuisine', filters.cuisines.join(','))
  if (filters.googleMinRating > 0)
    next.set('googleMin', String(filters.googleMinRating))
  if (filters.googleMinReviews > 0)
    next.set('googleReviews', String(filters.googleMinReviews))
  if (filters.yelpMinRating > 0)
    next.set('yelpMin', String(filters.yelpMinRating))
  if (filters.yelpMinReviews > 0)
    next.set('yelpReviews', String(filters.yelpMinReviews))
  if (filters.michelinStars.length)
    next.set('michelin', filters.michelinStars.slice().sort().join(','))
  if (filters.bibGourmand) next.set('bib', '1')
  if (filters.jamesBeard !== 'any') next.set('jb', filters.jamesBeard)
  if (filters.eater38) next.set('eater38', '1')
  return next
}

export function isDefaultFilters(f: SearchFilters): boolean {
  return (
    f.mode === DEFAULT_FILTERS.mode &&
    f.cities.length === 0 &&
    f.cuisines.length === 0 &&
    f.googleMinRating === 0 &&
    f.googleMinReviews === 0 &&
    f.yelpMinRating === 0 &&
    f.yelpMinReviews === 0 &&
    f.michelinStars.length === 0 &&
    !f.bibGourmand &&
    f.jamesBeard === 'any' &&
    !f.eater38
  )
}

export function readStoredFilters(): SearchFilters | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<SearchFilters>
    return {
      ...DEFAULT_FILTERS,
      ...parsed,
      // Defensive array coercion — old schemas can't sneak in bad values.
      cities: Array.isArray(parsed.cities) ? parsed.cities : [],
      cuisines: Array.isArray(parsed.cuisines) ? parsed.cuisines : [],
      michelinStars: Array.isArray(parsed.michelinStars)
        ? parsed.michelinStars.filter((n): n is number => typeof n === 'number')
        : [],
    }
  } catch {
    return null
  }
}

export function writeStoredFilters(filters: SearchFilters): void {
  if (typeof window === 'undefined') return
  try {
    if (isDefaultFilters(filters)) {
      localStorage.removeItem(STORAGE_KEY)
    } else {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(filters))
    }
  } catch {
    // Safari private mode / quota exceeded — best effort.
  }
}
