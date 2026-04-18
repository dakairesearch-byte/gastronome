'use client'

import { useEffect, useState } from 'react'
import { Share2, Check, AlertCircle } from 'lucide-react'

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

type ToastState =
  | { kind: 'idle' }
  | { kind: 'copied' }
  | { kind: 'shared' }
  | { kind: 'error'; message: string }

/**
 * Restaurant share button.
 *
 * Prefers the Web Share API (`navigator.share`) — on iOS/Android this
 * opens the native share sheet (Messages, AirDrop, Mail, WhatsApp, …).
 * Falls back to clipboard copy on desktop browsers that don't implement
 * it, with a short "Copied" toast.
 *
 * `navigator.share` only resolves the Promise after the user picks a
 * target, so cancellations show up as an `AbortError` that we swallow.
 *
 * Visible feedback is mandatory on every code path — previous QA bug:
 * on desktop Safari without clipboard permission the button appeared to
 * do nothing, and users clicked it repeatedly.
 */
export default function ShareButton({
  title,
  text,
  url,
  className = '',
}: ShareButtonProps) {
  const [state, setState] = useState<ToastState>({ kind: 'idle' })

  // Auto-dismiss any non-idle state after 2.5s.
  useEffect(() => {
    if (state.kind === 'idle') return
    const t = window.setTimeout(() => setState({ kind: 'idle' }), 2500)
    return () => window.clearTimeout(t)
  }, [state])

  const handleShare = async () => {
    const shareUrl =
      url ?? (typeof window !== 'undefined' ? window.location.href : '')
    const payload = { title, text, url: shareUrl }

    const nav = typeof navigator !== 'undefined' ? navigator : null

    if (nav?.share) {
      try {
        if (!nav.canShare || nav.canShare(payload)) {
          await nav.share(payload)
          setState({ kind: 'shared' })
          return
        }
      } catch (err) {
        // User dismissed the sheet — don't fall through to clipboard.
        if ((err as DOMException)?.name === 'AbortError') {
          setState({ kind: 'idle' })
          return
        }
      }
    }

    try {
      if (!nav?.clipboard?.writeText) {
        throw new Error('Clipboard API unavailable')
      }
      await nav.clipboard.writeText(shareUrl)
      setState({ kind: 'copied' })
    } catch {
      setState({
        kind: 'error',
        message: 'Copy failed — copy the URL from your address bar',
      })
    }
  }

  const isCopied = state.kind === 'copied'
  const isError = state.kind === 'error'

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={handleShare}
        aria-label={
          isCopied ? 'Link copied' : isError ? state.message : 'Share restaurant'
        }
        aria-live="polite"
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 backdrop-blur-sm rounded-lg text-xs font-medium text-gray-200 border border-white/10 transition-colors ${className}`}
      >
        {isCopied ? (
          <Check size={14} />
        ) : isError ? (
          <AlertCircle size={14} />
        ) : (
          <Share2 size={14} />
        )}
        {isCopied ? 'Copied' : isError ? 'Error' : 'Share'}
      </button>
      {(isCopied || isError) && (
        <div
          role="status"
          className={`absolute right-0 top-full mt-2 px-3 py-1.5 rounded-md shadow-lg text-xs whitespace-nowrap z-50 ${
            isError ? 'bg-red-600 text-white' : 'bg-gray-900 text-white'
          }`}
        >
          {isCopied ? 'Link copied to clipboard' : state.message}
        </div>
      )}
    </div>
  )
}
