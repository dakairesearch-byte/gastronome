/**
 * verdict.ts — pure helper for "The Verdict" cross-source consensus card.
 *
 * Computes the spread (max − min of per-source normalized 0-10 values) from
 * a breakdown array and returns a structured VerdictTier. The spread uses the
 * same normalized values that feed the AGREEMENT penalty in score.ts — the
 * constants are NOT imported; we just operate on the output breakdown array.
 *
 * Tier thresholds (from report #56 / Stage 1 spec):
 *   - 1 source          → "Single source — uncorroborated"
 *   - spread ≤ 0.7      → "Unanimous: every crowd agrees"
 *   - spread ≤ 1.8      → "Broad agreement"
 *   - spread  > 1.8     → "Contested: sources disagree" (names extreme sources)
 */

import type { ScoreContribution } from '@/lib/score'

export type VerdictTier =
  | { kind: 'single' }
  | { kind: 'unanimous' }
  | { kind: 'broad' }
  | { kind: 'contested'; highSource: string; lowSource: string }

export interface VerdictResult {
  tier: VerdictTier
  /** max − min of normalized per-source values, or 0 for a single source. */
  spread: number
  /** normalized 0-10 value of the highest-scoring source. */
  high: number
  /** normalized 0-10 value of the lowest-scoring source. */
  low: number
}

export function computeVerdict(breakdown: ScoreContribution[]): VerdictResult {
  if (breakdown.length === 0) {
    return { tier: { kind: 'single' }, spread: 0, high: 0, low: 0 }
  }

  if (breakdown.length === 1) {
    const n = breakdown[0].normalized
    return { tier: { kind: 'single' }, spread: 0, high: n, low: n }
  }

  // Find min/max contributors by their normalized 0-10 quality.
  let highIdx = 0
  let lowIdx = 0
  for (let i = 1; i < breakdown.length; i++) {
    if (breakdown[i].normalized > breakdown[highIdx].normalized) highIdx = i
    if (breakdown[i].normalized < breakdown[lowIdx].normalized) lowIdx = i
  }

  const high = breakdown[highIdx].normalized
  const low = breakdown[lowIdx].normalized
  const spread = high - low

  let tier: VerdictTier
  if (spread <= 0.7) {
    tier = { kind: 'unanimous' }
  } else if (spread <= 1.8) {
    tier = { kind: 'broad' }
  } else {
    tier = {
      kind: 'contested',
      highSource: breakdown[highIdx].source,
      lowSource: breakdown[lowIdx].source,
    }
  }

  return { tier, spread, high, low }
}
