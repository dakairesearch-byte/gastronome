import { redirect } from 'next/navigation'

/**
 * /explore was merged into /discover in Reformulation Wave 2 (Explore +
 * Search were the same product built twice). next.config.ts already
 * permanently redirects /explore -> /discover at the edge — this stub is a
 * belt-and-suspenders fallback that also forwards the query string so any
 * direct render path (or a future config change) still lands users on the
 * unified surface with their ?city= / ?accolade= / ?cuisine= intent intact.
 */
export default async function ExplorePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const qs = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      for (const v of value) qs.append(key, v)
    } else if (value != null) {
      qs.set(key, value)
    }
  }
  const str = qs.toString()
  redirect(str ? `/discover?${str}` : '/discover')
}
