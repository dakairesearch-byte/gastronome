/**
 * Editorial section header — the Figma v23 pattern:
 * optional small uppercase accent label — large Spectral heading.
 *
 * Figma v23 left-aligns every section title on the home/explore pages and
 * only renders the uppercase eyebrow label on the hero section of each
 * page. The accent divider is only drawn when an eyebrow label is present,
 * otherwise the heading stands alone for a cleaner editorial rhythm.
 */

interface SectionHeaderProps {
  label?: string
  title: string
  align?: 'center' | 'left'
  className?: string
}

export default function SectionHeader({
  label,
  title,
  align = 'left',
  className = '',
}: SectionHeaderProps) {
  const isCenter = align === 'center'
  return (
    <div className={`mb-6 ${isCenter ? 'text-center' : ''} ${className}`}>
      {label && (
        <div className="mb-2">
          <span
            className="text-xs uppercase tracking-wide"
            style={{
              color: 'var(--color-action)',
              fontFamily: 'var(--font-body)',
              fontWeight: 500,
            }}
          >
            {label}
          </span>
        </div>
      )}
      <h2
        className="text-2xl"
        style={{
          color: 'var(--color-text)',
          fontFamily: 'var(--font-heading)',
          fontWeight: 600,
          letterSpacing: '-0.01em',
          lineHeight: 1.2,
        }}
      >
        {title}
      </h2>
    </div>
  )
}
