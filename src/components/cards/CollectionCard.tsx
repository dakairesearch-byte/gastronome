import Link from 'next/link'
import type { ReactNode } from 'react'

interface CollectionCardProps {
  href: string
  title: string
  subtitle?: string
  count?: number
  accent?: 'red' | 'amber' | 'pink' | 'orange' | 'emerald' | 'gray'
  icon?: ReactNode
}

const ACCENT_STYLES = {
  red: 'from-red-50 to-rose-50 border-red-200 text-red-900',
  amber: 'from-amber-50 to-yellow-50 border-amber-200 text-amber-900',
  pink: 'from-pink-50 to-rose-50 border-pink-200 text-pink-900',
  orange: 'from-orange-50 to-amber-50 border-orange-200 text-orange-900',
  emerald: 'from-emerald-50 to-teal-50 border-emerald-200 text-emerald-900',
  gray: 'from-gray-50 to-slate-50 border-gray-200 text-gray-900',
}

const ACCENT_HOVER = {
  red: 'hover:border-red-400',
  amber: 'hover:border-amber-400',
  pink: 'hover:border-pink-400',
  orange: 'hover:border-orange-400',
  emerald: 'hover:border-emerald-400',
  gray: 'hover:border-gray-400',
}

/**
 * Editorial collection card for Explore. Distinct from both TrendingCard
 * (horizontal-scroll photo tiles) and the feed's EventCard — this is a
 * flat, photo-less, accent-colored tile linking into a filtered list.
 */
export default function CollectionCard({
  href,
  title,
  subtitle,
  count,
  accent = 'emerald',
  icon,
}: CollectionCardProps) {
  return (
    <Link
      href={href}
      className={`group block rounded-2xl border bg-gradient-to-br ${ACCENT_STYLES[accent]} ${ACCENT_HOVER[accent]} p-5 transition-all hover:shadow-md hover:-translate-y-0.5`}
    >
      {icon && <div className="mb-3 opacity-80">{icon}</div>}
      <h3 className="font-extrabold text-lg leading-tight">{title}</h3>
      {subtitle && (
        <p className="mt-1 text-xs font-medium opacity-70">{subtitle}</p>
      )}
      {typeof count === 'number' && count > 0 && (
        <p className="mt-3 text-2xl font-extrabold">
          {count.toLocaleString()}
          <span className="ml-1 text-xs font-semibold opacity-60">
            restaurant{count === 1 ? '' : 's'}
          </span>
        </p>
      )}
    </Link>
  )
}
