/**
 * taste.ts — Taste Vector v0
 *
 * A ~20-float per-device taste profile stored in localStorage.
 *
 * VECTOR LAYOUT  (22 dimensions total)
 * ──────────────────────────────────────────────────────────────────────────
 *  [0..11]  cuisine one-hots (top-12 from live SQL census, 2026-06-10):
 *             0 Mexican  1 Italian  2 American  3 Chinese  4 Japanese
 *             5 Bakery   6 Sushi    7 French    8 Cafe     9 Pizza
 *            10 Korean  11 Thai
 *  [12..15] price-tier one-hots: price_range ∈ {1,2,3,4} → idx 12..15
 *  [16]     accolade flag: michelin_stars >= 1 → 1.0, else 0.0
 *  [17..21] city bucket (5 "cities" matching the app's current 6 metros,
 *           deduped to 5 slots; see CITIES below). Unused for now — kept
 *           as reserved dimensions so the vector shape is stable across
 *           future expansions without a migration.
 *  TOTAL    22 dimensions
 *
 * STORAGE
 *   localStorage key: "gastronome_taste_v0"
 *   Format: { v: number[], updated: string (ISO) }
 *   v0 is intentionally per-device. Limitation: vectors do NOT sync across
 *   devices or sessions. The planned migration path is:
 *     - Phase 2: upsert vector into `profiles.taste_vector jsonb` after each
 *       online update; pull server vector on login (merge strategy: server wins
 *       if updated timestamp is newer).
 *     - Phase 3: move learning fully server-side via a nightly "vector refresh"
 *       edge function that ingests the user's verdicts/bookmarks from the
 *       `reviews` table, removing the localStorage dependency entirely.
 *
 * SEEDING
 *   `seedFromCuisines(cuisines)` maps onboarding cuisine strings to the
 *   cuisine one-hot dimensions with pseudo-weight m=10 so declared preferences
 *   prime the vector before any behavior. Behavior wins within ~2 sessions
 *   (m=10, η=0.15 → ~13 positive events to halve the prior weight).
 *
 * ONLINE UPDATE
 *   v ← (1−η)v + η·x_r    with η=0.15
 *   Called by `recordPositiveEvent` on would-return=true or rating≥7 from
 *   VerdictSheet, and on bookmark save from BookmarkButton.
 *
 * AFFINITY FORMULA
 *   raw_dot = dot(v, x_r)             // both vectors have unit-ish norms
 *   affinity = 0.85 + 0.30·sigmoid(raw_dot − SHIFT)
 *   Bounded to [0.85, 1.15] by construction (sigmoid output ∈ (0,1)).
 *   Used as the A term in the QFA ranker: rank = Q^1.0 · (1+T)^0.5 · A^0.3
 *
 * COLD-START NEUTRALITY
 *   An all-zero stored vector (no signal yet) returns exactly 1.0 — the same
 *   neutral value as the SSR path — so rails can detect cold start with
 *   `getTasteAffinity(...) === 1.0` consistently on server and client.
 *
 * SSR SAFETY
 *   All localStorage reads are guarded by `typeof window !== 'undefined'`.
 *   On the server, `getTasteAffinity` returns 1.0 (neutral — no personalization
 *   penalty for SSR paths). `recordPositiveEvent` is a no-op on the server.
 *
 * PURE-MATH CORE
 *   `buildRestaurantVector`, `dot`, `sigmoid`, `onlineUpdate`, and
 *   `applySeeds` are exported as pure functions so unit tests can run
 *   without a DOM / localStorage mock.
 */

// ── Constants ──────────────────────────────────────────────────────────────

const STORAGE_KEY = 'gastronome_taste_v0'
const DIM = 22
const ETA = 0.15           // online-learning rate
const SIGMOID_SHIFT = 0.5  // shift so a modest positive dot (≈0.5) maps to mid-range; a zero dot → ≈0.963 (mild, not punitive)
const AFF_MIN = 0.85
const AFF_RANGE = 0.30     // AFF_MIN + AFF_RANGE = 1.15
const PSEUDO_WEIGHT = 10   // m in the seed prior (number of pseudo-observations)

/** Top-12 cuisines from live SQL census (2026-06-10), ordered by restaurant count. */
export const CATALOG_CUISINES = [
  'Mexican',   // 0  — 257
  'Italian',   // 1  — 255
  'American',  // 2  — 171
  'Chinese',   // 3  — 168
  'Japanese',  // 4  — 162
  'Bakery',    // 5  — 140
  'Sushi',     // 6  — 134
  'French',    // 7  — 134
  'Cafe',      // 8  — 125
  'Pizza',     // 9  — 123
  'Korean',    // 10 — 118
  'Thai',      // 11 — 100
] as const

const CUISINE_IDX: Record<string, number> = Object.fromEntries(
  CATALOG_CUISINES.map((c, i) => [c, i])
)

// Price tier: price_range 1..4 → vector indices 12..15
const PRICE_OFFSET = 12
// Accolade flag: index 16
const ACCOLADE_IDX = 16
// City slots: indices 17..21 (reserved, not yet populated)

// ── Pure-math core (DOM-free, importable in tests without mocks) ──────────

