# Gate 3 — Adopt the Engagement Decision Gate in CLAUDE.md

**Date:** 2026-06-10
**Gate:** gate3-engagement-gate
**Status:** Awaiting owner decision (see QUESTIONS.md Q-004 — Stage-0 assignment is gate-order: gate1→Q-002 … gate5→Q-006)
**Implementation time if approved:** ~30 min (one CLAUDE.md edit, zero src/ changes)

---

## Context

The engagement report (§4, ENGAGEMENT_AND_COMMUNITY_SCORING_2026-06-09.md) identified four
mechanic classes that are (a) genuinely effective and (b) ethically contested:

| Class | Example mechanic in §4 | Why it's contested |
|---|---|---|
| Loss-framing / expiry | Weekly Bite Streak | Broken-streak churn cliff; spending-pressure on dining |
| Interpersonal comparison in notifications | "3 friends ate here without you" | FOMO exploitation; trust-battery drain |
| Variable-ratio reward schedules | Tonight's Pick spinner (unrestricted) | Slot-machine mechanics; compulsive re-engagement |
| Contribution-volume leaderboards | "Top reviewer" by count, not taste | Incentivizes fake check-ins; poisons community signal |

The ethics lens recommended making "we'd never do that" a *process*, not a mood — by adding an
Engagement decision gate to CLAUDE.md that requires explicit owner approval plus a written
user-benefit rationale before any of the four classes ships as a default-on feature.

Two additional code-enforced defaults were proposed:
1. All social/comparison notifications are opt-in (users see Gastronome-world news by default, never comparison pushes by default).
2. No public-profile metric counts raw contribution volume — profiles describe taste, not activity.

---

## The one honest tension

**Some of these mechanics genuinely work.** Beli's forced ranking is the core of its retention.
Duolingo's streak is the most-studied loss-aversion mechanic in consumer software. Contribution
leaderboards drove Wikipedia's early explosive growth. Declining them in v1 is not "they don't
work" — it is choosing slower month-1 growth to win month-12 trust.

The gate does NOT ban these mechanics. It bans shipping them as defaults without a deliberate
owner decision. Optional, user-initiated versions can pass without the gate (e.g. a user who
explicitly enables a streak is opting into loss framing — that's informed consent, not dark
pattern).

The owner should make this trade knowingly, once, in writing. That is the entire purpose of
this gate.

---

## Options

### Option A — Adopt as written (recommended)

Add the Engagement gate to CLAUDE.md's "Decision gates" section exactly as drafted in
`engagement-gate.patch`. Enforced by written policy, not code — agents and overseers must
invoke the gate when the four classes appear in any proposal. The two code defaults (opt-in
social notifications, no contribution-volume public metrics) are enforced at implementation
time when those features are built.

**Tradeoff:** A future agent (or a future you, in a hurry) might miss the gate. Written policy
is not a compiler. The gate's value is proportional to how seriously the two overseers apply it.

### Option B — Adopt with a narrower scope (variable-ratio only)

Narrow the gate to variable-ratio rewards only (the class most analogous to gambling mechanics).
Allow loss-framing and comparison notifications without a gate, treating them as standard
growth-product decisions.

**Tradeoff:** Loses the most important protections. Loss-framing (streaks on spending behaviors)
and interpersonal FOMO pushes are the mechanics most likely to erode the trust brand and generate
support-inbox blowback. This option is faster to write but defends less.

### Option C — Defer

Build the engagement mechanics first; add governance later. No CLAUDE.md change now.

**Tradeoff:** Every future engagement proposal relitigates the same trade from scratch, and
defaults-drift ships whichever mechanic a hurried agent reaches for first. Retrofit cost grows
with every feature built in the meantime.

*Variant considered and rejected (not offered as an option):* code-level enforcement now —
ESLint/CI string-match rules flagging banned notification copy ("without you", "streak expires").
Over-engineering for a 3,340-restaurant app at reviews=0; lint rules on copy are fragile.
Write policy now; add code enforcement if and when the policy gets ignored.

---

## Recommendation

**Option A.** The gate is cheap to add and expensive not to have. The honest cost is one
paragraph in CLAUDE.md and a few minutes per future proposal. The honest benefit is that every
engagement trade-off surfaces as a named decision rather than a defaults-drift.

---

## Rollout steps

1. Owner approves Option A in QUESTIONS.md Q-004.
2. Apply the patch from the repo root: `git apply reports/stage0/gate3-engagement-gate/engagement-gate.patch`
   (one hunk, 26 added lines, inserts after CLAUDE.md line 199 — the last ASK bullet — verified
   clean against current CLAUDE.md on 2026-06-10).
3. Confirm the two code defaults are noted in the relevant feature tickets when social
   notifications and public profiles are built (not today — those features don't exist yet).
4. No src/ changes, no migrations, no deployment.

---

## Rollback plan

Delete the added paragraph from CLAUDE.md. No data, no schema, no deployed artifact.
Rollback time: 2 minutes.

---

## Success metrics

- Every future BACKLOG.md item proposing streak mechanics, FOMO notifications, variable-ratio
  rewards, or volume leaderboards is filed as a QUESTIONS.md gate rather than a DO.
- The two code defaults (opt-in social notifications, no public contribution-volume metrics) are
  present when those features ship — verifiable in code review.
- Zero "we shipped a dark pattern and had to walk it back" incidents.

---

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Agent misses the gate on a future proposal | Medium | Overseer-A applies it as a hard-rule check; the mechanic classes are explicit and enumerable |
| Gate becomes a bureaucratic tax on legitimate features | Low | Gate is on defaults, not on features; user-initiated opt-in bypasses it |
| Mechanic classes too vague to apply consistently | Low | Four classes listed with one concrete example each; ambiguous cases go to ASK |
