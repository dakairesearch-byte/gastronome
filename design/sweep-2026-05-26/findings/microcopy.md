# microcopy

**Lens:** Every visible string — labels, empty states, button copy, section headers — audited for voice consistency (foodie-confident, never precious or robotic).
**Reviewed:** `home-desktop.png` + `src/app/page.tsx`, `src/components/Navigation.tsx`, `src/components/home/FavoritesSection.tsx`, `src/components/home/RecentSearches.tsx`, `src/components/SectionHeader.tsx`.

## Top 3 findings

1. [P1] **What's wrong:** The Suggestions section carries the eyebrow label "Curated Selection" (`page.tsx` line 84), but this is just the trending-by-city algorithm — not editorially curated. The label overpromises.
   **Why it matters:** Users who click through expecting hand-picked picks and find an algorithmic list feel misled. Trust erodes fast in a recommendations product.
   **What to do:** Change the eyebrow to "Trending This Week" or "What's Hot Right Now" to accurately reflect the 7-day trending window. Reserve "Curated" for genuinely editorial content.
   **Why you'd want to do this:** Honest signals outperform flattering ones for retention — users return when expectations match reality.
   (effort: S)

2. [P1] **What's wrong:** The Favorites empty state (`FavoritesSection.tsx` line 96) says "tap the heart to save them" — but the desktop bookmark uses a bookmark icon (Lucide `Bookmark`), not a heart. The instruction points to a control that doesn't exist on this viewport.
   **Why it matters:** A new user on desktop follows the instruction, finds no heart, and concludes the feature is broken or hidden. Direct abandonment.
   **What to do:** Change to "bookmark the restaurant to save it here" and match whichever icon the detail page actually renders. Verify on mobile too before shipping.
   **Why you'd want to do this:** Accurate affordance language (language describing interactive controls) is the cheapest onboarding fix — zero dev cost once confirmed.
   (effort: S)

3. [P2] **What's wrong:** The mobile menu drawer labels two auth actions inconsistently: desktop nav says "Sign in" (`Navigation.tsx` line 136) while the mobile drawer uses "Log in" (`Navigation.tsx` line 254) for the same action.
   **Why it matters:** "Sign in" vs "Log in" side-by-side on the same session signals a product that hasn't been QA'd, which erodes the premium editorial feel Gastronome is building toward.
   **What to do:** Pick one and apply it everywhere — "Sign in" is the more standard convention for web apps and matches the `openSignInModal` call signature (mode: 'signin').
   **Why you'd want to do this:** Terminological consistency (using the same word for the same action everywhere) is a basic trust signal; inconsistency reads as carelessness.
   (effort: S)

## Quick wins (≤3, no severity tag)

1. **What's wrong:** "Your recent searches will appear here" (`RecentSearches.tsx` line 96) is passive and flat for a product with an editorial voice.
   **Why it matters:** Empty states are a brand moment — this one sounds like a system status bar, not Gastronome.
   **What to do:** Try "Search for a restaurant — we'll remember where you left off." It's warmer and nudges action without being pushy.
   **Why you'd want to do this:** On-brand empty states increase feature discovery and make a sparse home page feel intentional rather than broken.
   (effort: S)

2. **What's wrong:** The "Start exploring" CTA inside the Favorites empty state (`FavoritesSection.tsx` line 107) is generic — identical copy could appear on any app.
   **Why it matters:** A food-forward brand should have food-forward buttons. "Generic CTA" (a call-to-action that could belong to any product) wastes the one moment you have to reinforce voice.
   **What to do:** "Find your first favourite" or "See what's trending" ties the action to the product's actual value.
   **Why you'd want to do this:** Specificity in CTAs consistently lifts click-through in A/B tests and signals craft.
   (effort: S)

3. **What's wrong:** The `Saved Collections` section header (`page.tsx` line 105) is a noun, but the type labels underneath each card ("Romance", "Weekday", "Celebration", "Discovery") are inconsistent in register — some are moods, one is a day-of-week.
   **Why it matters:** The taxonomy reads like it was assembled from different drafts. "Weekday" next to "Romance" and "Celebration" is jarring.
   **What to do:** Align to one register: either all occasions ("Date Night Out", "Lunch Break", "Milestone Dinner", "Off the Beaten Path") or all moods. Drop "Weekday" — it's the odd one out.
   **Why you'd want to do this:** Coherent taxonomy makes collections scannable and reinforces that the product has a point of view.
   (effort: S)

## One bigger bet (optional)

**What's wrong:** "Suggestions" (`page.tsx` line 84) is the section title for what is actually a personalised trending feed. The word is vague — it could mean the app is suggesting anything.
**Why it matters:** A user who bookmarks nothing and has no city preference gets the same label as a power user. The copy does no work to explain the logic or make the user feel seen.
**What to do:** Make the section title dynamic: "Trending in New York" when city is pinned, "Picked for You" once there's preference signal. Let the label teach users what the algorithm is doing.
**Why you'd want to do this:** Transparent personalisation copy (labels that name the city or signal source) builds trust in recommendations and encourages the engagement that improves ranking quality — a virtuous loop.
**The tradeoff:** Requires passing the city name into the section header render path (`page.tsx` line 84) and adding a fallback for users with no preference signal. Light engineering lift; design must accommodate variable-length city names.
(effort: M)

## Alarming (optional, 1 line)

The `Saved Collections` tiles are PLACEHOLDER_COLLECTIONS hardcoded in `page.tsx` (lines 20–53) with Unsplash images — if any user sees this page expecting their real saved collections, the mismatch is a data-integrity trust failure, not just a copy problem.
