'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { MapPin, Search, ChevronDown } from 'lucide-react'

const MAJOR_CITIES = [
  'New York',
  'Los Angeles',
  'Chicago',
  'Houston',
  'Phoenix',
  'San Antonio',
  'San Diego',
  'Dallas',
  'Austin',
  'San Francisco',
  'Seattle',
  'Denver',
  'Miami',
  'Atlanta',
  'Boston',
  'Nashville',
  'Portland',
  'Las Vegas',
  'New Orleans',
  'Philadelphia',
]

interface CitySelectorProps {
  availableCities?: string[]
}

export default function CitySelector({ availableCities = [] }: CitySelectorProps) {
  const router = useRouter()
  const [selectedCity, setSelectedCity] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Merge DB cities with major cities, deduplicate, and sort
  const allCities = useMemo(
    () => [...new Set([...availableCities, ...MAJOR_CITIES])].sort(),
    [availableCities]
  )

  const filteredCities = useMemo(
    () => searchQuery.trim()
      ? allCities.filter((city) =>
          city.toLowerCase().includes(searchQuery.toLowerCase())
        )
      : allCities,
    [allCities, searchQuery]
  )

  // Mark which cities have restaurants in the DB
  const citiesWithRestaurants = useMemo(
    () => new Set(availableCities.map((c) => c.toLowerCase())),
    [availableCities]
  )

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleCitySelect = (city: string) => {
    setSelectedCity(city)
    setSearchQuery('')
    setIsOpen(false)
  }

  const handleExplore = () => {
    if (selectedCity) {
      router.push(`/explore?city=${encodeURIComponent(selectedCity)}`)
    } else {
      router.push('/explore')
    }
  }

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      // If the query matches a city, select it
      const match = allCities.find(
        (c) => c.toLowerCase() === searchQuery.toLowerCase()
      )
      if (match) {
        handleCitySelect(match)
      }
    }
  }

  return (
    <div className="w-full max-w-xl mx-auto space-y-4">
      {/* City Selector */}
      <div ref={containerRef} className="relative">
        <div
          className="flex items-center bg-white rounded-2xl shadow-lg border border-emerald-200/60 overflow-hidden cursor-pointer hover:shadow-xl transition-shadow"
          onClick={() => {
            setIsOpen(!isOpen)
            setTimeout(() => inputRef.current?.focus(), 50)
          }}
        >
          <div className="flex items-center gap-2 pl-5 pr-3 py-4 text-emerald-600">
            <MapPin size={22} />
          </div>

          {isOpen ? (
            <form onSubmit={handleSearchSubmit} className="flex-1">
              <input
                ref={inputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search for a city..."
                className="w-full py-4 pr-4 text-gray-900 text-lg bg-transparent outline-none placeholder:text-gray-400"
                autoComplete="off"
              />
            </form>
          ) : (
            <div className="flex-1 py-4 pr-4 flex items-center justify-between">
              <span className={`text-lg ${selectedCity ? 'text-gray-900 font-medium' : 'text-gray-400'}`}>
                {selectedCity || 'Select your city...'}
              </span>
              <ChevronDown size={20} className="text-gray-400" />
            </div>
          )}
        </div>

        {/* Dropdown */}
        {isOpen && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-xl border border-gray-100 z-50 max-h-72 overflow-y-auto">
            {filteredCities.length > 0 ? (
              <ul className="py-2">
                {filteredCities.map((city) => {
                  const hasRestaurants = citiesWithRestaurants.has(city.toLowerCase())
                  return (
                    <li
                      key={city}
                      onClick={() => handleCitySelect(city)}
                      className={`px-5 py-3 cursor-pointer transition-colors flex items-center justify-between ${
                        selectedCity === city
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'hover:bg-gray-50 text-gray-700'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <MapPin size={16} className={selectedCity === city ? 'text-emerald-500' : 'text-gray-400'} />
                        <span className="font-medium">{city}</span>
                      </div>
                      {hasRestaurants && (
                        <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">
                          restaurants
                        </span>
                      )}
                    </li>
                  )
                })}
              </ul>
            ) : (
              <div className="px-5 py-6 text-center text-gray-500">
                No cities found matching &ldquo;{searchQuery}&rdquo;
              </div>
            )}
          </div>
        )}
      </div>

      {/* Explore Button */}
      <button
        onClick={handleExplore}
        className="w-full py-4 bg-gradient-to-r from-emerald-500 to-emerald-500 text-white rounded-2xl hover:from-emerald-600 hover:to-emerald-600 transition-all font-bold text-lg shadow-lg shadow-emerald-500/25 hover:shadow-xl hover:shadow-emerald-500/30 flex items-center justify-center gap-2"
      >
        <Search size={20} />
        {selectedCity ? `Explore ${selectedCity}` : 'Explore All Restaurants'}
      </button>
    </div>
  )
}
