# Empty States — Findings
**Specialist:** empty-states | **Sweep:** 2026-05-26-v2

---

## Top 5 Findings

**F1. Profile page dead-ends the unauthenticated user with plain text**
Unauthenticated visitors who reach `/profile` see a single sentence — "You need to be signed in to see your profile." — with no CTA, no sign-in link, and no explanation of what a profile offers. `src/app/profile/page.tsx:102–116`. `profile-desktop.png` shows ~500px of white void below this sentence before the footer.
**Fix:** Replace the bare `<p>` with the shared `EmptyState` component (icon: User, title: "Sign in to see your profile", description: one line of value prop, CTA → `/auth/login`). One component swap; no new logic.

**F2. Community is permanently "Coming Soon" with no sign-in path**
`/community` renders a styled holding page ("Members Only / Coming Soon") regardless of auth state. There is no CTA whatsoever — not a "Sign in" link, not a "Notify me" form, not even a link to another section. `src/app/community/page.tsx:1–73`, `community-desktop.png`. A nav item that routes here from every page is a wasted slot that leads nowhere.
**Fix:** At minimum, add a secondary CTA (e.g. "Browse restaurants while we build this →") pointing to `/explore`. Optionally an email-capture input. Cost: 5 lines of JSX.

**F3. "Your Favorites" on home is a dead end without a Search link**
`FavoritesSection` empty state reads "tap the heart to save them" — but there is no heart anywhere on the home page. The only CTA is "Start exploring" → `/explore`. A new user reading this in the Home → "Your Favorites" panel has no obvious path. `src/components/home/FavoritesSection.tsx:86–111`, `home-desktop.png`.
**Fix:** Clarify copy ("Bookmark any restaurant from its detail page or Explore") and add a secondary link to `/search` so two distinct discovery paths are offered, not one.

**F4. "Recent Searches" empty state offers zero guidance**
`RecentSearches` empty state is plain text: "Your recent searches will appear here." No icon, no link to Search, no example queries. It occupies meaningful real estate in the two-column home grid alongside "Your Favorites." `src/components/home/RecentSearches.tsx:90–101`, `home-desktop.png`.
**Fix:** Add a link to `/search` and one example nudge ("Try 'ramen NYC' or 'Michelin spots SF'"). 3 lines of JSX.

**F5. Search empty state conflates "no results" with "hasn't started yet" using identical UI**
`EmptyState` is rendered for both "no results found" (filters active) and "start searching" (blank state). Icon stays the same (`Search`), only title and description text change. `src/app/search/page.tsx:536–558`. On the screenshot (`search-desktop.png`), with active filters showing skeletons, a user clearing filters can't visually distinguish "loading" from "genuinely empty."
**Fix:** Use a dimmer or differently-styled variant of `EmptyState` for the idle/pre-search state, reserving the current style for the no-results failure mode. The component already supports `onCtaClick`; a second `variant` prop would be sufficient.

---

## 5 Quick Wins

**Q1. Search idle state CTA copies "Discover" but links to `/explore`** — label is misleading vs. the actual destination. `search/page.tsx:553`. Change `ctaText` to "Browse restaurants".

**Q2. Profile `CollectionsPanel` empty-collection inline state is italic grey text** — "Empty — add restaurants from any detail page." — no link. `profile/page.tsx:534–546`. Add an `href` to `/explore` in the same sentence.

**Q3. Recent page filter empty state drops the active filter from the message** — "No matching events in the last 30 days" doesn't name the filter, so a user filtering "videos" doesn't know what to change. `recent/page.tsx:100–108`. Inject `filter` name into the description string.

**Q4. Profile unauthenticated state uses `min-h-[70vh]`** — vastly more white space than necessary, pushing the footer far below. Reduce to `min-h-[40vh]` or centre within a card so the page feels intentional. `profile/page.tsx:104`.

**Q5. Home "Saved Collections" section shows placeholder images even when user has no real collections** — the four `PLACEHOLDER_COLLECTIONS` tiles always render, giving the appearance of content that isn't the user's. This is a low-signal empty state dressed as content. `src/app/page.tsx:20–53`. Add a note or heading clarifying these are editorial suggestions, not personal saves.

---

## 2 Bigger Bets

**B1. Replace Community "Coming Soon" with a locked-state preview**
Instead of a blank holding page, render a blurred or reduced-opacity sample of what the Community feed will look like (3–4 static review cards, obscured), with a layered sign-up prompt over it. Establishes expectation, builds desire, captures email leads before launch. Requires mock data + overlay component, ~1–2 days.

**B2. Personalised post-onboarding empty home — use the home city set in onboarding**
The home page always defaults to New York (`DEFAULT_CITY = 'New York'`, `src/app/page.tsx:16`) even after a user sets a different home city in onboarding or profile settings. A new user who selected "San Francisco" during onboarding sees NYC suggestions, making the page feel generic. Wire `profiles.home_city` into the `topTrendingRestaurants` call so the first logged-in load is already personalised. Involves: reading session in a Server Component, one extra Supabase query on the auth path, ~half a day.

---

## Alarming

**Profile page is publicly reachable while appearing auth-gated.** The component comments say "Middleware should prevent this from being reachable" (`profile/page.tsx:101`), but the screenshot confirms the page renders fully for the unauthenticated bypass session — including nav, footer, and the "You need to be signed in" message — rather than redirecting to `/auth/login`. If middleware is off or misconfigured in any environment (edge cold-start, Vercel preview without env vars), the profile shell leaks. The `community.tsx` page has no auth gate at all. Verify middleware coverage for both routes before launch.
