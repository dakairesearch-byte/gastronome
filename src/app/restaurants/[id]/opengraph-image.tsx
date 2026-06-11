/**
 * Per-restaurant OG Score Card (1200x630).
 *
 * File-convention route: Next.js App Router automatically wires this as the
 * og:image for /restaurants/[id] — no manual openGraph.images entry needed.
 *
 * Two variants:
 *  - SCORED: restaurant name, Gastronome Score badge, source line
 *    ("4.8 Google · 4.5 Yelp · N sources"), accolade marks, city/cuisine.
 *  - SCORELESS (~24% of catalog): "Unrated — be the first to weigh in" copy.
 *
 * ImageResponse renders JSX → PNG via Satori/resvg (Next.js built-in).
 * Constraints: no Tailwind classes, no CSS vars, inline styles only.
 * Fonts: system-font stack resolved to Inter/sans-serif (safe; no fetch needed).
 */

import { ImageResponse } from 'next/og'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { gastronomeScore } from '@/lib/score'

export const runtime = 'nodejs'

export const alt = 'Gastronome restaurant score card'

export const size = {
  width: 1200,
  height: 630,
}

export const contentType = 'image/png'

// Brand tokens (must be literal hex — ImageResponse/Satori doesn't read CSS vars)
const GARNET = '#8E3B46'
const AMBER = '#D4A574'
const CREAM = '#FFFEFB'
const DARK = '#1C1C1C'
const MID = '#5E5E5E'
const SURFACE = '#FFFFFF'
const SURFACE_ALT = '#EFEAE1'
const MICHELIN_RED = '#f87171'
const JBF_AMBER = '#fbbf24'
const EATER_PINK = '#f472b6'

