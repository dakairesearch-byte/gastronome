'use client'

import { useSyncExternalStore } from 'react'
import Link from 'next/link'
import { X } from 'lucide-react'

interface RecentSearch {
  query: string
  time: string // ISO
}

const STORAGE_KEY = 'gastronome_recent_searches'
const MAX_SEARCHES = 5

function loadSearches(): RecentSearch[] {
  if (typeof window === 'undefined') return []
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
  } catch {
    return []
  }
}

function saveSearches(searches: RecentSearch[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(searches.slice(0, MAX_SEARCHES)))
  // Fan out to any other RecentSearches instance mounted in the tree so
  // it re-reads from localStorage via the `storage` listener below.
  try {
    window.dispatchEvent(new Event('gastronome:recent-searches'))
  } catch {
    // Best-effort; event dispatch can't meaningfully fail at runtime.
  }
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return days === 1 ? 'Yesterday' : `${days} days ago`
}

// `useSyncExternalStore` gives us a stable server snapshot (empty list)
// and a subscribe-based client snapshot, so SSR and the first client
// render emit identical HTML. This replaces the `useEffect(() =>
// setState(loadSearches()))` pattern that triggered a hydration flash.

function subscribe(listener: () => void): () => void {
  window.addEventListener('storage', listener)
  window.addEventListener('gastronome:recent-searches', listener)
  return () => {
    window.removeEventListener('storage', listener)
    window.removeEventListener('gastronome:recent-searches', listener)
  }
}

// Cache the parsed list by raw JSON string so we return the same
// reference until the underlying storage changes — otherwise
// `useSyncExternalStore` throws on every render.
let cachedRaw: string | null = null
let cachedValue: RecentSearch[] = []

function getClientSnapshot(): RecentSearch[] {
  const raw = localStorage.getItem(STORAGE_KEY) ?? '[]'
  if (raw === cachedRaw) return cachedValue
  cachedRaw = raw
  try {
    cachedValue = JSON.parse(raw)
  } catch {
    cachedValue = []
  }
  return cachedValue
}

const EMPTY: RecentSearch[] = []
function getServerSnapshot(): RecentSearch[] {
  return EMPTY
}

export default function RecentSearches() {
  const searches = useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot)

  const remove = (idx: number) => {
    const next = searches.filter((_, i) => i !== idx)
    saveSearches(next)
  }

  if (searches.length === 0) {
    return (
      <div>
        <p
          className="text-sm py-4"
          style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-body)' }}
        >
          Your recent searches will appear here.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {searches.slice(0, 3).map((s, i) => (
        <div
          key={`${s.query}-${i}`}
          className="relative p-5 transition-all hover:shadow-lg border-l rounded-sm"
          style={{
            backgroundColor: 'var(--color-surface)',
            borderLeftColor: 'var(--color-accent)',
          }}
        >
          <Link
            href={`/search?q=${encodeURIComponent(s.query)}`}
            className="block pr-8"
          >
            <p
              className="mb-1"
              style={{
                color: 'var(--color-text)',
                fontFamily: 'var(--font-body)',
                fontSize: '15px',
                fontWeight: 400,
              }}
            >
              {s.query}
            </p>
            <p
              className="text-xs uppercase tracking-wider"
              style={{
                color: 'var(--color-text-secondary)',
                fontFamily: 'var(--font-body)',
                letterSpacing: '0.08em',
              }}
            >
              {timeAgo(s.time)}
            </p>
          </Link>
          <button
            type="button"
            aria-label="Remove recent search"
            onClick={() => remove(i)}
            className="absolute top-4 right-4 p-1 rounded-sm hover:bg-gray-100 transition-colors"
          >
            <X size={14} style={{ color: 'var(--color-text-secondary)' }} />
          </button>
        </div>
      ))}
    </div>
  )
}

/**
 * Record a new search query. Call this from the search page / hero
 * search input before navigating so the Recent Searches rail on the
 * homepage actually populates.
 */
export function recordSearch(query: string) {
  const q = query.trim()
  if (!q) return
  const searches = loadSearches()
  const filtered = searches.filter((s) => s.query.toLowerCase() !== q.toLowerCase())
  const next = [{ query: q, time: new Date().toISOString() }, ...filtered].slice(0, MAX_SEARCHES)
  saveSearches(next)
}
