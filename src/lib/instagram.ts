/**
 * Instagram URL + handle helpers for the manual-curation ingestion path.
 *
 * We don't call any Instagram API — the admin UI only parses URLs pasted in
 * by hand and builds the public iframe embed URL. No auth, no rate limits.
 */

const HANDLE_PATTERN = /^[A-Za-z0-9_.]{1,30}$/

const REEL_PATH_PATTERN = /instagram\.com\/(?:reel|reels|p|tv)\/([A-Za-z0-9_-]{5,})/

/**
 * Normalize a raw handle string: strip leading @, whitespace, and any URL
 * wrapper a user might paste (e.g. `https://www.instagram.com/carbonenyc/`).
 * Returns null if nothing usable is left.
 */
export function normalizeHandle(raw: string | null | undefined): string | null {
  if (!raw) return null
  let value = raw.trim()
  if (!value) return null

  // Accept a full profile URL and pull out the handle segment.
  const urlMatch = value.match(/instagram\.com\/([A-Za-z0-9_.]{1,30})\/?/)
  if (urlMatch) {
    value = urlMatch[1]
  }

  value = value.replace(/^@+/, '').trim()
  if (!HANDLE_PATTERN.test(value)) return null
  return value.toLowerCase()
}

export function buildProfileUrl(handle: string): string {
  return `https://www.instagram.com/${handle}/`
}

/**
 * Parse an Instagram reel/post URL and extract the shortcode.
 * Accepts /reel/, /reels/, /p/, /tv/ variants with or without www.
 * Returns null if the input isn't a recognizable IG content URL.
 */
export function extractReelShortcode(raw: string | null | undefined): string | null {
  if (!raw) return null
  const trimmed = raw.trim()
  if (!trimmed) return null
  const match = trimmed.match(REEL_PATH_PATTERN)
  return match ? match[1] : null
}

export function buildReelUrl(shortcode: string): string {
  return `https://www.instagram.com/reel/${shortcode}/`
}

export function buildReelEmbedUrl(shortcode: string): string {
  return `https://www.instagram.com/reel/${shortcode}/embed/`
}
