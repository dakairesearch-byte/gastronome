import type { Metadata } from 'next'

export const metadata: Metadata = {
  // Brand suffix comes from the root layout title template ('%s · Gastronome').
  title: 'Privacy Policy',
  description:
    'How Gastronome collects, uses, and protects your data, and how it aggregates third-party restaurant information.',
}

// TODO(legal): This is a pre-launch draft. Have legal counsel review before public launch.

const LAST_UPDATED = '2026-05-31'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2
        className="mb-4"
        style={{
          color: 'var(--color-text)',
          fontFamily: 'var(--font-heading)',
          fontWeight: 400,
          letterSpacing: '-0.01em',
          fontSize: '1.5rem',
          lineHeight: 1.2,
        }}
      >
        {title}
      </h2>
      <div
        className="space-y-4 text-base leading-relaxed"
        style={{
          color: 'var(--color-text-secondary)',
          fontFamily: 'var(--font-body)',
          fontWeight: 300,
          lineHeight: 1.7,
        }}
      >
        {children}
      </div>
    </section>
  )
}

export default function PrivacyPage() {
  return (
    <div style={{ backgroundColor: 'var(--color-background)', minHeight: '100vh' }}>
      <div className="max-w-3xl mx-auto px-6 lg:px-8 py-20 md:py-28">
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
            Legal
          </span>
        </div>

        <h1
          style={{
            color: 'var(--color-text)',
            fontFamily: 'var(--font-heading)',
            fontWeight: 400,
            letterSpacing: '-0.02em',
            lineHeight: 1.05,
            fontSize: '2.5rem',
            marginBottom: '16px',
          }}
        >
          Privacy Policy
        </h1>

        <p
          className="text-sm mb-2"
          style={{
            color: 'var(--color-text-secondary)',
            fontFamily: 'var(--font-body)',
            fontWeight: 300,
          }}
        >
          Last updated {LAST_UPDATED}
        </p>

        <div
          className="w-12 h-px mb-10"
          style={{ backgroundColor: 'var(--color-accent)' }}
        />

        <div
          className="mb-12 p-5 rounded-sm border"
          style={{
            backgroundColor: 'var(--color-surface)',
            borderColor: 'var(--color-border)',
          }}
        >
          <p
            className="text-base leading-relaxed"
            style={{
              color: 'var(--color-text-secondary)',
              fontFamily: 'var(--font-body)',
              fontWeight: 300,
              lineHeight: 1.7,
            }}
          >
            Gastronome is a restaurant-discovery tool that aggregates and
            displays publicly available ratings and editorial recognition from
            third-party sources. Gastronome is pre-launch; this policy describes
            our current and intended practices and may change before and after
            launch.
          </p>
        </div>

        <Section title="Account Data We Collect">
          <p>
            When you create an account, we collect and store the information
            needed to operate your account, including:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Your email address, used to sign in and to contact you.</li>
            <li>
              Profile information you provide, such as a display name and any
              onboarding preferences.
            </li>
            <li>
              Your home city, used to personalize the restaurants and content we
              surface.
            </li>
            <li>
              Your collections and bookmarks — the restaurants you save and how
              you organize them.
            </li>
          </ul>
        </Section>

        <Section title="Third-Party Data We Aggregate and Display">
          <p>
            Gastronome is a data aggregator. We collect, organize, and display
            restaurant ratings, accolades, editorial coverage, and related media
            from third-party sources, with attribution to each source. These
            sources include, among others:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Google (Google Places ratings and reviews)</li>
            <li>Yelp</li>
            <li>the Michelin Guide</li>
            <li>the James Beard Foundation</li>
            <li>Eater</li>
            <li>The Infatuation</li>
            <li>TikTok</li>
            <li>Instagram</li>
          </ul>
          <p>
            This third-party content remains the property of its respective
            owners and is displayed for informational and discovery purposes
            with attribution to its source. Gastronome does not claim ownership
            of third-party ratings, reviews, photographs, or video.
          </p>
        </Section>

        <Section title="Cookies and Authentication Sessions">
          <p>
            We use cookies and similar browser storage to keep you signed in and
            to maintain your authenticated session. These are necessary for the
            app to function. We do not use these mechanisms to build advertising
            profiles.
          </p>
        </Section>

        <Section title="How We Use Your Data">
          <p>
            We use your account data to authenticate you, personalize the
            restaurants and content we show, save your collections and
            bookmarks, and communicate with you about your account and the
            service.
          </p>
        </Section>

        <Section title="Account Deletion">
          <p>
            You may request deletion of your account and associated personal
            data at any time. On deletion, we remove your profile information,
            home-city preference, and collections from our active systems.
            Aggregated third-party restaurant data is not personal to you and is
            not affected by account deletion.
          </p>
          <p>
            {/* TODO(legal): confirm final contact address and deletion SLA before launch. */}
            To request deletion or to ask any question about this policy, contact
            us at{' '}
            <a
              href="mailto:privacy@gastronome.app"
              style={{ color: 'var(--color-accent)' }}
            >
              privacy@gastronome.app
            </a>
            .
          </p>
        </Section>

        <Section title="Pre-Launch Notice">
          <p>
            Gastronome is in a pre-launch phase. Features, data sources, and
            this policy are evolving. We will update the &ldquo;Last
            updated&rdquo; date above when this policy changes.
          </p>
        </Section>
      </div>
    </div>
  )
}
