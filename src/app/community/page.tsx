import { Users } from 'lucide-react'
import CommunityWaitlistForm from '@/components/CommunityWaitlistForm'

export const revalidate = 60

/**
 * Community page — waitlist signup while the feature is in development.
 *
 * Previously a dead-end "Coming Soon" placeholder with no CTA, which
 * confused users who arrived via the primary nav (QA bug #7). The new
 * layout keeps the Figma aesthetic but adds a functional waitlist form
 * so visitors can express interest and Claude-the-team can close the
 * loop when the feature ships.
 */
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
              Members Only · Early Access
            </span>
          </div>

          <h1
            className="text-5xl md:text-7xl mb-6"
            style={{
              color: 'var(--color-text)',
              fontFamily: 'var(--font-heading)',
              fontWeight: 400,
              letterSpacing: '-0.02em',
              lineHeight: 1.05,
            }}
          >
            Join the Table
          </h1>

          <div
            className="w-12 h-px mb-8"
            style={{ backgroundColor: 'var(--color-accent)' }}
          />

          <p
            className="text-base md:text-lg leading-relaxed mb-10"
            style={{
              color: 'var(--color-text-secondary)',
              fontFamily: 'var(--font-body)',
              fontWeight: 300,
              lineHeight: 1.7,
            }}
          >
            We&apos;re building an invitation-only community for discerning food
            enthusiasts — reviews you can trust, restaurant-nights with other
            members, and early access to new openings. Add your email to the
            waitlist and we&apos;ll reach out when your invite is ready.
          </p>

          <CommunityWaitlistForm />
        </div>
      </div>
    </div>
  )
}
