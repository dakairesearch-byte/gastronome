import Link from 'next/link'
import {
  MichelinStarIcon,
  JamesBeardIcon,
  EaterIcon,
} from '@/components/brands/BrandIcons'

/**
 * Editorial collection / category-result header.
 *
 * Renders the slate band that sits above a filtered results wall so the
 * page reads as a curated list (with a who/why) instead of a bare title
 * over an anonymous grid. Replaces the prior behavior where landing on a
 * category stripped the description and showed no curator/source.
 *
 * PRIMITIVE props by design — this stays decoupled from editorial.ts
 * types so any caller (explore page, future surfaces) can render it from
 * plain strings/numbers. Server-component-friendly: no client hooks.
 *
 * `brand` opts into a brand mark via BrandIcons. The gastronome/
 * infatuation cases have no asset in BrandIcons, so they render the
 * eyebrow text alone (no mark) rather than inventing one.
 */

type Brand = 'michelin' | 'jbf' | 'eater' | 'infatuation' | 'gastronome'

interface CollectionHeaderProps {
  /** Source/authority kicker, e.g. "THE MICHELIN GUIDE 2025", "EATER NYC". */
  eyebrow: string
  title: string
  description: string
  /** Number of results in the active city; rendered as a sentence. */
  count: number
  /** What the order means, e.g. "Ranked by Gastronome Score" or
   *  "Source: Michelin Guide 2025". Surfaced so ordered/curated lists
   *  don't read as an arbitrary sort. */
  rankBasis: string
  /** Optional href for a "Clear filters" link back to the facet root. */
  clearHref?: string
  /** Optional brand for a logo mark next to the eyebrow. */
  brand?: Brand
  /** Optional unit noun for the count sentence (default "places"),
   *  e.g. "starred tables" → "27 starred tables". */
  countUnit?: string
  /** Optional locality for the count sentence, e.g. "New York" →
   *  "27 starred tables in New York". */
  locality?: string
}

function BrandMark({ brand }: { brand: Brand }) {
  switch (brand) {
    case 'michelin':
      return <MichelinStarIcon size={18} title="Michelin Guide" />
    case 'jbf':
      return <JamesBeardIcon size={18} title="James Beard Foundation" />
    case 'eater':
      return <EaterIcon size={18} title="Eater" />
    // No canonical asset for these in BrandIcons — eyebrow text stands alone.
    case 'infatuation':
    case 'gastronome':
    default:
      return null
  }
}

export default function CollectionHeader({
  eyebrow,
  title,
  description,
  count,
  rankBasis,
  clearHref,
  brand,
  countUnit = 'places',
  locality,
}: CollectionHeaderProps) {
  const countSentence = `${count.toLocaleString()} ${countUnit}${
    locality ? ` in ${locality}` : ''
  }`

  return (
    <header
      className="rounded-sm px-6 py-8 sm:px-10 sm:py-10"
      style={{ backgroundColor: 'var(--color-secondary)' }}
    >
      <div className="flex items-center gap-2.5">
        {brand ? <BrandMark brand={brand} /> : null}
        <p
          className="text-[11px] uppercase"
          style={{
            color: 'var(--color-primary)',
            fontFamily: 'var(--font-body)',
            letterSpacing: '0.18em',
            fontWeight: 600,
          }}
        >
          {eyebrow}
        </p>
      </div>

      <h1
        className="mt-3 text-3xl sm:text-4xl"
        style={{
          color: 'var(--color-surface)',
          fontFamily: 'var(--font-heading)',
          fontWeight: 500,
          lineHeight: 1.1,
        }}
      >
        {title}
      </h1>

      {description ? (
        <p
          className="mt-3 max-w-2xl text-sm sm:text-base"
          style={{
            color: 'rgba(255,255,255,0.78)',
            fontFamily: 'var(--font-body)',
            lineHeight: 1.55,
          }}
        >
          {description}
        </p>
      ) : null}

      <div
        className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs sm:text-sm"
        style={{ fontFamily: 'var(--font-body)' }}
      >
        <span style={{ color: 'var(--color-surface)', fontWeight: 600 }}>
          {countSentence}
        </span>
        <span style={{ color: 'rgba(255,255,255,0.4)' }} aria-hidden="true">
          ·
        </span>
        <span style={{ color: 'rgba(255,255,255,0.72)' }}>{rankBasis}</span>
        {clearHref ? (
          <>
            <span style={{ color: 'rgba(255,255,255,0.4)' }} aria-hidden="true">
              ·
            </span>
            <Link
              href={clearHref}
              className="underline underline-offset-2 transition-opacity hover:opacity-80"
              style={{ color: 'var(--color-primary)' }}
            >
              Clear filters
            </Link>
          </>
        ) : null}
      </div>
    </header>
  )
}
