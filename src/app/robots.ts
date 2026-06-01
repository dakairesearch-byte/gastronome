import type { MetadataRoute } from 'next'

/**
 * robots.txt (Next.js 16 `robots.ts` convention).
 *
 * Allow general crawling of the public browse surface; disallow the
 * authenticated/admin/internal areas that have no SEO value and should
 * never appear in search results. Sitemap points crawlers at the
 * dynamic sitemap.ts route.
 */
const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
).replace(/\/$/, '')

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin', '/api', '/onboarding', '/auth'],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  }
}
