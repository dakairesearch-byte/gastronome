import { Flame, TrendingUp } from 'lucide-react'
import type { TrendingTier } from '@/lib/placement'

interface TrendingBadgeProps {
  tier: TrendingTier
}

export default function TrendingBadge({ tier }: TrendingBadgeProps) {
  if (tier === 'none') return null

  if (tier === 'hot') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-orange-100 text-orange-700 border border-orange-200">
        <Flame size={11} />
        Hot
      </span>
    )
  }

  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-700 border border-emerald-200">
      <TrendingUp size={11} />
      Trending
    </span>
  )
}
