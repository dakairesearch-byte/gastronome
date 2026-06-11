/**
 * checklists.ts — data helpers for editorial checklist quests.
 *
 * Three list types per metro (derived from existing accolade flags):
 *   - eater38:    restaurants where eater_38 = true
 *   - michelin:   restaurants where michelin_stars > 0
 *   - bib:        restaurants where michelin_designation = 'bib_gourmand'
 *
 * "Tried" = the authenticated user has a row in `reviews` for that restaurant
 *   (rating may be null — a bare Been via submit_verdict counts).
 *
 * Progress is computed server-side when user is known, client-side-fetched
 * when the user state resolves on the client.
 */

export type ChecklistType = 'eater38' | 'michelin' | 'bib'

export interface ChecklistMeta {
  type: ChecklistType
  /** URL slug, e.g. "new-york-eater-38" */
  slug: string
  city: string
  title: string
  subtitle: string
  /** Hex color for the accent ring / badge */
  color: string
  /** Tailwind-compatible bg class for the badge pill */
  bgClass: string
  textClass: string
}

/** Canonical checklist definitions. */
export const CHECKLIST_TYPES: Record<ChecklistType, {
  title: (city: string) => string
  subtitle: (city: string) => string
  color: string
  bgClass: string
  textClass: string
}> = {
  eater38: {
    title: (city) => `${city} Eater 38`,
    subtitle: () => "The most essential restaurants according to Eater's editors.",
    color: '#be185d', // pink-700
    bgClass: 'bg-pink-50',
    textClass: 'text-pink-700',
  },
  michelin: {
    title: (city) => `${city} Michelin Stars`,
    subtitle: () => "Restaurants holding at least one Michelin star.",
    color: '#dc2626', // red-600
    bgClass: 'bg-red-50',
    textClass: 'text-red-700',
  },
  bib: {
    title: (city) => `${city} Bib Gourmand`,
    subtitle: () => "Michelin Bib Gourmand — exceptional food at moderate prices.",
    color: '#b45309', // amber-700
    bgClass: 'bg-amber-50',
    textClass: 'text-amber-700',
  },
}

/** Build a slug from city + type, e.g. "new-york-eater-38" */
export function buildSlug(city: string, type: ChecklistType): string {
  const citySlug = city.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
  const typePart = type === 'eater38' ? 'eater-38' : type === 'michelin' ? 'michelin-stars' : 'bib-gourmand'
  return `${citySlug}-${typePart}`
}

/** Reverse a slug into { city, type } (best-effort, server queries validate). */
export function parseSlug(slug: string): { citySlug: string; type: ChecklistType } | null {
  if (slug.endsWith('-eater-38')) {
    return { citySlug: slug.slice(0, -'-eater-38'.length), type: 'eater38' }
  }
  if (slug.endsWith('-michelin-stars')) {
    return { citySlug: slug.slice(0, -'-michelin-stars'.length), type: 'michelin' }
  }
  if (slug.endsWith('-bib-gourmand')) {
    return { citySlug: slug.slice(0, -'-bib-gourmand'.length), type: 'bib' }
  }
  return null
}

export function checklistMeta(city: string, type: ChecklistType): ChecklistMeta {
  const def = CHECKLIST_TYPES[type]
  return {
    type,
    slug: buildSlug(city, type),
    city,
    title: def.title(city),
    subtitle: def.subtitle(city),
    color: def.color,
    bgClass: def.bgClass,
    textClass: def.textClass,
  }
}

/** Minimal restaurant row needed for checklist display. */
export interface ChecklistRestaurant {
  id: string
  name: string
  city: string | null
  neighborhood: string | null
  cuisine: string | null
  michelin_stars: number | null
  michelin_designation: string | null
  eater_38: boolean | null
  google_rating: number | null
  photo_url: string | null
  google_photo_url: string | null
}
