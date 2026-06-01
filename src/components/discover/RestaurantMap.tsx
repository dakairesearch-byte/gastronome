'use client'

/* eslint-disable @typescript-eslint/no-explicit-any -- Google Maps JS API has no bundled types; install @types/google.maps to remove these */

import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { Crosshair, Search } from 'lucide-react'
import StaticMapTile from '@/components/StaticMapTile'
import { gastronomeScore } from '@/lib/score'
import { Restaurant } from '@/types/database'

export interface MapBounds {
  north: number
  south: number
  east: number
  west: number
}

interface RestaurantMapProps {
  restaurants: Restaurant[]
  selectedId?: string | null
  onSelect?: (id: string) => void
  onSearchArea?: (b: MapBounds) => void
  className?: string
  /**
   * Fires (debounced) whenever the user finishes panning/zooming the map.
   * Used by DiscoverMapView to enable a "Search this area" affordance only
   * after the viewport actually moves (Beli behavior). Optional — older
   * callers (the W3 split-pane) don't pass it and keep working.
   */
  onBoundsChange?: (b: MapBounds) => void
  /**
   * When true, the built-in "Search this area" button is hidden so the host
   * (DiscoverMapView) can render its own area-search affordance over the
   * full-bleed map. Defaults to false to preserve the W3 split-pane look.
   */
  hideSearchAreaButton?: boolean
  /**
   * Optional render-prop for the in-map preview card shown when a pin is
   * selected. Receives the selected restaurant and a close handler. When
   * omitted, no preview overlay is rendered (the host owns the preview, e.g.
   * in a bottom sheet). Lets the parent supply token-styled markup without
   * RestaurantMap importing card components.
   */
  renderPreview?: (restaurant: Restaurant, close: () => void) => React.ReactNode
}

// The Maps JS key. Mirrors the autocomplete file but prefers a dedicated
// Maps key, falling back to the shared Places key.
const MAPS_KEY =
  process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ||
  process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY

