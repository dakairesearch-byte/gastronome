'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { City } from '@/types/database'

export default function SignupPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [homeCity, setHomeCity] = useState('')
  const [cities, setCities] = useState<City[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function loadCities() {
      const { data } = await supabase
        .from('cities')
        .select('*')
        .eq('is_active', true)
        .order('name')
      setCities(data || [])
    }
    loadCities()
  }, [supabase])

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!displayName.trim()) {
      setError('Display name is required')
      return
    }
    if (!username.trim()) {
      setError('Username is required')
      return
    }
    if (username.trim().length < 3) {
      setError('Username must be at least 3 characters')
      return
    }
    if (!email.trim()) {
      setError('Email is required')
      return
    }
    if (!password) {
      setError('Password is required')
      return
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    setLoading(true)

    try {
      // Pass all profile data in metadata so the DB trigger (handle_new_user)
      // can create the profile row automatically with SECURITY DEFINER privileges.
      // This avoids RLS issues when email confirmation is enabled.
      const { data, error: signupError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username,
            display_name: displayName,
            home_city: homeCity || null,
            is_critic: true,
          },
        },
      })

      if (signupError) {
        setError(signupError.message)
        return
      }

      if (!data.user) {
        setError('Signup failed — no user returned')
        return
      }

      router.push('/onboarding')
      router.refresh()
    } catch (err) {
      setError('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left panel — branding (hidden on mobile) */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-emerald-600 via-emerald-500 to-teal-500 relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PGNpcmNsZSBjeD0iMzAiIGN5PSIzMCIgcj0iMiIvPjwvZz48L2c+PC9zdmc+')] opacity-50" />
        <div className="relative flex flex-col justify-center px-12 lg:px-16">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center text-white font-bold text-xl">
              G
            </div>
            <span className="text-white font-bold text-xl">Gastronome</span>
          </div>
          <h2 className="text-3xl font-bold text-white leading-snug">
            Discover your next<br />favorite restaurant
          </h2>
          <p className="mt-4 text-emerald-100 text-lg max-w-md">
            Compare Google, Yelp, Infatuation, and Michelin ratings side by side.
          </p>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center py-12 px-4 sm:px-8">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-10 h-10 bg-emerald-500 rounded-xl mb-4 lg:hidden">
              <span className="text-white font-bold text-lg">G</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Create account</h1>
            <p className="text-sm text-gray-500 mt-1">Create your Gastronome account</p>
          </div>

          {error && (
            <div className="mb-6 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSignup} className="space-y-4">
            <div>
              <label htmlFor="displayName" className="block text-sm font-medium text-gray-700 mb-1">
                Display Name
              </label>
              <input
                id="displayName"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition text-sm"
                placeholder="Your Name"
              />
            </div>

            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">
                Username
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s/g, '_'))}
                required
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition text-sm"
                placeholder="your_username"
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition text-sm"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition text-sm"
                placeholder="Create a password"
              />
            </div>

            <div>
              <label htmlFor="homeCity" className="block text-sm font-medium text-gray-700 mb-1">
                Home City <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <select
                id="homeCity"
                value={homeCity}
                onChange={(e) => setHomeCity(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition text-sm text-gray-700"
              >
                <option value="">Select a city</option>
                {cities.map((city) => (
                  <option key={city.id} value={city.name}>
                    {city.name}, {city.state}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Creating account...' : 'Create Account'}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-6">
            Already have an account?{' '}
            <Link href="/auth/login" className="text-emerald-600 hover:text-emerald-700 font-semibold">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
