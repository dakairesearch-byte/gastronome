# Source Attribution Findings — sweep-2026-05-26-v2

Lens: how the user knows where a recommendation comes from; source credibility clarity; denominator/scale consistency; badge legibility; transparency.

---

## Top 5 Findings

**1. Mixed denominators rendered identically — no scale context**
Google and Yelp show `4.3/5`; Infatuation and Beli show `8.5/10` — but the `/maxRating` suffix is the only cue, and in compact mode the badge shrinks to ~28px wide where that suffix is barely legible. A user seeing `G 4.3` next to `TI 7.0` has no immediate sense that 7.0/10 is *better* than 4.3/5.
File: `SourceBadge.tsx:31`, `SourceRatingsBar.tsx:36-56`; screenshot: `restaurant-desktop.png` Ratings Dashboard.

**2. Accolade badges carry no "what this means" affordance**
`AccoladesBadges.tsx` renders `1 Michelin Star`, `Bib Gourmand`, `Eater 38`, and `James Beard Winner` as identical-weight colored pills. There is no tooltip, no link label, no explanatory copy — a new user cannot distinguish a Bib Gourmand from a starred restaurant, or know that "Eater 38" is a curated editorial list vs. a rating.
File: `AccoladesBadges.tsx:40-97`; screenshot: `restaurant-desktop.png` hero area, red "Michelin Star" pill visible.

**3. TikTok and Instagram have no rating surface — social presence masquerades as endorsement**
The "On Social" section of the restaurant detail shows TikTok/Instagram video counts and tabs, but these sources are completely absent from `SourceRatingsBar` and `getSourceRatings`. Users see a large social-video block without understanding whether 50 TikToks is a signal of quality or just virality. No label explains the distinction.
File: `SourceRatingsBar.tsx:4-59` (TikTok/Instagram absent); screenshot: `restaurant-desktop.png` "On Social" section.

**4. Home and Cities-NYC cards show bare `G 4.3` / `Y 3.7` letters with no source name**
In compact badge mode on cards, `icon` renders a single letter (`G`, `Y`, `B`, `TI`). The `label` field (`'Google'`, `'Yelp'`) is never displayed; only the icon character appears. Users unfamiliar with the convention must guess what `B` means (Beli? Best? Bon Appétit?).
File: `SourceBadge.tsx:30` (`source.icon` only, `source.label` unused); screenshot: `cities-newyork-desktop.png` restaurant card rows, `home-desktop.png` suggestion grid.

**5. James Beard badge never links out — no source URL**
`AccoladesBadges.tsx` wraps the JBF badge in a plain `<span>`, not `<BadgeLink>`, so it is never clickable even when a JBF URL exists. Every other accolade (Michelin, Eater 38) gets a `BadgeLink`. Users have no path to verify or learn more about the award.
File: `AccoladesBadges.tsx:74-80` — `<span>` hardcoded, no `BadgeLink` wrapper, no `href`.

---

## 5 Quick Wins

**QW1. Show source label on hover in compact mode.**
`SourceBadge.tsx:34-38` already has tooltip logic for review count — extend it to also show `source.label` (e.g. "Google") when no review count is available.

**QW2. Standardize denominator display: show `/5` or `/10` always, not conditionally.**
`SourceBadge.tsx:31` renders `{source.maxRating ? \`/${source.maxRating}\` : ''}` — remove the conditional; always show the scale so badges are comparable at a glance.

**QW3. Wrap JBF badge in `BadgeLink` like Michelin and Eater 38.**
One-line fix in `AccoladesBadges.tsx:74` — replace `<span key="james-beard"` wrapper with `<BadgeLink key="james-beard" href={restaurant.james_beard_url ?? null}>`.

**QW4. Add a `title` attribute to each accolade badge for screen readers and power-user hover.**
e.g. `title="Bib Gourmand — Michelin's designation for exceptional value"` on the pill span. Zero layout cost; adds tooltip-level context.

**QW5. Surfacing Eater 38 year on the badge.**
The `restaurant_eater38_history` table tracks listing year. Showing "Eater 38 '25" instead of just "Eater 38" signals recency and prevents stale listings from appearing equally authoritative as current ones.
File: `AccoladesBadges.tsx:86-97`.

---

## 2 Bigger Bets

**BB1. "About our sources" drawer or tooltip system.**
There is currently no UI entry point explaining what each source is, how it scores, or why it matters. A single tap/click on any source badge (Google, Yelp, Infatuation, Beli, Michelin, JBF, Eater 38) should open a lightweight sheet: source name, scoring method, scale, and a link to the source's methodology. This is the single highest-leverage transparency fix — it would convert the ratings bar from an opaque number cluster into a credibility signal users can trust.

**BB2. Unified normalized score bar alongside raw scores.**
Because Google (5), Yelp (5), Infatuation (10), and Beli (10) all use different scales, direct visual comparison is meaningless. A thin normalized bar (0–100%) behind each badge — or a single "Gastronome score" that shows how each source contributed — would let users compare quality across sources without mental arithmetic. This also creates a natural home to explain the aggregation methodology.

---

## Alarming

The `explore-desktop.png` and `restaurant-desktop.png` both show a **live Google Maps API error** injected mid-page ("Google Maps Platform rejected your request..."). This error text appears adjacent to source ratings and accolade badges, visually undermining the credibility of the entire ratings surface. While flagged as a known capture artifact in the primer, if this error ever appears in production it would directly damage trust in the app's source data.
