/**
 * Shared formatters for ratings, counts, and other display values.
 * Centralizes precision/abbreviation rules that were previously inlined
 * across 14+ components.
 */

/**
 * Format a rating to a single decimal (e.g. 4.7). Returns null if no
 * rating is present so callers can choose what to render — most show a
 * "No rating yet" affordance.
 */
export function formatRating(rating: number | null | undefined): string | null {
  if (rating == null) return null
  return rating.toFixed(1)
}

/**
 * Abbreviate large numbers for display next to social/review counts:
 *   1_500_000 → "1.5M"
 *   12_345 → "12.3K"
 *   999 → "999"
 */
export function formatCount(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`
  return count.toLocaleString()
}
