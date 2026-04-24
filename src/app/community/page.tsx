import { Users } from 'lucide-react'

export const revalidate = 60

export default function CommunityPage() {
  return (
    <div style={{ backgroundColor: 'var(--color-background)', minHeight: '100vh' }}>
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-20 md:py-28">
        <div className="flex flex-col items-center justify-center text-center max-w-2xl mx-auto">
          <div
            className="inline-flex items-center justify-center w-28 h-28 md:w-32 md:h-32 mb-8 md:mb-10 border rounded-sm"
            style={{
              backgroundColor: 'var(--color-surface)',
              borderColor: 'var(--color-accent)',
            }}
          >
            <Users
              className="w-14 h-14 md:w-16 md:h-16"
              style={{ color: 'var(--color-accent)' }}
              strokeWidth={1.25}
            />
          </div>

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
              Members Only
            </span>
          </div>

          <h1
            style={{
              color: 'var(--color-text)',
              fontFamily: 'var(--font-heading)',
              fontWeight: 400,
              letterSpacing: '-0.02em',
              lineHeight: 1.05,
              fontSize: '2.25rem',
              marginBottom: '24px',
            }}
          >
            Coming Soon
          </h1>

          <div
            className="w-12 h-px mb-8"
            style={{ backgroundColor: 'var(--color-accent)' }}
          />

          <p
            className="text-base md:text-lg leading-relaxed"
            style={{
              color: 'var(--color-text-secondary)',
              fontFamily: 'var(--font-body)',
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
