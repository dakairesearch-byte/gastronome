import { createServerSupabaseClient } from '@/lib/supabase/server'
import { checklistMeta, buildSlug, type ChecklistType } from '@/lib/checklists'
import ChecklistCard from '@/components/checklists/ChecklistCard'
import type { Metadata } from 'next'

export const revalidate = 300

export const metadata: Metadata = {
  title: 'Checklists',
  description: 'Track the restaurants on the essential city lists — Eater 38, Michelin stars, and Bib Gourmand — and see how many you\'ve tried.',
}

/**
 * /checklists index.
 *
 * Server component. Fetches:
 *   1. All active cities.
 *   2. Per-city counts for each accolade type (eater38, michelin, bib).
 *   3. If user is authenticated: per-checklist "tried" counts from reviews.
 *
 * Renders a grid of ChecklistCard per (city × type) that has at least 1
 * entry, grouped by city. Empty lists are omitted.
 */

interface CityChecklist {
  city: string
  type: ChecklistType
  total: number
  tried: number | null
}

export default async function ChecklistsPage() {
  const supabase = await createServerSupabaseClient()

  // Auth (session may be null for anonymous visitors)
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // --- 1. Count restaurants per city × accolade type ---
  // We do three separate aggregates to keep queries simple and typed.

  const [eater38Res, michelinRes, bibRes] = await Promise.all([
    supabase
      .from('restaurants')
      .select('city')
      .eq('eater_38', true)
      .eq('flagged_for_removal', false),
    supabase
      .from('restaurants')
      .select('city')
      .gt('michelin_stars', 0)
      .eq('flagged_for_removal', false),
    supabase
      .from('restaurants')
      .select('city')
      .eq('michelin_designation', 'bib_gourmand')
      .eq('flagged_for_removal', false),
  ])

  // Count per city for each type
  function countByCity(rows: { city: string | null }[] | null): Map<string, number> {
    const m = new Map<string, number>()
    for (const row of rows ?? []) {
      if (!row.city) continue
      m.set(row.city, (m.get(row.city) ?? 0) + 1)
    }
    return m
  }

  const eater38Counts = countByCity(eater38Res.data)
  const michelinCounts = countByCity(michelinRes.data)
  const bibCounts = countByCity(bibRes.data)

  // Collect distinct cities that have at least one checklist entry
  const allCities = new Set([
    ...eater38Counts.keys(),
    ...michelinCounts.keys(),
    ...bibCounts.keys(),
  ])

  // --- 2. Per-checklist tried counts for authenticated user ---
  const triedMap = new Map<string, number>() // key = buildSlug(city, type)

  if (user) {
    // Fetch all this user's reviews (author_id = user.id) with restaurant
    // city + accolade fields so we can bucket them.
    const { data: userReviews } = await supabase
      .from('reviews')
      .select('restaurant_id, restaurants!inner(city, eater_38, michelin_stars, michelin_designation, flagged_for_removal)')
      .eq('author_id', user.id)

    if (userReviews) {
      for (const row of userReviews) {
        const r = row.restaurants as {
          city: string | null
          eater_38: boolean | null
          michelin_stars: number | null
          michelin_designation: string | null
          flagged_for_removal: boolean
        } | null
        if (!r || r.flagged_for_removal || !r.city) continue
        if (r.eater_38) {
          const k = buildSlug(r.city, 'eater38')
          triedMap.set(k, (triedMap.get(k) ?? 0) + 1)
        }
        if ((r.michelin_stars ?? 0) > 0) {
          const k = buildSlug(r.city, 'michelin')
          triedMap.set(k, (triedMap.get(k) ?? 0) + 1)
        }
        if (r.michelin_designation === 'bib_gourmand') {
          const k = buildSlug(r.city, 'bib')
          triedMap.set(k, (triedMap.get(k) ?? 0) + 1)
        }
      }
    }
  }

  // Build flat list of CityChecklist entries, sorted by city then type priority
  const TYPE_ORDER: ChecklistType[] = ['eater38', 'michelin', 'bib']
  const sortedCities = Array.from(allCities).sort()

  const checklists: CityChecklist[] = []
  for (const city of sortedCities) {
    for (const type of TYPE_ORDER) {
      const counts = type === 'eater38' ? eater38Counts : type === 'michelin' ? michelinCounts : bibCounts
      const total = counts.get(city) ?? 0
      if (total === 0) continue
      const slug = buildSlug(city, type)
      checklists.push({
        city,
        type,
        total,
        tried: user ? (triedMap.get(slug) ?? 0) : null,
      })
    }
  }

  // Group by city for display
  const byCity = new Map<string, CityChecklist[]>()
  for (const cl of checklists) {
    const arr = byCity.get(cl.city) ?? []
    arr.push(cl)
    byCity.set(cl.city, arr)
  }

  return (
    // div, not <main> — the root layout already wraps every page in
    // <main id="main-content">; nested main landmarks are invalid HTML.
    <div
      className="max-w-3xl mx-auto px-4 sm:px-6 py-8 md:py-12 pb-28 md:pb-12"
      style={{ minHeight: '60vh' }}
    >
      {/* Page header */}
      <div className="mb-8">
        <h1
          className="text-2xl md:text-3xl font-bold leading-tight"
          style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-text)' }}
        >
          Checklists
        </h1>
        <p
          className="mt-2 text-base"
          style={{ fontFamily: 'var(--font-body)', color: 'var(--color-text-secondary)' }}
        >
          Track the essential city lists — Eater 38, Michelin stars, and Bib Gourmand.
        </p>
        {!user && (
          <p
            className="mt-2 text-sm"
            style={{ fontFamily: 'var(--font-body)', color: 'var(--color-text-secondary)' }}
          >
            Sign in to track your progress.
          </p>
        )}
      </div>

      {checklists.length === 0 ? (
        <div
          className="text-center py-16"
          style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-body)' }}
        >
          No checklists available yet.
        </div>
      ) : (
        <div className="space-y-10">
          {Array.from(byCity.entries()).map(([city, lists]) => (
            <section key={city}>
              <h2
                className="mb-3 text-xs uppercase tracking-widest"
                style={{
                  fontFamily: 'var(--font-body)',
                  letterSpacing: '0.12em',
                  color: 'var(--color-text-secondary)',
                }}
              >
                {city}
              </h2>
              <div className="space-y-3">
                {lists.map((cl) => {
                  const meta = checklistMeta(cl.city, cl.type)
                  return (
                    <ChecklistCard
                      key={meta.slug}
                      meta={meta}
                      total={cl.total}
                      tried={cl.tried}
                    />
                  )
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
