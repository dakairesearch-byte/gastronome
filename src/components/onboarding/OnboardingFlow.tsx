'use client'

import { useState } from 'react'
import StepDiscover from './StepDiscover'
import StepCompare from './StepCompare'
import StepExplore from './StepExplore'
import StepSignup from './StepSignup'
import type { City } from '@/types/database'

interface OnboardingFlowProps {
  totalRestaurants: number
  totalCities: number
  cities: City[]
  onSkip: () => void
}

export default function OnboardingFlow({
  totalRestaurants,
  totalCities,
  cities,
  onSkip,
}: OnboardingFlowProps) {
  const [step, setStep] = useState(0)

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Progress bar */}
      <div className="fixed top-0 left-0 right-0 z-[60] h-1 bg-gray-800">
        <div
          className="h-full bg-emerald-500 transition-all duration-500 ease-out"
          style={{ width: `${((step + 1) / 4) * 100}%` }}
        />
      </div>

      {/* Skip button */}
      <button
        onClick={onSkip}
        className="fixed top-4 right-4 z-[60] text-sm font-medium text-gray-400 hover:text-white transition-colors px-3 py-1.5 rounded-lg hover:bg-white/10"
      >
        Skip
      </button>

      {/* Steps */}
      <div className="transition-opacity duration-300">
        {step === 0 && (
          <StepDiscover
            totalRestaurants={totalRestaurants}
            totalCities={totalCities}
            onNext={() => setStep(1)}
          />
        )}
        {step === 1 && <StepCompare onNext={() => setStep(2)} />}
        {step === 2 && (
          <StepExplore cities={cities} onNext={() => setStep(3)} />
        )}
        {step === 3 && <StepSignup cities={cities} />}
      </div>
    </div>
  )
}
