'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { Restaurant } from '@/types/database'

interface CityGroup {
  city: string
  restaurants: Restaurant[]
}

interface CityTrendingListProps {
  cityGroups: CityGroup[]
  defaultCity: string
}

const CITIES = ['New York', 'Los Angeles', 'Miami', 'Chicago', 'San Francisco']

/**
 * Figma "Trending in NYC" — numbered ranked list with city tabs.
 * Client component for the city selector interaction.
 */
export default function CityTrendingList({
  cityGroups,
  defaultCity,
}: CityTrendingListProps) {
  const [selectedCity, setSelectedCity] = useState(defaultCity)
  const [selectedRank, setSelectedRank] = useState<number | null>(null)

  const group = cityGroups.find((g) => g.city === selectedCity)
  const restaurants = group?.restaurants ?? []

  return (
    <section className="mb-24">
      <div className="mb-2">
        {/* City tabs */}
        <div className="flex flex-wrap gap-2 mb-3">
          {CITIES.map((city) => {
            const active = city === selectedCity
            return (
              <button
                key={city}
                type="button"
                onClick={() => {
                  setSelectedCity(city)
                  setSelectedRank(null)
                }}
                className="px-4 py-1.5 text-xs uppercase tracking-wider rounded-sm transition-all"
                style={{
                  fontFamily: "'DM Sans', sans-serif",
                  letterSpacing: '0.1em',
                  fontWeight: active ? 500 : 400,
                  backgroundColor: active ? 'var(--color-primary)' : 'transparent',
                  color: active ? '#fff' : 'var(--color-text-secondary)',
                  border: active ? 'none' : '1px solid var(--color-border)',
                }}
              >
                {city === 'New York' ? 'NYC' : city === 'Los Angeles' ? 'LA' : city === 'San Francisco' ? 'SF' : city}
              </button>
            )
          })}
        </div>
        <div className="mb-2">
          <span
            className="text-xs uppercase tracking-widest"
            style={{
              color: 'var(--color-accent)',
              fontFamily: "'DM Sans', sans-serif",
              letterSpacing: '0.15em',
              fontWeight: 500,
            }}
          >
            {selectedCity}
          </span>
        </div>
        <h2
          className="text-3xl sm:text-4xl mb-3"
          style={{
            color: 'var(--color-text)',
            fontFamily: "'Spectral', serif",
            fontWeight: 400,
            letterSpacing: '-0.01em',
          }}
        >
          Top 10 Trending
        </h2>
        <div className="w-12 h-px" style={{ backgroundColor: 'var(--color-accent)' }} />
      </div>

      <div className="space-y-2">
        {restaurants.length === 0 && (
          <p
            className="text-sm py-8 text-center"
            style={{ color: 'var(--color-text-secondary)', fontFamily: "'DM Sans', sans-serif" }}
          >
            No trending data for {selectedCity} yet.
          </p>
        )}
        {restaurants.map((r, idx) => {
          const rank = idx + 1
          const rating = r.google_rating ?? r.yelp_rating ?? null
          const selected = selectedRank === rank
          return (
            <Link
              key={r.id}
              href={`/restaurants/${r.id}`}
              onClick={() => setSelectedRank(rank)}
              className="block p-3 cursor-pointer transition-all hover:shadow-lg border-l-2 rounded-sm"
              style={{
                backgroundColor: 'var(--color-surface)',
                borderLeftColor: selected ? 'var(--color-primary)' : 'var(--color-border)',
              }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 flex-1">
                  <div
                    className="text-lg flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-full"
                    style={{
                      backgroundColor: rank <= 3 ? 'rgba(212,165,116,0.2)' : 'rgba(235,235,235,0.5)',
                      color: rank <= 3 ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                      fontFamily: "'Spectral', serif",
                      fontWeight: 600,
                      fontSize: '14px',
                    }}
                  >
                    {rank}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3
                      className="text-lg mb-1 truncate"
                      style={{
                        color: 'var(--color-text)',
                        fontFamily: "'Spectral', serif",
                        fontWeight: 500,
                      }}
                    >
                      {r.name}
                    </h3>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className="text-sm uppercase tracking-wider"
                        style={{
                          color: 'var(--color-accent)',
                          fontFamily: "'DM Sans', sans-serif",
                          letterSpacing: '0.06em',
                        }}
                      >
                        {r.cuisine && r.cuisine !== 'Restaurant' ? r.cuisine : 'Restaurant'}
                      </span>
                      {r.neighborhood && (
                        <>
                          <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>&bull;</span>
                          <span
                            className="text-sm"
                            style={{ color: 'var(--color-text-secondary)', fontFamily: "'DM Sans', sans-serif" }}
                          >
                            {r.neighborhood}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                {rating != null && (
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <span
                      className="text-base"
                      style={{
                        color: 'var(--color-primary)',
                        fontFamily: "'DM Sans', sans-serif",
                        fontWeight: 500,
                      }}
                    >
                      &#9733; {rating.toFixed(1)}
                    </span>
                  </div>
                )}
              </div>
            </Link>
          )
        })}
      </div>
    </section>
  )
}
