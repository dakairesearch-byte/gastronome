import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { getDishPageData, getActiveCities, getCityTopDishes } from '@/lib/dishPages'
import { ScorePill } from '@/components/GastronomeScoreBadge'
import BookmarkButton from '@/components/BookmarkButton'
import AccoladesBadges from '@/components/AccoladesBadges'
import { isStockFallbackPhoto } from '@/lib/restaurant'
import type { Restaurant } from '@/types/database'

export const revalidate = 3600

/* ------------------------------------------------------------------ */
/*  Static params (active cities × qualifying dishes)                   */
/* ------------------------------------------------------------------ */

export async function generateStaticParams(): Promise<
  { city: string; dish: string }[]
> {
  try {
    const cities = await getActiveCities()
    const params: { city: string; dish: string }[] = []
    for (const city of cities) {
      const dishes = await getCityTopDishes(city.slug)
      for (const d of dishes) {
        params.push({ city: city.slug, dish: d.dishSlug })
      }
    }
    return params
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
  params: Promise<{ city: string; dish: string }>
}): Promise<Metadata> {
  const { city: citySlug, dish: dishSlug } = await params
  const data = await getDishPageData(citySlug, dishSlug)

  if (!data) {
    return { title: 'Not found' }
  }

  const { dishDisplayName, city, restaurants } = data
  const topRestaurant = restaurants[0]?.restaurant.name ?? ''
  const description = `Ranked by Gastronome Score: the best ${dishDisplayName} in ${city.name}. ${topRestaurant ? `Top pick: ${topRestaurant}.` : ''} Based on reviews, Google ratings, TikTok, and Instagram across ${restaurants.length} restaurants.`

  return {
    title: `Best ${dishDisplayName} in ${city.name}`,
    description,
    openGraph: {
      title: `Best ${dishDisplayName} in ${city.name} · Gastronome`,
      description,
      type: 'website',
    },
    twitter: {
      card: 'summary',
      title: `Best ${dishDisplayName} in ${city.name} · Gastronome`,
      description,
    },
  }
}

/* ------------------------------------------------------------------ */
/*  Slim dish restaurant card (server-rendered, no client state)        */
/* ------------------------------------------------------------------ */

function getPhoto(r: Pick<Restaurant, 'photo_url' | 'photo_urls' | 'google_photo_url'>): string | null {
  return r.photo_url || (r.photo_urls?.[0] ?? null) || r.google_photo_url || null
}

/* ------------------------------------------------------------------ */
/*  Page                                                                 */
/* ------------------------------------------------------------------ */

export default async function DishPage({
  params,
}: {
  params: Promise<{ city: string; dish: string }>
}) {
  const { city: citySlug, dish: dishSlug } = await params
  const data = await getDishPageData(citySlug, dishSlug)

  if (!data) notFound()

  const { dishDisplayName, city, restaurants } = data

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
            <Link
              href={`/best/${city.slug}`}
              className="hover:underline"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              Best in {city.name}
            </Link>
            <ChevronRight size={14} aria-hidden="true" />
            <span
              className="font-medium"
              style={{ color: 'var(--color-text)' }}
              aria-current="page"
            >
              {dishDisplayName}
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
          Best {dishDisplayName} in {city.name}
        </h1>
        <p
          className="text-base"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          {restaurants.length} restaurants ranked by Gastronome Score — combining Google, Yelp, and social sources.
        </p>
      </div>

      {/* ── Ranked list ── */}
      <div className="max-w-3xl mx-auto px-4 pb-16">
        <ol className="space-y-4" aria-label={`Ranked list of best ${dishDisplayName} in ${city.name}`}>
          {restaurants.map((entry, index) => {
            const { restaurant, gastronomeScore: score, evidenceLine } = entry
            const photo = getPhoto(restaurant)
            const photoIsStock = isStockFallbackPhoto(photo)
            const hasAccolades =
              (restaurant.michelin_stars && restaurant.michelin_stars > 0) ||
              restaurant.james_beard_winner ||
              restaurant.eater_38

            return (
              <li key={restaurant.id}>
                <div
                  className="relative shadow-sm hover:shadow-lg transition-shadow duration-200 border overflow-hidden bg-white group"
                  style={{
                    borderColor: 'var(--color-border)',
                    borderRadius: 'var(--r-card)',
                  }}
                >
                  {/* Stretched overlay link */}
                  <Link
                    href={`/restaurants/${restaurant.id}`}
                    className="absolute inset-0 z-0"
                    aria-label={restaurant.name}
                  />

                  <div className="relative z-[1] flex gap-3 p-3 sm:p-4 pointer-events-none">
                    {/* Rank badge + thumbnail */}
                    <div className="flex flex-col items-center gap-2 shrink-0">
                      <span
                        className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                        style={{
                          background: index === 0
                            ? 'var(--color-primary)'
                            : 'var(--color-surface-alt)',
                          color: index === 0
                            ? '#fff'
                            : 'var(--color-text-secondary)',
                        }}
                        aria-label={`Ranked #${index + 1}`}
                      >
                        {index + 1}
                      </span>

                      <div
                        className="relative w-16 h-16 rounded-xl overflow-hidden bg-gray-100 shrink-0"
                        aria-hidden="true"
                      >
                        {photo && !photoIsStock ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={photo}
                            alt=""
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                            loading="lazy"
                          />
                        ) : (
                          <div
                            className="w-full h-full flex items-center justify-center"
                            style={{
                              background:
                                'linear-gradient(135deg, var(--color-skeleton-base) 0%, var(--color-skeleton-highlight) 100%)',
                            }}
                          >
                            <span
                              className="text-xl font-light"
                              style={{ color: 'var(--color-text-secondary)' }}
                              aria-hidden="true"
                            >
                              {restaurant.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="flex items-start gap-2 flex-wrap pr-8">
                        <h2
                          className="font-bold text-gray-900 text-base leading-snug transition-colors group-hover:text-[var(--color-action)] line-clamp-1 min-w-0"
                          style={{ fontFamily: 'var(--font-heading)' }}
                          title={restaurant.name}
                        >
                          {restaurant.name}
                        </h2>
                        {score !== null && (
                          <ScorePill score={score} size="sm" />
                        )}
                      </div>

                      {/* Location */}
                      <p
                        className="text-xs"
                        style={{ color: 'var(--color-text-secondary)' }}
                      >
                        {[restaurant.neighborhood, restaurant.city]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>

                      {/* Evidence line — the per-restaurant source spread */}
                      <p
                        className="text-xs italic"
                        style={{ color: 'var(--color-text-secondary)' }}
                      >
                        {evidenceLine}
                      </p>

                      {/* Accolades */}
                      {hasAccolades && (
                        <div className="pointer-events-auto w-fit pt-0.5">
                          <AccoladesBadges restaurant={restaurant} maxBadges={3} />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Save button */}
                  <div className="absolute top-2 right-2 z-[2] pointer-events-auto">
                    <BookmarkButton restaurantId={restaurant.id} variant="card" />
                  </div>
                </div>
              </li>
            )
          })}
        </ol>

        {/* ── Footer note ── */}
        <p
          className="mt-8 text-xs text-center"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          Rankings are updated hourly based on Gastronome Score — a weighted
          combination of Google, Yelp, and social signals. Accolades (Michelin,
          James Beard, Eater 38) are shown separately and do not affect the score.
        </p>
      </div>
    </main>
  )
}
