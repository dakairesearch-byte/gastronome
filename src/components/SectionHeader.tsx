/**
 * Editorial section header â the Figma v23 pattern:
 * optional small uppercase accent label â large Spectral heading.
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
    <div className={`mb-8 ${isCenter ? 'text-center' : ''} ${className}`}>
      {label && (
        <div className="mb-3">
          <span
            className="text-xs uppercase"
            style={{
              color: 'var(--color-accent)',
              fontFamily: 'var(--font-body)',
              letterSpacing: '0.18em',
              fontWeight: 500,
            }}
          >
            {label}
          </span>
        </div>
      )}
      <h2
        className="text-3xl sm:text-4xl lg:text-5xl"
        style={{
          color: 'var(--color-text)',
          fontFamily: 'var(--font-heading)',
          fontWeight: 400,
          letterSpacing: '-0.01em',
          lineHeight: 1.15,
        }}
      >
        {title}
      </h2>
      {label && (
        <div
          className={`mt-4 w-12 h-px ${isCenter ? 'mx-auto' : ''}`}
          style={{ backgroundColor: 'var(--color-accent)' }}
        />
      )}
    </div>
  )
}
