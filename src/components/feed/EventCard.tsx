import Link from 'next/link'
import { formatDistanceToNow, parseISO } from 'date-fns'
import {
  ArrowRight,
  Clock,
  Film,
  ImageIcon,
  MessageSquare,
  Sparkles,
} from 'lucide-react'
import type { FeedEvent } from '@/lib/events'

interface EventCardProps {
  event: FeedEvent
}

/**
 * Single event card used by /recent. Intentionally flat and horizontal
 * with NO ranking, NO restaurant rows. Pure reverse-chronological event
 * rendering.
 */
export default function EventCard({ event }: EventCardProps) {
  const { Icon, iconBg, iconColor, title } = describeEvent(event)
  const timestamp = parseISO(event.timestamp)
  const relative = formatDistanceToNow(timestamp, { addSuffix: true })

  return (
    <article className="flex items-start gap-4 rounded-xl border border-gray-100 bg-white p-4 hover:border-emerald-200 hover:shadow-sm transition-all">
      <span
        className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${iconBg}`}
      >
        <Icon size={18} className={iconColor} />
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-900">
          {title}
          {event.restaurant_city && (
            <>
              {' in '}
              <span className="text-gray-500">{event.restaurant_city}</span>
            </>
          )}
        </p>
        <p className="mt-1 flex items-center gap-1 text-[11px] text-gray-400">
          <Clock size={10} />
          <time dateTime={event.timestamp}>{relative}</time>
        </p>
      </div>
      <Link
        href={`/restaurants/${event.restaurant_id}`}
        className="inline-flex items-center gap-1 text-sm font-semibold text-emerald-600 hover:text-emerald-700 transition-colors whitespace-nowrap self-center"
      >
        Visit restaurant
        <ArrowRight size={13} />
      </Link>
    </article>
  )
}

function describeEvent(event: FeedEvent): {
  Icon: typeof Sparkles
  iconBg: string
  iconColor: string
  title: React.ReactNode
} {
  switch (event.kind) {
    case 'restaurant_added':
      return {
        Icon: Sparkles,
        iconBg: 'bg-emerald-100',
        iconColor: 'text-emerald-600',
        title: (
          <>
            <span className="font-semibold">{event.restaurant_name}</span>
            {' added'}
          </>
        ),
      }
    case 'videos_added': {
      const count = event.count ?? 1
      const platform =
        event.platform === 'instagram' ? 'Instagram reel' : 'TikTok'
      const label = count === 1 ? `1 new ${platform}` : `${count} new ${platform}s`
      return {
        Icon: Film,
        iconBg: 'bg-pink-100',
        iconColor: 'text-pink-600',
        title: (
          <>
            {label} for{' '}
            <span className="font-semibold">{event.restaurant_name}</span>
          </>
        ),
      }
    }
    case 'review_added':
      return {
        Icon: MessageSquare,
        iconBg: 'bg-blue-100',
        iconColor: 'text-blue-600',
        title: (
          <>
            New review for{' '}
            <span className="font-semibold">{event.restaurant_name}</span>
          </>
        ),
      }
    case 'photos_added':
      return {
        Icon: ImageIcon,
        iconBg: 'bg-amber-100',
        iconColor: 'text-amber-600',
        title: (
          <>
            New photo of{' '}
            <span className="font-semibold">{event.restaurant_name}</span>
          </>
        ),
      }
  }
}
