'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import type { CSSProperties, ReactNode } from 'react'

interface BackButtonProps {
  /**
   * Fallback destination when the browser has no history to pop (e.g.
   * user landed here via a direct link / tab restore). Without this we
   * call `router.back()` and blow out of the tab.
   */
  fallbackHref: string
  /** Accessible label when the button is announced by a screen reader. */
  ariaLabel?: string
  /** Icon size — defaults to 14 to match existing call sites. */
  iconSize?: number
  className?: string
  style?: CSSProperties
  children: ReactNode
}

/**
 * History-aware "back" affordance.
 *
 * Prior bug: the restaurant detail page rendered a hardcoded
 * `<Link href="/explore">Discover</Link>` regardless of where the user
 * came from — so a visitor who arrived via a City page, Collection, or
 * shared URL was bounced to /explore and lost their context. We now use
 * `router.back()` when history is available, and fall back to the given
 * href on first-render (no history entry, or when opened in a new tab).
 */
export default function BackButton({
  fallbackHref,
  ariaLabel = 'Back',
  iconSize = 14,
  className = '',
  style,
  children,
}: BackButtonProps) {
  const router = useRouter()

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    // If there's nothing to pop (history length 1 on a fresh tab), let
    // the <Link> fall through to navigate to the fallback.
    if (typeof window === 'undefined') return
    if (window.history.length > 1) {
      e.preventDefault()
      router.back()
    }
  }

  return (
    <Link
      href={fallbackHref}
      onClick={handleClick}
      aria-label={ariaLabel}
      className={className}
      style={style}
    >
      <ArrowLeft size={iconSize} />
      {children}
    </Link>
  )
}
