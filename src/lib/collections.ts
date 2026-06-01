/**
 * Restaurant bookmarking + collections.
 *
 * Storage model: localStorage is the SYNCHRONOUS source of truth for
 * the UI (so the hooks below stay sync and consumers don't change),
 * with a best-effort write-through to Supabase when the user is signed
 * in. This gives cross-device persistence without rewriting every
 * consumer to be async.
 *
 *   - When signed in (see `initCollectionsSync`), we pull the user's
 *     server-side favorites/collections into the localStorage cache. On
 *     a first-ever sign-in where the server is empty but local has data,
 *     we migrate the local data UP to the server instead of clobbering
 *     it.
 *   - Every mutation writes localStorage immediately (instant UI) and
 *     then fires a best-effort Supabase write. If Supabase fails — table
 *     missing (migration not yet applied), offline, RLS, signed out —
 *     the error is swallowed and the app behaves exactly as the old
 *     localStorage-only version did.
 *   - On sign-out we clear the local cache so one user's saves don't
 *     leak to the next user on a shared device.
 *
 * Two independent slots: a flat `favorites` bookmark list and named
 * `collections`. A restaurant can be favorited without being in any
 * collection, or in many collections without being favorited.
 *
 * All mutations fan out via custom window events so multiple mounted
 * instances re-read from the same store without a React-context round
 * trip.
 */

import { useSyncExternalStore } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'

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
 * A full UUID so client-created collection ids match the `uuid` primary
 * key in `user_collections` server-side (we insert with an explicit id
 * to avoid a round-trip for the id). Falls back to a uuid-shaped random
 * string on older browsers lacking `crypto.randomUUID`.
 */
function makeId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  // RFC4122-ish fallback; uniqueness within a user's own list is enough.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

// ---------- Supabase sync layer (best-effort) ----------

type AnySupabase = SupabaseClient
let _supabase: AnySupabase | null = null
let _userId: string | null = null

/**
 * Mirror a write to Supabase without ever blocking or breaking the UI,
 * but — unlike a true fire-and-forget — surface failures to the console
 * and retry once on transient errors so a flaky network doesn't silently
 * drop a save. Returns a promise resolving to a status so callers that
 * care (e.g. the migration path) can await it.
 *
 * `label` identifies the operation in logs.
 */
async function bestEffort(
  fn: () => PromiseLike<{ error: unknown } | unknown> | undefined,
  label = 'collections-sync'
): Promise<{ ok: boolean; error?: unknown }> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await Promise.resolve(fn())
      const error =
        res && typeof res === 'object' && 'error' in res
          ? (res as { error: unknown }).error
          : null
      if (!error) return { ok: true }
      // PostgREST returns an error object rather than throwing; log it and
      // retry once (covers transient 5xx / network blips). Persistent
      // failures (table missing, RLS, offline) fall through after retry.
      if (attempt === 0) continue
      console.warn(`[${label}] write failed:`, error)
      return { ok: false, error }
    } catch (err) {
      if (attempt === 0) continue
      console.warn(`[${label}] write threw:`, err)
      return { ok: false, error: err }
    }
  }
  return { ok: false }
}

/**
 * Pull server state into the local cache on sign-in. On a first-ever
 * sign-in (server empty, local non-empty) we migrate local → server
 * rather than wiping the user's existing local saves.
 */
