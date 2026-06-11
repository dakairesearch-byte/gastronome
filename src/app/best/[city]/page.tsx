import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronRight, UtensilsCrossed } from 'lucide-react'
import { getCityTopDishes, getActiveCities } from '@/lib/dishPages'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

export const revalidate = 3600

/* ------------------------------------------------------------------ */
/*  Static params (active cities only)                                   */
/* ------------------------------------------------------------------ */

export async function generateStaticParams(): Promise<{ city: string }[]> {
  try {
    const cities = await getActiveCities()
    return cities.map((c) => ({ city: c.slug }))
  } catch {
    return []
  }
}

/* ------------------------------------------------------------------ */
/*  Metadata                                                             */
/* ------------------------------------------------------------------ */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ city: string }>
}): Promise<Metadata> {
  const { city: citySlug } = await params

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return { title: 'Best dishes' }

  const supabase = createClient<Database>(url, key, { auth: { persistSession: false } })
  const { data: cityData } = await supabase
    .from('cities')
    .select('name')
    .eq('slug', citySlug)
    .eq('is_active', true)
    .single()

  if (!cityData) return { title: 'City not found' }

  const description = `Find the best dishes in ${cityData.name} ranked by Gastronome Score — the best birria tacos, ramen, pizza, and more, based on real reviews and social signals.`

  return {
    title: `Best Dishes in ${cityData.name}`,
    description,
    openGraph: {
      title: `Best Dishes in ${cityData.name} · Gastronome`,
      description,
      type: 'website',
    },
    twitter: {
      card: 'summary',
      title: `Best Dishes in ${cityData.name} · Gastronome`,
      description,
    },
  }
}

/* ------------------------------------------------------------------ */
/*  Page                                                                 */
/* ------------------------------------------------------------------ */

export default async function CityBestPage({
  params,
}: {
  params: Promise<{ city: string }>
}) {
  const { city: citySlug } = await params

  // Resolve city name for display
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) notFound()

  const supabase = createClient<Database>(url, key, { auth: { persistSession: false } })
  const { data: cityData } = await supabase
    .from('cities')
    .select('name, slug')
    .eq('slug', citySlug)
    .eq('is_active', true)
    .single()

  if (!cityData) notFound()

  const dishes = await getCityTopDishes(citySlug)

  if (dishes.length === 0) notFound()

  return (
    <main
      className="min-h-screen"
      style={{ background: 'var(--color-background)' }}
    >
      {/* ── Breadcrumb ── */}
      <div
        className="border-b"
        style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
      >
        <div className="max-w-3xl mx-auto px-4 py-3">
          <nav
            className="flex items-center gap-1 text-sm"
            style={{ color: 'var(--color-text-secondary)' }}
            aria-label="Breadcrumb"
          >
            <Link
              href="/"
              className="hover:underline"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              Gastronome
            </Link>
            <ChevronRight size={14} aria-hidden="true" />
            <span
              className="font-medium"
              style={{ color: 'var(--color-text)' }}
              aria-current="page"
            >
              Best in {cityData.name}
            </span>
          </nav>
        </div>
      </div>

      {/* ── Hero header ── */}
      <div className="max-w-3xl mx-auto px-4 pt-8 pb-6">
        <h1
          className="text-3xl sm:text-4xl font-bold mb-2"
          style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-text)' }}
        >
          Best Dishes in {cityData.name}
        </h1>
        <p
          className="text-base"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          {dishes.length} dish{dishes.length !== 1 ? 'es' : ''} ranked by Gastronome Score, built from reviews, Google ratings, TikTok, and Instagram.
        </p>
      </div>

      {/* ── Dish grid ── */}
      <div className="max-w-3xl mx-auto px-4 pb-16">
        <ul
          className="grid grid-cols-1 sm:grid-cols-2 gap-3"
          aria-label={`Best dishes in ${cityData.name}`}
        >
          {dishes.map((dish) => (
            <li key={dish.dishSlug}>
              <Link
                href={`/best/${citySlug}/${dish.dishSlug}`}
                className="flex items-center gap-3 p-4 rounded-xl border transition-shadow duration-200 hover:shadow-md group"
                style={{
                  borderColor: 'var(--color-border)',
                  background: 'var(--color-surface)',
                  borderRadius: 'var(--r-card)',
                }}
              >
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                  style={{ background: 'var(--color-surface-alt)' }}
                  aria-hidden="true"
                >
                  <UtensilsCrossed
                    size={18}
                    style={{ color: 'var(--color-action)' }}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p
                    className="font-semibold text-sm leading-snug line-clamp-1 transition-colors group-hover:text-[var(--color-action)]"
                    style={{ color: 'var(--color-text)' }}
                    title={dish.dishDisplayName}
                  >
                    {dish.dishDisplayName}
                  </p>
                  <p
                    className="text-xs mt-0.5"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    {dish.restaurantCount} restaurant{dish.restaurantCount !== 1 ? 's' : ''}
                  </p>
                </div>
                <ChevronRight
                  size={16}
                  aria-hidden="true"
                  style={{ color: 'var(--color-text-secondary)', flexShrink: 0 }}
                />
              </Link>
            </li>
          ))}
        </ul>

        <p
          className="mt-8 text-xs text-center"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          Only dishes with at least 3 restaurants and verified Gastronome Scores are shown.
        </p>
      </div>
    </main>
  )
}