/** Build a ~unit restaurant feature vector from its metadata. */
export function buildRestaurantVector(r: {
  cuisine: string | null
  price_range: number | null
  michelin_stars: number | null
}): number[] {
  const x = new Array<number>(DIM).fill(0)
  // Cuisine one-hot
  if (r.cuisine !== null) {
    const idx = CUISINE_IDX[r.cuisine]
    if (idx !== undefined) x[idx] = 1
  }
  // Price-tier one-hot (1-indexed → offset 12)
  if (r.price_range !== null && r.price_range >= 1 && r.price_range <= 4) {
    x[PRICE_OFFSET + (r.price_range - 1)] = 1
  }
  // Accolade flag
  if (r.michelin_stars !== null && r.michelin_stars >= 1) {
    x[ACCOLADE_IDX] = 1
  }
  return x
}

/** Dot product of two equal-length arrays. */
export function dot(a: number[], b: number[]): number {
  let s = 0
  for (let i = 0; i < a.length; i++) s += a[i] * b[i]
  return s
}

/** Numerically stable sigmoid. */
export function sigmoid(z: number): number {
  if (z >= 0) {
    const e = Math.exp(-z)
    return 1 / (1 + e)
  }
  const e = Math.exp(z)
  return e / (1 + e)
}

/**
 * Online EMA update: v ← (1−η)·v + η·x
 * Returns a NEW array; does not mutate.
 */
export function onlineUpdate(v: number[], x: number[], eta: number = ETA): number[] {
  const out = new Array<number>(v.length)
  for (let i = 0; i < v.length; i++) {
    out[i] = (1 - eta) * v[i] + eta * x[i]
  }
  return out
}

/**
 * Apply cuisine seeds as pseudo-observations.
 * Each seed cuisine pushes the vector as if m positive events were recorded.
 * Returns a NEW array; does not mutate.
 */
export function applySeeds(v: number[], cuisines: string[], m: number = PSEUDO_WEIGHT): number[] {
  const out = [...v]
  for (const cuisine of cuisines) {
    const idx = CUISINE_IDX[cuisine]
    if (idx === undefined) continue
    // Build a unit vector for this cuisine
    const x = new Array<number>(DIM).fill(0)
    x[idx] = 1
    // Apply m pseudo-update steps: repeated EMA application
    // v_m = (1−η)^m · v + (1 − (1−η)^m) · x
    const decay = Math.pow(1 - ETA, m)
    for (let i = 0; i < DIM; i++) {
      out[i] = decay * out[i] + (1 - decay) * x[i]
    }
  }
  return out
}

// ── Storage helpers (DOM-dependent) ───────────────────────────────────────

function isClient(): boolean {
  return typeof window !== 'undefined'
}

function readVector(): number[] {
  if (!isClient()) return new Array<number>(DIM).fill(0)
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return new Array<number>(DIM).fill(0)
    const parsed = JSON.parse(raw) as { v?: unknown }
    if (!Array.isArray(parsed.v) || parsed.v.length !== DIM) {
      return new Array<number>(DIM).fill(0)
    }
    return parsed.v as number[]
  } catch {
    return new Array<number>(DIM).fill(0)
  }
}

function writeVector(v: number[]): void {
  if (!isClient()) return
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ v, updated: new Date().toISOString() })
    )
  } catch {
    // localStorage quota exceeded or private-browsing restriction — silent no-op
  }
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * The restaurant shape consumed by the two cross-lane API functions.
 * `city` is accepted for forward-compatibility (reserved city dimensions)
 * but is not yet used in the affinity calculation.
 */
export type TasteRestaurant = {
  cuisine: string | null
  city: string | null
  price_range: number | null
  michelin_stars: number | null
}

/**
 * getTasteAffinity — returns a personalization multiplier bounded to [0.85, 1.15].
 *
 * SSR-safe: returns 1.0 (neutral) when called outside the browser.
 * Self-initializes from localStorage synchronously; no async required.
 */
export function getTasteAffinity(r: TasteRestaurant): number {
  if (!isClient()) return 1.0
  const v = readVector()
  // Cold start: an all-zero vector carries no signal.  Return exactly the
  // same neutral 1.0 as the SSR path so cold-start detection in the rails
  // (`getTasteAffinity(...) === 1.0` for every candidate) behaves identically
  // on the server and on the client — without this, an empty vector yields
  // 0.85 + 0.30·sigmoid(−0.5) ≈ 0.963 and cold start is never detected.
  if (v.every((n) => n === 0)) return 1.0
  const x = buildRestaurantVector(r)
  const rawDot = dot(v, x)
  const aff = AFF_MIN + AFF_RANGE * sigmoid(rawDot - SIGMOID_SHIFT)
  // Clamp defensively (should be guaranteed by sigmoid, but protect against NaN)
  if (!isFinite(aff)) return 1.0
  return Math.max(AFF_MIN, Math.min(AFF_MIN + AFF_RANGE, aff))
}

/**
 * recordPositiveEvent — updates the taste vector toward the given restaurant.
 *
 * Call after: would-return=true, rating≥7, or bookmark save.
 * Fire-and-forget; synchronous; SSR no-op.
 */
export function recordPositiveEvent(r: TasteRestaurant): void {
  if (!isClient()) return
  const v = readVector()
  const x = buildRestaurantVector(r)
  const updated = onlineUpdate(v, x)
  writeVector(updated)
}

/**
 * seedFromCuisines — seeds the taste vector from onboarding cuisine preferences.
 *
 * Applies pseudo-weight m=10 so declared preferences prime the vector.
 * Safe to call on an empty vector (first onboarding) or an existing one
 * (re-onboarding blends in rather than replaces).
 * SSR no-op.
 */
export function seedFromCuisines(cuisines: string[]): void {
  if (!isClient()) return
  const v = readVector()
  const seeded = applySeeds(v, cuisines)
  writeVector(seeded)
}
