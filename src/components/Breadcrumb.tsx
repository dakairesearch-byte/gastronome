import Link from 'next/link'
import { ChevronRight } from 'lucide-react'

export interface Crumb {
  label: string
  /** Omit href on the final (current-page) crumb. */
  href?: string
}

/**
 * Accessible breadcrumb trail. Deep pages (restaurant detail, city
 * pages) previously gave users no hierarchical context — a deep-link
 * from email/social dropped them in with only a generic "Back" button
 * and no sense of where they were. Sweep v2 navigation P1.
 *
 * The last crumb is rendered as plain text with aria-current="page".
 * `light` mode inverts colors for use over dark hero backgrounds.
 */
export default function Breadcrumb({
  crumbs,
  light = false,
}: {
  crumbs: Crumb[]
  light?: boolean
}) {
  if (crumbs.length === 0) return null

  const baseColor = light ? 'rgba(255,255,255,0.6)' : 'var(--color-text-secondary)'
  const currentColor = light ? 'rgba(255,255,255,0.95)' : 'var(--color-text)'

  return (
    <nav aria-label="Breadcrumb" className="min-w-0">
      <ol
        className="flex items-center gap-1.5 text-xs flex-wrap"
        style={{ fontFamily: 'var(--font-body)' }}
      >
        {crumbs.map((c, i) => {
          const isLast = i === crumbs.length - 1
          return (
            <li key={`${c.label}-${i}`} className="flex items-center gap-1.5 min-w-0">
              {c.href && !isLast ? (
                <Link
                  href={c.href}
                  className="hover:underline underline-offset-2 truncate"
                  style={{ color: baseColor }}
                >
                  {c.label}
                </Link>
              ) : (
                <span
                  aria-current={isLast ? 'page' : undefined}
                  className="truncate"
                  style={{ color: isLast ? currentColor : baseColor, fontWeight: isLast ? 500 : 400 }}
                >
                  {c.label}
                </span>
              )}
              {!isLast && (
                <ChevronRight
                  size={12}
                  aria-hidden="true"
                  style={{ color: baseColor, flexShrink: 0 }}
                />
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
