'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChefHat,
  Loader2,
  MapPin,
  Sparkles,
  UtensilsCrossed,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { City, Restaurant } from '@/types/database'

const CUISINES = [
  'Italian', 'Japanese', 'Mexican', 'Thai', 'Chinese', 'Indian',
  'French', 'Mediterranean', 'Korean', 'Vietnamese', 'American',
  'Spanish', 'Greek', 'Steakhouse', 'Seafood', 'Pizza', 'Sushi',
  'BBQ', 'Vegan', 'Bakery',
]

const MAX_CITIES = 3
const MAX_CUISINES = 8

type Step = 'welcome' | 'cities' | 'cuisines' | 'done'
const STEPS: Step[] = ['welcome', 'cities', 'cuisines', 'done']

interface OnboardingStepsProps {
  onComplete: () => void
}

/**
 * Portable onboarding wizard that embeds inside a modal.
 *
 * Renders the same 4 steps as the standalone `/onboarding` page
 * (welcome → pick cities → pick cuisines → confirmation) but without
 * any page-level routing or layout assumptions. On "Start Exploring"
 * it saves preferences to the user's profile and calls `onComplete`.
 */
export default function OnboardingSteps({ onComplete }: OnboardingStepsProps) {
  const supabase = useMemo(() => createClient(), [])
  const [idx, setIdx] = useState(0)
  const step = STEPS[idx]

  const [cities, setCities] = useState<City[]>([])
  const [selCities, setSelCities] = useState<string[]>([])
  const [selCuisines, setSelCuisines] = useState<string[]>([])
  const [previews, setPreviews] = useState<Record<string, Restaurant[]>>({})
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    supabase
      .from('cities')
      .select('*')
      .eq('is_active', true)
      .order('restaurant_count', { ascending: false })
      .then(({ data }) => {
        if (active) setCities(data ?? [])
      })
    return () => { active = false }
  }, [supabase])

  useEffect(() => {
    for (const name of selCities) {
      if (previews[name]) continue
      supabase
        .from('restaurants')
        .select('id, name, cuisine, city, neighborhood, photo_url, google_photo_url')
        .eq('city', name)
        .order('google_rating', { ascending: false, nullsFirst: false })
        .limit(2)
        .then(({ data }) => {
          setPreviews((p) => ({ ...p, [name]: (data ?? []) as Restaurant[] }))
        })
    }
  }, [selCities, previews, supabase])

  const toggle = <T extends string>(
    sel: T[],
    set: React.Dispatch<React.SetStateAction<T[]>>,
    max: number,
    val: T,
  ) => {
    set((prev) => {
      if (prev.includes(val)) return prev.filter((v) => v !== val)
      if (prev.length >= max) return prev
      return [...prev, val]
    })
  }

  const canNext =
    step === 'welcome' ||
    (step === 'cities' && selCities.length >= 1) ||
    (step === 'cuisines' && selCuisines.length >= 1) ||
    step === 'done'

  const finish = async () => {
    setSubmitting(true)
    setError(null)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setError('Session expired'); setSubmitting(false); return }
      const { error: e } = await supabase
        .from('profiles')
        .update({
          onboarding_completed: true,
          favorite_cities: selCities,
          favorite_cuisines: selCuisines,
          ...(selCities.length > 0 ? { home_city: selCities[0] } : {}),
        })
        .eq('id', user.id)
      if (e) { setError(e.message); setSubmitting(false); return }
      onComplete()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setSubmitting(false)
    }
  }

  return (
    <div>
      {/* Progress dots */}
      <div className="flex items-center justify-center gap-2 mb-6">
        {STEPS.map((_, i) => (
          <span
            key={i}
            className="rounded-full transition-all"
            style={{
              width: i === idx ? 28 : 8,
              height: 6,
              backgroundColor:
                i <= idx ? 'var(--color-primary)' : 'var(--color-border)',
            }}
          />
        ))}
      </div>

      {/* Step content */}
      <div className="min-h-[280px]">
        {step === 'welcome' && <WelcomeStep />}
        {step === 'cities' && (
          <CitiesStep
            cities={cities}
            sel={selCities}
            onToggle={(n) => toggle(selCities, setSelCities, MAX_CITIES, n)}
            previews={previews}
          />
        )}
        {step === 'cuisines' && (
          <CuisinesStep
            sel={selCuisines}
            onToggle={(c) => toggle(selCuisines, setSelCuisines, MAX_CUISINES, c)}
          />
        )}
        {step === 'done' && (
          <DoneStep cityCount={selCities.length} cuisineCount={selCuisines.length} />
        )}
      </div>

      {error && (
        <p
          className="mt-3 text-xs text-center"
          style={{ color: '#9c2a2a', fontFamily: 'var(--font-body)' }}
        >
          {error}
        </p>
      )}

      {/* Navigation */}
      <div
        className="flex items-center justify-between gap-3 mt-6 pt-5"
        style={{ borderTop: '1px solid var(--color-border)' }}
      >
        <button
          type="button"
          onClick={() => setIdx((i) => Math.max(0, i - 1))}
          disabled={idx === 0 || submitting}
          className="inline-flex items-center gap-1 text-xs uppercase transition-opacity disabled:opacity-0"
          style={{
            color: 'var(--color-text-secondary)',
            fontFamily: 'var(--font-body)',
            letterSpacing: '0.12em',
            fontWeight: 500,
          }}
        >
          <ArrowLeft size={13} /> Back
        </button>

        <span
          className="text-xs"
          style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-body)' }}
        >
          {idx + 1} / {STEPS.length}
        </span>

        {step === 'done' ? (
          <button
            type="button"
            onClick={finish}
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
              <><Loader2 size={13} className="animate-spin" /> Saving…</>
            ) : (
              <>Start Exploring <ArrowRight size={13} /></>
            )}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setIdx((i) => Math.min(STEPS.length - 1, i + 1))}
            disabled={!canNext}
            className="inline-flex items-center gap-1.5 px-5 py-2.5 text-xs uppercase rounded-sm text-white transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              backgroundColor: 'var(--color-primary)',
              fontFamily: 'var(--font-body)',
              letterSpacing: '0.14em',
              fontWeight: 500,
            }}
          >
            Continue <ArrowRight size={13} />
          </button>
        )}
      </div>
    </div>
  )
}

