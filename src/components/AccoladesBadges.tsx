import { Star, Award, Utensils } from 'lucide-react'
import type { Restaurant, Accolade } from '@/types/database'

interface AccoladesBadgesProps {
  restaurant: Restaurant
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

export default function AccoladesBadges({ restaurant }: AccoladesBadgesProps) {
  const badges: React.ReactNode[] = []

  // Michelin stars (most prominent)
  if (restaurant.michelin_stars > 0) {
    badges.push(
      <BadgeLink key="michelin-stars" href={restaurant.michelin_url}>
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-600 text-white text-sm font-bold shadow-sm">
          {Array.from({ length: restaurant.michelin_stars }).map((_, i) => (
            <Star key={i} size={14} className="fill-white text-white" />
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
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-50 text-red-700 border border-red-200 text-sm font-semibold">
          <Star size={14} className="text-red-500" />
          <span>{restaurant.michelin_designation}</span>
        </span>
      </BadgeLink>
    )
  }

  // James Beard
  if (restaurant.james_beard_winner) {
    badges.push(
      <span key="james-beard" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300 text-sm font-semibold">
        <Award size={14} className="text-amber-600" />
        <span>James Beard Winner</span>
      </span>
    )
  } else if (restaurant.james_beard_nominated) {
    badges.push(
      <span key="james-beard" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-sm font-semibold">
        <Award size={14} className="text-amber-500" />
        <span>James Beard Nominee</span>
      </span>
    )
  }

  // Eater 38
  if (restaurant.eater_38) {
    badges.push(
      <span key="eater-38" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-pink-50 text-pink-700 border border-pink-200 text-sm font-semibold">
        <Utensils size={14} className="text-pink-500" />
        <span>Eater 38</span>
      </span>
    )
  }

  // Custom accolades from the JSONB field
  if (restaurant.accolades && Array.isArray(restaurant.accolades)) {
    const customAccolades = restaurant.accolades as unknown as Accolade[]
    for (const accolade of customAccolades) {
      badges.push(
        <BadgeLink key={`accolade-${accolade.type}-${accolade.label}`} href={accolade.url}>
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-sm font-semibold">
            {accolade.icon ? (
              <span className="text-xs">{accolade.icon}</span>
            ) : (
              <Award size={14} className="text-emerald-500" />
            )}
            <span>{accolade.label}</span>
            {accolade.year && (
              <span className="text-emerald-500 text-xs">({accolade.year})</span>
            )}
          </span>
        </BadgeLink>
      )
    }
  }

  if (badges.length === 0) return null

  return (
    <div className="flex flex-wrap items-center gap-2">
      {badges}
    </div>
  )
}
