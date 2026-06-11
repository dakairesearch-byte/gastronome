/**
 * Feed impression logging — fire-and-forget, client-side only.
 *
 * Cross-lane API contract (other lanes build against this sight-unseen):
 *   export type ImpressionEvent = 'impression' | 'click' | 'save' | 'vote'
 *   export function logFeedEvent(e: {
 *     surface: string
 *     position: number
 *     restaurantId: string
 *     event: ImpressionEvent
 *   }): void
 *
 * Architecture:
 *   - Anonymous session id persisted in localStorage under IMPRESSION_SESSION_KEY.
 *     crypto.randomUUID() is spec-baseline in all supported browsers + Node 20.
 *   - In-memory queue, flushed via navigator.sendBeacon to POST /api/impressions.
 *     sendBeacon survives page unload; fetch does not.
 *   - Flush triggers: visibilitychange (hidden), pagehide, 5 s interval, queue >= 20 events.
 *   - All module-level side-effects guard on typeof window so the module is
 *     safe to import on the server (SSR no-ops throughout).
 *
 * Privacy / spam tradeoff (documented per CLAUDE.md):
 *   INSERT-only RLS with check=true means any caller can append rows.
 *   Mitigation: route.ts validates shape, enum, uuid regex, length caps, batch ≤ 50.
 *   Ad-blocker undercount (~10–25%) is acceptable for ranking; never for billing metrics.
 */

export type ImpressionEvent = 'impression' | 'click' | 'save' | 'vote'

export interface FeedEventPayload {
  surface: string
  position: number
  restaurantId: string
  event: ImpressionEvent
}

// ---------- constants ----------

const IMPRESSION_SESSION_KEY = 'gastro_impression_session'
const FLUSH_ENDPOINT = '/api/impressions'
const FLUSH_INTERVAL_MS = 5_000
const FLUSH_BATCH_SIZE = 20

// ---------- session id ----------

let _sessionId: string | null = null

function getSessionId(): string {
  if (_sessionId) return _sessionId

  if (typeof window === 'undefined') return ''

  try {
    const stored = window.localStorage.getItem(IMPRESSION_SESSION_KEY)
    // Validate the stored value: /api/impressions drops rows whose session_id
    // fails its UUID check, so a corrupt/legacy value here would silently
    // zero out analytics for this device forever. Regenerate if malformed.
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (stored && UUID_RE.test(stored)) {
      _sessionId = stored
    } else {
      _sessionId = crypto.randomUUID()
      window.localStorage.setItem(IMPRESSION_SESSION_KEY, _sessionId)
    }
  } catch {
    // localStorage blocked (private browsing strict mode, storage quota, etc.)
    // — use an ephemeral session id for this page load only.
    if (!_sessionId) _sessionId = crypto.randomUUID()
  }

  return _sessionId
}

// ---------- in-memory queue ----------

interface QueuedEvent {
  session_id: string
  surface: string
  position: number
  restaurant_id: string
  event: ImpressionEvent
}

const _queue: QueuedEvent[] = []
let _listenersAttached = false

function flush(): void {
  if (_queue.length === 0) return

  const batch = _queue.splice(0, _queue.length)
  const body = JSON.stringify(batch)
  const blob = new Blob([body], { type: 'application/json' })

  let sent = false
  if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
    sent = navigator.sendBeacon(FLUSH_ENDPOINT, blob)
  }

  if (!sent) {
    // Best-effort non-blocking fetch fallback — not awaited.
    fetch(FLUSH_ENDPOINT, {
      method: 'POST',
      body,
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
    }).catch(() => {
      // Silently swallow — impression logging is advisory; lost events are
      // acceptable and must never surface as a visible error.
    })
  }
}

function attachListeners(): void {
  if (_listenersAttached) return
  _listenersAttached = true

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush()
  })

  window.addEventListener('pagehide', () => flush())

  setInterval(flush, FLUSH_INTERVAL_MS)
}

// ---------- public API ----------

/**
 * Enqueue a single feed event for batched delivery to POST /api/impressions.
 *
 * Fire-and-forget: returns void, never throws. SSR calls are no-ops.
 */
export function logFeedEvent(e: FeedEventPayload): void {
  // SSR no-op: safe to call during server rendering.
  if (typeof window === 'undefined') return

  // Lazily attach flush listeners on first use so the module has no
  // side-effects at import time (important for the Next.js SSR module graph).
  attachListeners()

  _queue.push({
    session_id: getSessionId(),
    surface: e.surface,
    position: e.position,
    restaurant_id: e.restaurantId,
    event: e.event,
  })

  if (_queue.length >= FLUSH_BATCH_SIZE) flush()
}
