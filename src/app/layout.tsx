import type { Metadata, Viewport } from 'next'
import { DM_Sans, Spectral } from 'next/font/google'
import './globals.css'
import Navigation from '@/components/Navigation'
import Footer from '@/components/Footer'
import BottomNav from '@/components/BottomNav'
import SignInModalHost from '@/components/auth/SignInModalHost'
import CollectionsSync from '@/components/CollectionsSync'

/**
 * Fonts are loaded via `next/font/google` so they're self-hosted and
 * preloaded rather than pulled in via a render-blocking CSS @import.
 * The `variable` CSS custom properties are referenced from inline
 * `fontFamily` styles across the tree (see globals.css + the numerous
 * `var(--font-dm-sans)` / `var(--font-spectral)` references).
 */
const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-dm-sans',
  display: 'swap',
})

/**
 * Spectral is used for h1/h2/h3 only — weight 400/500/700 covers every
 * actual use (regular, medium, bold). We also include `italic` for
 * future editorial pull-quotes; without it, any `font-italic` style
 * triggers browser-synthesized faux italic (skewed, no true optical
 * correction) — flagged by typography specialist in v2 sweep.
 */
const spectral = Spectral({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  style: ['normal', 'italic'],
  variable: '--font-spectral',
  display: 'swap',
})

export const metadata: Metadata = {
  // metadataBase makes relative OG/Twitter image URLs resolve to absolute
  // URLs (crawlers reject relative image paths). Falls back to localhost
  // for local dev; production sets NEXT_PUBLIC_SITE_URL.
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
  ),
  title: 'Gastronome — Every Restaurant Rating in One Place',
  description:
    'Compare Google, Yelp, The Infatuation, and Michelin ratings side by side. Like Rotten Tomatoes, but for food.',
  keywords:
    'restaurant ratings, restaurant reviews, Google rating, Yelp rating, Michelin stars, Infatuation, dining, food',
  authors: [{ name: 'Gastronome' }],
  appleWebApp: {
    capable: true,
    title: 'Gastronome',
    statusBarStyle: 'default',
  },
  openGraph: {
    title: 'Gastronome — Every Restaurant Rating in One Place',
    description:
      'Compare Google, Yelp, The Infatuation, and Michelin ratings side by side. Like Rotten Tomatoes, but for food.',
    type: 'website',
    locale: 'en_US',
    images: [
      {
        url: '/og.jpg',
        width: 1200,
        height: 630,
        alt: 'Gastronome',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Gastronome — Every Restaurant Rating in One Place',
    description:
      'Compare Google, Yelp, The Infatuation, and Michelin ratings side by side. Like Rotten Tomatoes, but for food.',
    images: ['/og.jpg'],
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#FFFEFB',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      className={`h-full antialiased scroll-smooth ${dmSans.variable} ${spectral.variable}`}
    >
      <body
        style={{ fontFamily: 'var(--font-body)' }}
        className="min-h-screen flex flex-col"
      >
        {/* Skip-to-content link for keyboard users — visible only on focus.
            Without this, keyboard users Tab through the nav (5+ items) on
            every page load. WCAG 2.4.1. */}
        <a href="#main-content" className="skip-link">
          Skip to content
        </a>
        <Navigation />
        <main
          id="main-content"
          className="flex-1 pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0"
        >
          {children}
        </main>
        <Footer />
        <BottomNav />
        <SignInModalHost />
        <CollectionsSync />
      </body>
    </html>
  )
}
