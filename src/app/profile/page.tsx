'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  AlertCircle,
  Bookmark,
  FolderPlus,
  Loader2,
  LogOut,
  Pencil,
  Star,
  Trash2,
} from 'lucide-react'
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import type { City, Profile, Restaurant } from '@/types/database'
import {
  createCollection,
  deleteCollection,
  renameCollection,
  useCollections,
  useFavorites,
} from '@/lib/collections'

/**
 * `/profile` — the user's personal home.
 *
 * Per product direction (2026-04-19), the profile page should ONLY ever
 * show two things:
 *   1. Collections — the restaurants the user has saved, grouped into
 *      Favorites + any named collections they've created.
 *   2. Settings   — account settings (display name, email, username,
 *      home city, creative mode, sign out).
 *
 * Everything social/public (bio, avatar galleries, activity feeds,
 * other-user view) has been moved out of this page. The public view
 * of another user still lives at `/profile/[id]`.
 */

type TabKey = 'collections' | 'settings'

export default function ProfilePage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<TabKey>('collections')

  useEffect(() => {
    let active = true
    ;(async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session) {
        if (active) {
          setUser(null)
          setLoading(false)
        }
        return
      }
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single()
      if (!active) return
      setUser(session.user)
      if (data) setProfile(data)
      setLoading(false)
    })()
    return () => {
      active = false
    }
  }, [supabase])

  if (loading) {
    return (
      <div
        className="flex items-center justify-center min-h-[60vh]"
        style={{ backgroundColor: 'var(--color-background)' }}
      >
        <Loader2 className="animate-spin" size={24} style={{ color: 'var(--color-primary)' }} />
      </div>
    )
  }

  // Middleware should prevent this from being reachable, but render a
  // graceful fallback anyway in case a user hits the page mid-logout.
  if (!user) {
    return (
      <div
        className="flex items-center justify-center min-h-[70vh] px-6"
        style={{ backgroundColor: 'var(--color-background)' }}
      >
        <p
          className="text-sm"
          style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-body)' }}
        >
          You need to be signed in to see your profile.
        </p>
      </div>
    )
  }

  return (
    <div
      className="min-h-screen"
      style={{ backgroundColor: 'var(--color-background)' }}
    >
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
        <header className="mb-8">
          <p
            className="text-xs uppercase mb-2"
            style={{
              color: 'var(--color-accent)',
              fontFamily: 'var(--font-body)',
              letterSpacing: '0.16em',
              fontWeight: 500,
            }}
          >
            Your profile
          </p>
          <h1
            className="text-4xl"
            style={{
              color: 'var(--color-text)',
              fontFamily: 'var(--font-heading)',
              fontWeight: 400,
              letterSpacing: '-0.01em',
            }}
          >
            {profile?.display_name || profile?.username || 'Welcome back'}
          </h1>
        </header>

        <nav
          className="flex gap-1 mb-8"
          style={{ borderBottom: '1px solid var(--color-border)' }}
          role="tablist"
        >
          <TabButton
            active={tab === 'collections'}
            onClick={() => setTab('collections')}
            label="Collections"
          />
          <TabButton
            active={tab === 'settings'}
            onClick={() => setTab('settings')}
            label="Settings"
          />
        </nav>

        {tab === 'collections' ? (
          <CollectionsPanel />
        ) : (
          <SettingsPanel
            user={user}
            profile={profile}
            onProfileChange={setProfile}
            onSignOut={async () => {
              await supabase.auth.signOut()
              router.push('/onboarding')
              router.refresh()
            }}
          />
        )}
      </div>
    </div>
  )
}

/* ---------- Tab button ---------- */

function TabButton({
  active,
  onClick,
  label,
}: {
  active: boolean
  onClick: () => void
  label: string
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className="px-4 py-3 text-xs uppercase transition-colors"
      style={{
        fontFamily: 'var(--font-body)',
        letterSpacing: '0.14em',
        fontWeight: 500,
        color: active ? 'var(--color-text)' : 'var(--color-text-secondary)',
        borderBottom: active
          ? '2px solid var(--color-primary)'
          : '2px solid transparent',
        marginBottom: '-1px',
      }}
    >
      {label}
    </button>
  )
}

