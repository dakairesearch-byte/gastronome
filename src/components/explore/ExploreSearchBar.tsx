'use client'

import SearchAutocomplete from '@/components/search/SearchAutocomplete'

export default function ExploreSearchBar() {
  return (
    <div
      className="py-6 border-b"
      style={{
        backgroundColor: 'var(--color-surface)',
        borderBottomColor: 'var(--color-border)',
      }}
    >
      <div className="max-w-4xl mx-auto px-6 lg:px-8">
        <SearchAutocomplete
          variant="bar"
          placeholder="Search cities, restaurants, cuisine..."
        />
      </div>
    </div>
  )
}
