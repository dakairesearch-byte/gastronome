'use client'

import { AlertTriangle, CheckCircle } from 'lucide-react'

interface StepCompareProps {
  onNext: () => void
}

const mockRatings = [
  { source: 'Google', rating: 4.8, max: 5, color: 'bg-blue-500' },
  { source: 'Yelp', rating: 4.0, max: 5, color: 'bg-red-500' },
  { source: 'Infatuation', rating: 8.6, max: 10, color: 'bg-orange-500' },
]

export default function StepCompare({ onNext }: StepCompareProps) {
  const composite = (
    (4.8 + 4.0 + 8.6 / 2) / 3
  ).toFixed(1)

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-white">
      <div className="max-w-lg w-full text-center space-y-8">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 leading-tight">
          Stop Guessing.{' '}
          <span className="text-emerald-600">Start Knowing.</span>
        </h1>

        {/* Problem */}
        <div className="bg-red-50 border border-red-200 rounded-xl p-5 text-left">
          <div className="flex items-start gap-3">
            <AlertTriangle size={20} className="text-red-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-red-800">The problem</p>
              <p className="text-sm text-red-700 mt-1">
                Yelp says 4 stars. Google says 4.8. The Infatuation says 8.6.
                Which one do you trust?
              </p>
            </div>
          </div>
        </div>

        {/* Solution — mock comparison */}
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 text-left space-y-4">
          <div className="flex items-start gap-3">
            <CheckCircle size={20} className="text-emerald-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-gray-900">The Gastronome view</p>
              <p className="text-sm text-gray-600 mt-1">
                All ratings in one view so you can compare with confidence.
              </p>
            </div>
          </div>

          <div className="border-t border-gray-200 pt-4">
            <p className="text-sm font-bold text-gray-900 mb-3">Carbone, New York</p>
            <div className="space-y-2.5">
              {mockRatings.map((r) => (
                <div key={r.source} className="flex items-center gap-3">
                  <span className="text-xs font-medium text-gray-500 w-20">
                    {r.source}
                  </span>
                  <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${r.color} rounded-full transition-all duration-700`}
                      style={{ width: `${(r.rating / r.max) * 100}%` }}
                    />
                  </div>
                  <span className="text-sm font-bold text-gray-900 w-10 text-right">
                    {r.rating}
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-4 pt-3 border-t border-gray-200 flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-700">
                Composite Score
              </span>
              <span className="text-xl font-extrabold text-emerald-600">
                {composite}
              </span>
            </div>
          </div>
        </div>

        <button
          onClick={onNext}
          className="mt-4 px-8 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold text-sm transition-colors"
        >
          What Can You Explore? &rarr;
        </button>
      </div>
    </div>
  )
}
