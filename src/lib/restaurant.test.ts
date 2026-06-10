import { describe, it, expect } from 'vitest'
import {
  fallbackPhotoForCuisine,
  getRestaurantPhotoUrl,
  isStockFallbackPhoto,
  displayCuisine,
  citySlug,
  hasMeaningfulCuisine,
} from './restaurant'

const GENERIC =
  'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&q=80'
const PIZZA =
  'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=800&q=80'

describe('fallbackPhotoForCuisine', () => {
  it('returns the generic fallback for null/undefined/empty cuisine', () => {
    expect(fallbackPhotoForCuisine(null)).toBe(GENERIC)
    expect(fallbackPhotoForCuisine(undefined)).toBe(GENERIC)
    expect(fallbackPhotoForCuisine('')).toBe(GENERIC)
  })

  it('matches a known cuisine case-insensitively and trimmed', () => {
    expect(fallbackPhotoForCuisine('Pizza')).toBe(PIZZA)
    expect(fallbackPhotoForCuisine('  PIZZA  ')).toBe(PIZZA)
  })

  it('falls back to generic for an unknown cuisine', () => {
    expect(fallbackPhotoForCuisine('Ethiopian')).toBe(GENERIC)
  })
})

describe('getRestaurantPhotoUrl', () => {
  // Matches PhotoFields = Pick<Restaurant, ...>, where `cuisine` is a
  // non-nullable string; '' exercises the empty-cuisine → generic path.
  const base = {
    photo_url: null as string | null,
    google_photo_url: null as string | null,
    yelp_photo_url: null as string | null,
    image_url: null as string | null,
    photo_urls: null as string[] | null,
    website_photo_url: null as string | null,
    cuisine: '',
  }

  it('prefers the first-party photo_url', () => {
    expect(
      getRestaurantPhotoUrl({ ...base, photo_url: 'first.jpg', google_photo_url: 'g.jpg' })
    ).toBe('first.jpg')
  })

  it('falls through photo → google → yelp → cuisine stock', () => {
    expect(getRestaurantPhotoUrl({ ...base, google_photo_url: 'g.jpg' })).toBe('g.jpg')
    expect(getRestaurantPhotoUrl({ ...base, yelp_photo_url: 'y.jpg' })).toBe('y.jpg')
    expect(getRestaurantPhotoUrl({ ...base, cuisine: 'Pizza' })).toBe(PIZZA)
  })

  it('treats empty strings as absent and continues the chain', () => {
    expect(
      getRestaurantPhotoUrl({ ...base, photo_url: '', google_photo_url: '', yelp_photo_url: 'y.jpg' })
    ).toBe('y.jpg')
  })

  it('always returns a usable URL even with no sources and no cuisine', () => {
    expect(getRestaurantPhotoUrl(base)).toBe(GENERIC)
  })
})

describe('isStockFallbackPhoto', () => {
  it('detects cuisine-keyed and generic stock URLs', () => {
    expect(isStockFallbackPhoto(PIZZA)).toBe(true)
    expect(isStockFallbackPhoto(GENERIC)).toBe(true)
  })

  it('returns false for first-party URLs and null/empty', () => {
    expect(isStockFallbackPhoto('https://cdn.example.com/real.jpg')).toBe(false)
    expect(isStockFallbackPhoto(null)).toBe(false)
    expect(isStockFallbackPhoto(undefined)).toBe(false)
    expect(isStockFallbackPhoto('')).toBe(false)
  })
})

describe('displayCuisine', () => {
  it('passes through a real cuisine', () => {
    expect(displayCuisine('Thai')).toBe('Thai')
  })

  it('normalizes null/empty/sentinel to "Restaurant"', () => {
    expect(displayCuisine(null)).toBe('Restaurant')
    expect(displayCuisine(undefined)).toBe('Restaurant')
    expect(displayCuisine('')).toBe('Restaurant')
    expect(displayCuisine('Restaurant')).toBe('Restaurant')
  })
})

describe('hasMeaningfulCuisine', () => {
  it('is true only for a real, non-sentinel cuisine', () => {
    expect(hasMeaningfulCuisine('Italian')).toBe(true)
  })

  it('is false for null/empty/sentinel', () => {
    expect(hasMeaningfulCuisine(null)).toBe(false)
    expect(hasMeaningfulCuisine(undefined)).toBe(false)
    expect(hasMeaningfulCuisine('')).toBe(false)
    expect(hasMeaningfulCuisine('Restaurant')).toBe(false)
  })
})

describe('citySlug', () => {
  it('lowercases and hyphenates spaces and punctuation', () => {
    expect(citySlug('New York')).toBe('new-york')
    expect(citySlug('Los Angeles')).toBe('los-angeles')
    expect(citySlug("St. Louis")).toBe('st-louis')
  })

  it('trims leading/trailing hyphens and whitespace', () => {
    expect(citySlug('  Austin!  ')).toBe('austin')
  })

  it('returns empty string for null/undefined', () => {
    expect(citySlug(null)).toBe('')
    expect(citySlug(undefined)).toBe('')
  })
})
