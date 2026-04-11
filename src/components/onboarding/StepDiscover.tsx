'use client'

import { BarChart3, Star } from 'lucide-react'

interface StepDiscoverProps {
  totalRestaurants: number
  totalCities: number
  onNext: () => void
}

export default function StepDiscover({
  totalRestaurants,
  totalCities,
  onNext,
}: StepDiscoverProps) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-gradient-to-br from-gray-900 via-gray-900 to-emerald-950 text-white">
      <div className="max-w-lg w-full text-center space-y-8">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500/15 border border-emerald-500/20 rounded-full text-emerald-400 text-sm font-medium">
          <BarChart3 size={16} />
          Rating Aggregator
        </div>

        <h1 className="text-4xl sm:text-5xl font-extrabold leading-tight tracking-tight">
          Every Rating.{' '}
          <span className="bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
            One Place.
          </span>
        </h1>

        <p className="text-lg text-gray-400 max-w-md mx-auto">
          We aggregate ratings from Google, Yelp, The Infatuation, and Michelin
          — so you always get the full picture.
        </p>

        {/* Mock rating badges */}
        <div className="flex items-center justify-center gap-3 flex-wrap">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/20 text-blue-300 text-sm font-semibold border border-blue-500/30">
            G <span className="text-white">4.7</span>
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/20 text-red-300 text-sm font-semibold border border-red-500/30">
            Y <span className="text-white">4.5</span>
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-500/20 text-orange-300 text-sm font-semibold border border-orange-500/30">
            TI <span className="text-white">8.2</span>
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600/20 text-red-200 text-sm font-semibold border border-red-500/30">
            <Star size={14} className="fill-current" /> Michelin
          </span>
        </div>

        {/* Social proof */}
        <div className="flex items-center justify-center gap-6 text-sm text-gray-500 pt-4">
          {totalRestaurants > 0 && (
            <span>
              <strong className="text-gray-300">{totalRestaurants.toLocaleString()}</strong>{' '}
              restaurants
            </span>
          )}
          {totalCities > 0 && (
            <span>
              <strong className="text-gray-300">{totalCities}</strong> cities
            </span>
          )}
          <span>
            <strong className="text-gray-300">4</strong> rating sources
          </span>
        </div>

        <button
          onClick={onNext}
          className="mt-4 px-8 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold text-sm transition-colors shadow-lg shadow-emerald-900/30"
        >
          See How It Works &rarr;
        </button>
      </div>
    </div>
  )
}
