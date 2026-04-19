/**
 * Restaurant bookmarking + collections — client-side only.
 *
 * Two independent storage slots:
 *   1. `gastronome_favorites` — flat ordered list of ids, the quick
 *      "bookmark" toggle surfaced on the home page.
 *   2. `gastronome_collections` — named buckets so users can sort
 *      their bookmarks (Date Night, Quick Lunch, Visited, …).
 *
 * Favorites and collection membership are independent: a restaurant
 * can be favorited without being in any collection, or in many
 * collections without being favorited. This matches how most
 * consumer bookmarking UIs work (Instagram saves, Pinterest boards).
 *
 * All mutations fan out via a custom `gastronome:collections` window
 * event so multiple mounted instances re-read from the same store
 * without a round-trip through React context.
 */

import { useSyncExternalStore } from 'react'

const FAVORITES_KEY = 'gastronome_favorites'
const COLLECTIONS_KEY = 'gastronome_collections'
const FAVORITES_EVENT = 'gastronome:favorites'
const COLLECTIONS_EVENT = 'gastronome:collections'

/** A named list of restaurant ids. */
export interface Collection {
  id: string
  name: string
  restaurantIds: string[]
  createdAt: string
  updatedAt: string
}

// ---------- Pure helpers ----------

function now(): string {
  return new Date().toISOString()
}

/**
 * 12-char base36 id derived from `crypto.randomUUID` where available,
 * falling back to `Math.random` on older browsers. Not a security
 * primitive — it just has to be unique within a user's own list.
 */
function makeId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID().replace(/-/g, '').slice(0, 12)
  }
  return Math.random().toString(36).slice(2, 14)
}

// ---------- Storage read/write ----------