export default async function OGImage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const supabase = await createServerSupabaseClient()
  const { data: restaurant } = await supabase
    .from('restaurants')
    .select(
      'name, cuisine, city, neighborhood, google_rating, yelp_rating, infatuation_rating, beli_score, google_review_count, yelp_review_count, social_score, michelin_stars, michelin_designation, james_beard_winner, eater_38'
    )
    .eq('id', id)
    .single()

  // Fallback: unknown restaurant — show branded error card
  if (!restaurant) {
    return new ImageResponse(
      (
        <div
          style={{
            width: 1200,
            height: 630,
            background: CREAM,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              fontSize: 28,
              color: MID,
              fontFamily: 'sans-serif',
            }}
          >
            Gastronome
          </div>
        </div>
      ),
      { ...size }
    )
  }

  const score = gastronomeScore(restaurant)

  // --- Accolade marks ---
  const michelin = (restaurant.michelin_stars ?? 0) > 0 || !!restaurant.michelin_designation
  const michelinLabel = restaurant.michelin_stars
    ? '★'.repeat(Math.min(restaurant.michelin_stars, 3))
    : restaurant.michelin_designation === 'Bib Gourmand'
    ? 'Bib'
    : restaurant.michelin_designation === 'Recommended'
    ? 'Recommended'
    : 'Michelin'
  const jbf = !!restaurant.james_beard_winner
  const eater = !!restaurant.eater_38

  // --- Location line ---
  const where = [restaurant.neighborhood, restaurant.city].filter(Boolean).join(', ')
  const cuisine =
    restaurant.cuisine && restaurant.cuisine !== 'Restaurant' ? restaurant.cuisine : null

  // --- Source detail line ---
  const sourceItems: string[] = []
  if (typeof restaurant.google_rating === 'number') {
    sourceItems.push(`${restaurant.google_rating.toFixed(1)} Google`)
  }
  if (typeof restaurant.yelp_rating === 'number') {
    sourceItems.push(`${restaurant.yelp_rating.toFixed(1)} Yelp`)
  }
  if (typeof restaurant.infatuation_rating === 'number') {
    sourceItems.push(`${restaurant.infatuation_rating.toFixed(1)} Infatuation`)
  }
  if (typeof restaurant.beli_score === 'number') {
    sourceItems.push(`${restaurant.beli_score.toFixed(1)} Beli`)
  }
  const sourceLine = sourceItems.length
    ? sourceItems.join(' · ') + ` · ${sourceItems.length} source${sourceItems.length !== 1 ? 's' : ''}`
    : ''

  const hasAccolades = michelin || jbf || eater

  return new ImageResponse(
    score ? (
      // ── SCORED VARIANT ──────────────────────────────────────────────────
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

        {/* Main content area */}
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
          {/* Top section: wordmark + accolades */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
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

            {/* Accolades row */}
            {hasAccolades && (
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                {michelin && (
                  <div
                    style={{
                      background: MICHELIN_RED,
                      color: SURFACE,
                      fontSize: 12,
                      fontWeight: 700,
                      padding: '4px 12px',
                      borderRadius: 999,
                      letterSpacing: '0.06em',
                    }}
                  >
                    MICHELIN {michelinLabel}
                  </div>
                )}
                {jbf && (
                  <div
                    style={{
                      background: JBF_AMBER,
                      color: SURFACE,
                      fontSize: 12,
                      fontWeight: 700,
                      padding: '4px 12px',
                      borderRadius: 999,
                      letterSpacing: '0.06em',
                    }}
                  >
                    JAMES BEARD
                  </div>
                )}
                {eater && (
                  <div
                    style={{
                      background: EATER_PINK,
                      color: SURFACE,
                      fontSize: 12,
                      fontWeight: 700,
                      padding: '4px 12px',
                      borderRadius: 999,
                      letterSpacing: '0.06em',
                    }}
                  >
                    EATER 38
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Middle section: name + cuisine/location */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div
              style={{
                fontSize: cuisine ? 12 : 0,
                fontWeight: 600,
                color: MID,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                display: 'flex',
              }}
            >
              {cuisine ?? ''}
            </div>
            <div
              style={{
                fontSize: 62,
                fontWeight: 700,
                color: DARK,
                lineHeight: 1.05,
                letterSpacing: '-0.02em',
                maxWidth: 740,
              }}
            >
              {restaurant.name}
            </div>
            {where && (
              <div
                style={{
                  fontSize: 18,
                  color: MID,
                  fontWeight: 400,
                  letterSpacing: '0.01em',
                }}
              >
                {where}
              </div>
            )}
          </div>

          {/* Bottom section: score badge + source line */}
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
            {/* Score badge */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: MID,
                  letterSpacing: '0.18em',
                  textTransform: 'uppercase',
                }}
              >
                GASTRONOME SCORE
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                <div
                  style={{
                    background: GARNET,
                    color: SURFACE,
                    fontSize: 52,
                    fontWeight: 700,
                    borderRadius: 14,
                    width: 130,
                    height: 84,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    letterSpacing: '-0.02em',
                  }}
                >
                  {score.score.toFixed(1)}
                </div>
                <div
                  style={{
                    fontSize: 22,
                    color: MID,
                    fontWeight: 400,
                    marginBottom: 6,
                  }}
                >
                  / 10
                </div>
              </div>
              {sourceLine && (
                <div
                  style={{
                    fontSize: 13,
                    color: MID,
                    fontWeight: 400,
                    letterSpacing: '0.01em',
                  }}
                >
                  {sourceLine}
                </div>
              )}
            </div>

            {/* Right decorative element: score band / branding block */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-end',
                gap: 6,
              }}
            >
              <div
                style={{
                  width: 240,
                  height: 6,
                  borderRadius: 3,
                  background: SURFACE_ALT,
                  overflow: 'hidden',
                  display: 'flex',
                }}
              >
                <div
                  style={{
                    width: `${(score.score / 10) * 100}%`,
                    height: '100%',
                    background: GARNET,
                    borderRadius: 3,
                  }}
                />
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: MID,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  fontWeight: 500,
                }}
              >
                {score.sourceCount} of {score.maxSources} sources
              </div>
            </div>
          </div>
        </div>
      </div>
    ) : (
      // ── SCORELESS VARIANT ────────────────────────────────────────────────
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

          {/* Name + location */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {cuisine && (
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: MID,
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                  display: 'flex',
                }}
              >
                {cuisine}
              </div>
            )}
            <div
              style={{
                fontSize: 62,
                fontWeight: 700,
                color: DARK,
                lineHeight: 1.05,
                letterSpacing: '-0.02em',
                maxWidth: 740,
              }}
            >
              {restaurant.name}
            </div>
            {where && (
              <div
                style={{
                  fontSize: 18,
                  color: MID,
                  fontWeight: 400,
                }}
              >
                {where}
              </div>
            )}
          </div>

          {/* Unrated call-to-action */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div
              style={{
                // Satori only supports display: flex/none — inline-flex throws
                // at render time. alignSelf: 'flex-start' already shrink-wraps.
                display: 'flex',
                background: SURFACE_ALT,
                borderRadius: 10,
                padding: '14px 20px',
                alignSelf: 'flex-start',
                flexDirection: 'column',
                gap: 4,
              }}
            >
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: GARNET,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                }}
              >
                UNRATED
              </div>
              <div
                style={{
                  fontSize: 16,
                  color: MID,
                  fontWeight: 400,
                }}
              >
                Be the first to weigh in
              </div>
            </div>
          </div>
        </div>
      </div>
    ),
    { ...size }
  )
}
