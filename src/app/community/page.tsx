import { Users } from 'lucide-react'

export const revalidate = 60

/**
 * Community page — currently a "Coming Soon" placeholder per the Figma
 * source. The video feed and review tables exist in the database but the
 * Figma design intentionally hides them until the feature ships.
 */
export default function CommunityPage() {
  return (
    <div style={{ backgroundColor: 'var(--color-background)', minHeight: '100vh' }}>
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-32">
        <div className="flex flex-col items-center justify-center text-center max-w-2xl mx-auto">
          <div
            className="inline-flex items-center justify-center w-32 h-32 mb-10 border rounded-sm"
            style={{
              backgroundColor: 'var(--color-surface)',
              borderColor: 'var(--color-accent)',
            }}
          >
            <Users
              className="w-16 h-16"
              style={{ color: 'var(--color-accent)' }}
              strokeWidth={1.25}
            />
          </div>

          <div className="mb-3">
            <span
              className="text-xs uppercase"
              style={{
                color: 'var(--color-accent)',
                fontFamily: "'DM Sans', sans-serif",
                letterSpacing: '0.18em',
                fontWeight: 500,
              }}
            >
              Members Only
            </span>
          </div>

          <h1
            className="text-6xl md:text-7xl mb-6"
            style={{
              color: 'var(--color-text)',
              fontFamily: "'Spectral', serif",
              fontWeight: 400,
              letterSpacing: '-0.02em',
              lineHeight: 1.05,
            }}
          >
            Coming Soon
          </h1>

          <div
            className="w-12 h-px mb-8"
            style={{ backgroundColor: 'var(--color-accent)' }}
          />

          <p
            className="text-lg leading-relaxed"
            style={{
              color: 'var(--color-text-secondary)',
              fontFamily: "'DM Sans', sans-serif",
              fontWeight: 300,
              lineHeight: 1.7,
            }}
          >
            An exclusive community for discerning food enthusiasts. Connect,
            share, and discover exceptional dining experiences.
          </p>
        </div>
      </div>
    </div>
  )
}