function readFavorites(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(FAVORITES_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

function writeFavorites(ids: string[]) {
  // localStorage.setItem throws in Safari private mode and when the
  // quota is exceeded. Swallow both — the UI will re-render from the
  // prior value via the event below, which is worse than persisting
  // but far better than crashing the page.
  try {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(ids.slice(0, 200)))
  } catch {
    // Best effort — private browsing or quota exceeded.
  }
  try {
    window.dispatchEvent(new Event(FAVORITES_EVENT))
  } catch {
    // No-op; event dispatch shouldn't meaningfully fail at runtime.
  }
}

function readCollections(): Collection[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(COLLECTIONS_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((c): c is Collection =>
        !!c &&
        typeof c === 'object' &&
        typeof c.id === 'string' &&
        typeof c.name === 'string' &&
        Array.isArray(c.restaurantIds)
      )
      .map((c) => ({
        ...c,
        restaurantIds: c.restaurantIds.filter((x): x is string => typeof x === 'string'),
      }))
  } catch {
    return []
  }
}

function writeCollections(collections: Collection[]) {
  try {
    localStorage.setItem(COLLECTIONS_KEY, JSON.stringify(collections))
  } catch {
    // Best effort — private browsing or quota exceeded.
  }
  try {
    window.dispatchEvent(new Event(COLLECTIONS_EVENT))
  } catch {
    // No-op.
  }
}

// ---------- Favorites API (bookmark toggle) ----------

export function getFavorites(): string[] {
  return readFavorites()
}

export function isFavorite(restaurantId: string): boolean {
  return readFavorites().includes(restaurantId)
}

/**
 * Toggle a restaurant in the favorites list. Newly-added favorites go
 * to the front so the home page "Your Favorites" rail shows the
 * most-recently-saved entry first. Returns the new favorited state.
 */
export function toggleFavorite(restaurantId: string): boolean {
  const favs = readFavorites()
  const idx = favs.indexOf(restaurantId)
  if (idx >= 0) {
    favs.splice(idx, 1)
    writeFavorites(favs)
    return false
  }
  favs.unshift(restaurantId)
  writeFavorites(favs)
  return true
}

// ---------- Collections API ----------

export function getCollections(): Collection[] {
  return readCollections()
}

/**
 * Create a new collection with the given display name. Throws if the
 * name is empty after trimming. No uniqueness check on name — users
 * can have two collections called "Favorites" if they really want.
 */
export function createCollection(name: string): Collection {
  const trimmed = name.trim()
  if (!trimmed) throw new Error('Collection name is required')
  const collection: Collection = {
    id: makeId(),
    name: trimmed.slice(0, 80),
    restaurantIds: [],
    createdAt: now(),
    updatedAt: now(),
  }
  const next = [collection, ...readCollections()]
  writeCollections(next)
  return collection
}

export function renameCollection(id: string, name: string): void {
  const trimmed = name.trim()
  if (!trimmed) throw new Error('Collection name is required')
  const collections = readCollections()
  const next = collections.map((c) =>
    c.id === id ? { ...c, name: trimmed.slice(0, 80), updatedAt: now() } : c
  )
  writeCollections(next)
}

export function deleteCollection(id: string): void {
  writeCollections(readCollections().filter((c) => c.id !== id))
}

export function addToCollection(collectionId: string, restaurantId: string): void {
  const collections = readCollections()
  const next = collections.map((c) => {
    if (c.id !== collectionId) return c
    if (c.restaurantIds.includes(restaurantId)) return c
    return {
      ...c,
      // Newest-first so the collection page can render "recently added"
      // naturally without a separate timestamp per membership.
      restaurantIds: [restaurantId, ...c.restaurantIds],
      updatedAt: now(),
    }
  })
  writeCollections(next)
}

export function removeFromCollection(collectionId: string, restaurantId: string): void {
  const collections = readCollections()
  const next = collections.map((c) =>
    c.id !== collectionId
      ? c
      : {
          ...c,
          restaurantIds: c.restaurantIds.filter((id) => id !== restaurantId),
          updatedAt: now(),
        }
  )
  writeCollections(next)
}

/**
 * Toggle a restaurant's membership in a collection. Returns the new
 * membership state (`true` = now in the collection).
 */
export function toggleInCollection(collectionId: string, restaurantId: string): boolean {
  const collections = readCollections()
  const target = collections.find((c) => c.id === collectionId)
  if (!target) return false
  const nowIn = !target.restaurantIds.includes(restaurantId)
  if (nowIn) addToCollection(collectionId, restaurantId)
  else removeFromCollection(collectionId, restaurantId)
  return nowIn
}

/** All collections that already contain the given restaurant. */
export function getCollectionsForRestaurant(restaurantId: string): Collection[] {
  return readCollections().filter((c) => c.restaurantIds.includes(restaurantId))
}

// ---------- React hooks (useSyncExternalStore) ----------
//
// We cache the parsed value keyed by the raw JSON string so repeated
// calls to `getSnapshot` return a stable reference until the underlying
// storage actually changes — useSyncExternalStore throws otherwise.

function subscribe(event: string) {
  return (listener: () => void): (() => void) => {
    window.addEventListener('storage', listener)
    window.addEventListener(event, listener)
    return () => {
      window.removeEventListener('storage', listener)
      window.removeEventListener(event, listener)
    }
  }
}

let cachedFavRaw: string | null = null
let cachedFavValue: string[] = []
function getFavSnapshot(): string[] {
  // localStorage.getItem throws in Safari private mode when the origin
  // has disabled storage. Treat it as an empty favorites list rather
  // than letting the exception bubble up through useSyncExternalStore
  // and crash the subtree.
  let raw: string
  try {
    raw = localStorage.getItem(FAVORITES_KEY) ?? '[]'
  } catch {
    raw = '[]'
  }
  if (raw === cachedFavRaw) return cachedFavValue
  cachedFavRaw = raw
  try {
    const parsed = JSON.parse(raw)
    cachedFavValue = Array.isArray(parsed)
      ? parsed.filter((x): x is string => typeof x === 'string')
      : []
  } catch {
    cachedFavValue = []
  }
  return cachedFavValue
}

let cachedColRaw: string | null = null
let cachedColValue: Collection[] = []
function getColSnapshot(): Collection[] {
  let raw: string
  try {
    raw = localStorage.getItem(COLLECTIONS_KEY) ?? '[]'
  } catch {
    raw = '[]'
  }
  if (raw === cachedColRaw) return cachedColValue
  cachedColRaw = raw
  cachedColValue = readCollections()
  return cachedColValue
}

const EMPTY_FAVS: string[] = []
const EMPTY_COLS: Collection[] = []
const serverFavs = (): string[] => EMPTY_FAVS
const serverCols = (): Collection[] => EMPTY_COLS

/** Subscribe to the favorites list. SSR-safe. */
export function useFavorites(): string[] {
  return useSyncExternalStore(subscribe(FAVORITES_EVENT), getFavSnapshot, serverFavs)
}

/** Subscribe to the full list of collections. SSR-safe. */
export function useCollections(): Collection[] {
  return useSyncExternalStore(subscribe(COLLECTIONS_EVENT), getColSnapshot, serverCols)
}
