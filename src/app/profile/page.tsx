'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, Loader2, LogOut, X } from 'lucide-react'
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/types/database'
import { openSignInModal } from '@/components/auth/SignInModalHost'

/**
 * Profile = Settings.
 *
 * Per product direction, `/profile` is the user's settings surface only
 * — display name, bio, avatar, creative-mode toggle, and account
 * metadata. The public profile view (`/profile/[id]`) remains for
 * viewing other users. Unauthenticated visitors see a prompt to sign
 * in instead of a form.
 */
export default function ProfileSettingsPage() {
  const router = useRouter()
  const supabase = createClient()

  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  const [displayName, setDisplayName] = useState('')
  const [bio, setBio] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [avatarPreview, setAvatarPreview] = useState('')
  const [creativeMode, setCreativeMode] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    let active = true
    ;(async () => {
      const { data: { session } } = await supabase.auth.getSession()
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
      if (data) {
        setProfile(data)
        setDisplayName(data.display_name ?? '')
        setBio(data.bio ?? '')
        setAvatarUrl(data.avatar_url ?? '')
        setAvatarPreview(data.avatar_url ?? '')
        setCreativeMode(!!data.creative_mode_enabled)
      }
      setLoading(false)
    })()
    return () => {
      active = false
    }
  }, [supabase])

  const onAvatarChange = (v: string) => {
    setAvatarUrl(v)
    setAvatarPreview(v.trim() ? v : '')
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    setError('')
    setSuccess('')
    const trimmed = displayName.trim()
    if (trimmed.length < 2) return setError('Display name must be at least 2 characters')
    if (bio.length > 500) return setError('Bio must be less than 500 characters')
    setSaving(true)
    try {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          display_name: trimmed,
          bio: bio.trim() || null,
          avatar_url: avatarUrl.trim() || null,
          creative_mode_enabled: creativeMode,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id)
      if (updateError) {
        setError('Failed to update profile: ' + updateError.message)
        return
      }
      setSuccess('Settings saved')
      window.setTimeout(() => setSuccess(''), 2500)
    } catch {
      setError('An unexpected error occurred')
    } finally {
      setSaving(false)
    }
  }

  const onSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

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

  if (!user) {
    return (
      <div
        className="flex items-center justify-center min-h-[70vh] px-6"
        style={{ backgroundColor: 'var(--color-background)' }}
      >
        <div className="max-w-md w-full text-center">
          <div
            className="w-14 h-14 mx-auto rounded-sm flex items-center justify-center text-white shadow-sm mb-6"
            style={{
              backgroundColor: 'var(--color-primary)',
              fontFamily: 'var(--font-heading)',
              fontWeight: 500,
              fontSize: '22px',
            }}
          >
            G
          </div>
          <h1
            className="text-3xl mb-2"
            style={{
              color: 'var(--color-text)',
              fontFamily: 'var(--font-heading)',
              fontWeight: 400,
            }}
          >
            Sign in to view settings
          </h1>
          <p
            className="text-sm mb-8"
            style={{
              color: 'var(--color-text-secondary)',
              fontFamily: 'var(--font-body)',
              fontWeight: 300,
            }}
          >
            Your profile settings live here once you&rsquo;re signed in.
          </p>
          <button
            type="button"
            onClick={() => openSignInModal({ mode: 'signin' })}
            className="inline-flex items-center justify-center px-8 py-3 text-xs uppercase rounded-sm text-white transition-opacity hover:opacity-90"
            style={{
              backgroundColor: 'var(--color-primary)',
              fontFamily: 'var(--font-body)',
              letterSpacing: '0.16em',
              fontWeight: 500,
            }}
          >
            Sign in
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      className="min-h-screen"
      style={{ backgroundColor: 'var(--color-background)' }}
    >
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
        <header className="mb-10">
          <p
            className="text-xs uppercase mb-2"
            style={{
              color: 'var(--color-accent)',
              fontFamily: 'var(--font-body)',
              letterSpacing: '0.16em',
              fontWeight: 500,
            }}
          >
            Settings
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
            Your profile
          </h1>
        </header>

        {error && (
          <div
            className="mb-6 p-3 rounded-sm border text-sm flex items-start gap-2"
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
            className="mb-6 p-3 rounded-sm border text-sm"
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

        <form onSubmit={onSubmit} className="space-y-6">
          <section
            className="p-6 rounded-sm"
            style={{
              backgroundColor: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
            }}
          >
            <h2
              className="text-xs uppercase mb-5"
              style={{
                color: 'var(--color-text-secondary)',
                fontFamily: 'var(--font-body)',
                letterSpacing: '0.14em',
                fontWeight: 500,
              }}
            >
              Avatar
            </h2>
            <div className="flex items-center gap-5">
              {avatarPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={avatarPreview}
                  alt="Avatar preview"
                  onError={() => setAvatarPreview('')}
                  className="w-20 h-20 rounded-full object-cover flex-shrink-0"
                  style={{ border: '1px solid var(--color-border)' }}
                />
              ) : (
                <div
                  className="w-20 h-20 rounded-full flex items-center justify-center flex-shrink-0 text-2xl text-white"
                  style={{
                    backgroundColor: 'var(--color-primary)',
                    fontFamily: 'var(--font-heading)',
                  }}
                >
                  {(profile?.display_name ?? displayName ?? 'G').charAt(0).toUpperCase()}
                </div>
              )}
              <div className="flex-1 flex gap-2">
                <input
                  type="url"
                  value={avatarUrl}
                  onChange={(e) => onAvatarChange(e.target.value)}
                  placeholder="https://example.com/avatar.jpg"
                  style={inputStyle}
                  className="flex-1 px-4 py-2.5 outline-none transition-colors"
                />
                {avatarUrl && (
                  <button
                    type="button"
                    onClick={() => onAvatarChange('')}
                    className="px-3 rounded-sm transition-colors hover:bg-gray-50"
                    aria-label="Clear avatar"
                    style={{
                      color: 'var(--color-text-secondary)',
                      border: '1px solid var(--color-border)',
                    }}
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
            </div>
          </section>

          <section
            className="p-6 rounded-sm space-y-5"
            style={{
              backgroundColor: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
            }}
          >
            <Field label="Display Name">
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
                maxLength={50}
                style={inputStyle}
                className="w-full px-4 py-2.5 outline-none transition-colors"
              />
              <Hint>{displayName.length}/50</Hint>
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
                value={profile?.email ?? ''}
                disabled
                style={{ ...inputStyle, backgroundColor: 'var(--color-background)', opacity: 0.7 }}
                className="w-full px-4 py-2.5 cursor-not-allowed"
              />
              <Hint>Cannot be changed</Hint>
            </Field>

            <Field label="Bio">
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                maxLength={500}
                rows={4}
                placeholder="Tell us about yourself and your food interests…"
                style={inputStyle}
                className="w-full px-4 py-2.5 outline-none transition-colors resize-none"
              />
              <Hint>{bio.length}/500</Hint>
            </Field>
          </section>

          <section
            className="p-6 rounded-sm"
            style={{
              backgroundColor: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
            }}
          >
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2
                  className="text-sm mb-1"
                  style={{
                    color: 'var(--color-text)',
                    fontFamily: 'var(--font-body)',
                    fontWeight: 500,
                  }}
                >
                  Creative Mode
                </h2>
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

          <section
            className="p-6 rounded-sm"
            style={{
              backgroundColor: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
            }}
          >
            <h2
              className="text-xs uppercase mb-3"
              style={{
                color: 'var(--color-text-secondary)',
                fontFamily: 'var(--font-body)',
                letterSpacing: '0.14em',
                fontWeight: 500,
              }}
            >
              Account
            </h2>
            <p
              className="text-sm"
              style={{
                color: 'var(--color-text-secondary)',
                fontFamily: 'var(--font-body)',
              }}
            >
              Member since{' '}
              {profile?.created_at
                ? new Date(profile.created_at).toLocaleDateString()
                : '—'}
            </p>
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
      </div>
    </div>
  )
}

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
