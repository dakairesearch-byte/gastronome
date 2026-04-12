'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import OnboardingRestaurantPreview from './OnboardingRestaurantPreview'
import {
  UtensilsCrossed,
  MapPin,
  ChefHat,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Check,
  Loader2,
} from 'lucide-react'
import type { City, Restaurant } from '@/types/database'

const CUISINES = [
  'Italian',
  'Japanese',
  'Mexican',
  'Thai',
  'Chinese',
  'Indian',
  'French',
  'Mediterranean',
  'Korean',
  'Vietnamese',
  'American',
  'Spanish',
  'Greek',
  'Steakhouse',
  'Seafood',
  'Pizza',
  'Sushi',
  'BBQ',
  'Vegan',
  'Bakery',
]

const MIN_CITIES = 1
const MAX_CITIES = 3
const MIN_CUISINES = 1
const MAX_CUISINES = 8

type StepKey = 'welcome' | 'cities' | 'cuisines' | 'done'
const STEPS: StepKey[] = ['welcome', 'cities', 'cuisines', 'done']

export default function OnboardingFlow() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  const [stepIndex, setStepIndex] = useState(0)
  const [cities, setCities] = useState<City[]>([])
  const [selectedCities, setSelectedCities] = useState<string[]>([])
  const [selectedCuisines, setSelectedCuisines] = useState<string[]>([])
  const [previews, setPreviews] = useState<Record<string, Restaurant[]>>({})
  const [previewLoading, setPreviewLoading] = useState<Set<string>>(new Set())
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const step = STEPS[stepIndex]

  // Load available cities
  useEffect(() => {
    async function loadCities() {
      const { data } = await supabase
        .from('cities')
        .select('*')
        .eq('is_active', true)
        .order('restaurant_count', { ascending: false })
      setCities(data || [])
    }
    loadCities()
  }, [supabase])

  // Fetch previews when a city is selected
  useEffect(() => {
    async function fetchPreview(cityName: string) {
      if (previews[cityName]) return
      setPreviewLoading((prev) => new Set(prev).add(cityName))
      try {
        const { data } = await supabase
          .from('restaurants')
          .select('*')
          .eq('city', cityName)
          .order('google_rating', { ascending: false, nullsFirst: false })
          .limit(4)
        setPreviews((prev) => ({ ...prev, [cityName]: (data as Restaurant[]) || [] }))
      } finally {
        setPreviewLoading((prev) => {
          const next = new Set(prev)
          next.delete(cityName)
          return next
        })
      }
    }
    for (const c of selectedCities) {
      if (!previews[c]) fetchPreview(c)
    }
  }, [selectedCities, previews, supabase])

  const toggleCity = (name: string) => {
    setSelectedCities((prev) => {
      if (prev.includes(name)) return prev.filter((c) => c !== name)
      if (prev.length >= MAX_CITIES) return prev
      return [...prev, name]
    })
  }

  const toggleCuisine = (cuisine: string) => {
    setSelectedCuisines((prev) => {
      if (prev.includes(cuisine)) return prev.filter((c) => c !== cuisine)
      if (prev.length >= MAX_CUISINES) return prev
      return [...prev, cuisine]
    })
  }

  const canProceed = (() => {
    if (step === 'welcome') return true
    if (step === 'cities') return selectedCities.length >= MIN_CITIES
    if (step === 'cuisines') return selectedCuisines.length >= MIN_CUISINES
    return true
  })()

  const goNext = () => {
    if (!canProceed) return
    setStepIndex((i) => Math.min(i + 1, STEPS.length - 1))
  }
  const goBack = () => setStepIndex((i) => Math.max(i - 1, 0))

  const handleFinish = async () => {
    setSubmitting(true)
    setError(null)
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        setError('You must be signed in to complete onboarding')
        setSubmitting(false)
        return
      }
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          onboarding_completed: true,
          favorite_cities: selectedCities,
          favorite_cuisines: selectedCuisines,
          ...(selectedCities.length > 0 ? { home_city: selectedCities[0] } : {}),
        })
        .eq('id', user.id)

      if (updateError) {
        setError(updateError.message)
        setSubmitting(false)
        return
      }
      router.push('/')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50 flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-2xl">
        {/* Progress indicator */}
        <div className="flex items-center justify-center gap-2 mb-6">
          {STEPS.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === stepIndex
                  ? 'w-8 bg-emerald-500'
                  : i < stepIndex
                    ? 'w-2 bg-emerald-400'
                    : 'w-2 bg-gray-200'
              }`}
              aria-hidden
            />
          ))}
        </div>

        <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden">
          <div
            key={step}
            className="p-6 sm:p-10 transition-opacity duration-300"
          >
            {step === 'welcome' && <WelcomeStep />}

            {step === 'cities' && (
              <CitiesStep
                cities={cities}
                selected={selectedCities}
                onToggle={toggleCity}
                previews={previews}
                previewLoading={previewLoading}
              />
            )}

            {step === 'cuisines' && (
              <CuisinesStep
                selected={selectedCuisines}
                onToggle={toggleCuisine}
              />
            )}

            {step === 'done' && (
              <DoneStep
                cityCount={selectedCities.length}
                cuisineCount={selectedCuisines.length}
              />
            )}
          </div>

          {error && (
            <div className="mx-6 sm:mx-10 mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Footer controls */}
          <div className="px-6 sm:px-10 py-4 border-t border-gray-100 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={goBack}
              disabled={stepIndex === 0 || submitting}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 disabled:opacity-0 disabled:pointer-events-none transition-colors"
            >
              <ArrowLeft size={14} /> Back
            </button>

            <div className="text-xs text-gray-400">
              Step {stepIndex + 1} of {STEPS.length}
            </div>

            {step === 'done' ? (
              <button
                type="button"
                onClick={handleFinish}
                disabled={submitting}
                className="inline-flex items-center gap-1.5 px-5 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm font-semibold shadow-sm transition-colors disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <Loader2 size={14} className="animate-spin" /> Saving...
                  </>
                ) : (
                  <>
                    Start Exploring <ArrowRight size={14} />
                  </>
                )}
              </button>
            ) : (
              <button
                type="button"
                onClick={goNext}
                disabled={!canProceed}
                className="inline-flex items-center gap-1.5 px-5 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm font-semibold shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Continue <ArrowRight size={14} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ---------- Step components ---------- */

function WelcomeStep() {
  const features = [
    {
      icon: Sparkles,
      title: 'All ratings in one place',
      description:
        'Compare Google, Yelp, The Infatuation, and Michelin side-by-side — no more tab-switching.',
    },
    {
      icon: ChefHat,
      title: 'Critic-backed accolades',
      description:
        'See which restaurants hold Michelin stars, James Beard awards, or made the Eater 38.',
    },
    {
      icon: MapPin,
      title: 'Trending in your cities',
      description:
        'Discover what food creators on TikTok and Instagram are raving about right now.',
    },
  ]
  return (
    <div className="text-center">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 mb-5 shadow-lg shadow-emerald-500/20 animate-bounce">
        <UtensilsCrossed className="text-white" size={30} />
      </div>
      <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
        Welcome to Gastronome
      </h1>
      <p className="text-sm text-gray-500 mt-2 max-w-md mx-auto">
        Rotten Tomatoes for restaurants — one search, every score.
      </p>

      <div className="mt-8 grid gap-3 text-left">
        {features.map(({ icon: Icon, title, description }) => (
          <div
            key={title}
            className="flex items-start gap-3 p-3 rounded-xl bg-emerald-50/50 border border-emerald-100"
          >
            <div className="w-9 h-9 flex-shrink-0 rounded-lg bg-emerald-500 text-white flex items-center justify-center">
              <Icon size={16} />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900">{title}</p>
              <p className="text-xs text-gray-600 leading-relaxed mt-0.5">
                {description}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function CitiesStep({
  cities,
  selected,
  onToggle,
  previews,
  previewLoading,
}: {
  cities: City[]
  selected: string[]
  onToggle: (name: string) => void
  previews: Record<string, Restaurant[]>
  previewLoading: Set<string>
}) {
  const atMax = selected.length >= MAX_CITIES

  return (
    <div>
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-emerald-100 text-emerald-600 mb-4">
          <MapPin size={22} />
        </div>
        <h2 className="text-xl sm:text-2xl font-extrabold text-gray-900">
          Pick your cities
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          Choose up to {MAX_CITIES} cities you want to explore.{' '}
          <span className="font-semibold text-emerald-600">
            {selected.length}/{MAX_CITIES} selected
          </span>
        </p>
      </div>

      <div className="mt-6 flex flex-wrap gap-2 justify-center">
        {cities.map((city) => {
          const isSelected = selected.includes(city.name)
          const disabled = !isSelected && atMax
          return (
            <button
              key={city.id}
              type="button"
              onClick={() => onToggle(city.name)}
              disabled={disabled}
              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold border transition-all ${
                isSelected
                  ? 'bg-emerald-500 text-white border-emerald-500 shadow-sm'
                  : disabled
                    ? 'bg-gray-50 text-gray-300 border-gray-100 cursor-not-allowed'
                    : 'bg-white text-gray-700 border-gray-200 hover:border-emerald-300 hover:bg-emerald-50'
              }`}
            >
              {isSelected && <Check size={13} />}
              {city.name}
            </button>
          )
        })}
      </div>

      {/* Previews */}
      {selected.length > 0 && (
        <div className="mt-8 space-y-5">
          {selected.map((cityName) => {
            const items = previews[cityName] || []
            const isLoading = previewLoading.has(cityName)
            return (
              <div
                key={cityName}
                className="transition-opacity duration-300"
              >
                <p className="text-xs font-bold uppercase tracking-wider text-emerald-700 mb-2">
                  A taste of {cityName}
                </p>
                {isLoading ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {[0, 1].map((i) => (
                      <div
                        key={i}
                        className="h-28 rounded-xl bg-emerald-50/60 animate-pulse"
                      />
                    ))}
                  </div>
                ) : items.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {items.map((r) => (
                      <OnboardingRestaurantPreview
                        key={r.id}
                        restaurant={r}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 italic">
                    No preview available yet.
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function CuisinesStep({
  selected,
  onToggle,
}: {
  selected: string[]
  onToggle: (cuisine: string) => void
}) {
  const atMax = selected.length >= MAX_CUISINES
  return (
    <div>
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-emerald-100 text-emerald-600 mb-4">
          <ChefHat size={22} />
        </div>
        <h2 className="text-xl sm:text-2xl font-extrabold text-gray-900">
          What cuisines do you love?
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          Pick as many as you want, up to {MAX_CUISINES}.{' '}
          <span className="font-semibold text-emerald-600">
            {selected.length}/{MAX_CUISINES}
          </span>
        </p>
      </div>

      <div className="mt-6 flex flex-wrap gap-2 justify-center">
        {CUISINES.map((cuisine) => {
          const isSelected = selected.includes(cuisine)
          const disabled = !isSelected && atMax
          return (
            <button
              key={cuisine}
              type="button"
              onClick={() => onToggle(cuisine)}
              disabled={disabled}
              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold border transition-all ${
                isSelected
                  ? 'bg-emerald-500 text-white border-emerald-500 shadow-sm'
                  : disabled
                    ? 'bg-gray-50 text-gray-300 border-gray-100 cursor-not-allowed'
                    : 'bg-white text-gray-700 border-gray-200 hover:border-emerald-300 hover:bg-emerald-50'
              }`}
            >
              {isSelected && <Check size={13} />}
              {cuisine}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function DoneStep({
  cityCount,
  cuisineCount,
}: {
  cityCount: number
  cuisineCount: number
}) {
  return (
    <div className="text-center py-4">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 mb-5 shadow-lg shadow-emerald-500/20">
        <Check className="text-white" size={30} />
      </div>
      <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
        You&rsquo;re all set!
      </h2>
      <p className="text-sm text-gray-500 mt-2 max-w-md mx-auto">
        We&rsquo;ve saved your {cityCount} {cityCount === 1 ? 'city' : 'cities'} and{' '}
        {cuisineCount} cuisine {cuisineCount === 1 ? 'preference' : 'preferences'}.
        Your homepage will now feel like it was made for you.
      </p>
    </div>
  )
}
