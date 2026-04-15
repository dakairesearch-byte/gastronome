'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

interface AdminInstagramFormProps {
  restaurantId: string
  initialHandle: string | null
}

type SubmitResult =
  | { kind: 'idle' }
  | { kind: 'success'; handleUpdated: boolean; inserted: number; invalid: string[] }
  | { kind: 'error'; message: string }

export default function AdminInstagramForm({
  restaurantId,
  initialHandle,
}: AdminInstagramFormProps) {
  const router = useRouter()
  const [handle, setHandle] = useState(initialHandle ?? '')
  const [reelUrlsText, setReelUrlsText] = useState('')
  const [result, setResult] = useState<SubmitResult>({ kind: 'idle' })
  const [isPending, startTransition] = useTransition()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setResult({ kind: 'idle' })

    const reelUrls = reelUrlsText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)

    // Only send handle if it actually changed from what's already saved,
    // OR if the admin is explicitly clearing it. Avoids spurious updates.
    const handleChanged = handle.trim() !== (initialHandle ?? '')
    const payload: Record<string, unknown> = {}
    if (handleChanged) payload.handle = handle.trim()
    if (reelUrls.length > 0) payload.reelUrls = reelUrls

    if (Object.keys(payload).length === 0) {
      setResult({ kind: 'error', message: 'Nothing to save — change the handle or paste reel URLs.' })
      return
    }

    try {
      const res = await fetch(
        `/api/admin/restaurants/${encodeURIComponent(restaurantId)}/instagram`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      )
      const data = await res.json()
      if (!res.ok) {
        setResult({ kind: 'error', message: data.error ?? 'Request failed' })
        return
      }
      setResult({
        kind: 'success',
        handleUpdated: Boolean(data.handleUpdated),
        inserted: Number(data.inserted ?? 0),
        invalid: Array.isArray(data.invalid) ? data.invalid : [],
      })
      setReelUrlsText('')
      startTransition(() => router.refresh())
    } catch (err) {
      setResult({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Unexpected error',
      })
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label
          htmlFor="ig-handle"
          className="block text-xs font-semibold text-gray-700 mb-1"
        >
          Instagram handle
        </label>
        <input
          id="ig-handle"
          type="text"
          value={handle}
          onChange={(e) => setHandle(e.target.value)}
          placeholder="carbonenyc"
          className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition text-sm"
          autoComplete="off"
        />
        <p className="text-[11px] text-gray-400 mt-1">
          Leave blank to clear. Accepts a raw handle, <code>@handle</code>, or a
          full profile URL.
        </p>
      </div>

      <div>
        <label
          htmlFor="ig-reels"
          className="block text-xs font-semibold text-gray-700 mb-1"
        >
          Reel URLs (one per line)
        </label>
        <textarea
          id="ig-reels"
          value={reelUrlsText}
          onChange={(e) => setReelUrlsText(e.target.value)}
          rows={6}
          placeholder={'https://www.instagram.com/reel/ABC123/\nhttps://www.instagram.com/p/XYZ789/'}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition text-sm font-mono"
        />
        <p className="text-[11px] text-gray-400 mt-1">
          Accepts <code>/reel/</code>, <code>/reels/</code>, <code>/p/</code>,
          and <code>/tv/</code> URLs. Invalid lines are skipped and reported.
        </p>
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="inline-flex items-center justify-center px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isPending ? 'Saving…' : 'Save'}
      </button>

      {result.kind === 'error' && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          {result.message}
        </div>
      )}

      {result.kind === 'success' && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-sm space-y-1">
          <p>
            {result.handleUpdated ? 'Handle saved. ' : ''}
            {result.inserted > 0
              ? `${result.inserted} reel${result.inserted === 1 ? '' : 's'} upserted.`
              : 'No reels added.'}
          </p>
          {result.invalid.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-red-700 mt-2">
                Skipped {result.invalid.length} invalid URL
                {result.invalid.length === 1 ? '' : 's'}:
              </p>
              <ul className="text-xs text-red-700 font-mono list-disc list-inside">
                {result.invalid.map((url, i) => (
                  <li key={i} className="truncate">{url}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </form>
  )
}
