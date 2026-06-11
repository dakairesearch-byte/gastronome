import type { Metadata } from 'next'

export const metadata: Metadata = {
  // Brand suffix comes from the root layout title template ('%s · Gastronome').
  title: 'Terms of Service',
  description:
    'The terms governing your use of Gastronome, including acceptable use, third-party content, and account terms.',
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

export default function TermsPage() {
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
          Terms of Service
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
            These Terms of Service (&ldquo;Terms&rdquo;) govern your use of
            Gastronome, a restaurant-discovery tool that aggregates publicly
            available ratings and editorial recognition from third-party
            sources. Gastronome is pre-launch; these Terms may change before and
            after launch. By creating an account or using the service, you agree
            to these Terms.
          </p>
        </div>

        <Section title="Acceptable Use">
          <p>You agree to use Gastronome only for lawful purposes. You will not:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              scrape, harvest, or bulk-extract data from the service except as
              expressly permitted;
            </li>
            <li>
              attempt to disrupt, overload, or gain unauthorized access to the
              service or its underlying systems;
            </li>
            <li>
              use the service to infringe the rights of any third party or to
              violate any applicable law; or
            </li>
            <li>
              misrepresent your identity or use another person&rsquo;s account
              without permission.
            </li>
          </ul>
        </Section>

        <Section title="Third-Party Content Disclaimer">
          <p>
            Gastronome aggregates and displays ratings, accolades, editorial
            coverage, photographs, and video from third-party sources including
            Google, Yelp, the Michelin Guide, the James Beard Foundation, Eater,
            The Infatuation, TikTok, and Instagram. This content is provided by
            and remains the property of those sources. We do not author, verify,
            or endorse third-party content, and we are not responsible for its
            accuracy, completeness, or availability. Ratings and accolades may be
            out of date or incomplete.
          </p>
        </Section>

        <Section title="No Warranty">
          <p>
            The service is provided &ldquo;as is&rdquo; and &ldquo;as
            available,&rdquo; without warranties of any kind, whether express or
            implied, including but not limited to warranties of merchantability,
            fitness for a particular purpose, and non-infringement. We do not
            warrant that the service will be uninterrupted, error-free, or that
            any information displayed is accurate or current. Your use of the
            service is at your own risk.
          </p>
        </Section>

        <Section title="Account Terms">
          <p>
            You are responsible for maintaining the confidentiality of your
            account credentials and for all activity that occurs under your
            account. You must provide accurate information when creating an
            account. We may suspend or terminate accounts that violate these
            Terms. You may close your account at any time, as described in our{' '}
            <a href="/privacy" style={{ color: 'var(--color-accent)' }}>
              Privacy Policy
            </a>
            .
          </p>
        </Section>

        <Section title="Governing Law">
          <p>
            {/* TODO(legal): set the governing jurisdiction and venue before launch. */}
            These Terms are governed by the laws of [GOVERNING JURISDICTION TO BE
            DETERMINED], without regard to its conflict-of-laws principles. Any
            disputes will be resolved in the courts located in that jurisdiction.
          </p>
        </Section>

        <Section title="Changes to These Terms">
          <p>
            As a pre-launch product, Gastronome may update these Terms as the
            service evolves. We will update the &ldquo;Last updated&rdquo; date
            above when changes are made. Continued use of the service after a
            change constitutes acceptance of the revised Terms.
          </p>
        </Section>
      </div>
    </div>
  )
}
