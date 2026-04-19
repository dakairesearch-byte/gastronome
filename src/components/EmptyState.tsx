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
}

export default function EmptyState({
  icon: Icon,
  title,
  description,
  ctaText,
  ctaHref,
  onCtaClick,
}: EmptyStateProps) {
  const ctaClass =
    'px-5 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors text-sm font-medium'
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4">
      <div className="w-16 h-16 rounded-full bg-gradient-to-br from-emerald-100 to-teal-100 flex items-center justify-center mb-4">
        <Icon size={28} className="text-emerald-500" />
      </div>
      <h3 className="text-base font-semibold text-gray-900 mb-1 text-center">
        {title}
      </h3>
      <p className="text-sm text-gray-500 text-center mb-5 max-w-sm">
        {description}
      </p>
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
    </div>
  )
}
