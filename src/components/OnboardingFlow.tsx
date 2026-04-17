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
  'Italian', 'Japanese', 'Mexican', 'Thai', 'Chinese', 'Indian',
  'French', 'Mediterranean', 'Korean', 'Vietnamese', 'American',
  'Spanish', 'Greek', 'Steakhouse', 'Seafood', 'Pizza', 'Sushi',
  'BBQ', 'Vegan', 'Bakery',
]

const MIN_CITIES = 1
const MAX_CITIES = 3
const MIN_CUISINES = 1
const MAX_CUISINES = 8

type StepKey = 'welcome' | 'cities' | 'cuisines' | 'done'
const STEPS: StepKey[] = ['welcome', 'cities', 'cuisines', 'done']

/**
 * Standalone onboarding wizard — rendered at `/onboarding`.
 *
 * Styled to match the editorial palette so it feels like a seamless
 * continuation of the sign-in popup (gold CTA, Spectral headings,
 * dot-pattern accent). The inline modal version
 * (`OnboardingSteps.tsx`) shares the same step structure but renders
 * without the page-level card wrapper.
 */
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
      const { data: { user } } = await supabase.auth.getUser()
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
    <div className="w-full max-w-2xl">
      {/* Progress */}
      <div className="flex items-center justify-center gap-2 mb-6">
        {STEPS.map((_, i) => (
          <span
            key={i}
            className="rounded-full transition-all"
            style={{
              width: i === stepIndex ? 28 : 8,
              height: 6,
              backgroundColor:
                i <= stepIndex ? 'var(--color-primary)' : 'var(--color-border)',
            }}
          />
        ))}
      </div>

      <div
        className="rounded-sm shadow-xl overflow-hidden"
        style={{
          backgroundColor: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
        }}
      >
        <div key={step} className="p-6 sm:p-10 transition-opacity duration-300">
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
            <CuisinesStep selected={selectedCuisines} onToggle={toggleCuisine} />
          )}
          {step === 'done' && (
            <DoneStep
              cityCount={selectedCities.length}
              cuisineCount={selectedCuisines.length}
            />
          )}
        </div>

        {error && (
          <div
            className="mx-6 sm:mx-10 mb-4 p-3 rounded-sm border text-sm"
            style={{
              backgroundColor: '#fdf2f2',
              borderColor: '#f5c2c2',
              color: '#9c2a2a',
              fontFamily: 'var(--font-body)',
            }}
          >
            {error}
          </div>
        )}

        <div
          className="px-6 sm:px-10 py-4 flex items-center justify-between gap-3"
          style={{ borderTop: '1px solid var(--color-border)' }}
        >
          <button
            type="button"
            onClick={goBack}
            disabled={stepIndex === 0 || submitting}
            className="inline-flex items-center gap-1 text-xs uppercase transition-opacity disabled:opacity-0"
            style={{
              color: 'var(--color-text-secondary)',
              fontFamily: 'var(--font-body)',
              letterSpacing: '0.12em',
              fontWeight: 500,
            }}
          >
            <ArrowLeft size={14} /> Back
          </button>

          <div
            className="text-xs"
            style={{
              color: 'var(--color-text-secondary)',
              fontFamily: 'var(--font-body)',
            }}
          >
            Step {stepIndex + 1} of {STEPS.length}
          </div>

          {step === 'done' ? (
            <button
              type="button"
              onClick={handleFinish}
              disabled={submitting}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 text-xs uppercase rounded-sm text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{
                backgroundColor: 'var(--color-primary)',
                fontFamily: 'var(--font-body)',
                letterSpacing: '0.14em',
                fontWeight: 500,
              }}
            >
              {submitting ? (
                <><Loader2 size={14} className="animate-spin" /> Saving…</>
              ) : (
                <>Start Exploring <ArrowRight size={14} /></>
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={goNext}
              disabled={!canProceed}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 text-xs uppercase rounded-sm text-white transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                backgroundColor: 'var(--color-primary)',
                fontFamily: 'var(--font-body)',
                letterSpacing: '0.14em',
                fontWeight: 500,
              }}
            >
              Continue <ArrowRight size={14} />
            </button>
          )}
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
      desc: 'Compare Google, Yelp, The Infatuation, and Michelin side-by-side.',
    },
    {
      icon: ChefHat,
      title: 'Critic-backed accolades',
      desc: 'See which restaurants hold Michelin stars, James Beard awards, or made the Eater 38.',
    },
    {
      icon: MapPin,
      title: 'Trending in your cities',
      desc: 'Discover what food creators on TikTok and Instagram are raving about.',
    },
  ]
  return (
    <div className="text-center">
      <div
        className="inline-flex items-center justify-center w-16 h-16 rounded-sm mb-5 shadow-lg"
        style={{ backgroundColor: 'var(--color-primary)' }}
      >
        <UtensilsCrossed className="text-white" size={30} />
      </div>
      <h1
        className="text-2xl sm:text-3xl"
        style={{
          color: 'var(--color-text)',
          fontFamily: 'var(--font-heading)',
          fontWeight: 400,
          letterSpacing: '-0.01em',
        }}
      >
        Welcome to Gastronome
      </h1>
      <p
        className="text-sm mt-2 max-w-md mx-auto"
        style={{
          color: 'var(--color-text-secondary)',
          fontFamily: 'var(--font-body)',
          fontWeight: 300,
        }}
      >
        Every restaurant score, one search.
      </p>

      <div className="mt-8 grid gap-3 text-left">
        {features.map(({ icon: Icon, title, desc }) => (
          <div
            key={title}
            className="flex items-start gap-3 p-3 rounded-sm"
            style={{
              backgroundColor: 'var(--color-background)',
              border: '1px solid var(--color-border)',
            }}
          >
            <div
              className="w-9 h-9 flex-shrink-0 rounded-sm text-white flex items-center justify-center"
              style={{ backgroundColor: 'var(--color-primary)' }}
            >
              <Icon size={16} />
            </div>
            <div>
              <p
                className="text-sm"
                style={{
                  color: 'var(--color-text)',
                  fontFamily: 'var(--font-body)',
                  fontWeight: 500,
                }}
              >
                {title}
              </p>
              <p
                className="text-xs leading-relaxed mt-0.5"
                style={{
                  color: 'var(--color-text-secondary)',
                  fontFamily: 'var(--font-body)',
                  fontWeight: 300,
                }}
              >
                {desc}
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
        <h2
          className="text-xl sm:text-2xl"
          style={{
            color: 'var(--color-text)',
            fontFamily: 'var(--font-heading)',
            fontWeight: 400,
          }}
        >
          Pick your cities
        </h2>
        <p
          className="text-sm mt-1"
          style={{
            color: 'var(--color-text-secondary)',
            fontFamily: 'var(--font-body)',
          }}
        >
          Choose up to {MAX_CITIES} cities you want to explore.{' '}
          <span style={{ color: 'var(--color-primary)', fontWeight: 500 }}>
            {selected.length}/{MAX_CITIES} selected
          </span>
        </p>
      </div>

      <div className="mt-6 flex flex-wrap gap-2 justify-center">
        {cities.map((city) => {
          const on = selected.includes(city.name)
          const off = !on && atMax
          return (
            <button
              key={city.id}
              type="button"
              onClick={() => onToggle(city.name)}
              disabled={off}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-sm text-xs uppercase transition-all"
              style={{
                fontFamily: 'var(--font-body)',
                letterSpacing: '0.1em',
                fontWeight: 500,
                backgroundColor: on
                  ? 'var(--color-primary)'
                  : off
                  ? 'var(--color-background)'
                  : 'var(--color-surface)',
                color: on ? '#fff' : off ? 'var(--color-border)' : 'var(--color-text)',
                border: `1px solid ${on ? 'var(--color-primary)' : 'var(--color-border)'}`,
                cursor: off ? 'not-allowed' : 'pointer',
              }}
            >
              {on && <Check size={13} />}
              {city.name}
            </button>
          )
        })}
      </div>

      {selected.length > 0 && (
        <div className="mt-8 space-y-5">
          {selected.map((cityName) => {
            const items = previews[cityName] || []
            const isLoading = previewLoading.has(cityName)
            return (
              <div key={cityName}>
                <p
                  className="text-[10px] uppercase mb-2"
                  style={{
                    color: 'var(--color-accent)',
                    fontFamily: 'var(--font-body)',
                    letterSpacing: '0.14em',
                    fontWeight: 500,
                  }}
                >
                  A taste of {cityName}
                </p>
                {isLoading ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {[0, 1].map((i) => (
                      <div key={i} className="h-28 rounded-sm animate-shimmer" />
                    ))}
                  </div>
                ) : items.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {items.map((r) => (
                      <OnboardingRestaurantPreview key={r.id} restaurant={r} />
                    ))}
                  </div>
                ) : (
                  <p
                    className="text-xs italic"
                    style={{
                      color: 'var(--color-text-secondary)',
                      fontFamily: 'var(--font-body)',
                    }}
                  >
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
        <h2
          className="text-xl sm:text-2xl"
          style={{
            color: 'var(--color-text)',
            fontFamily: 'var(--font-heading)',
            fontWeight: 400,
          }}
        >
          What cuisines do you love?
        </h2>
        <p
          className="text-sm mt-1"
          style={{
            color: 'var(--color-text-secondary)',
            fontFamily: 'var(--font-body)',
          }}
        >
          Pick as many as you want, up to {MAX_CUISINES}.{' '}
          <span style={{ color: 'var(--color-primary)', fontWeight: 500 }}>
            {selected.length}/{MAX_CUISINES}
          </span>
        </p>
      </div>

      <div className="mt-6 flex flex-wrap gap-2 justify-center">
        {CUISINES.map((cuisine) => {
          const on = selected.includes(cuisine)
          const off = !on && atMax
          return (
            <button
              key={cuisine}
              type="button"
              onClick={() => onToggle(cuisine)}
              disabled={off}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-sm text-xs uppercase transition-all"
              style={{
                fontFamily: 'var(--font-body)',
                letterSpacing: '0.1em',
                fontWeight: 500,
                backgroundColor: on
                  ? 'var(--color-primary)'
                  : off
                  ? 'var(--color-background)'
                  : 'var(--color-surface)',
                color: on ? '#fff' : off ? 'var(--color-border)' : 'var(--color-text)',
                border: `1px solid ${on ? 'var(--color-primary)' : 'var(--color-border)'}`,
                cursor: off ? 'not-allowed' : 'pointer',
              }}
            >
              {on && <Check size={13} />}
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
      <div
        className="inline-flex items-center justify-center w-16 h-16 rounded-sm mb-5 shadow-lg"
        style={{ backgroundColor: 'var(--color-primary)' }}
      >
        <Check className="text-white" size={30} />
      </div>
      <h2
        className="text-2xl sm:text-3xl"
        style={{
          color: 'var(--color-text)',
          fontFamily: 'var(--font-heading)',
          fontWeight: 400,
        }}
      >
        You&rsquo;re all set
      </h2>
      <p
        className="text-sm mt-2 max-w-md mx-auto"
        style={{
          color: 'var(--color-text-secondary)',
          fontFamily: 'var(--font-body)',
          fontWeight: 300,
        }}
      >
        We&rsquo;ve saved your {cityCount} {cityCount === 1 ? 'city' : 'cities'} and{' '}
        {cuisineCount} cuisine {cuisineCount === 1 ? 'preference' : 'preferences'}. Your
        homepage will now feel like it was made for you.
      </p>
    </div>
  )
}
