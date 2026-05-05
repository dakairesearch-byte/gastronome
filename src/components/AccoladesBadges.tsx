import { Star, Award, Utensils } from 'lucide-react'
import type { Restaurant } from '@/types/database'

const DESIGNATION_DISPLAY: Record<string, string> = {
  one_star: '1 Michelin Star',
  two_star: '2 Michelin Stars',
  two_stars: '2 Michelin Stars',
  three_star: '3 Michelin Stars',
  three_stars: '3 Michelin Stars',
  bib_gourmand: 'Bib Gourmand',
  selected: 'Michelin Selected',
}

export function getDesignationDisplay(designation: string | null | undefined): string {
  if (!designation) return ''
  return DESIGNATION_DISPLAY[designation] || designation.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

interface AccoladesBadgesProps {
  restaurant: Restaurant
  maxBadges?: number
}

function BadgeLink({ href, children }: { href?: string | null; children: React.ReactNode }) {
  if (href) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className="hover:opacity-80 transition-opacity">
        {children}
      </a>
    )
  }
  return <>{children}</>
}

export default function AccoladesBadges({ restaurant, maxBadges }: AccoladesBadgesProps) {
  const badges: React.ReactNode[] = []

  // Michelin stars (most prominent)
  if (restaurant.michelin_stars > 0) {
    badges.push(
      <BadgeLink key="michelin-stars" href={restaurant.michelin_url}>
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-600 text-white text-xs font-bold shadow-sm">
          {Array.from({ length: restaurant.michelin_stars }).map((_, i) => (
            // Stable id keyed off the restaurant so the diffing keeps
            // the same DOM nodes across re-renders that change star count.
            <Star
              key={`star-${restaurant.id}-${i}`}
              size={12}
              className="fill-white text-white"
            />
          ))}
          <span>Michelin {restaurant.michelin_stars === 1 ? 'Star' : 'Stars'}</span>
        </span>
      </BadgeLink>
    )
  }

  // Michelin designation (Bib Gourmand, Plate, etc.) without stars
  if (restaurant.michelin_designation && restaurant.michelin_stars === 0) {
    badges.push(
      <BadgeLink key="michelin-designation" href={restaurant.michelin_url}>
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-50 text-red-700 border border-red-200 text-xs font-semibold">
          <Star size={12} className="text-red-500" />
          <span>{getDesignationDisplay(restaurant.michelin_designation)}</span>
        </span>
      </BadgeLink>
    )
  }

  // James Beard. The `james_beard_nominated` column was dropped in the
  // award-history migration; nominee/finalist/semifinalist info now lives
  // in `restaurant_jbf_history`. Only render the winner badge here â pages
  // that want richer recognition status should join that history table.
  if (restaurant.james_beard_winner) {
    badges.push(
      <span key="james-beard" className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 border border-amber-300 text-xs font-semibold">
        <Award size={12} className="text-amber-600" />
        <span>James Beard Winner</span>
      </span>
    )
  }

  // Eater 38 â wrap in BadgeLink so the badge is clickable through to the
  // Eater list when we have an eater_url. BadgeLink falls back to a plain
  // span when href is null, matching the Michelin/JBF pattern above.
  if (restaurant.eater_38) {
    const eaterHref =
      (restaurant as Restaurant & { eater_url?: string | null }).eater_url ?? null
    badges.push(
      <BadgeLink key="eater-38" href={eaterHref}>
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-pink-50 text-pink-700 border border-pink-200 text-xs font-semibold">
          <Utensils size={12} className="text-pink-500" />
          <span>Eater 38</span>
        </span>
      </BadgeLink>
    )
  }

  if (badges.length === 0) return null

  const limit = maxBadges ?? badges.length
  const visible = badges.slice(0, limit)
  const overflow = badges.length - limit

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {visible}
      {overflow > 0 && (
        <span className="text-xs text-gray-400 font-medium">+{overflow}</span>
      )}
    </div>
  )
}