export async function initCollectionsSync(
  supabase: AnySupabase,
  userId: string
): Promise<void> {
  _supabase = supabase
  _userId = userId

  try {
    const [favRes, colRes, itemRes] = await Promise.all([
      supabase
        .from('user_favorites')
        .select('restaurant_id, created_at')
        .order('created_at', { ascending: false }),
      supabase
        .from('user_collections')
        .select('id, name, created_at, updated_at')
        .order('created_at', { ascending: false }),
      supabase.from('user_collection_items').select('collection_id, restaurant_id, added_at'),
    ])

    // If any query errored (e.g. tables not yet created), abort the sync
    // silently and stay in localStorage-only mode.
    if (favRes.error || colRes.error || itemRes.error) return

    const serverFavorites = (favRes.data ?? []).map((r) => r.restaurant_id as string)
    const itemsByCollection = new Map<string, string[]>()
    for (const it of itemRes.data ?? []) {
      const arr = itemsByCollection.get(it.collection_id as string) ?? []
      arr.push(it.restaurant_id as string)
      itemsByCollection.set(it.collection_id as string, arr)
    }
    const serverCollections: Collection[] = (colRes.data ?? []).map((c) => ({
      id: c.id as string,
      name: c.name as string,
      restaurantIds: itemsByCollection.get(c.id as string) ?? [],
      createdAt: (c.created_at as string) ?? now(),
      updatedAt: (c.updated_at as string) ?? now(),
    }))

    const localFavorites = readFavorites()
    const localCollections = readCollections()

    // Push any local-only saves UP to the server BEFORE we overwrite the
    // local cache with server state. Without this, a second device that
    // had its own unsynced local saves would lose them the moment it
    // signed in (the server snapshot would clobber the local cache). By
    // unioning first, the server ends up holding the superset and the
    // re-read below reflects everything. Upserts with ignoreDuplicates
    // make this idempotent, so it's safe to run on every sign-in, not
    // just the first.
    const serverFavSet = new Set(serverFavorites)
    const localOnlyFavorites = localFavorites.filter((rid) => !serverFavSet.has(rid))
    for (const rid of localOnlyFavorites) {
      void bestEffort(
        () =>
          supabase.from('user_favorites').upsert(
            { user_id: userId, restaurant_id: rid },
            { onConflict: 'user_id,restaurant_id', ignoreDuplicates: true }
          ),
        'sync-favorite-up'
      )
    }

    const serverColById = new Map(serverCollections.map((c) => [c.id, c]))
    for (const col of localCollections) {
      const serverCol = serverColById.get(col.id)
      // Create the collection server-side if it only exists locally.
      if (!serverCol) {
        void bestEffort(
          () =>
            supabase.from('user_collections').upsert(
              { id: col.id, user_id: userId, name: col.name },
              { onConflict: 'id' }
            ),
          'sync-collection-up'
        )
      }
      // Push any membership rows the server doesn't already have.
      const serverItemSet = new Set(serverCol?.restaurantIds ?? [])
      for (const rid of col.restaurantIds) {
        if (serverItemSet.has(rid)) continue
        void bestEffort(
          () =>
            supabase.from('user_collection_items').upsert(
              { collection_id: col.id, restaurant_id: rid },
              { onConflict: 'collection_id,restaurant_id', ignoreDuplicates: true }
            ),
          'sync-collection-item-up'
        )
      }
    }

    // Build the unioned view locally so the cache reflects both sides
    // immediately (the server upserts above are async/best-effort).
    // localOnlyFavorites is already disjoint from serverFavorites; place
    // them first so the most-recently-saved (local) entries stay near the
    // front of the "Your Favorites" rail.
    const unionedFavorites = [...localOnlyFavorites, ...serverFavorites]
    const mergedCollections: Collection[] = serverCollections.map((c) => ({ ...c }))
    const mergedById = new Map(mergedCollections.map((c) => [c.id, c]))
    for (const col of localCollections) {
      const existing = mergedById.get(col.id)
      if (!existing) {
        mergedCollections.push({ ...col })
        mergedById.set(col.id, col)
        continue
      }
      // Union membership, preserving server order then appending local-only ids.
      const seen = new Set(existing.restaurantIds)
      for (const rid of col.restaurantIds) {
        if (!seen.has(rid)) {
          existing.restaurantIds.push(rid)
          seen.add(rid)
        }
      }
    }

    writeFavorites(unionedFavorites)
    writeCollections(mergedCollections)
  } catch {
    // Network or unexpected error — stay in localStorage-only mode.
  }
}

