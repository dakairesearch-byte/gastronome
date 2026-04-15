import { Clock } from 'lucide-react'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import {
  fetchRecentEvents,
  groupEventsByDay,
  type FeedEvent,
} from '@/lib/events'
import FeedFilterChips, {
  type FeedFilter,
} from '@/components/feed/FeedFilterChips'
import EventCard from '@/components/feed/EventCard'
import EmptyState from '@/components/EmptyState'

export const revalidate = 60

export const metadata = {
  title: "What's new | Gastronome",
  description:
    'Reverse-chronological feed of new restaurants, videos, reviews, and photos across Gastronome.',
}

interface SearchParamsInput {
  filter?: string
}

function parseFilter(value: string | undefined): FeedFilter {
  if (
    value === 'restaurants' ||
    value === 'videos' ||
    value === 'reviews' ||
    value === 'photos'
  )
    return value
  return 'all'
}

function applyFilter(events: FeedEvent[], filter: FeedFilter): FeedEvent[] {
  switch (filter) {
    case 'all':
      return events
    case 'restaurants':
      return events.filter((e) => e.kind === 'restaurant_added')
    case 'videos':
      return events.filter((e) => e.kind === 'videos_added')
    case 'reviews':
      return events.filter((e) => e.kind === 'review_added')
    case 'photos':
      return events.filter((e) => e.kind === 'photos_added')
  }
}

export default async function RecentPage({
  searchParams,
}: {
  searchParams: Promise<SearchParamsInput>
}) {
  const raw = await searchParams
  const filter = parseFilter(raw.filter)

  const supabase = await createServerSupabaseClient()
  const allEvents = await fetchRecentEvents(supabase, { lookbackDays: 30 })
  const events = applyFilter(allEvents, filter)
  const groups = groupEventsByDay(events)

  const sections: { title: string; events: FeedEvent[] }[] = [
    { title: 'Today', events: groups.today },
    { title: 'Yesterday', events: groups.yesterday },
    { title: 'This week', events: groups.thisWeek },
    { title: 'Earlier', events: groups.earlier },
  ].filter((s) => s.events.length > 0)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero */}
      <section className="bg-gradient-to-br from-gray-900 via-gray-900 to-emerald-950 text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 sm:py-12">
          <div className="flex items-center gap-2 mb-2">
            <Clock size={22} className="text-emerald-400" />
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              What&apos;s new
            </h1>
          </div>
          <p className="text-gray-400 text-sm">
            Reverse-chronological activity across Gastronome. New
            restaurants, new videos, new reviews — grouped by day.
          </p>
        </div>
      </section>

      {/* Sticky filter chips */}
      <div className="sticky top-14 z-20 bg-gray-50/95 backdrop-blur-sm border-b border-gray-100">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3">
          <FeedFilterChips active={filter} />
        </div>
      </div>

      {/* Body */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
        {sections.length === 0 ? (
          <EmptyState
            icon={Clock}
            title="Nothing yet"
            description={
              filter === 'all'
                ? 'Nothing new in the last 30 days. Check back later.'
                : 'No matching events in the last 30 days.'
            }
          />
        ) : (
          <div className="space-y-10">
            {sections.map(({ title, events: sectionEvents }) => (
              <section key={title}>
                <h2 className="text-sm font-bold uppercase tracking-wide text-gray-500 mb-3">
                  {title}
                  <span className="ml-2 text-gray-400 font-medium normal-case">
                    ({sectionEvents.length})
                  </span>
                </h2>
                <div className="space-y-3">
                  {sectionEvents.map((e) => (
                    <EventCard key={e.id} event={e} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
