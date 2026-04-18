'use client'

import { useEffect, useRef, useState } from 'react'
import { Bookmark, BookmarkCheck, Check, Plus } from 'lucide-react'
import {
  createCollection,
  toggleFavorite,
  toggleInCollection,
  useCollections,
  useFavorites,
} from '@/lib/collections'
import { createClient } from '@/lib/supabase/client'
import { openSignInModal } from '@/components/auth/SignInModalHost'
import type { User as SupabaseUser } from '@supabase/supabase-js'

interface BookmarkButtonProps {
  restaurantId: string
  /**
   * Presentation variant.
   *   - `hero` (default) — translucent white-on-dark pill matching the
   *     dark hero on the restaurant detail page, sits next to Share.
   *   - `card` — smaller, dark-on-light round icon for restaurant cards.
   */
  variant?: 'hero' | 'card'
  className?: string
}

/**
 * Bookmark toggle + "save to collection" popover.
 *
 * Primary tap: toggles the flat favorites list (shows up on the home
 * "Your Favorites" rail). A small ⌄ affordance opens a popover that
 * lets users drop the restaurant into any named collection, or create
 * a new one inline.
 *
 * All state lives in `src/lib/collections.ts` under localStorage — no
 * auth / DB dependency yet, so bookmarks don't sync across devices.
 */
export default function BookmarkButton({
  restaurantId,
  variant = 'hero',
  className = '',
}: BookmarkButtonProps) {
  const favorites = useFavorites()
  const collections = useCollections()
  const [open, setOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [user, setUser] = useState<SupabaseUser | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const rootRef = useRef<HTMLDivElement | null>(null)

  const isFavorite = favorites.includes(restaurantId)

  // Track auth state so Save can show a sign-in prompt instead of silently
  // storing to localStorage when the user isn't logged in.
  useEffect(() => {
    const supabase = createClient()
    let active = true
    supabase.auth.getSession().then(({ data }) => {
      if (active) setUser(data.session?.user ?? null)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_e, session) => {
      if (active) setUser(session?.user ?? null)
    })
    return () => {
      active = false
      listener.subscription.unsubscribe()
    }
  }, [])

  // Auto-dismiss toast after 2s.
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 2000)
    return () => clearTimeout(t)
  }, [toast])

  // Dismiss the popover on outside click / Escape so it behaves like a
  // conventional dropdown. `mousedown` runs before the target element's
  // own click handler so inside-popover clicks aren't lost.
  useEffect(() => {
    if (!open) return
    function onDocMouseDown(e: MouseEvent) {
      if (!rootRef.current) return
      if (!rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDocMouseDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const handleToggleFavorite = () => {
    if (!user) {
      openSignInModal({ mode: 'signin' })
      return
    }
    toggleFavorite(restaurantId)
    setToast(isFavorite ? 'Removed from favorites' : 'Saved to favorites')
  }

  const handleOpenCollections = () => {
    if (!user) {
      openSignInModal({ mode: 'signin' })
      return
    }
    setOpen((v) => !v)
  }

  const handleCreateCollection = () => {
    const trimmed = newName.trim()
    if (!trimmed) {
      setError('Name required')
      return
    }
    if (!user) {
      openSignInModal({ mode: 'signin' })
      return
    }
    try {
      const created = createCollection(trimmed)
      // Auto-add the current restaurant to the newly-made collection —
      // the user clearly wanted it there; skipping the extra click.
      toggleInCollection(created.id, restaurantId)
      setNewName('')
      setError(null)
      setToast(`Added to ${created.name}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create')
    }
  }

  const buttonClass =
    variant === 'hero'
      ? `inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 backdrop-blur-sm rounded-lg text-xs font-medium text-gray-200 border border-white/10 transition-colors ${
          isFavorite ? 'bg-white/20 text-white' : ''
        }`
      : `inline-flex items-center justify-center w-8 h-8 rounded-full bg-white/90 hover:bg-white shadow-md text-gray-700 transition-colors ${
          isFavorite ? 'text-emerald-600' : ''
        }`

  const chevronClass =
    variant === 'hero'
      ? 'inline-flex items-center justify-center w-7 py-1.5 bg-white/10 hover:bg-white/20 backdrop-blur-sm rounded-lg text-xs text-gray-200 border border-white/10 transition-colors'
      : 'inline-flex items-center justify-center w-7 h-8 rounded-full bg-white/90 hover:bg-white shadow-md text-gray-700 text-xs transition-colors'

  return (
    <div ref={rootRef} className={`relative inline-flex items-stretch gap-1 ${className}`}>
      <button
        type="button"
        onClick={handleToggleFavorite}
        aria-pressed={isFavorite}
        aria-label={isFavorite ? 'Remove bookmark' : 'Bookmark'}
        className={buttonClass}
      >
        {isFavorite ? <BookmarkCheck size={14} /> : <Bookmark size={14} />}
        {variant === 'hero' && (isFavorite ? 'Saved' : 'Save')}
      </button>

      <button
        type="button"
        onClick={handleOpenCollections}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Save to collection"
        className={chevronClass}
      >
        ▾
      </button>

      {toast && (
        <div
          role="status"
          className="absolute right-0 top-full mt-2 px-3 py-1.5 rounded-md shadow-lg bg-gray-900 text-white text-xs whitespace-nowrap z-50"
        >
          {toast}
        </div>
      )}

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-2 w-72 rounded-lg shadow-xl border border-gray-200 bg-white text-gray-900 z-50 overflow-hidden"
        >
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <p className="text-xs uppercase tracking-wider font-semibold text-gray-500">
              Save to collection
            </p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="p-1 -mr-1 rounded-sm text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            >
              ✕
            </button>
          </div>

          <div className="max-h-56 overflow-y-auto">
            {collections.length === 0 ? (
              <p className="px-4 py-3 text-sm text-gray-500">
                No collections yet. Create one below.
              </p>
            ) : (
              collections.map((c) => {
                const included = c.restaurantIds.includes(restaurantId)
                return (
                  <button
                    key={c.id}
                    type="button"
                    role="menuitemcheckbox"
                    aria-checked={included}
                    onClick={() => toggleInCollection(c.id, restaurantId)}
                    className="flex items-center justify-between w-full px-4 py-2.5 text-sm hover:bg-gray-50 transition-colors"
                  >
                    <span className="truncate text-gray-800">{c.name}</span>
                    {included ? (
                      <Check size={16} className="text-emerald-600 flex-shrink-0 ml-3" />
                    ) : (
                      <span className="w-4 h-4 rounded border border-gray-300 flex-shrink-0 ml-3" />
                    )}
                  </button>
                )
              })
            )}
          </div>

          <div className="p-3 border-t border-gray-100 bg-gray-50">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newName}
                onChange={(e) => {
                  setNewName(e.target.value)
                  if (error) setError(null)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleCreateCollection()
                  }
                }}
                maxLength={80}
                placeholder="New collection…"
                className="flex-1 px-3 py-2 rounded-md border border-gray-200 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              />
              <button
                type="button"
                onClick={handleCreateCollection}
                disabled={!newName.trim()}
                aria-label="Create collection"
                className="inline-flex items-center justify-center w-9 h-9 rounded-md bg-emerald-500 text-white hover:bg-emerald-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Plus size={16} />
              </button>
            </div>
            {error && <p className="mt-1.5 text-xs text-red-600">{error}</p>}
          </div>
        </div>
      )}
    </div>
  )
}
