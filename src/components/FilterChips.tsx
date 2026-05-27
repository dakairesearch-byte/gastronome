'use client'

import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Check, X } from 'lucide-react'

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
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const hasActiveFilters = selectedCuisines.length > 0

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    // Escape closes the dropdown so keyboard users aren't trapped.
    // Sweep v2 filtering QW: "Add Escape-to-close on the FilterChips
    // dropdown (mouse-outside works, keyboard is trapped)."
    function handleKeydown(event: KeyboardEvent) {
      if (event.key === 'Escape' && isOpen) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeydown)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeydown)
    }
  }, [isOpen])

  return (
    <div className="flex items-center gap-2">
      <div className="relative" ref={dropdownRef}>
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border transition-colors min-h-[44px] focus-visible:ring-2 focus-visible:ring-emerald-500 outline-none ${
            hasActiveFilters
              ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
              : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
          }`}
        >
          Cuisine
          {hasActiveFilters && (
            <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-bold bg-emerald-500 text-white rounded-full">
              {selectedCuisines.length}
            </span>
          )}
          <ChevronDown size={14} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {isOpen && (
          <div className="absolute top-full left-0 mt-1 w-56 bg-white border border-gray-200 rounded-xl shadow-lg z-50 py-1 max-h-64 overflow-y-auto">
            {cuisines.map((cuisine) => {
              const isSelected = selectedCuisines.includes(cuisine)
              return (
                <button
                  type="button"
                  key={cuisine}
                  onClick={() => onCuisineChange(cuisine)}
                  className={`w-full flex items-center justify-between px-3 py-2 text-sm transition-colors ${
                    isSelected
                      ? 'bg-emerald-50 text-emerald-700 font-medium'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {cuisine}
                  {isSelected && <Check size={14} className="text-emerald-500" />}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Selected cuisine pills */}
      {hasActiveFilters && (
        <>
          <div className="flex flex-wrap gap-1.5">
            {selectedCuisines.map((cuisine) => (
              <span
                key={cuisine}
                className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-md text-xs font-medium"
              >
                {cuisine}
                <button
                  type="button"
                  onClick={() => onCuisineChange(cuisine)}
                  className="hover:text-emerald-900"
                  aria-label={`Remove ${cuisine} filter`}
                >
                  <X size={12} aria-hidden="true" />
                </button>
              </span>
            ))}
          </div>
          {onClearAll && (
            <button
              type="button"
              onClick={onClearAll}
              // Darkened from text-gray-400 to text-gray-600 so the
              // hit target meets WCAG AA contrast against white at
              // 12px — flagged by filtering specialist (low-contrast
              // "Clear" button).
              className="text-xs text-gray-600 hover:text-gray-800 underline-offset-2 hover:underline whitespace-nowrap"
              aria-label="Clear all cuisine filters"
            >
              Clear
            </button>
          )}
        </>
      )}
    </div>
  )
}
