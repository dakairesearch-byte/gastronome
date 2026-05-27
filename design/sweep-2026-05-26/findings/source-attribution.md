# source-attribution

**Lens:** How clearly users understand where each recommendation, rating, and accolade comes from — and whether the app feels like a transparent aggregator or an opaque black box.
**Reviewed:** `restaurant-desktop.png` + `SourceBadge.tsx`, `AccoladesBadges.tsx`, `SourceRatingsBar.tsx`.

## Top 3 findings

1. [P0] **What's wrong:** Source badges use single-letter icons (`G`, `Y`, `TI`, `B`) with no logo or full label visible at rest — only a hover tooltip reveals review count, and there is no persistent label name on the badge itself (SourceBadge.tsx:31).
   **Why it matters:** A new user cannot tell "G 4.3" means Google without already knowing. The icon letter is ambiguous — `B` could be Bon Appétit or Beli. The rating denomination also differs silently (Google/Yelp are out of 5; Infatuation/Beli are out of 10), so comparing the raw numbers side-by-side misleads users.
   **What to do:** Replace single letters with the source's wordmark or at minimum a full short label ("Google", "Yelp", "Infatuation") inside the badge. Add a static denominator display that makes scale differences visible (e.g. "4.3 / 5" vs "8.1 / 10"). Consider swapping brand logos from `public/logos/` into the badge.
   **Why you'd want to do this:** Transparency is the app's core value proposition — users who trust ratings they understand return more often.
   (effort: S)

2. [P1] **What's wrong:** The James Beard badge only renders for `james_beard_winner`; semifinalist and finalist recognition (which live in `restaurant_jbf_history`) is silently dropped (AccoladesBadges.tsx:74, comment at line 71–73). The Infatuation "Perfect For" tags — a defining editorial signal — have no badge or display path at all.
   **Why it matters:** A JBF semifinalist restaurant looks badge-free even though it carries meaningful industry recognition. Users who rely on Gastronome to aggregate all prestige signals get an incomplete picture; they may distrust the app when they see a gap versus a source they checked manually.
   **What to do:** Add a secondary JBF badge tier ("JBF Semifinalist", "JBF Finalist") sourced from `restaurant_jbf_history`. Separately, surface Infatuation "Perfect For" tags as editorial chips (e.g. "Perfect For: Date Night") on the detail page.
   **Why you'd want to do this:** Showing the full recognition hierarchy is the aggregator's job; hiding it makes the app feel inferior to visiting Michelin or Eater directly.
   (effort: M)

3. [P1] **What's wrong:** The Eater 38 badge falls back silently to a non-linked plain span when `eater_url` is null (AccoladesBadges.tsx:87–93). Users see "Eater 38" but cannot verify or read the source — the badge is a dead end.
   **Why it matters:** Credibility signals need a verifiable source. A badge without a link looks like a claim Gastronome invented, especially given the primer's note that awards data was previously stale (CLAUDE.md: "Never invent accolades").
   **What to do:** When `eater_url` is null, either omit the badge entirely until a URL can be backfilled, or render a tooltip explaining "Eater 38 — source link unavailable." Never show an accolade badge that cannot be verified.
   **Why you'd want to do this:** Unverifiable badges erode user trust faster than no badge — one press mention of an unverifiable claim could damage Gastronome's credibility.
   (effort: S)

## Quick wins (≤3, no severity tag)

1. **What's wrong:** The "Ratings Dashboard" section heading (visible in screenshot) gives no explanation of how the aggregated score is computed — the label "AGGREGATED RATINGS" appears in small caps above it but the word "aggregated" is design jargon that many users will not parse.
   **Why it matters:** Users who don't understand how ratings combine may assume Gastronome has its own proprietary star count, treating it like a review site rather than an aggregator.
   **What to do:** Add a one-line subhead or "?" info icon (affordance: a UI element that signals interactability) with copy like "Ratings pulled from Google, Yelp, and Infatuation — tap any badge to read the original review."
   **Why you'd want to do this:** Sets correct expectations in one line; reduces support questions and distrust from power users.
   (effort: S)

2. **What's wrong:** The tooltip on `SourceBadge` only fires on `mouseEnter`/`mouseLeave` (SourceBadge.tsx:27–28), making review counts invisible on mobile where there is no hover state.
   **Why it matters:** Mobile users — likely the majority — never see review count context, so they have no way to gauge how many opinions back a rating.
   **What to do:** Replace hover-only tooltip with a tap-to-expand inline expansion or show review count as static small text below the badge (e.g. "4.3 · 1,240 reviews").
   **Why you'd want to do this:** Review count is the single strongest proxy for rating reliability; hiding it on mobile removes the most important trust signal.
   (effort: S)

3. **What's wrong:** The `colorMap` in `SourceBadge.tsx` has no entry for Michelin, James Beard, or Eater — those sources fall to a gray default (SourceBadge.tsx:20). Yet `AccoladesBadges.tsx` hard-codes its own separate color scheme for those same sources.
   **Why it matters:** Two parallel color systems for the same sources means a future refactor or new source gets inconsistently styled, and the visual language for "source identity" is fragmented.
   **What to do:** Consolidate source color tokens into a single map (or design token) shared by both components.
   **Why you'd want to do this:** A single color vocabulary makes it faster to add new sources and keeps brand colors consistent across every surface they appear.
   (effort: S)

## One bigger bet (optional)

**What's wrong:** There is no "source explainer" layer anywhere in the app — no page, modal, or tooltip that explains Gastronome's full source roster (what Beli is, how Infatuation scoring works 1–10, what Michelin Bib Gourmand means vs a star).
**Why it matters:** Casual users encountering Beli or Infatuation for the first time have nowhere to learn what those scores mean in context of each other — the app is a black box for anyone not already familiar with all eight sources.
**What to do:** Add a lightweight "About our sources" modal or dedicated `/sources` page — one paragraph per source, the scoring scale, and a link to the original outlet. Surface it via the "?" affordance next to "AGGREGATED RATINGS."
**Why you'd want to do this:** This single page can be linked from press, shared by users, and referenced in onboarding — it converts first-time visitors into believers in the aggregation model.
**The tradeoff:** Adds a page to maintain; if a source's scoring methodology changes (Infatuation switched scales in the past), the explainer can become stale and backfire.
(effort: M)

## Alarming (optional)

The Google Maps API "Reject API key" error is visible mid-page in the screenshot — this means the map attribution chip (a legally required element of Google Maps usage) is broken in production, which may violate Google Maps Platform Terms of Service.
