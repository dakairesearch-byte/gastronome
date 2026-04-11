'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Profile } from '@/types/database'
import { AlertCircle, Loader2, X } from 'lucide-react'

export default function EditProfilePage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [displayName, setDisplayName] = useState('')
  const [bio, setBio] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [avatarPreview, setAvatarPreview] = useState('')
  const [creativeModeEnabled, setCreativeModeEnabled] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const supabase = createClient()

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession()

        if (!session) {
          router.push('/auth/login')
          return
        }

        setUser(session.user)

        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single()

        if (profileData) {
          setProfile(profileData)
          setDisplayName(profileData.display_name)
          setBio(profileData.bio || '')
          setAvatarUrl(profileData.avatar_url || '')
          setAvatarPreview(profileData.avatar_url || '')
          setCreativeModeEnabled(profileData.creative_mode_enabled || false)
        }
      } catch (err) {
        setError('Failed to load profile')
      } finally {
        setLoading(false)
      }
    }

    fetchProfile()
  }, [supabase, router])

  const handleAvatarUrlChange = (url: string) => {
    setAvatarUrl(url)
    if (url.trim()) {
      setAvatarPreview(url)
    } else {
      setAvatarPreview('')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setSaving(true)

    try {
      if (!user) return

      if (displayName.trim().length === 0) {
        setError('Display name is required')
        return
      }

      if (displayName.trim().length < 2) {
        setError('Display name must be at least 2 characters')
        return
      }

      if (bio.length > 500) {
        setError('Bio must be less than 500 characters')
        return
      }

      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          display_name: displayName.trim(),
          bio: bio.trim() || null,
          avatar_url: avatarUrl.trim() || null,
          creative_mode_enabled: creativeModeEnabled,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id)

      if (updateError) {
        setError('Failed to update profile: ' + updateError.message)
        return
      }

      setSuccess('Profile updated successfully!')
      setTimeout(() => {
        router.push(`/profile/${user.id}`)
        router.refresh()
      }, 1500)
    } catch (err) {
      setError('An unexpected error occurred')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="animate-spin text-emerald-500" size={32} />
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-sm text-gray-500">Profile not found</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-gray-900">Edit Profile</h1>
          <p className="text-sm text-gray-500 mt-1">Update your profile information</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg flex gap-2 text-sm">
            <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
            <p>{error}</p>
          </div>
        )}

        {success && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">
            <p>{success}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Avatar Section */}
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-700">Avatar</label>

            {avatarPreview && (
              <img
                src={avatarPreview}
                alt="Avatar preview"
                className="w-16 h-16 rounded-full object-cover"
                onError={() => setAvatarPreview('')}
              />
            )}

            <div className="flex gap-2">
              <input
                type="url"
                value={avatarUrl}
                onChange={(e) => handleAvatarUrlChange(e.target.value)}
                className="flex-1 px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition text-sm"
                placeholder="https://example.com/avatar.jpg"
              />
              {avatarUrl && (
                <button
                  type="button"
                  onClick={() => handleAvatarUrlChange('')}
                  className="px-3 py-2 text-gray-400 hover:text-gray-700 transition-colors"
                >
                  <X size={16} />
                </button>
              )}
            </div>
          </div>

          {/* Display Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Display Name *
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
              maxLength={50}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition text-sm"
              placeholder="Your display name"
            />
            <p className="text-xs text-gray-400 mt-1">{displayName.length}/50</p>
          </div>

          {/* Username (Read-only) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Username
            </label>
            <input
              type="text"
              value={profile.username}
              disabled
              className="w-full px-4 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed text-sm"
            />
            <p className="text-xs text-gray-400 mt-1">Cannot be changed</p>
          </div>

          {/* Email (Read-only) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              value={profile.email}
              disabled
              className="w-full px-4 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed text-sm"
            />
            <p className="text-xs text-gray-400 mt-1">Cannot be changed</p>
          </div>

          {/* Bio */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Bio
            </label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={500}
              rows={4}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition resize-none text-sm"
              placeholder="Tell us about yourself and your food interests..."
            />
            <p className="text-xs text-gray-400 mt-1">{bio.length}/500</p>
          </div>

          {/* Account Info */}
          <div className="p-4 bg-white rounded-lg border border-gray-100">
            <h3 className="text-sm font-medium text-gray-700 mb-2">Account</h3>
            <p className="text-sm text-gray-500">
              Member since {new Date(profile.created_at).toLocaleDateString()}
            </p>
          </div>

          {/* Creative Mode Toggle */}
          <div className="p-4 bg-white rounded-lg border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-gray-900">Creative Mode</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Long-form reviews, image uploads, and rich formatting
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={creativeModeEnabled}
                onClick={() => setCreativeModeEnabled(!creativeModeEnabled)}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 ${
                  creativeModeEnabled ? 'bg-emerald-500' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    creativeModeEnabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Submit Buttons */}
          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {saving && <Loader2 size={16} className="animate-spin" />}
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
            <button
              type="button"
              onClick={() => router.back()}
              className="px-5 py-2 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