/* ---------- Step sub-components ---------- */

function WelcomeStep() {
  const items = [
    { icon: Sparkles, title: 'All ratings in one place', desc: 'Compare Google, Yelp, The Infatuation, and Michelin side-by-side.' },
    { icon: ChefHat, title: 'Critic-backed accolades', desc: 'See which restaurants hold Michelin stars, James Beard awards, or made the Eater 38.' },
    { icon: MapPin, title: 'Trending in your cities', desc: 'Discover what food creators on TikTok and Instagram are raving about.' },
  ]
  return (
    <div className="text-center">
      <div
        className="inline-flex items-center justify-center w-14 h-14 rounded-sm mb-4"
        style={{ backgroundColor: 'var(--color-primary)' }}
      >
        <UtensilsCrossed className="text-white" size={26} />
      </div>
      <h2
        className="text-2xl mb-1"
        style={{ color: 'var(--color-text)', fontFamily: 'var(--font-heading)', fontWeight: 400 }}
      >
        Welcome to Gastronome
      </h2>
      <p
        className="text-sm mb-6"
        style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-body)', fontWeight: 300 }}
      >
        Every restaurant score, one search.
      </p>
      <div className="space-y-2.5 text-left">
        {items.map(({ icon: Icon, title, desc }) => (
          <div
            key={title}
            className="flex items-start gap-3 p-3 rounded-sm"
            style={{ backgroundColor: 'var(--color-background)', border: '1px solid var(--color-border)' }}
          >
            <div
              className="w-8 h-8 flex-shrink-0 rounded-sm flex items-center justify-center text-white"
              style={{ backgroundColor: 'var(--color-primary)' }}
            >
              <Icon size={14} />
            </div>
            <div>
              <p className="text-sm" style={{ color: 'var(--color-text)', fontFamily: 'var(--font-body)', fontWeight: 500 }}>{title}</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-body)', fontWeight: 300 }}>{desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function CitiesStep({
  cities,
  sel,
  onToggle,
  previews,
}: {
  cities: City[]
  sel: string[]
  onToggle: (n: string) => void
  previews: Record<string, Restaurant[]>
}) {
  const atMax = sel.length >= MAX_CITIES
  return (
    <div>
      <div className="text-center mb-5">
        <h2 className="text-xl" style={{ color: 'var(--color-text)', fontFamily: 'var(--font-heading)', fontWeight: 400 }}>
          Pick your cities
        </h2>
        <p className="text-xs mt-1" style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-body)' }}>
          Choose up to {MAX_CITIES}. <span style={{ color: 'var(--color-primary)', fontWeight: 500 }}>{sel.length}/{MAX_CITIES}</span>
        </p>
      </div>
      <div className="flex flex-wrap gap-2 justify-center">
        {cities.map((c) => {
          const on = sel.includes(c.name)
          const off = !on && atMax
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => onToggle(c.name)}
              disabled={off}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-sm text-xs uppercase transition-all"
              style={{
                fontFamily: 'var(--font-body)',
                letterSpacing: '0.1em',
                fontWeight: 500,
                backgroundColor: on ? 'var(--color-primary)' : off ? 'var(--color-background)' : 'var(--color-surface)',
                color: on ? '#fff' : off ? 'var(--color-border)' : 'var(--color-text)',
                border: `1px solid ${on ? 'var(--color-primary)' : 'var(--color-border)'}`,
                cursor: off ? 'not-allowed' : 'pointer',
              }}
            >
              {on && <Check size={12} />}
              {c.name}
            </button>
          )
        })}
      </div>
      {sel.length > 0 && (
        <div className="mt-5 space-y-3 max-h-40 overflow-y-auto">
          {sel.map((name) => {
            const rows = previews[name] ?? []
            if (rows.length === 0) return null
            return (
              <div key={name}>
                <p className="text-[10px] uppercase mb-1.5" style={{ color: 'var(--color-accent)', fontFamily: 'var(--font-body)', letterSpacing: '0.14em', fontWeight: 500 }}>
                  A taste of {name}
                </p>
                <div className="flex gap-2">
                  {rows.map((r) => {
                    const photo = r.photo_url || r.google_photo_url
                    return (
                      <div key={r.id} className="flex items-center gap-2 flex-1 min-w-0 p-2 rounded-sm" style={{ backgroundColor: 'var(--color-background)', border: '1px solid var(--color-border)' }}>
                        {photo && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={photo} alt={r.name} className="w-9 h-9 rounded-sm object-cover flex-shrink-0" />
                        )}
                        <div className="min-w-0">
                          <p className="text-xs truncate" style={{ color: 'var(--color-text)', fontFamily: 'var(--font-body)', fontWeight: 500 }}>{r.name}</p>
                          <p className="text-[10px] truncate" style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-body)' }}>{r.cuisine}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function CuisinesStep({
  sel,
  onToggle,
}: {
  sel: string[]
  onToggle: (c: string) => void
}) {
  const atMax = sel.length >= MAX_CUISINES
  return (
    <div>
      <div className="text-center mb-5">
        <h2 className="text-xl" style={{ color: 'var(--color-text)', fontFamily: 'var(--font-heading)', fontWeight: 400 }}>
          What cuisines do you love?
        </h2>
        <p className="text-xs mt-1" style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-body)' }}>
          Pick up to {MAX_CUISINES}. <span style={{ color: 'var(--color-primary)', fontWeight: 500 }}>{sel.length}/{MAX_CUISINES}</span>
        </p>
      </div>
      <div className="flex flex-wrap gap-2 justify-center">
        {CUISINES.map((c) => {
          const on = sel.includes(c)
          const off = !on && atMax
          return (
            <button
              key={c}
              type="button"
              onClick={() => onToggle(c)}
              disabled={off}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-sm text-xs uppercase transition-all"
              style={{
                fontFamily: 'var(--font-body)',
                letterSpacing: '0.1em',
                fontWeight: 500,
                backgroundColor: on ? 'var(--color-primary)' : off ? 'var(--color-background)' : 'var(--color-surface)',
                color: on ? '#fff' : off ? 'var(--color-border)' : 'var(--color-text)',
                border: `1px solid ${on ? 'var(--color-primary)' : 'var(--color-border)'}`,
                cursor: off ? 'not-allowed' : 'pointer',
              }}
            >
              {on && <Check size={12} />}
              {c}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function DoneStep({ cityCount, cuisineCount }: { cityCount: number; cuisineCount: number }) {
  return (
    <div className="text-center py-4">
      <div
        className="inline-flex items-center justify-center w-14 h-14 rounded-sm mb-4"
        style={{ backgroundColor: 'var(--color-primary)' }}
      >
        <Check className="text-white" size={26} />
      </div>
      <h2 className="text-2xl mb-2" style={{ color: 'var(--color-text)', fontFamily: 'var(--font-heading)', fontWeight: 400 }}>
        You&rsquo;re all set
      </h2>
      <p className="text-sm" style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-body)', fontWeight: 300 }}>
        {cityCount} {cityCount === 1 ? 'city' : 'cities'} and {cuisineCount} cuisine{' '}
        {cuisineCount === 1 ? 'preference' : 'preferences'} saved. Your feed will feel like it was made for you.
      </p>
    </div>
  )
}
