'use client'

import { useState } from 'react'
import { Share2, Check } from 'lucide-react'

interface ShareButtonProps {
  title: string
  text?: string
  /**
   * Override the URL to share. Defaults to `window.location.href`, which
   * is the right answer for any detail page where the component is
   * rendered at the canonical URL for the entity.
   */
  url?: string
  className?: string
}

/**
 * Restaurant share button.
 *
 * Prefers the Web Share API (`navigator.share`) — on iOS/Android this
 * opens the native share sheet (Messages, AirDrop, Mail, WhatsApp, …).
 * Falls back to clipboard copy on desktop browsers that don't implement
 * it, with a short "Copied" confirmation.
 *
 * `navigator.share` only resolves the Promise after the user picks a
 * target, so cancellations show up as an `AbortError` that we swallow.
 */
export default function ShareButton({
  title,
  text,
  url,
  className = '',
}: ShareButtonProps) {
  const [copied, setCopied] = useState(false)

  const handleShare = async () => {
    const shareUrl =
      url ?? (typeof window !== 'undefined' ? window.location.href : '')
    const payload = { title, text, url: shareUrl }

    const nav = typeof navigator !== 'undefined' ? navigator : null

    if (nav?.share) {
      try {
        if (!nav.canShare || nav.canShare(payload)) {
          await nav.share(payload)
          return
        }
      } catch (err) {
        // User dismissed the sheet — don't fall through to clipboard.
        if ((err as DOMException)?.name === 'AbortError') return
      }
    }

    try {
      await nav?.clipboard?.writeText(shareUrl)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard blocked (insecure context, permission denied). No
      // meaningful UI recovery — the user can still copy the URL bar.
    }
  }

  return (
    <button
      type="button"
      onClick={handleShare}
      aria-label={copied ? 'Link copied' : 'Share restaurant'}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 backdrop-blur-sm rounded-lg text-xs font-medium text-gray-200 border border-white/10 transition-colors ${className}`}
    >
      {copied ? <Check size={14} /> : <Share2 size={14} />}
      {copied ? 'Copied' : 'Share'}
    </button>
  )
}
