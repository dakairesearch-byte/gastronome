# Discovery UX — findings
_Lens: browsing without a search query. Do curated lists, trending signals, and community hooks give a reason to return?_

---

## Top 5 findings

**1. Home page is city-locked to New York with no disclosure**
Suggestions pull `DEFAULT_CITY = 'New York'` regardless of the user's onboarded home city (page.tsx:14, 62–66). A user who picked Miami during onboarding sees NYC restaurants on their home feed with no label explaining the source. Explore resolves the user's `profile.home_city` (explore/page.tsx:148–168) — Home never does. The mismatch is quiet and trust-eroding.
Cite: `src/app/page.tsx:14`, `src/app/explore/page.tsx:149`

**2. Community is a dead nav item — a primary slot wasted**
The Community page is a full-page "Coming Soon" placeholder (community/page.tsx:5–73) yet holds a top-nav slot alongside Home, Explore, and Profile. Clicking it from any browse session hits a dead end with zero content and no call to action. For intent-free browsing — exactly the moment community signals matter most — the slot returns nothing.
Cite: `src/app/community/page.tsx:5`, `community-desktop.png`

**3. Recent feed is a dense text-only firehose with no visual hierarchy**
The Recent page renders hundreds of events as a flat chronological list (recent/page.tsx:119–126). The screenshot shows a single unbroken column of small-text rows stretching for thousands of pixels with no images, no restaurant thumbnails, no "why this matters" signal. The filter chips (All / Restaurants / Videos / Reviews / Photos) are the only navigation affordance. Serendipitous discovery requires visual pull; this page has none.
Cite: `src/app/recent/page.tsx:119`, `recent-desktop.png`

**4. Home "Saved Collections" are hardcoded placeholder tiles, not user data**
The four collection tiles (Date Night, Quick Lunch, Special Occasions, Hidden Gems) are a static `PLACEHOLDER_COLLECTIONS` constant (page.tsx:20–53). They are labeled "Saved Collections" — implying the user's own saves — but link to generic `/explore` filtered views. A returning user who has bookmarked actual restaurants sees the same four tiles on every visit. The section title creates false personalization.
Cite: `src/app/page.tsx:20–53`, `home-desktop.png`

**5. No "near you", no neighborhood, no location context on any browse surface**
None of the four pages under review surface a proximity signal. Explore defaults to NYC (or home city when logged in), but there is no "Near you" section, no neighborhood filter, and no "trending in your area" hook. For a user browsing without intent, local relevance is often the strongest discovery pull — and it is entirely absent.
Cite: `src/app/page.tsx` (no geo), `src/app/explore/page.tsx` (city-level only, no neighborhood)

---

## 5 quick wins

**QW1. Label the Suggestions section with its actual city.**
Add `— {DEFAULT_CITY}` or resolve the user's home city and render it inline. One-line change in page.tsx:84 removes the silent mismatch.
Cite: `src/app/page.tsx:84`

**QW2. Give Recent events a thumbnail.**
EventCard renders text-only. Pulling `restaurant.photo_url` from the linked restaurant and rendering a 48×48 thumbnail per row costs one join and transforms the firehose into a scannable visual feed.
Cite: `src/app/recent/page.tsx:120`

**QW3. Surface "Top 10 Trending" on the home page, not just on Explore.**
The Explore page has a ranked, numbered Top 10 with source badges (explore/page.tsx:275). Home shows an unranked 4×2 grid of the same trending pool. Promoting the ranked list to Home gives a clear reason to check back daily.
Cite: `src/app/page.tsx:85`, `src/app/explore/page.tsx:275`

**QW4. Remove or redirect the Community nav item until the feature ships.**
Replace the dead "Coming Soon" route with either a teaser sign-up gate or remove it from the nav entirely. A broken primary nav link is worse than an absent one.
Cite: `src/app/community/page.tsx:5`, `community-desktop.png`

**QW5. Add a "What's new today" count badge to the Recent nav link.**
The recent feed already groups events by day (recent/page.tsx:65–70). A small numeric badge on the nav link ("12 new") gives returning users an ambient reason to click in — the same mechanic that drives notification-driven return visits.
Cite: `src/app/recent/page.tsx:65`

---

## 2 bigger bets

**BB1. Personalized "For You" section seeded from bookmark + review history.**
The data exists: `reviews`, `bookmarks`, and `profiles.home_city` are all populated. A lightweight collaborative signal ("users who saved JoJo also saved…") or even a cuisine-preference vector from past reviews could replace the static PLACEHOLDER_COLLECTIONS with a genuinely personal discovery surface. This is the single highest-leverage move for return-visit motivation — it makes every home page visit feel different.
Cite: `src/app/page.tsx:20–53` (what to replace), `src/types/database.ts` (reviews, bookmarks tables)

**BB2. Trending by neighborhood, not just by city.**
Explore's trending algorithm runs at city level (explore/page.tsx:189–194). NYC has 90+ restaurants; "trending in the West Village" would surface sharper, more actionable signal than "trending in New York." The `restaurants` table has coordinates; neighborhood attribution is a one-time geocode enrichment. Once available, a "Trending near you" rail with 4–5 cards would be the most compelling ambient hook the app could offer for intent-free browsing.
Cite: `src/app/explore/page.tsx:189`, `src/lib/ranking/trending.ts` (city param only)

---

## Alarming

**Community holds a primary nav slot and is entirely empty.**
It is not a partial build or a logged-out state — the component unconditionally renders "Coming Soon" for all users (community/page.tsx:5). Navigation promises that are not kept train users to distrust the rest of the app. This should be either gated behind auth with real content, or removed from the nav before any further user testing.
Cite: `src/app/community/page.tsx:4–6`, `community-desktop.png`
