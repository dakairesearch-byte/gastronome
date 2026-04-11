'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Check } from 'lucide-react'
import type { City } from '@/types/database'

interface StepSignupProps {
  cities: City[]
  prefilledCity?: string | null
}

const VALUE_ITEMS = [
  'See how every restaurant near you stacks up across Google, Yelp, and more',
  'Save restaurants you want to try',
  'Get alerts when new spots open in your area',
  'Access the full analytics dashboard for any restaurant',
]

export default function StepSignup({ cities, prefilledCity }: StepSignupProps) {
  const [displayName, setDisplayName] = useState('')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [homeCity, setHomeCity] = useState(prefilledCity || '')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!displayName.trim()) { setError('Display name is required'); return }
    if (!username.trim() || username.trim().length < 3) {
      setError('Username must be at least 3 characters'); return
    }
    if (!email.trim()) { setError('Email is required'); return }
    if (!password || password.length < 6) {
      setError('Password must be at least 6 characters'); return
    }
    if (!homeCity) { setError('Please select your home city'); return }

    setLoading(true)

    try {
      const { data, error: signupError } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { username, display_name: displayName } },
      })

      if (signupError) { setError(signupError.message); return }

      if (data.user) {
        const { error: profileError } = await supabase.from('profiles').insert([
          {
            id: data.user.id,
            email,
            username,
            display_name: displayName,
            home_city: homeCity,
          },
        ])

        if (profileError) {
          setError('Profile creation failed: ' + profileError.message)
          return
        }
      }

      localStorage.setItem('gastronome_onboarding_done', '1')
      router.push('/')
      router.refresh()
    } catch {
      setError('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-gradient-to-br from-gray-900 via-gray-900 to-emerald-950 py-16">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white leading-tight">
            Make It{' '}
            <span className="bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
              Yours
            </span>
          </h1>
          <p className="text-gray-400 mt-3">
            {prefilledCity
              ? `You just explored ${prefilledCity}. Create a free account to keep going:`
              : 'Create a free account to unlock:'}
          </p>
        </div>

        {/* Value list */}
        <ul className="space-y-2.5">
          {VALUE_ITEMS.map((item) => (
            <li
              key={item}
              className="flex items-start gap-2.5 text-sm text-gray-300"
            >
              <Check
                size={16}
                className="text-emerald-400 mt-0.5 flex-shrink-0"
              />
              {item}
            </li>
          ))}
        </ul>

        {/* Signup form */}
        <form onSubmit={handleSubmit} className="space-y-3">
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-300 rounded-lg text-sm">
              {error}
            </div>
          )}

          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Display Name"
            required
            className="w-full px-4 py-2.5 bg-white/10 border border-white/20 rounded-lg text-white placeholder:text-gray-500 outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
          />
          <input
            type="text"
            value={username}
            onChange={(e) =>
              setUsername(e.target.value.toLowerCase().replace(/\s/g, '_'))
            }
            placeholder="Username"
            required
            className="w-full px-4 py-2.5 bg-white/10 border border-white/20 rounded-lg text-white placeholder:text-gray-500 outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
          />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            required
            className="w-full px-4 py-2.5 bg-white/10 border border-white/20 rounded-lg text-white placeholder:text-gray-500 outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password (min 6 characters)"
            required
            minLength={6}
            className="w-full px-4 py-2.5 bg-white/10 border border-white/20 rounded-lg text-white placeholder:text-gray-500 outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
          />
          <select
            value={homeCity}
            onChange={(e) => setHomeCity(e.target.value)}
            required
            className="w-full px-4 py-2.5 bg-white/10 border border-white/20 rounded-lg text-white outline-none focus:ring-2 focus:ring-emerald-500 text-sm [&>option]:text-gray-900"
          >
            <option value="">Select your home city</option>
            {cities.map((city) => (
              <option key={city.id} value={city.name}>
                {city.name}, {city.state}
              </option>
            ))}
          </select>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Creating account...' : 'Start Exploring Free'}
          </button>
        </form>

        <p className="text-center text-xs text-gray-500">
          Free forever &middot; No credit card &middot; Takes 10 seconds
        </p>

        <p className="text-center text-sm text-gray-400">
          Already have an account?{' '}
          <Link
            href="/auth/login"
            className="text-emerald-400 hover:text-emerald-300 font-semibold"
          >
            Log in
          </Link>
        </p>
      </div>
    </div>
  )
}