/* ---------- Collections panel ---------- */

function CollectionsPanel() {
  const supabase = useMemo(() => createClient(), [])
  const favorites = useFavorites()
  const collections = useCollections()

  const [restaurantsById, setRestaurantsById] = useState<Record<string, Restaurant>>(
    {}
  )
  const [newName, setNewName] = useState('')
  const [adding, setAdding] = useState(false)

  // Every id referenced anywhere in favorites + any collection — fetch
  // once and cache by id so the render loop stays O(1) per lookup.
  const allIds = useMemo(() => {
    const set = new Set<string>(favorites)
    for (const c of collections) for (const id of c.restaurantIds) set.add(id)
    return Array.from(set)
  }, [favorites, collections])

  useEffect(() => {
    if (allIds.length === 0) {
      setRestaurantsById({})
      return
    }
    let active = true
    ;(async () => {
      const { data } = await supabase
        .from('restaurants')
        .select(
          'id, name, cuisine, city, neighborhood, photo_url, google_photo_url, yelp_photo_url, google_rating, yelp_rating'
        )
        .in('id', allIds)
      if (!active || !data) return
      const next: Record<string, Restaurant> = {}
      for (const r of data as Restaurant[]) next[r.id] = r
      setRestaurantsById(next)
    })()
    return () => {
      active = false
    }
  }, [allIds, supabase])

  const handleCreate = () => {
    const trimmed = newName.trim()
    if (!trimmed) return
    try {
      createCollection(trimmed)
      setNewName('')
      setAdding(false)
    } catch {
      // createCollection throws only on empty; we already guard above.
    }
  }

  const isEmpty = favorites.length === 0 && collections.length === 0

  if (isEmpty) {
    return (
      <div
        className="rounded-sm text-center p-10"
        style={{
          backgroundColor: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
        }}
      >
        <Bookmark
          size={28}
          className="mx-auto mb-4"
          style={{ color: 'var(--color-primary)' }}
        />
        <h2
          className="text-xl mb-2"
          style={{
            color: 'var(--color-text)',
            fontFamily: 'var(--font-heading)',
            fontWeight: 400,
          }}
        >
          No collections yet
        </h2>
        <p
          className="text-sm mb-6 max-w-sm mx-auto"
          style={{
            color: 'var(--color-text-secondary)',
            fontFamily: 'var(--font-body)',
            fontWeight: 300,
          }}
        >
          Tap the bookmark icon on any restaurant to save it to your favorites.
          Group picks into custom collections any time.
        </p>
        <Link
          href="/explore"
          className="inline-block px-6 py-2.5 text-xs uppercase rounded-sm text-white transition-opacity hover:opacity-90"
          style={{
            backgroundColor: 'var(--color-primary)',
            fontFamily: 'var(--font-body)',
            letterSpacing: '0.14em',
            fontWeight: 500,
          }}
        >
          Start exploring
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Add collection control */}
      <div className="flex items-center justify-between">
        <p
          className="text-xs uppercase"
          style={{
            color: 'var(--color-text-secondary)',
            fontFamily: 'var(--font-body)',
            letterSpacing: '0.14em',
            fontWeight: 500,
          }}
        >
          {favorites.length + collections.length === 1
            ? '1 list'
            : `${favorites.length > 0 ? 1 : 0} + ${collections.length} lists`}
        </p>

        {adding ? (
          <div className="flex items-center gap-2">
            <input
              autoFocus
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreate()
                if (e.key === 'Escape') {
                  setAdding(false)
                  setNewName('')
                }
              }}
              placeholder="e.g. Date Night"
              style={inputStyle}
              className="px-3 py-1.5 outline-none text-sm"
            />
            <button
              type="button"
              onClick={handleCreate}
              disabled={!newName.trim()}
              className="text-xs uppercase px-3 py-1.5 rounded-sm text-white disabled:opacity-50"
              style={{
                backgroundColor: 'var(--color-primary)',
                fontFamily: 'var(--font-body)',
                letterSpacing: '0.12em',
                fontWeight: 500,
              }}
            >
              Add
            </button>
            <button
              type="button"
              onClick={() => {
                setAdding(false)
                setNewName('')
              }}
              className="text-xs"
              style={{
                color: 'var(--color-text-secondary)',
                fontFamily: 'var(--font-body)',
              }}
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="inline-flex items-center gap-1.5 text-xs uppercase px-3 py-1.5 rounded-sm transition-colors hover:bg-gray-50"
            style={{
              color: 'var(--color-text)',
              border: '1px solid var(--color-border)',
              fontFamily: 'var(--font-body)',
              letterSpacing: '0.12em',
              fontWeight: 500,
            }}
          >
            <FolderPlus size={13} /> New collection
          </button>
        )}
      </div>

      {/* Favorites always first */}
      {favorites.length > 0 && (
        <CollectionSection
          title="Favorites"
          subtitle={`${favorites.length} restaurant${favorites.length !== 1 ? 's' : ''}`}
          restaurantIds={favorites}
          restaurantsById={restaurantsById}
          pinned
        />
      )}

      {/* Custom collections */}
      {collections.map((c) => (
        <CollectionSection
          key={c.id}
          id={c.id}
          title={c.name}
          subtitle={`${c.restaurantIds.length} restaurant${
            c.restaurantIds.length !== 1 ? 's' : ''
          }`}
          restaurantIds={c.restaurantIds}
          restaurantsById={restaurantsById}
        />
      ))}
    </div>
  )
}

