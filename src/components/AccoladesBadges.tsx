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

  // Append the recognition year when known so a stale accolade doesn't read
  // as equally current as a fresh one.
  const yearSuffix = (year: number | null | undefined) =>
    year ? ` '${String(year).slice(-2)}` : ''
  const michelinYear = (restaurant as Restaurant & { michelin_year?: number | null }).michelin_year

  // Michelin stars (most prominent)
  if (restaurant.michelin_stars > 0) {
    const starsLabel = `${restaurant.michelin_stars} Michelin ${restaurant.michelin_stars === 1 ? 'Star' : 'Stars'} — Michelin Guide's highest distinction, awarded for exceptional cooking.`
    badges.push(
      <BadgeLink key="michelin-stars" href={restaurant.michelin_url}>
        <span
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-600 text-white text-xs font-bold shadow-sm"
          title={starsLabel}
        >
          {Array.from({ length: restaurant.michelin_stars }).map((_, i) => (
            // Stable id keyed off the restaurant so the diffing keeps
            // the same DOM nodes across re-renders that change star count.
            <Star
              key={`star-${restaurant.id}-${i}`}
              size={12}
              className="fill-white text-white"
              aria-hidden="true"
            />
          ))}
          <span>{`Michelin ${restaurant.michelin_stars === 1 ? 'Star' : 'Stars'}${yearSuffix(michelinYear)}`}</span>
        </span>
      </BadgeLink>
    )
  }

  // Michelin designation (Bib Gourmand, Plate, etc.) without stars
  if (restaurant.michelin_designation && restaurant.michelin_stars === 0) {
    const designationLabel = `${getDesignationDisplay(restaurant.michelin_designation)} — recognized by the Michelin Guide.`
    badges.push(
      <BadgeLink key="michelin-designation" href={restaurant.michelin_url}>
        <span
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-50 text-red-700 border border-red-200 text-xs font-semibold"
          title={designationLabel}
        >
          <Star size={12} className="text-red-500" aria-hidden="true" />
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
    // Wrapped in BadgeLink to match the Michelin/Eater pattern even when
    // there's no URL (it falls back to a plain span). When a `jbf_url`
    // column lands on `restaurants`, this will become clickable for free.
    const jbfHref =
      (restaurant as Restaurant & { jbf_url?: string | null }).jbf_url ?? null
    const jbfYear = (restaurant as Restaurant & { jbf_year?: number | null }).jbf_year
    badges.push(
      <BadgeLink key="james-beard" href={jbfHref}>
        <span
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 border border-amber-300 text-xs font-semibold"
          title="Recipient of a James Beard Foundation award — the U.S. restaurant industry's most prestigious honors."
        >
          <Award size={12} className="text-amber-600" aria-hidden="true" />
          <span>{`James Beard Winner${yearSuffix(jbfYear)}`}</span>
        </span>
      </BadgeLink>
    )
  }

  // Eater 38 â wrap in BadgeLink so the badge is clickable through to the
  // Eater list when we have an eater_url. BadgeLink falls back to a plain
  // span when href is null, matching the Michelin/JBF pattern above.
  if (restaurant.eater_38) {
    const eaterHref =
      (restaurant as Restaurant & { eater_url?: string | null }).eater_url ?? null
    // Append the listing year when known ("Eater 38 '25") so stale
    // listings don't look equally authoritative as a current pick.
    const eaterYear =
      (restaurant as Restaurant & { eater_year?: number | null }).eater_year
    badges.push(
      <BadgeLink key="eater-38" href={eaterHref}>
        <span
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-pink-50 text-pink-700 border border-pink-200 text-xs font-semibold"
          title="Listed on the Eater 38 — Eater's running list of the most essential restaurants in this city."
        >
          <Utensils size={12} className="text-pink-500" aria-hidden="true" />
          <span>{`Eater 38${yearSuffix(eaterYear)}`}</span>
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
