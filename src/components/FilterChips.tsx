'use client'

import { X } from 'lucide-react'

interface FilterChipsProps {
  cuisines: string[]
  selectedCuisines: string[]
  onCuisineChange: (cuisine: string) => void
  onClearAll?: () => void
}

export default function FilterChips({
  cuisines,
  selectedCuisines,
  onCuisineChange,
  onClearAll,
}: FilterChipsProps) {
  const hasActiveFilters = selectedCuisines.length > 0

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900">Cuisines</h3>
        {hasActiveFilters && onClearAll && (
          <button
            type="button"
            onClick={onClearAll}
            className="text-sm text-emerald-600 hover:text-emerald-700 transition-colors flex items-center gap-1"
          >
            <X size={16} />
            Clear filters
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {cuisines.map((cuisine) => {
          const isSelected = selectedCuisines.includes(cuisine)
          return (
            <button
              type="button"
              key={cuisine}
              onClick={() => onCuisineChange(cuisine)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                isSelected
                  ? 'bg-emerald-500 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {cuisine}
            </button>
          )
        })}
      </div>
    </div>
  )
}