/** Clear sync state + local cache on sign-out (avoid cross-user leak). */
export function teardownCollectionsSync(): void {
  _supabase = null
  _userId = null
  writeFavorites([])
  writeCollections([])
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
  try {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(ids.slice(0, 200)))
  } catch {
    // Best effort — private browsing or quota exceeded.
  }
  try {
    window.dispatchEvent(new Event(FAVORITES_EVENT))
  } catch {
    // No-op.
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
 * Writes localStorage synchronously, then mirrors to Supabase when
 * signed in (best-effort).
 */
export function toggleFavorite(restaurantId: string): boolean {
  const favs = readFavorites()
  const idx = favs.indexOf(restaurantId)
  if (idx >= 0) {
    favs.splice(idx, 1)
    writeFavorites(favs)
    if (_supabase && _userId) {
      const sb = _supabase
      const uid = _userId
      void bestEffort(
        () =>
          sb
            .from('user_favorites')
            .delete()
            .eq('user_id', uid)
            .eq('restaurant_id', restaurantId),
        'unfavorite'
      )
    }
    return false
  }
  favs.unshift(restaurantId)
  writeFavorites(favs)
  if (_supabase && _userId) {
    const sb = _supabase
    const uid = _userId
    void bestEffort(
      () =>
        sb.from('user_favorites').upsert(
          { user_id: uid, restaurant_id: restaurantId },
          { onConflict: 'user_id,restaurant_id', ignoreDuplicates: true }
        ),
      'favorite'
    )
  }
  return true
}

// ---------- Collections API ----------

export function getCollections(): Collection[] {
  return readCollections()
}

/**
 * Create a new collection with the given display name. Throws if the
 * name is empty after trimming. No uniqueness check on name.
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
  if (_supabase && _userId) {
    const sb = _supabase
    const uid = _userId
    void bestEffort(
      () =>
        sb.from('user_collections').insert({
          id: collection.id,
          user_id: uid,
          name: collection.name,
        }),
      'create-collection'
    )
  }
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
  if (_supabase && _userId) {
    const sb = _supabase
    const uid = _userId
    void bestEffort(
      () =>
        sb
          .from('user_collections')
          .update({ name: trimmed.slice(0, 80), updated_at: now() })
          .eq('id', id)
          .eq('user_id', uid),
      'rename-collection'
    )
  }
}

export function deleteCollection(id: string): void {
  writeCollections(readCollections().filter((c) => c.id !== id))
  if (_supabase && _userId) {
    const sb = _supabase
    const uid = _userId
    // ON DELETE CASCADE removes the membership rows server-side.
    void bestEffort(
      () => sb.from('user_collections').delete().eq('id', id).eq('user_id', uid),
      'delete-collection'
    )
  }
}

export function addToCollection(collectionId: string, restaurantId: string): void {
  const collections = readCollections()
  const next = collections.map((c) => {
    if (c.id !== collectionId) return c
    if (c.restaurantIds.includes(restaurantId)) return c
    return {
      ...c,
      restaurantIds: [restaurantId, ...c.restaurantIds],
      updatedAt: now(),
    }
  })
  writeCollections(next)
  if (_supabase && _userId) {
    const sb = _supabase
    void bestEffort(
      () =>
        sb.from('user_collection_items').upsert(
          { collection_id: collectionId, restaurant_id: restaurantId },
          { onConflict: 'collection_id,restaurant_id', ignoreDuplicates: true }
        ),
      'add-to-collection'
    )
  }
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
  if (_supabase && _userId) {
    const sb = _supabase
    void bestEffort(
      () =>
        sb
          .from('user_collection_items')
          .delete()
          .eq('collection_id', collectionId)
          .eq('restaurant_id', restaurantId),
      'remove-from-collection'
    )
  }
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
