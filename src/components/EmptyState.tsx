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
   * Visual tone for the icon "halo". Defaults to `neutral` (brand
   * accent); pass `attention` for failure / not-found states where the
   * accent would read as success-coded. Sweep v2 empty-states QW.
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
  // Token-bound colors live in inline `style` (Tailwind v4 can't hover-swap
  // a CSS-var background cleanly); layout/spacing stay in className.
  const ctaClass =
    'px-5 py-2 rounded-lg transition-colors text-sm font-medium gastro-accent-cta'
  const ctaStyle = {
    backgroundColor: 'var(--color-accent)',
    color: 'var(--color-on-accent)',
  }
  const secondaryClass =
    'px-5 py-2 text-sm font-medium underline-offset-4 hover:underline transition-colors'
  // `attention` halo keeps amber (failure semantics, not an accent); the
  // neutral halo now derives from the brand accent instead of emerald.
  const haloStyle =
    tone === 'attention'
      ? { backgroundColor: 'color-mix(in srgb, var(--color-accolade-jbf) 18%, transparent)', color: 'var(--color-accolade-jbf)' }
      : { backgroundColor: 'color-mix(in srgb, var(--color-accent) 16%, transparent)', color: 'var(--color-accent)' }

  return (
    <div className="flex flex-col items-center justify-center py-12 px-4">
      <div
        className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
        style={haloStyle}
      >
        <Icon size={28} aria-hidden="true" />
      </div>
      <h3 className="text-base font-semibold mb-1 text-center" style={{ color: 'var(--color-text)' }}>
        {title}
      </h3>
      <p className="text-sm text-center mb-5 max-w-sm" style={{ color: 'var(--color-text-secondary)' }}>
        {description}
      </p>
      <div className="flex flex-col sm:flex-row items-center gap-2">
        {ctaText && ctaHref && (
          <Link href={ctaHref} className={ctaClass} style={ctaStyle}>
            {ctaText}
          </Link>
        )}
        {ctaText && !ctaHref && onCtaClick && (
          <button type="button" onClick={onCtaClick} className={ctaClass} style={ctaStyle}>
            {ctaText}
          </button>
        )}
        {secondaryCtaText && secondaryCtaHref && (
          <Link href={secondaryCtaHref} className={secondaryClass} style={{ color: 'var(--color-text-secondary)' }}>
            {secondaryCtaText}
          </Link>
        )}
        {secondaryCtaText && !secondaryCtaHref && onSecondaryCtaClick && (
          <button type="button" onClick={onSecondaryCtaClick} className={secondaryClass} style={{ color: 'var(--color-text-secondary)' }}>
            {secondaryCtaText}
          </button>
        )}
      </div>
    </div>
  )
}
