import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import {
  parseSlug,
  checklistMeta,
  type ChecklistRestaurant,
} from '@/lib/checklists'
import ChecklistRow from '@/components/checklists/ChecklistRow'
import ProgressRing from '@/components/checklists/ProgressRing'
import SignInNudgeClient from '@/components/checklists/SignInNudgeClient'
import type { Metadata } from 'next'

export const revalidate = 300

/**
 * /checklists/[slug] detail page.
 *
 * Server component shell — fetches restaurant list and per-user tried set.
 * Each row renders a BeenButton (client island) for the check action.
 *
 * Anonymous visitors see the full list with a sign-in nudge in place of
 * the progress ring. The list is still fully rendered for SEO.
 */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const parsed = parseSlug(slug)
  if (!parsed) return { title: 'Checklist' }

  const supabase = await createServerSupabaseClient()
  const { data: cityRow } = await supabase
    .from('cities')
    .select('name')
    .eq('slug', parsed.citySlug)
    .single()

  const city =
    cityRow?.name ??
    parsed.citySlug
      .split('-')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ')
  const meta = checklistMeta(city, parsed.type)
  return {
    title: meta.title,
    description: `${meta.subtitle} Track which ones you've tried on Gastronome.`,
  }
}

export default async function ChecklistDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const parsed = parseSlug(slug)
  if (!parsed) notFound()

  const supabase = await createServerSupabaseClient()

  // --- Resolve city name from slug ---
  const { data: cityRow } = await supabase
    .from('cities')
    .select('name')
    .eq('slug', parsed.citySlug)
    .single()

  const cityName: string =
    cityRow?.name ??
    parsed.citySlug
      .split('-')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ')

  const meta = checklistMeta(cityName, parsed.type)

  // --- Fetch restaurants for this list ---
  const SELECT =
    'id, name, city, neighborhood, cuisine, michelin_stars, michelin_designation, eater_38, google_rating, photo_url, google_photo_url'

  let query = supabase
    .from('restaurants')
    .select(SELECT)
    .eq('city', cityName)
    .eq('flagged_for_removal', false)
    .order('name', { ascending: true })

  if (parsed.type === 'eater38') {
    query = query.eq('eater_38', true)
  } else if (parsed.type === 'michelin') {
    query = query.gt('michelin_stars', 0)
  } else {
    query = query.eq('michelin_designation', 'bib_gourmand')
  }

  const { data: restaurants } = await query

  if (!restaurants || restaurants.length === 0) notFound()

  const restaurantList = restaurants as ChecklistRestaurant[]

  // --- Auth + tried set ---
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let triedSet = new Set<string>()
  if (user) {
    const restaurantIds = restaurantList.map((r) => r.id)
    const { data: userReviews } = await supabase
      .from('reviews')
      .select('restaurant_id')
      .eq('author_id', user.id)
      .in('restaurant_id', restaurantIds)

    if (userReviews) {
      triedSet = new Set(userReviews.map((r) => r.restaurant_id))
    }
  }

  const triedCount = user ? triedSet.size : 0
  const total = restaurantList.length

  return (
    // div, not <main> — the root layout already wraps every page in
    // <main id="main-content">; nested main landmarks are invalid HTML.
    <div
      className="max-w-2xl mx-auto px-4 sm:px-6 py-8 md:py-12 pb-28 md:pb-12"
      style={{ minHeight: '60vh' }}
    >
      {/* Breadcrumb */}
      <nav className="mb-6" aria-label="Breadcrumb">
        <Link
          href="/checklists"
          className="text-xs uppercase tracking-wide hover:underline focus-visible:outline focus-visible:outline-2"
          style={{
            fontFamily: 'var(--font-body)',
            letterSpacing: '0.1em',
            color: 'var(--color-text-secondary)',
          }}
        >
          Checklists
        </Link>
        <span
          className="mx-2 text-xs"
          style={{ color: 'var(--color-border)' }}
          aria-hidden="true"
        >
          /
        </span>
        <span
          className="text-xs uppercase tracking-wide"
          style={{
            fontFamily: 'var(--font-body)',
            letterSpacing: '0.1em',
            color: 'var(--color-text)',
          }}
        >
          {meta.city}
        </span>
      </nav>

      {/* Header */}
      <div className="flex items-start gap-5 mb-8">
        {user ? (
          <ProgressRing
            tried={triedCount}
            total={total}
            color={meta.color}
            size={72}
          />
        ) : (
          <div
            className="flex-shrink-0 w-[72px] h-[72px] rounded-full flex items-center justify-center"
            style={{ border: '3px solid var(--color-border)' }}
          >
            <span
              className="text-xl font-bold"
              style={{ fontFamily: 'var(--font-body)', color: 'var(--color-text-secondary)' }}
            >
              {total}
            </span>
          </div>
        )}

        <div className="flex-1 pt-1">
          <h1
            className="text-2xl md:text-3xl font-bold leading-tight"
            style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-text)' }}
          >
            {meta.title}
          </h1>
          <p
            className="mt-1.5 text-sm"
            style={{ fontFamily: 'var(--font-body)', color: 'var(--color-text-secondary)' }}
          >
            {meta.subtitle}
          </p>
          {user ? (
            <p
              className="mt-2 text-sm font-medium"
              style={{ fontFamily: 'var(--font-body)', color: meta.color }}
            >
              {triedCount === 0
                ? `Start exploring — ${total} places to try`
                : triedCount === total
                  ? `You've tried all ${total}!`
                  : `${triedCount} of ${total} tried`}
            </p>
          ) : (
            <p
              className="mt-2 text-sm"
              style={{ fontFamily: 'var(--font-body)', color: 'var(--color-text-secondary)' }}
            >
              Sign in to track your progress across {total} places.
            </p>
          )}
        </div>
      </div>

      {/* Restaurant list */}
      <div>
        {restaurantList.map((restaurant) => (
          <ChecklistRow
            key={restaurant.id}
            restaurant={restaurant}
            initialTried={triedSet.has(restaurant.id)}
          />
        ))}
      </div>

      {/* Anonymous sign-in nudge at the bottom */}
      {!user && (
        <SignInNudgeClient listTitle={meta.title} />
      )}
    </div>
  )
}
