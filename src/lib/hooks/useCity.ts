'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

/**
 * Global active-city state for the header switcher (W0).
 *
 * Resolution order for the active city:
 *   1. `?city=` URL param if present (the canonical, shareable source)
 *   2. localStorage key `gastro_city` (sticky across visits)
 *   3. `DEFAULT_CITY` ("New York")
 *
 * The setter persists to localStorage and navigates to the canonical
 * city-filtered browse surface (`/explore?city=<name>`) so every surface
 * stays in sync off the URL. We intentionally key off the URL first: a
 * shared `/explore?city=Chicago` link should win over a stale local
 * preference.
 */
export const CITY_STORAGE_KEY = 'gastro_city'
export const DEFAULT_CITY = 'New York'

export interface UseCity {
  /** The resolved active city name. */
  city: string
  /** Active city names fetched from the `cities` table (may be empty while loading). */
  cities: string[]
  /** Persist + navigate to the chosen city's canonical browse surface. */
  setCity: (next: string) => void
}

/**
 * @param initialCities Optional caller-supplied list of active city names.
 *   When provided we skip the client-side fetch (useful when a server
 *   component already has the list). Otherwise we fetch from `cities`.
 */
// Client-only readers used as lazy useState initializers. Returning the same
// value on the server (null) and computing the real value on the client at
// init avoids a synchronous setState-in-an-effect (react-hooks/set-state-in-
// effect) — the lint-correct way to hydrate client-only state.
function readStoredCity(): string | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage.getItem(CITY_STORAGE_KEY)?.trim() || null
  } catch {
    return null
  }
}
function readUrlCity(): string | null {
  if (typeof window === 'undefined') return null
  try {
    return new URLSearchParams(window.location.search).get('city')?.trim() || null
  } catch {
    return null
  }
}

export function useCity(initialCities?: string[]): UseCity {
  const router = useRouter()

  // Initialised once from localStorage + the live URL (no setState-in-effect).
  // We deliberately avoid useSearchParams() — this hook is consumed by the
  // root-layout <Navigation>, where useSearchParams would force a CSR bailout
  // needing a Suspense boundary. The setter below keeps both fresh on in-app
  // city changes; a full reload re-reads the URL via the initializer.
  const [stored, setStored] = useState<string | null>(readStoredCity)
  const [urlCity, setUrlCity] = useState<string | null>(readUrlCity)
  const [cities, setCities] = useState<string[]>(initialCities ?? [])

  // Fetch active cities client-side unless the caller passed a list.
  useEffect(() => {
    if (initialCities && initialCities.length > 0) return
    let active = true
    const supabase = createClient()
    supabase
      .from('cities')
      .select('name')
      .eq('is_active', true)
      .order('restaurant_count', { ascending: false })
      .then(({ data }) => {
        if (active && data) setCities(data.map((c) => c.name))
      })
    return () => {
      active = false
    }
  }, [initialCities])

  const city = urlCity || stored || DEFAULT_CITY

  const setCity = useCallback(
    (next: string) => {
      const trimmed = next.trim()
      if (!trimmed) return
      try {
        window.localStorage.setItem(CITY_STORAGE_KEY, trimmed)
      } catch {
        /* ignore — see above */
      }
      setStored(trimmed)
      // Optimistically reflect the selection so the resolved `city` updates
      // immediately even when navigating within /explore (pathname stays
      // the same, so the URL-reading effect above wouldn't otherwise refire).
      setUrlCity(trimmed)
      router.push(`/explore?city=${encodeURIComponent(trimmed)}`)
    },
    [router]
  )

  return { city, cities, setCity }
}
