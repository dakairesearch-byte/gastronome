'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'
import Link from 'next/link'
import { Star } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Restaurant } from '@/types/database'

/**
 * "Your Favorites" section — client component.
 * Reads from localStorage favorites list for now (no DB table).
 *
 * The `useSyncExternalStore` read avoids the classic `useEffect(() =>
 * setState(load()))` hydration flash: server and first client render
 * both emit an empty list, and real data flows in only after the store
 * subscription fires.
 */

const STORAGE_KEY = 'gastronome_favorites'
const EVENT = 'gastronome:favorites'

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
  let next: string[]
  let isFav: boolean
  if (idx >= 0) {
    favs.splice(idx, 1)
    next = favs
    isFav = false
  } else {
    favs.unshift(id)
    next = favs.slice(0, 50)
    isFav = true
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  try {
    window.dispatchEvent(new Event(EVENT))
  } catch {
    // Best-effort cross-component notification.
  }
  return isFav
}

// ---- useSyncExternalStore plumbing for the favorites id list ----

function subscribe(listener: () => void): () => void {
  window.addEventListener('storage', listener)
  window.addEventListener(EVENT, listener)
  return () => {
    window.removeEventListener('storage', listener)
    window.removeEventListener(EVENT, listener)
  }
}

let cachedRaw: string | null = null
let cachedIds: string[] = []

function getClientSnapshot(): string[] {
  const raw = localStorage.getItem(STORAGE_KEY) ?? '[]'
  if (raw === cachedRaw) return cachedIds
  cachedRaw = raw
  try {
    cachedIds = JSON.parse(raw)
  } catch {
    cachedIds = []
  }
  return cachedIds
}

const EMPTY: string[] = []
function getServerSnapshot(): string[] {
  return EMPTY
}

export default function FavoritesSection() {
  const ids = useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot)
  const [restaurants, setRestaurants] = useState<Restaurant[]>([])
  const [loading, setLoading] = useState(true)

  // `ids` is a stable reference from the store until favorites change,
  // so keying the effect on the JSON form avoids re-fetching on every
  // re-render while still reacting when the list actually changes.
  const key = ids.slice(0, 6).join(',')

  useEffect(() => {
    let cancelled = false
    async function load() {
      const sliceIds = ids.slice(0, 6)
      if (sliceIds.length === 0) {
        if (!cancelled) {
          setRestaurants([])
          setLoading(false)
        }
        return
      }
      setLoading(true)
      const supabase = createClient()
      const { data, error } = await supabase
        .from('restaurants')
        .select(
          'id, name, cuisine, photo_url, google_photo_url, yelp_photo_url, google_rating, yelp_rating'
        )
        .in('id', sliceIds)
      if (cancelled) return
      if (error) {
        console.error('FavoritesSection load failed:', error)
        setRestaurants([])
        setLoading(false)
        return
      }
      // Supabase returns rows in arbitrary order; re-order to match the
      // stored favorite sequence so the user's most-recent favorite
      // renders first.
      const byId = new Map((data ?? []).map((r) => [r.id, r as Restaurant]))
      const ordered: Restaurant[] = []
      for (const id of sliceIds) {
        const row = byId.get(id)
        if (row) ordered.push(row)
      }
      setRestaurants(ordered)
      setLoading(false)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [key, ids])

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
          style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-body)' }}
        >
          No favorites yet. Explore restaurants and tap the heart to save them.
        </p>
        <Link
          href="/explore"
          className="inline-block px-6 py-2.5 text-xs uppercase tracking-wider font-medium rounded-sm text-white transition-all hover:opacity-90"
          style={{
            fontFamily: 'var(--font-body)',
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
                  fontFamily: 'var(--font-body)',
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
                  fontFamily: 'var(--font-heading)',
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
                    style={{ color: 'var(--color-text)', fontFamily: 'var(--font-body)', fontWeight: 500 }}
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
