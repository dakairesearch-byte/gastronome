import Link from 'next/link'
import { LucideIcon } from 'lucide-react'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description: string
  ctaText?: string
  ctaHref?: string
  /**
   * Optional click handler for the CTA. When provided (and ctaHref is not),
   * the CTA renders as a button instead of a link — useful for in-page
   * actions like "Reset filters".
   */
  onCtaClick?: () => void
  /**
   * Optional secondary CTA — sits next to the primary one. Common pairing
   * is primary="Reset filters" + secondary="Browse all restaurants" so
   * users always have at least one path out of a dead-end state.
   * Sweep v2 empty-states P1: "Mutually exclusive CTAs on no-results".
   */
  secondaryCtaText?: string
  secondaryCtaHref?: string
  onSecondaryCtaClick?: () => void
  /**
   * Visual tone for the icon "halo". Defaults to `neutral` (emerald);
   * pass `attention` for failure / not-found states where green would
   * read as success-coded. Sweep v2 empty-states QW.
   */
  tone?: 'neutral' | 'attention'
}

export default function EmptyState({
  icon: Icon,
  title,
  description,
  ctaText,
  ctaHref,
  onCtaClick,
  secondaryCtaText,
  secondaryCtaHref,
  onSecondaryCtaClick,
  tone = 'neutral',
}: EmptyStateProps) {
  const ctaClass =
    'px-5 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors text-sm font-medium'
  const secondaryClass =
    'px-5 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 underline-offset-4 hover:underline'
  const haloClass =
    tone === 'attention'
      ? 'bg-gradient-to-br from-amber-100 to-orange-100 text-amber-600'
      : 'bg-gradient-to-br from-emerald-100 to-teal-100 text-emerald-500'

  return (
    <div className="flex flex-col items-center justify-center py-12 px-4">
      <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 ${haloClass}`}>
        <Icon size={28} aria-hidden="true" />
      </div>
      <h3 className="text-base font-semibold text-gray-900 mb-1 text-center">
        {title}
      </h3>
      <p className="text-sm text-gray-600 text-center mb-5 max-w-sm">
        {description}
      </p>
      <div className="flex flex-col sm:flex-row items-center gap-2">
        {ctaText && ctaHref && (
          <Link href={ctaHref} className={ctaClass}>
            {ctaText}
          </Link>
        )}
        {ctaText && !ctaHref && onCtaClick && (
          <button type="button" onClick={onCtaClick} className={ctaClass}>
            {ctaText}
          </button>
        )}
        {secondaryCtaText && secondaryCtaHref && (
          <Link href={secondaryCtaHref} className={secondaryClass}>
            {secondaryCtaText}
          </Link>
        )}
        {secondaryCtaText && !secondaryCtaHref && onSecondaryCtaClick && (
          <button type="button" onClick={onSecondaryCtaClick} className={secondaryClass}>
            {secondaryCtaText}
          </button>
        )}
      </div>
    </div>
  )
}
