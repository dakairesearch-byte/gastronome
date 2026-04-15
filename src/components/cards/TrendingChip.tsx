import { Flame } from 'lucide-react'

interface TrendingChipProps {
  /** 1-indexed trending rank within the scope. */
  rank: number
  /** Optional city scope — e.g. "NYC" or "Austin". */
  city?: string | null
  /** Short label for the window: "week", "today", "month". Default "week". */
  window?: string
  size?: 'sm' | 'md'
}

/**
 * Small "🔥 #3 trending this week" chip. The only ranking visual the app
 * is allowed to show — rendered wherever a restaurant surfaces in a
 * trending context so the ranking is visible and accountable.
 */
export default function TrendingChip({
  rank,
  city,
  window = 'week',
  size = 'sm',
}: TrendingChipProps) {
  const padding = size === 'md' ? 'px-2.5 py-1' : 'px-2 py-0.5'
  const text = size === 'md' ? 'text-xs' : 'text-[11px]'
  const iconSize = size === 'md' ? 13 : 11

  return (
    <span
      className={`inline-flex items-center gap-1 ${padding} rounded-full ${text} font-semibold bg-orange-100 text-orange-700 border border-orange-200 whitespace-nowrap`}
      title={`Ranked #${rank} by trending engagement in the last ${window}${city ? ` in ${city}` : ''}`}
    >
      <Flame size={iconSize} />
      #{rank}
      {city ? ` in ${city}` : ` this ${window}`}
    </span>
  )
}