// Garnet pin SVG, recolored when selected. Encoded as a data URI marker icon.
const pinSvg = (selected: boolean) => {
  const fill = selected ? '#7a2e2e' : '#9e3535' // var(--color-action) family, darker when selected
  const stroke = '#ffffff'
  return (
    'data:image/svg+xml;charset=UTF-8,' +
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="34" height="44" viewBox="0 0 34 44">` +
        `<path d="M17 0C7.6 0 0 7.6 0 17c0 12 17 27 17 27s17-15 17-27C34 7.6 26.4 0 17 0z" fill="${fill}" stroke="${stroke}" stroke-width="2"/>` +
        `<circle cx="17" cy="17" r="11" fill="#ffffff"/>` +
      `</svg>`
    )
  )
}

function hasCoords(r: Restaurant): r is Restaurant & { latitude: number; longitude: number } {
  return (
    typeof r.latitude === 'number' &&
    typeof r.longitude === 'number' &&
    Number.isFinite(r.latitude) &&
    Number.isFinite(r.longitude)
  )
}

export default function RestaurantMap({
  restaurants,
  selectedId,
  onSelect,
  onSearchArea,
  className = '',
  onBoundsChange,
  hideSearchAreaButton = false,
  renderPreview,
}: RestaurantMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const markersRef = useRef<Map<string, any>>(new Map())
  const listenersRef = useRef<any[]>([])
  const boundsListenerRef = useRef<any>(null)
  const boundsDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Keep the latest onBoundsChange in a ref so the idle listener (attached
  // once when the map is created) always calls the current callback without
  // re-attaching on every render. Synced in an effect (not during render) to
  // satisfy react-hooks/refs.
  const onBoundsChangeRef = useRef(onBoundsChange)
  useEffect(() => {
    onBoundsChangeRef.current = onBoundsChange
  }, [onBoundsChange])

  const [sdkReady, setSdkReady] = useState(false)
  // MAPS_KEY is a module constant, so the "no key" failure is known at first
  // render — seed it into state rather than setting it inside an effect
  // (which would cascade a render). The effect only flips this on async load
  // failure.
  const [sdkFailed, setSdkFailed] = useState(!MAPS_KEY)

  // Restaurants that actually have coordinates.
  const located = useMemo(() => restaurants.filter(hasCoords), [restaurants])

  // The currently-selected restaurant (for the in-map preview overlay).
  const selectedRestaurant = useMemo(
    () => (selectedId ? restaurants.find((r) => r.id === selectedId) ?? null : null),
    [restaurants, selectedId]
  )

  // Result-set center for the static fallback tile.
  const center = useMemo(() => {
    if (located.length === 0) return { lat: null as number | null, lng: null as number | null }
    const sum = located.reduce(
      (acc, r) => ({ lat: acc.lat + r.latitude!, lng: acc.lng + r.longitude! }),
      { lat: 0, lng: 0 }
    )
    return { lat: sum.lat / located.length, lng: sum.lng / located.length }
  }, [located])

  // Singleton loader for the Google Maps JS API. Mirrors
  // GooglePlacesAutocomplete: reuse an already-loaded SDK, attach to an
  // in-flight shared script, or inject one tag that is never removed.
  useEffect(() => {
    if (!MAPS_KEY) return

    let cancelled = false
    const init = () => {
      if (!cancelled && window.google?.maps) setSdkReady(true)
    }
    const fail = () => {
      if (!cancelled) setSdkFailed(true)
    }

    if (window.google?.maps) {
      init()
      return () => {
        cancelled = true
      }
    }

    const existing = document.querySelector<HTMLScriptElement>('script[data-google-places]')
    if (existing) {
      existing.addEventListener('load', init)
      existing.addEventListener('error', fail)
      // If a places-only script is already loaded, window.google.maps still
      // exists (places lives under maps), so polling covers the race.
      const poll = window.setInterval(() => {
        if (window.google?.maps) {
          window.clearInterval(poll)
          init()
        }
      }, 150)
      return () => {
        cancelled = true
        window.clearInterval(poll)
        existing.removeEventListener('load', init)
        existing.removeEventListener('error', fail)
      }
    }

    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${MAPS_KEY}&libraries=places`
    script.async = true
    script.defer = true
    script.dataset.googlePlaces = 'true'
    script.addEventListener('load', init)
    script.addEventListener('error', fail)
    document.head.appendChild(script)

    // Intentionally do NOT remove the shared script on unmount.
    return () => {
      cancelled = true
      script.removeEventListener('load', init)
      script.removeEventListener('error', fail)
    }
  }, [])

  // Create the map once the SDK is ready.
  useEffect(() => {
    if (!sdkReady || !mapContainerRef.current || mapRef.current) return
    const g = window.google as any
    mapRef.current = new g.maps.Map(mapContainerRef.current, {
      center: { lat: center.lat ?? 40.7128, lng: center.lng ?? -74.006 },
      zoom: 12,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      clickableIcons: false,
      gestureHandling: 'greedy', // one-finger pan on mobile (Beli-style full map)
    })

    // Emit a debounced bounds-change on idle (after pan/zoom settles). Attached
    // once; reads the live callback via the ref so it survives prop churn.
    boundsListenerRef.current = mapRef.current.addListener('idle', () => {
      const cb = onBoundsChangeRef.current
      if (!cb || !mapRef.current) return
      const b = mapRef.current.getBounds()
      if (!b) return
      const ne = b.getNorthEast()
      const sw = b.getSouthWest()
      if (boundsDebounceRef.current) clearTimeout(boundsDebounceRef.current)
      boundsDebounceRef.current = setTimeout(() => {
        cb({ north: ne.lat(), south: sw.lat(), east: ne.lng(), west: sw.lng() })
      }, 250)
    })
  }, [sdkReady, center.lat, center.lng])

  // Tear down the idle listener + pending debounce on unmount.
  useEffect(() => {
    return () => {
      const g = window.google as any
      if (boundsListenerRef.current && g?.maps?.event) {
        g.maps.event.removeListener(boundsListenerRef.current)
        boundsListenerRef.current = null
      }
      if (boundsDebounceRef.current) clearTimeout(boundsDebounceRef.current)
    }
  }, [])

  // Rebuild markers whenever the located set changes.
  useEffect(() => {
    if (!sdkReady || !mapRef.current) return
    const g = window.google as any
    const map = mapRef.current

    // Clear existing markers + listeners.
    listenersRef.current.forEach((l) => g.maps.event.removeListener(l))
    listenersRef.current = []
    markersRef.current.forEach((m) => m.setMap(null))
    markersRef.current.clear()

    if (located.length === 0) return

    const bounds = new g.maps.LatLngBounds()
    located.forEach((r) => {
      const isSel = r.id === selectedId
      const score = gastronomeScore(r)?.score
      const marker = new g.maps.Marker({
        position: { lat: r.latitude!, lng: r.longitude! },
        map,
        title: r.name,
        icon: {
          url: pinSvg(isSel),
          scaledSize: new g.maps.Size(isSel ? 42 : 34, isSel ? 54 : 44),
          labelOrigin: new g.maps.Point(isSel ? 21 : 17, isSel ? 21 : 17),
        },
        zIndex: isSel ? 999 : 1,
        label:
          typeof score === 'number'
            ? {
                text: score.toFixed(1),
                color: '#9e3535',
                fontSize: '11px',
                fontWeight: '700',
              }
            : undefined,
      })
      const listener = marker.addListener('click', () => onSelect?.(r.id))
      listenersRef.current.push(listener)
      markersRef.current.set(r.id, marker)
      bounds.extend(marker.getPosition())
    })

    if (located.length === 1) {
      map.setCenter(bounds.getCenter())
      map.setZoom(15)
    } else {
      map.fitBounds(bounds, 48)
    }

    return () => {
      listenersRef.current.forEach((l) => g.maps.event.removeListener(l))
      listenersRef.current = []
    }
  }, [sdkReady, located, selectedId, onSelect])

  // Highlight the selected pin without a full rebuild (cheap re-icon + pan).
  useEffect(() => {
    if (!sdkReady || !mapRef.current) return
    const g = window.google as any
    markersRef.current.forEach((marker, id) => {
      const isSel = id === selectedId
      marker.setIcon({
        url: pinSvg(isSel),
        scaledSize: new g.maps.Size(isSel ? 42 : 34, isSel ? 54 : 44),
        labelOrigin: new g.maps.Point(isSel ? 21 : 17, isSel ? 17 : 17),
      })
      marker.setZIndex(isSel ? 999 : 1)
      if (isSel) mapRef.current.panTo(marker.getPosition())
    })
  }, [selectedId, sdkReady])

  const handleSearchArea = useCallback(() => {
    if (!mapRef.current || !onSearchArea) return
    const b = mapRef.current.getBounds()
    if (!b) return
    const ne = b.getNorthEast()
    const sw = b.getSouthWest()
    onSearchArea({
      north: ne.lat(),
      south: sw.lat(),
      east: ne.lng(),
      west: sw.lng(),
    })
  }, [onSearchArea])

  const handleNearMe = useCallback(() => {
    if (!mapRef.current || typeof navigator === 'undefined' || !navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const g = window.google as any
        const here = new g.maps.LatLng(pos.coords.latitude, pos.coords.longitude)
        mapRef.current.panTo(here)
        mapRef.current.setZoom(14)
      },
      () => {
        /* permission denied / unavailable — silently ignore */
      },
      { enableHighAccuracy: true, timeout: 8000 }
    )
  }, [])

  // GRACEFUL DEGRADATION: no key, or SDK failed to load → static tile of the
  // result-set center. StaticMapTile returns null when it can't render, so we
  // wrap it with a token-colored placeholder underneath.
  if (sdkFailed || !MAPS_KEY) {
    return (
      <div
        className={`relative h-full w-full overflow-hidden ${className}`}
        style={{ backgroundColor: 'var(--color-surface-muted, #f1ede6)' }}
      >
        <StaticMapTile lat={center.lat} lng={center.lng} label="Search results" zoom={12} />
      </div>
    )
  }

  return (
    <div className={`relative h-full w-full overflow-hidden ${className}`}>
      <div ref={mapContainerRef} className="h-full w-full" />

      {/* Controls — garnet (var(--color-action)). The host (DiscoverMapView)
          can hide this and render its own area-search affordance. */}
      {!hideSearchAreaButton && (
        <div className="pointer-events-none absolute inset-x-0 top-3 flex justify-center">
          <button
            type="button"
            onClick={handleSearchArea}
            className="pointer-events-auto inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-white shadow-md transition hover:opacity-90"
            style={{ backgroundColor: 'var(--color-action)' }}
          >
            <Search size={15} />
            Search this area
          </button>
        </div>
      )}

      {/* In-map preview card for the selected pin (host-supplied markup). */}
      {renderPreview && selectedRestaurant && (
        <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center px-3">
          <div className="pointer-events-auto w-full max-w-sm">
            {renderPreview(selectedRestaurant, () => onSelect?.(''))}
          </div>
        </div>
      )}

      <div className="absolute bottom-4 right-3">
        <button
          type="button"
          onClick={handleNearMe}
          aria-label="Center map on my location"
          className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-md transition hover:opacity-90"
          style={{ color: 'var(--color-action)' }}
        >
          <Crosshair size={20} />
        </button>
      </div>

      {/* Loading shimmer until the map paints. */}
      {!sdkReady && (
        <div
          className="absolute inset-0 animate-pulse"
          style={{ backgroundColor: 'var(--color-surface-muted, #f1ede6)' }}
        />
      )}
    </div>
  )
}
