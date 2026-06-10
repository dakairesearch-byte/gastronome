# UI Placement Proposal — Community Layer BESIDE the Gastronome Score

**Status:** PLANNING ARTIFACT — wireframe-in-words (visual design is itself UI-gated)
**Gate:** gate2 (this gate approves the placement logic; pixel-level design goes through normal UI gate)
**Does not touch:** `src/lib/score.ts`, `score.ts` formula, Gastronome Score display

---

## Placement principle

The community layer renders in a **visually distinct card** placed directly below the Gastronome Score block on the restaurant detail page (`src/app/restaurants/[slug]/page.tsx` or equivalent).

"Visually distinct" means:
- Different background treatment (e.g. a subtle tint or a thin dividing rule) so the eye reads two separate modules, not one merged block
- The word "Diners" or "Diner Score" appears in the module header — not "Score", not "Rating" in isolation
- No 0-10 numeral appears in the community module at low n (the % stat is the headline); once a Diner Score does appear it is in a smaller typographic weight than the Gastronome Score and labeled "Diner Score" explicitly

The rationale is §2's finding: "Visual hierarchy subordinates the community layer until volume earns it." Two competing 0-10 numbers on the same visual weight read as a bug; an ordinal rank reads as a different lens.

---

## Three render states (community module)

### State 1 — Below threshold (weighted n < 5)

```
┌─────────────────────────────────────────────────┐
│  DINERS                                         │
│                                                 │
│  No diner scores yet                            │
│  Be the first to leave a verdict →              │
│                                                 │
│  [If logged in + connections exist]             │
│  Nick: 8 · would go back                        │
│  Maya: 7                                        │
└─────────────────────────────────────────────────┘
```

- "No diner scores yet" (confident, not apologetic)
- CTA links to the Verdict Stack bottom sheet
- If the logged-in user has connections who have reviewed this restaurant, show
  named individual verdicts with avatar (≤3 shown, "View all" if more)
- Never show a numeric aggregate; never show "0 ratings" or "0% would return"

### State 2 — At threshold (weighted n ≥ 5, return-rate only)

```
┌─────────────────────────────────────────────────┐
│  DINERS                              ●●○  (2/3) │
│                                                 │
│  93% would return                               │
│  41 diners                                      │
│                                                 │
│  [If numeric ratings also ≥ threshold]          │
│  Diner Score  7.4                               │
└─────────────────────────────────────────────────┘
```

- "% would return · N diners" is always the headline (more meaningful at small n,
  inflation-immune, readable immediately)
- The "N diners" count is fuzzy-banded in the data (e.g. stored as 41 but displayed
  as "40+" below n=50, "50+" below n=100) so the exact threshold is unobservable
- Confidence dots (●●○ = 2 of 3) appear top-right of the module; tooltip says
  "Based on 41 diner reports — more reports increase confidence"
- "Diner Score" in secondary typography below the % stat, only when
  weighted_n ≥ 5 AND ≥ 3 distinct calibrated raters
- No Crowd Rank yet (Phase 2)

### State 3 — Phase 2 addition: Crowd Rank (≥ 10 comparisons, densest 1-2 metros)

```
┌─────────────────────────────────────────────────┐
│  DINERS                              ●●●  (3/3) │
│                                                 │
│  93% would return · 41 diners                   │
│  Diner Score  7.4                               │
│                                                 │
│  #12 in Austin · 87 head-to-heads               │
└─────────────────────────────────────────────────┘
```

- "#N in [City]" is an ordinal badge — never a 0-10 number
- "87 head-to-heads" is the comparison count (fuzzy-banded)
- "Settle it" affordance below the rank: "Think it's ranked wrong? → Duel it"
- Only rendered in the 1-2 metros with the densest comparison graphs (Phase 2 decision)

---

## What this gate approves vs what remains UI-gated

| Decision | This gate | Future UI gate |
|---|---|---|
| Module placed BELOW score block | Approved | — |
| "Diners" label for the module | Approved | — |
| Three render states (thresholds) | Approved | — |
| Phase 2 Crowd Rank as ordinal | Approved in principle | Pixel-level design |
| Exact typography, colors, spacing | — | Normal UI gate |
| Animation, bottom-sheet design | — | Normal UI gate |
| Verdict Stack bottom-sheet UI | — | Normal UI gate |
| Named connections display | Approved in principle | Normal UI gate |

---

## What this does NOT change

- `src/lib/score.ts` — untouched; Gastronome Score formula unchanged
- The Gastronome Score number, its label, its position, its size
- Any `score.ts` formula gate — community sits BESIDE, not inside the score

---

## Phase boundary summary

| Phase | Community module content |
|---|---|
| Stage 2 (trust substrate) | Schema only; no UI |
| Stage 3 (weeks 3-7) | State 1 + State 2 (% would return) at n ≥ 5 |
| Stage 5 (months 2-4) | Duels launch; Crowd Rank in 1-2 dense metros (State 3) |
| Stage 7 (months 4-6+) | Community as fifth source in score.ts — SEPARATE gate required |
