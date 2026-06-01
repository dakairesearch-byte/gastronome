import { describe, it, expect } from 'vitest'
import { formatCount, formatRating } from './format'

describe('formatRating', () => {
  it('returns null for null/undefined (callers render a "no rating" affordance)', () => {
    expect(formatRating(null)).toBeNull()
    expect(formatRating(undefined)).toBeNull()
  })

  it('fixes ratings to a single decimal', () => {
    expect(formatRating(4.7)).toBe('4.7')
    expect(formatRating(4)).toBe('4.0')
    expect(formatRating(4.25)).toBe('4.3') // rounds half up
  })

  it('treats 0 as a real rating, not absent', () => {
    expect(formatRating(0)).toBe('0.0')
  })
})

describe('formatCount', () => {
  it('returns "0" for null/undefined/NaN', () => {
    expect(formatCount(null)).toBe('0')
    expect(formatCount(undefined)).toBe('0')
    expect(formatCount(NaN)).toBe('0')
  })

  it('renders sub-thousand counts with locale grouping, not abbreviated', () => {
    expect(formatCount(0)).toBe('0')
    expect(formatCount(999)).toBe('999')
  })

  it('abbreviates thousands with one decimal', () => {
    expect(formatCount(1_000)).toBe('1.0K')
    expect(formatCount(12_345)).toBe('12.3K')
  })

  it('never prints "1000.0K" — promotes near-million values to millions', () => {
    // The load-bearing boundary: 999_999 rounds to 1.0M at /1000 precision,
    // so it must cross into the M bucket rather than render "1000.0K".
    expect(formatCount(999_999)).toBe('1.0M')
    expect(formatCount(999_950)).toBe('1.0M')
    // Just below the promotion threshold stays in K and must not be "1000.0K".
    const justBelow = formatCount(999_949)
    expect(justBelow).not.toBe('1000.0K')
    expect(justBelow).toBe('999.9K')
  })

  it('abbreviates millions with one decimal', () => {
    expect(formatCount(1_500_000)).toBe('1.5M')
    expect(formatCount(1_000_000)).toBe('1.0M')
  })
})
