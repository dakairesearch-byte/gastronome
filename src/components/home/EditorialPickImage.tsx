'use client'

import { useState } from 'react'
import { fallbackPhotoForCuisine } from '@/lib/restaurant'

/**
 * Editorial-pick tile image with an onError fallback. The home page is a
 * server component, so it can't attach an `onError` handler directly — the
 * raw Unsplash URLs the editorial picks use would render as broken images
 * if the upstream photo 404/403s or the network blocks Unsplash. This thin
 * client wrapper swaps in the generic cuisine fallback once, guarded so a
 * failing fallback doesn't loop.
 */
export default function EditorialPickImage({ src }: { src: string }) {
  const [resolvedSrc, setResolvedSrc] = useState(src)
  const [errored, setErrored] = useState(false)

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={resolvedSrc}
      alt=""
      className="w-full h-full object-cover transition-transform group-hover:scale-110 duration-700"
      onError={() => {
        if (errored) return
        setErrored(true)
        setResolvedSrc(fallbackPhotoForCuisine(null))
      }}
    />
  )
}
