'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Star } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Restaurant } from '@/types/database'

/**
 * "Your Favorites" section — client component.
 * Reads from localStorage favorites list for now (no DB table).
 */

const STORAGE_KEY = 'gastronome_favorites'

export function getFavorites(): string[] {
  if (typeof window === 'undefined') return []
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
  } catch {
    return []
  }
}

export function toggleFavorite(id: string): boolean {
  const favs = getFavorites()
  const idx = favs.indexOf(id)
  if (idx >= 0) {
    favs.splice(idx, 1)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(favs))
    return false
  }
  favs.unshift(id)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(favs.slice(0, 50)))
  return true
}

export default function FavoritesSection() {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const ids = getFavorites()
      if (ids.length === 0) {
        setLoading(false)
        return
      }
      const supabase = createClient()
      const { data } = await supabase
        .from('restaurants')
        .select('*')
        .in('id', ids.slice(0, 6))
      setRestaurants((data ?? []) as Restaurant[])
      setLoading(false)
    }
    load()
  }, [])

  if (loading) {
    return (
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="animate-shimmer h-16 rounded-sm" />
        ))}
      </div>
    )
  }

  if (restaurants.length === 0) {
    return (
      <div
        className="rounded-sm p-6 text-center"
        style={{ backgroundColor: 'var(--color-surface)' }}
      >
        <p
          className="text-sm mb-3"
          style={{ color: 'var(--color-text-secondary)', fontFamily: "'DM Sans', sans-serif" }}
        >
          No favorites yet. Explore restaurants and tap the heart to save them.
        </p>
        <Link
          href="/explore"
          className="inline-block px-6 py-2.5 text-xs uppercase tracking-wider font-medium rounded-sm text-white transition-all hover:opacity-90"
          style={{
            fontFamily: "'DM Sans', sans-serif",
            letterSpacing: '0.1em',
            backgroundColor: 'var(--color-primary)',
          }}
        >
          Start exploring
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {restaurants.map((r) => {
        const photo = r.photo_url || r.google_photo_url || r.yelp_photo_url || null
        const rating = r.google_rating ?? r.yelp_rating ?? null
        return (
          <Link
            key={r.id}
            href={`/restaurants/${r.id}`}
            className="flex items-center gap-5 p-5 cursor-pointer transition-all hover:shadow-lg rounded-sm"
            style={{ backgroundColor: 'var(--color-surface)' }}
          >
            {photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photo} alt="" className="w-20 h-20 object-cover rounded-sm" />
            ) : (
              <div
                className="w-20 h-20 rounded-sm flex items-center justify-center text-2xl font-bold"
                style={{ backgroundColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}
              >
                {r.name.charAt(0)}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p
                className="text-xs uppercase tracking-wider mb-1"
                style={{
                  color: 'var(--color-accent)',
                  fontFamily: "'DM Sans', sans-serif",
                  letterSpacing: '0.12em',
                  fontWeight: 500,
                }}
              >
                {r.cuisine && r.cuisine !== 'Restaurant' ? r.cuisine : 'Restaurant'}
              </p>
              <h3
                className="text-lg truncate"
                style={{
                  color: 'var(--color-text)',
                  fontFamily: "'Spectral', serif",
                  fontWeight: 500,
                }}
              >
                {r.name}
              </h3>
              {rating != null && (
                <div className="flex items-center gap-1.5 mt-1">
                  <Star className="h-4 w-4 fill-current" style={{ color: 'var(--color-primary)' }} />
                  <span
                    className="text-sm"
                    style={{ color: 'var(--color-text)', fontFamily: "'DM Sans', sans-serif", fontWeight: 500 }}
                  >
                    {rating.toFixed(1)}
                  </span>
                </div>
              )}
            </div>
          </Link>
        )
      })}
    </div>
  )
}
