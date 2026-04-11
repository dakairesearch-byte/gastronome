'use client'

import { useState, useEffect } from 'react'
import OnboardingFlow from '@/components/onboarding/OnboardingFlow'
import GenericHomepage from './GenericHomepage'
import type { Restaurant, City } from '@/types/database'
import type { TrendingRestaurant } from '@/lib/placement'

interface HomeClientProps {
  trendingRestaurants: Restaurant[]
  trending?: TrendingRestaurant[]
  cities: City[]
  totalRestaurants: number
  totalCities: number
}

export default function HomeClient(props: HomeClientProps) {
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const seen = localStorage.getItem('gastronome_onboarding_done')
    if (!seen) {
      setShowOnboarding(true)
    }
  }, [])

  // Avoid hydration mismatch — show nothing briefly until client decides
  if (!mounted) {
    return <div className="min-h-screen bg-gray-900" />
  }

  if (showOnboarding) {
    return (
      <OnboardingFlow
        totalRestaurants={props.totalRestaurants}
        totalCities={props.totalCities}
        cities={props.cities}
        onSkip={() => {
          localStorage.setItem('gastronome_onboarding_done', '1')
          setShowOnboarding(false)
        }}
      />
    )
  }

  return <GenericHomepage {...props} />
}
