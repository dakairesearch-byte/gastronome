'use client'

import { useState } from 'react'
import Link from 'next/link'
import { MapPin, Star } from 'lucide-react'
import type { Restaurant } from '@/types/database'

interface CityFeature {
  city: string
  shortLabel: string
  restaurant: Restaurant | null
  /** "Brooklyn, NY" — built server-side. */
  locationLabel: string
  /** Live restaurant count for the city. */
  cityCount: number
}

interface FeaturedCityShowcaseProps {
  cities: CityFeature[]
  defaultCity: string
}

/**
 * Figma "Iconic Dining" — city tabs that swap a single featured-restaurant
 * card. Two-column layout: image on the left, editorial copy on the right.
 *
 * The card shows the top-trending restaurant for the selected city (already
 * scored upstream and passed in via props), so this component is purely
 * presentational selection state.
 */
export default function FeaturedCityShowcase({
  cities,
  defaultCity,
}: FeaturedCityShowcaseProps) {
  const [selected, setSelected] = useState(
    cities.find((c) => c.city === defaultCity)?.city ??
      cities[0]?.city ??
      ''
  )

  const current = cities.find((c) => c.city === selected) ?? cities[0]
  if (!current) return null

  const r = current.restaurant
  const photo =
    r?.photo_url || r?.google_photo_url || r?.yelp_photo_url || null
  const rating = r?.google_rating ?? r?.yelp_rating ?? null

  return (
    <section className="mb-24">
      {/* Centered editorial header */}
      <div className="text-center mb-10">
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
            Explore by City
          </span>
        </div>
        <h2
          className="text-3xl sm:text-4xl lg:text-5xl mb-4"
          style={{
            color: 'var(--color-text)',
            fontFamily: "'Spectral', serif",
            fontWeight: 400,
            letterSpacing: '-0.01em',
            lineHeight: 1.15,
          }}
        >
          Iconic Dining
        </h2>
        <div
          className="w-12 h-px mx-auto"
          style={{ backgroundColor: 'var(--color-accent)' }}
        />
      </div>

      {/* City tabs */}
      <div className="flex flex-wrap items-center justify-center gap-3 mb-10">
        {cities.map((c) => {
          const active = c.city === selected
          return (
            <button
              key={c.city}
              type="button"
              onClick={() => setSelected(c.city)}
              className="px-5 py-2 text-xs uppercase rounded-full transition-all"
              style={{
                fontFamily: "'DM Sans', sans-serif",
                letterSpacing: '0.16em',
                fontWeight: active ? 500 : 400,
                backgroundColor: active ? 'var(--color-primary)' : 'transparent',
                color: active ? '#fff' : 'var(--color-text-secondary)',
                border: active ? '1px solid var(--color-primary)' : '1px solid var(--color-border)',
              }}
            >
              {c.shortLabel}
            </button>
          )
        })}
      </div>

      {/* Featured city card */}
      {r ? (
        <Link
          href={`/restaurants/${r.id}`}
          className="block overflow-hidden rounded-sm shadow-md transition-shadow hover:shadow-2xl group"
          style={{ backgroundColor: 'var(--color-surface)' }}
        >
          <div className="grid lg:grid-cols-2 gap-0">
            <div className="relative overflow-hidden aspect-[4/3] lg:aspect-auto">
              {photo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={photo}
                  alt=""
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
              ) : (
                <div
                  className="w-full h-full flex items-center justify-center text-6xl"
                  style={{
                    backgroundColor: 'var(--color-border)',
                    color: 'var(--color-text-secondary)',
                    fontFamily: "'Spectral', serif",
                  }}
                >
                  {r.name.charAt(0)}
                </div>
              )}
            </div>

            <div className="p-10 lg:p-12 flex flex-col justify-center">
              <div className="mb-4 flex items-center gap-3">
                <span
                  className="text-xs uppercase"
                  style={{
                    color: 'var(--color-accent)',
                    fontFamily: "'DM Sans', sans-serif",
                    letterSpacing: '0.18em',
                    fontWeight: 500,
                  }}
                >
                  Featured in {current.shortLabel}
                </span>
              </div>

              <h3
                className="text-3xl sm:text-4xl mb-5"
                style={{
                  color: 'var(--color-text)',
                  fontFamily: "'Spectral', serif",
                  fontWeight: 500,
                  letterSpacing: '-0.01em',
                }}
              >
                {r.name}
              </h3>

              <div
                className="flex items-center gap-4 flex-wrap mb-6"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                <span
                  className="text-sm uppercase"
                  style={{
                    color: 'var(--color-accent)',
                    fontFamily: "'DM Sans', sans-serif",
                    letterSpacing: '0.12em',
                    fontWeight: 500,
                  }}
                >
                  {r.cuisine && r.cuisine !== 'Restaurant' ? r.cuisine : 'Restaurant'}
                </span>
                {r.neighborhood && (
                  <span className="flex items-center gap-1.5 text-sm" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                    <MapPin className="h-3.5 w-3.5" />
                    {r.neighborhood}
                  </span>
                )}
              </div>

              {r.description && (
                <p
                  className="text-base mb-8"
                  style={{
                    color: 'var(--color-text-secondary)',
                    fontFamily: "'DM Sans', sans-serif",
                    fontWeight: 300,
                    lineHeight: 1.7,
                  }}
                >
                  {r.description}
                </p>
              )}

              <div
                className="flex items-center justify-between pt-6 border-t"
                style={{ borderColor: 'var(--color-border)' }}
              >
                {rating != null ? (
                  <div className="flex items-center gap-2">
                    <Star
                      className="h-5 w-5 fill-current"
                      style={{ color: 'var(--color-primary)' }}
                    />
                    <span
                      className="text-base"
                      style={{
                        color: 'var(--color-text)',
                        fontFamily: "'DM Sans', sans-serif",
                        fontWeight: 500,
                      }}
                    >
                      {rating.toFixed(1)}
                    </span>
                  </div>
                ) : (
                  <span
                    className="text-xs"
                    style={{
                      color: 'var(--color-text-secondary)',
                      fontFamily: "'DM Sans', sans-serif",
                    }}
                  >
                    No rating yet
                  </span>
                )}
                <span
                  className="text-xs uppercase"
                  style={{
                    color: 'var(--color-text-secondary)',
                    fontFamily: "'DM Sans', sans-serif",
                    letterSpacing: '0.16em',
                  }}
                >
                  {current.cityCount.toLocaleString()} restaurants in {current.shortLabel}
                </span>
              </div>
            </div>
          </div>
        </Link>
      ) : (
        <div
          className="p-12 text-center rounded-sm"
          style={{ backgroundColor: 'var(--color-surface)' }}
        >
          <p
            className="text-sm"
            style={{
              color: 'var(--color-text-secondary)',
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            No featured restaurant for {current.shortLabel} yet.
          </p>
        </div>
      )}
    </section>
  )
}
