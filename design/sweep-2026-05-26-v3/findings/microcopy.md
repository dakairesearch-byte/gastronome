# Microcopy — RE-SWEEP v3

Lens: button labels, error messages, tooltips, empty-state copy, voice consistency.

---

## Status on v2 items

**[RESOLVED]** "Log in" → "Sign in" consistency — onboarding-1-desktop.png
confirms "SIGN IN" in the nav and "Already have an account? Sign in" below
the card. Consistent throughout the visible surfaces.

**[RESOLVED]** Suggestions section city label — `page.tsx:175–177` renders
"Suggestions in {city}" with city-aware fallback note. Home-desktop.png
confirms "Suggestions in New York" with the "Showing New York by default"
attribution line.

**[RESOLVED]** Empty rail copy rewritten — `RecentSearches.tsx:99–102`
now reads "Try a cuisine, neighborhood, or dish in the search bar above —
we'll keep your recent searches handy here." Active invitation, not passive
system-speak.

**[RESOLVED]** "Saved Collections" → "Editorial Picks" — home-desktop.png
confirms the rename. The eyebrow label "Editor's gateways" is a new
addition (see below).

**[RESOLVED]** Bookmark vs. heart mismatch — `FavoritesSection.tsx:99`
now correctly says "Tap the bookmark on any card to start your list."

---

## Top 5 findings

**1. [NEW] "Editor's gateways" eyebrow label is jargon nobody will parse**
`page.tsx:227` — The Editorial Picks section renders a small-caps eyebrow
"Editor's gateways." "Gateways" is an internal metaphor (these are entry
points into Explore), not natural food language. Users read this as a
meaningless magazine-ism. The heading "Editorial Picks" is self-sufficient;
the eyebrow adds friction, not context. Suggested fix: drop it entirely, or
replace with "Curated for you."
[P1] Effort S

**2. [NEW] "Trending this week" eyebrow contradicts the fallback copy**
`page.tsx:174–195` / home-desktop.png — The section eyebrow says "Trending
this week" (a 7-day algorithm) but the fallback note below says "Showing
New York by default." When a user sees that fallback note, "trending"
implies New York trends — which is accurate but never stated. A user in
Austin sees NYC's trending list labeled as "Trending this week" with no
indication it's not their city's trends. The fallback note `page.tsx:184`
reads "Showing {city} by default" which helps, but "this week" still
implies recency-freshness that the anonymous user may never get — they're
always seeing a static fallback city. Suggested fix: fallback path should
read "Top-rated in New York" rather than "Trending this week" when
`citySource === 'fallback'`, so the algorithm descriptor is honest.
[P1] Effort S

**3. [STILL-OPEN] Search placeholder is too long for a CTA**
`page.tsx:164` / home-desktop.png — The fake search input reads "Search
restaurants, cuisines, neighborhoods, or dishes…" That's also the
`aria-label` on the `<Link>` at `page.tsx:151`. The visible placeholder is
redundant with the label and runs long on mobile (home-mobile.png shows it
truncating). A placeholder should hint, not enumerate. The search page
itself (search-desktop.png) has a shorter input hint. Suggested fix: "What
are you in the mood for?" or simply "Restaurants, cuisines, dishes…"
[P1] Effort S

**4. [NEW] "Find restaurants to save" button is a task, not an invitation**
`FavoritesSection.tsx:103–113` / home-desktop.png — The CTA in the empty
favorites state reads "Find restaurants to save." This is imperative in
the wrong direction — it sounds like homework. The surrounding copy already
sets up the save mechanic; the button should close the loop with warmth.
Suggested fix: "Explore restaurants" or "Start exploring." The uppercase
all-caps treatment compounds the cold register.
[P1] Effort S

**5. [NEW] "Step 1 of 4" is navigation prose, not copy**
onboarding-1-desktop.png — The progress indicator below the card reads
"Step 1 of 4" in body-weight text next to the CONTINUE button. This is
fine as orientation but the label competes with the eyebrow "THE PROBLEM"
above the card heading. Two meta-labels (step position + section label) for
a single pane creates redundancy. The dot indicators at the top of the card
already convey four steps. Suggested fix: drop "Step 1 of 4" prose and
rely on the dot indicators; or keep the prose but remove "THE PROBLEM"
eyebrow so there is only one orientation anchor per pane.
[P2] Effort S

---

## Quick wins (≤5)

**QW1.** `page.tsx:213` — Section header reads "Recent searches" (lowercase
s). All other section headers use title case ("Suggestions in New York,"
"Editorial Picks," "Your favorites"). Inconsistent. Fix: "Recent Searches."
[home-desktop.png]

**QW2.** `page.tsx:219` — "Your favorites" likewise uses lowercase f vs. the
`FavoritesSection` heading pattern. Fix: "Your Favorites." [home-desktop.png]

**QW3.** `RecentSearches.tsx:146` — The remove-search button `aria-label` is
"Remove recent search" (singular). When the button removes one item from a
named list, say which one: `aria-label={\`Remove "${s.query}" from recent
searches\`}`. Accessibility win doubles as better voice-assistant copy.

**QW4.** `page.tsx:139` — Hero subhead lists sources ending with "TikTok —
in one place." The em-dash before "in one place" is visually fine but the
list uses commas, not semicolons, so the em-dash reads as an afterthought
clause. Suggested rewrite: "…TikTok, and Instagram — all in one place." (Also
adds Instagram, which is currently missing from the hero enumeration despite
being listed in the primer and onboarding chip set.)

**QW5.** onboarding-1-desktop.png — The footer tagline reads "Every
restaurant rating in one place." The hero on the home page says "Decide in
one tab instead of six." These express the same proposition two different
ways. The footer copy is fine; the hero subhead should be audited for
consistency when both surfaces are live together.

---

## Bigger bets

**BB1. Onboarding pane 1 "THE PROBLEM" framing is the wrong emotional register**
onboarding-1-desktop.png — Leading with "The Problem" frames the product
as a solution to user suffering. This is common startup pitch deck language
but poor onboarding UX: the user just arrived, they haven't felt the pain
yet. The body copy ("Google says it's a 4.3. Yelp says 3.8…") is vivid and
specific — it's doing the right work. The eyebrow label "THE PROBLEM" is
the weak link. A label like "THE SITUATION" or simply dropping the eyebrow
and leading with the headline would be warmer and less MBA. This is a
brand-voice question: is Gastronome a confident guide or a product that
explains itself? [P2] Effort M

**BB2. Voice and register are inconsistent across surfaces**
The onboarding body copy is conversational and specific ("You just want to
know — is this place actually good?"). The Editorial Picks eyebrow says
"Editor's gateways." The hero subhead is declarative ("Decide in one tab
instead of six"). The FavoritesSection empty state is instructional ("Tap
the bookmark…"). These are four different authorial voices. The app needs a
one-paragraph tone guide: probably something like "confident and curious
local friend who's eaten everywhere, never condescending." That north star
would resolve QW4, BB1, Finding 1, and Finding 4 simultaneously. [P2] Effort L

---

## Alarming

None. No v2 regressions in microcopy. The resolved items (bookmark/heart,
city label, empty rail, "Sign in" consistency) are confirmed fixed and hold
up under re-examination. The new issues are all low-stakes polish, not
trust or usability failures.
