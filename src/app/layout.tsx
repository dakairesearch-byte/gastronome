import type { Metadata } from 'next'
import { DM_Sans, Spectral } from 'next/font/google'
import './globals.css'
import Navigation from '@/components/Navigation'
import Footer from '@/components/Footer'
import BottomNav from '@/components/BottomNav'

/**
 * Fonts are loaded via `next/font/google` so they're self-hosted and
 * preloaded rather than pulled in via a render-blocking CSS @import.
 * The `variable` CSS custom properties are referenced from inline
 * `fontFamily` styles across the tree (see globals.css + the numerous
 * `var(--font-dm-sans)` / `var(--font-spectral)` references).
 */
const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-dm-sans',
  display: 'swap',
})

const spectral = Spectral({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-spectral',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Gastronome â Every Restaurant Rating in One Place',
  description:
    'Compare Google, Yelp, The Infatuation, and Michelin ratings side by side. Like Rotten Tomatoes, but for food.',
  keywords:
    'restaurant ratings, restaurant reviews, Google rating, Yelp rating, Michelin stars, Infatuation, dining, food',
  authors: [{ name: 'Gastronome' }],
  icons: {
    icon: '/Logo.jpg',
    shortcut: '/Logo.jpg',
    apple: '/Logo.jpg',
  },
  openGraph: {
    title: 'Gastronome â Every Restaurant Rating in One Place',
    description:
      'Compare Google, Yelp, The Infatuation, and Michelin ratings side by side. Like Rotten Tomatoes, but for food.',
    type: 'website',
    locale: 'en_US',
    images: [
      {
        url: '/Logo.jpg',
        alt: 'Gastronome',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Gastronome â Every Restaurant Rating in One Place',
    description:
      'Compare Google, Yelp, The Infatuation, and Michelin ratings side by side. Like Rotten Tomatoes, but for food.',
    images: ['/Logo.jpg'],
  },
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
        <Navigation />
        <main className="flex-1">{children}</main>
        <Footer />
        <BottomNav />
      </body>
    </html>
  )
}
