/**
 * Editorial section header — the Figma design's signature pattern:
 * small uppercase accent label → large Spectral heading → thin accent divider.
 */

interface SectionHeaderProps {
  label?: string
  title: string
  className?: string
}

export default function SectionHeader({ label, title, className = '' }: SectionHeaderProps) {
  return (
    <div className={`mb-3 ${className}`}>
      {label && (
        <div className="mb-2">
          <span
            className="text-xs uppercase tracking-widest"
            style={{
              color: 'var(--color-accent)',
              fontFamily: "'DM Sans', sans-serif",
              letterSpacing: '0.15em',
              fontWeight: 500,
            }}
          >
            {label}
          </span>
        </div>
      )}
      <h2
        className="text-3xl sm:text-4xl mb-3"
        style={{
          color: 'var(--color-text)',
          fontFamily: "'Spectral', serif",
          fontWeight: 400,
          letterSpacing: '-0.01em',
        }}
      >
        {title}
      </h2>
      <div className="w-12 h-px" style={{ backgroundColor: 'var(--color-accent)' }} />
    </div>
  )
}
