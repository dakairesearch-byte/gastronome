/**
 * StaticMapTile — a single Google Static Maps <img> tile.
 *
 * Static Maps is a different Google product from Maps Embed: it renders a
 * flat map image via a plain <img> request and is typically enabled on the
 * same key we already use for Places (NEXT_PUBLIC_GOOGLE_PLACES_API_KEY),
 * whereas the Embed iframe needs a dedicated Embed key. This lets us show a
 * real, recognizable map without provisioning a new key.
 *
 * Returns `null` when coordinates are missing OR the key is unset — callers
 * are expected to render their own fallback (an empty half-column is worse
 * than a tasteful placeholder). If the key lacks Static Maps permission the
 * request just 403s and the <img> fails gracefully.
 *
 * The interactive map (Google Maps JS API) will replace this later; for now
 * this un-breaks the dormant map panels cheaply.
 */

interface StaticMapTileProps {
  lat: number | null | undefined
  lng: number | null | undefined
  /** Used for the <img> alt text. */
  label?: string
  /** Google Static Maps zoom level. Default 15 (street-level). */
  zoom?: number
  className?: string
}

export default function StaticMapTile({
  lat,
  lng,
  label,
  zoom = 15,
  className,
}: StaticMapTileProps) {
  const key = process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY

  // No coordinates or no key → caller shows its own fallback.
  if (
    !key ||
    typeof lat !== 'number' ||
    typeof lng !== 'number' ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lng)
  ) {
    return null
  }

  // scale=2 renders crisp on retina; size is a 16:10-ish frame that the
  // responsive `w-full h-full object-cover` below fits into any container.
  const src =
    `https://maps.googleapis.com/maps/api/staticmap` +
    `?center=${lat},${lng}` +
    `&zoom=${zoom}` +
    `&size=640x400` +
    `&scale=2` +
    `&markers=color:0x6B95A8%7C${lat},${lng}` +
    `&key=${key}`

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={label ? `Map showing ${label}` : 'Map'}
      loading="lazy"
      className={`w-full h-full object-cover ${className ?? ''}`.trim()}
      style={{ display: 'block' }}
    />
  )
}
