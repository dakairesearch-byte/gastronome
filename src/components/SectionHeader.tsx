/**
 * Editorial section header — the Figma design's signature pattern:
 * small uppercase accent label → large Spectral heading → thin accent divider.
 *
 * Defaults to centered (matching the current Figma source). Pass
 * `align="left"` for the few sections that hang the divider on the
 * leading edge.
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
  align = 'center',
  className = '',
}: SectionHeaderProps) {
  const isCenter = align === 'center'
  return (
    <div className={`mb-10 ${isCenter ? 'text-center' : ''} ${className}`}>
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
        className="text-3xl sm:text-4xl lg:text-5xl mb-4"
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
      <div
        className={`w-12 h-px ${isCenter ? 'mx-auto' : ''}`}
        style={{ backgroundColor: 'var(--color-accent)' }}
      />
    </div>
  )
}
