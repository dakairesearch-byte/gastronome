/**
 * Site-wide fallback OG image (1200x630).
 *
 * File-convention route: Next.js App Router serves this as the default
 * og:image for any route in the app that doesn't have its own
 * opengraph-image file. Overrides the static /og.jpg set in layout.tsx
 * metadata (file-convention images supersede metadata-declared images
 * in the same segment — root segment applies to all routes unless a
 * nested opengraph-image overrides it).
 *
 * NOTE: layout.tsx openGraph.images still references /og.jpg for routes
 * that don't benefit from this file — this file takes precedence for
 * the root segment. The per-restaurant card is the primary use case;
 * this is the branded fallback when no restaurant-specific card exists.
 */

import { ImageResponse } from 'next/og'

export const runtime = 'nodejs'

export const alt = 'Gastronome — Every Restaurant Rating in One Place'

export const size = {
  width: 1200,
  height: 630,
}

export const contentType = 'image/png'

// Brand tokens (literal hex — Satori doesn't read CSS vars)
const GARNET = '#8E3B46'
const AMBER = '#D4A574'
const CREAM = '#FFFEFB'
const DARK = '#1C1C1C'
const MID = '#5E5E5E'
const SURFACE_ALT = '#EFEAE1'

export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          background: CREAM,
          display: 'flex',
          flexDirection: 'column',
          fontFamily: 'sans-serif',
          position: 'relative',
        }}
      >
        {/* Left garnet accent stripe */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: 8,
            height: 630,
            background: GARNET,
          }}
        />

        {/* Top amber hairline */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 8,
            right: 0,
            height: 3,
            background: AMBER,
          }}
        />

        {/* Main content */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
            paddingLeft: 72,
            paddingRight: 72,
            paddingTop: 64,
            paddingBottom: 56,
            justifyContent: 'space-between',
          }}
        >
          {/* Wordmark */}
          <div
            style={{
              fontSize: 15,
              fontWeight: 600,
              color: AMBER,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
            }}
          >
            GASTRONOME
          </div>

          {/* Hero headline */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div
              style={{
                fontSize: 68,
                fontWeight: 700,
                color: DARK,
                lineHeight: 1.05,
                letterSpacing: '-0.025em',
                maxWidth: 820,
              }}
            >
              Every Restaurant Rating in One Place
            </div>
            <div
              style={{
                fontSize: 22,
                color: MID,
                fontWeight: 400,
                maxWidth: 620,
                lineHeight: 1.5,
              }}
            >
              Google, Yelp, The Infatuation, and Michelin — side by side.
            </div>
          </div>

          {/* Source badges row */}
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            {['Google', 'Yelp', 'Infatuation', 'Michelin'].map((source) => (
              <div
                key={source}
                style={{
                  background: SURFACE_ALT,
                  color: MID,
                  fontSize: 13,
                  fontWeight: 600,
                  padding: '8px 16px',
                  borderRadius: 999,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                }}
              >
                {source}
              </div>
            ))}
            <div
              style={{
                background: GARNET,
                color: '#fff',
                fontSize: 13,
                fontWeight: 700,
                padding: '8px 16px',
                borderRadius: 999,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
              }}
            >
              Gastronome Score
            </div>
          </div>
        </div>
      </div>
    ),
    { ...size }
  )
}