function CollectionSection({
  id,
  title,
  subtitle,
  restaurantIds,
  restaurantsById,
  pinned,
}: {
  id?: string
  title: string
  subtitle: string
  restaurantIds: string[]
  restaurantsById: Record<string, Restaurant>
  pinned?: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(title)

  const items = restaurantIds
    .map((rid) => restaurantsById[rid])
    .filter((r): r is Restaurant => !!r)

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <div>
          {editing && id ? (
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={() => {
                const v = draft.trim()
                if (v && v !== title) renameCollection(id, v)
                setEditing(false)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                if (e.key === 'Escape') {
                  setDraft(title)
                  setEditing(false)
                }
              }}
              style={inputStyle}
              className="px-2 py-1 outline-none text-lg"
            />
          ) : (
            <h3
              className="text-lg"
              style={{
                color: 'var(--color-text)',
                fontFamily: 'var(--font-heading)',
                fontWeight: 500,
              }}
            >
              {title}
            </h3>
          )}
          <p
            className="text-xs"
            style={{
              color: 'var(--color-text-secondary)',
              fontFamily: 'var(--font-body)',
            }}
          >
            {subtitle}
          </p>
        </div>

        {id && !pinned && !editing && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => {
                setDraft(title)
                setEditing(true)
              }}
              aria-label={`Rename ${title}`}
              className="p-1.5 rounded-sm transition-colors hover:bg-gray-50"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              <Pencil size={14} />
            </button>
            <button
              type="button"
              onClick={() => {
                if (confirm(`Delete collection "${title}"?`)) deleteCollection(id)
              }}
              aria-label={`Delete ${title}`}
              className="p-1.5 rounded-sm transition-colors hover:bg-gray-50"
              style={{ color: '#9c2a2a' }}
            >
              <Trash2 size={14} />
            </button>
          </div>
        )}
      </div>

      {items.length === 0 ? (
        <p
          className="text-xs italic p-4 rounded-sm"
          style={{
            color: 'var(--color-text-secondary)',
            fontFamily: 'var(--font-body)',
            backgroundColor: 'var(--color-surface)',
            border: '1px dashed var(--color-border)',
          }}
        >
          Empty — add restaurants from any detail page.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {items.map((r) => {
            const photo = r.photo_url || r.google_photo_url || r.yelp_photo_url
            const rating = r.google_rating ?? r.yelp_rating ?? null
            return (
              <Link
                key={r.id}
                href={`/restaurants/${r.id}`}
                className="flex items-center gap-3 p-3 rounded-sm transition-all hover:shadow-sm"
                style={{
                  backgroundColor: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                }}
              >
                {photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={photo}
                    alt=""
                    className="w-14 h-14 object-cover rounded-sm flex-shrink-0"
                  />
                ) : (
                  <div
                    className="w-14 h-14 rounded-sm flex items-center justify-center flex-shrink-0"
                    style={{
                      backgroundColor: 'var(--color-border)',
                      color: 'var(--color-text-secondary)',
                    }}
                  >
                    {r.name.charAt(0)}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p
                    className="text-[10px] uppercase mb-0.5"
                    style={{
                      color: 'var(--color-accent)',
                      fontFamily: 'var(--font-body)',
                      letterSpacing: '0.12em',
                      fontWeight: 500,
                    }}
                  >
                    {r.cuisine && r.cuisine !== 'Restaurant' ? r.cuisine : 'Restaurant'}
                  </p>
                  <p
                    className="truncate text-sm"
                    style={{
                      color: 'var(--color-text)',
                      fontFamily: 'var(--font-heading)',
                      fontWeight: 500,
                    }}
                  >
                    {r.name}
                  </p>
                  <p
                    className="text-xs flex items-center gap-1 mt-0.5"
                    style={{
                      color: 'var(--color-text-secondary)',
                      fontFamily: 'var(--font-body)',
                    }}
                  >
                    {rating != null && (
                      <>
                        <Star
                          size={11}
                          fill="currentColor"
                          style={{ color: 'var(--color-primary)' }}
                        />
                        <span>{rating.toFixed(1)}</span>
                        <span className="mx-1">·</span>
                      </>
                    )}
                    <span className="truncate">
                      {r.neighborhood || r.city || ''}
                    </span>
                  </p>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </section>
  )
}

/* ---------- Settings panel ---------- */

function SettingsPanel({
  user,
  profile,
  onProfileChange,
  onSignOut,
}: {
  user: User
  profile: Profile | null
  onProfileChange: (p: Profile) => void
  onSignOut: () => Promise<void>
}) {
  const supabase = useMemo(() => createClient(), [])
  const [displayName, setDisplayName] = useState(profile?.display_name ?? '')
  const [homeCity, setHomeCity] = useState(profile?.home_city ?? '')
  const [creativeMode, setCreativeMode] = useState(!!profile?.creative_mode_enabled)
  const [cities, setCities] = useState<City[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    let active = true
    ;(async () => {
      const { data } = await supabase
        .from('cities')
        .select('*')
        .eq('is_active', true)
        .order('name')
      if (active) setCities(data ?? [])
    })()
    return () => {
      active = false
    }
  }, [supabase])

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    const trimmed = displayName.trim()
    if (trimmed.length < 2) {
      setError('Display name must be at least 2 characters')
      return
    }
    setSaving(true)
    try {
      const updates = {
        display_name: trimmed,
        home_city: homeCity || null,
        favorite_cities: homeCity ? [homeCity] : [],
        creative_mode_enabled: creativeMode,
        updated_at: new Date().toISOString(),
      }
      const { data, error: updateError } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.id)
        .select('*')
        .single()
      if (updateError) {
        setError('Failed to update settings: ' + updateError.message)
        return
      }
      if (data) onProfileChange(data as Profile)
      setSuccess('Settings saved')
      window.setTimeout(() => setSuccess(''), 2500)
    } catch {
      setError('An unexpected error occurred')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {error && (
        <div
          className="p-3 rounded-sm border text-sm flex items-start gap-2"
          style={{
            backgroundColor: '#fdf2f2',
            borderColor: '#f5c2c2',
            color: '#9c2a2a',
            fontFamily: 'var(--font-body)',
          }}
        >
          <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
          <p>{error}</p>
        </div>
      )}
      {success && (
        <div
          className="p-3 rounded-sm border text-sm"
          style={{
            backgroundColor: '#f0f7f2',
            borderColor: '#c6ddd1',
            color: '#2d6b4d',
            fontFamily: 'var(--font-body)',
          }}
        >
          {success}
        </div>
      )}

      <section
        className="p-6 rounded-sm space-y-5"
        style={{
          backgroundColor: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
        }}
      >
        <h2
          className="text-xs uppercase"
          style={{
            color: 'var(--color-text-secondary)',
            fontFamily: 'var(--font-body)',
            letterSpacing: '0.14em',
            fontWeight: 500,
          }}
        >
          Account
        </h2>

        <Field label="Display name">
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
            maxLength={50}
            style={inputStyle}
            className="w-full px-4 py-2.5 outline-none"
          />
        </Field>

        <Field label="Username">
          <input
            type="text"
            value={profile?.username ?? ''}
            disabled
            style={{ ...inputStyle, backgroundColor: 'var(--color-background)', opacity: 0.7 }}
            className="w-full px-4 py-2.5 cursor-not-allowed"
          />
          <Hint>Cannot be changed</Hint>
        </Field>

        <Field label="Email">
          <input
            type="email"
            value={user.email ?? profile?.email ?? ''}
            disabled
            style={{ ...inputStyle, backgroundColor: 'var(--color-background)', opacity: 0.7 }}
            className="w-full px-4 py-2.5 cursor-not-allowed"
          />
          <Hint>Cannot be changed</Hint>
        </Field>
      </section>

      <section
        className="p-6 rounded-sm space-y-5"
        style={{
          backgroundColor: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
        }}
      >
        <h2
          className="text-xs uppercase"
          style={{
            color: 'var(--color-text-secondary)',
            fontFamily: 'var(--font-body)',
            letterSpacing: '0.14em',
            fontWeight: 500,
          }}
        >
          Preferences
        </h2>

        <Field label="Home city">
          <select
            value={homeCity}
            onChange={(e) => setHomeCity(e.target.value)}
            style={inputStyle}
            className="w-full px-4 py-2.5 outline-none"
          >
            <option value="">— No home city —</option>
            {cities.map((c) => (
              <option key={c.id} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>
          <Hint>Drives your homepage defaults.</Hint>
        </Field>

        <div className="flex items-center justify-between gap-4 pt-1">
          <div>
            <p
              className="text-sm mb-1"
              style={{
                color: 'var(--color-text)',
                fontFamily: 'var(--font-body)',
                fontWeight: 500,
              }}
            >
              Creative Mode
            </p>
            <p
              className="text-xs"
              style={{
                color: 'var(--color-text-secondary)',
                fontFamily: 'var(--font-body)',
              }}
            >
              Long-form reviews, image uploads, and rich formatting.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={creativeMode}
            onClick={() => setCreativeMode((v) => !v)}
            className="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2"
            style={{
              backgroundColor: creativeMode
                ? 'var(--color-primary)'
                : 'var(--color-border)',
            }}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ${
                creativeMode ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <button
          type="button"
          onClick={onSignOut}
          className="inline-flex items-center gap-2 px-5 py-2.5 text-xs uppercase rounded-sm transition-colors hover:bg-gray-50"
          style={{
            fontFamily: 'var(--font-body)',
            letterSpacing: '0.14em',
            fontWeight: 500,
            color: '#9c2a2a',
            border: '1px solid var(--color-border)',
          }}
        >
          <LogOut size={14} />
          Sign out
        </button>
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-2 px-8 py-3 text-xs uppercase rounded-sm text-white transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            backgroundColor: 'var(--color-primary)',
            fontFamily: 'var(--font-body)',
            letterSpacing: '0.16em',
            fontWeight: 500,
          }}
        >
          {saving && <Loader2 size={14} className="animate-spin" />}
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </form>
  )
}

/* ---------- small primitives ---------- */

const inputStyle: React.CSSProperties = {
  backgroundColor: 'var(--color-background)',
  border: '1px solid var(--color-border)',
  borderRadius: '2px',
  color: 'var(--color-text)',
  fontFamily: 'var(--font-body)',
  fontSize: '14px',
}

function Field({
  label,
  children,
}: {
  label: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span
        className="block text-xs uppercase mb-1.5"
        style={{
          color: 'var(--color-text-secondary)',
          fontFamily: 'var(--font-body)',
          letterSpacing: '0.1em',
          fontWeight: 500,
        }}
      >
        {label}
      </span>
      {children}
    </label>
  )
}

function Hint({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="text-xs mt-1.5"
      style={{
        color: 'var(--color-text-secondary)',
        fontFamily: 'var(--font-body)',
      }}
    >
      {children}
    </p>
  )
}
