# Restaurant Card — v3 Re-Sweep Findings
Specialist: restaurant-card | 2026-05-26

---

## Status tags

- [RESOLVED] 80x80 thumbnail on compact card — confirmed at `RestaurantCard.tsx:158-186`. Wall-of-text list is gone.
- [RESOLVED] Price chip on compact card — `formatPriceLevel` renders $/$$/$$$/$$$$ with aria-label (line 205-209).
- [RESOLVED] Save button on both variants — `BookmarkButton variant="card"` at `line 238` (compact) and `line 309` (hero). Stretched-link overlay is in place.
- [RESOLVED] Nested-anchor WCAG violation — overlay Link + `pointer-events-none` content layer + `pointer-events-auto` on interactive children. Clean pattern.
- [RESOLVED] sr-only accolade tier label — `accoladeTierLabel` + `<span className="sr-only">` at lines 54-60, 148, 299.

---

## Top 5

**1. CityRestaurantGrid is a completely different component — no thumbnail, no Save, no price [STILL-OPEN]**
The cities/New York page (cities-newyork-mobile.png) renders via `CityRestaurantGrid.tsx`, NOT `RestaurantCard`. That bespoke component has no photo, no BookmarkButton, no price chip, no SourceRatingsBar — just name, cuisine string, neighborhood, trending rank, and accolade badges. Every v2 win (thumbnail, Save, price) is absent here. Users on the city browse surface — likely the highest-volume discovery path — see a regressed, info-sparse card.
File: `src/components/cities/CityRestaurantGrid.tsx:61-83`
Screenshot: cities-newyork-mobile.png (entire list)
[P0] Effort: medium (swap CityRestaurantGrid rows to use `<RestaurantCard variant="compact" />`)

**2. Save button tap target is 32x32 px — below 44px WCAG minimum on mobile [STILL-OPEN]**
`BookmarkButton` `card` variant renders `w-8 h-8` (32x32 px) at `BookmarkButton.tsx:165`. On a touch device this is well under the 44x44 WCAG 2.5.5 minimum. The chevron ("▾") next to it is `w-7 h-8` (28x32 px) — even smaller. Both sit in the top-right corner of every card where thumb reach is already awkward. Visible in explore-mobile.png.
File: `src/components/BookmarkButton.tsx:164-172`
[P1] Effort: low (increase to `w-11 h-11` / 44px, adjust icon size to match)

**3. Hero variant shows only Google + Yelp; other aggregated sources invisible [STILL-OPEN]**
The hero card (used in Explore categories — explore-desktop.png, explore-mobile.png) deliberately shows only Google G + Yelp burst (lines 365-383). Infatuation and Beli ratings are silently dropped. A restaurant rated 9/10 by The Infatuation but mediocre on Google will look worse on this surface than on a compact-card surface. There is no Gastronome Score on either card variant — the unified 0-10 score that shipped for the detail page never reached the card level.
File: `RestaurantCard.tsx:364-383`
Screenshot: explore-mobile.png (category grids)
[P1] Effort: medium (replace the two-source cluster with the Gastronome score badge; or show all sources via compact SourceRatingsBar)

**4. Compact card name truncates at `line-clamp-1` but no tooltip on mobile [NEW]**
`h3` at line 191 uses `line-clamp-1` with `title={undefined}` (no title attribute set). The hero variant correctly adds `title={restaurant.name}` (line 355). On desktop, hover reveals nothing; on mobile, truncated names are permanently hidden. Restaurants with long names ("Hyderabadi Zaika", "Brown Bag Sandwich Co.") are clipped in cities-newyork-mobile.png with no affordance.
File: `RestaurantCard.tsx:191`
Screenshot: cities-newyork-mobile.png (rows 14+)
[P2] Effort: low (add `title={restaurant.name}` to compact h3, matching hero)

**5. Collection popover opens downward and clips inside card's `overflow-hidden` container [NEW]**
The card root has `overflow-hidden` (line 146). `BookmarkButton`'s popover is positioned `absolute top-full` with `z-50` — but the card's own stacking context and `overflow-hidden` will clip it. On a card near the top of a viewport the popover is invisible. The toast has the same problem. Inspect: `RestaurantCard.tsx:146` vs `BookmarkButton.tsx:210-226, 228-309`.
File: `RestaurantCard.tsx:146`, `BookmarkButton.tsx:212`
[P1] Effort: medium (use a portal / move popover outside overflow-hidden boundary, or set `overflow: visible` on the wrapper and rely on border-radius + clip-path for the rounded look)

---

## Quick wins (low effort, high value)

1. Add `title={restaurant.name}` to compact card `h3` (line 191) — matches hero behavior, 1 line. [NEW]
2. Bump BookmarkButton `card` variant from `w-8 h-8` to `w-11 h-11` and chevron from `w-7 h-8` to `w-11 h-11` for WCAG 2.5.5. [STILL-OPEN]
3. CityRestaurantGrid: add `aria-label="Save"` BookmarkButton to each row — the full swap is medium effort, but even wiring the bookmark alone is a quick win for the saving-lists lens.
4. Hero card `aspect-[16/10]` photo area (line 315) shows a gray skeleton on image failure — the first-letter monogram fallback only appears if `photoFailed` is true. The fallback gradient logic (lines 329-342) correctly handles this but only after an onError fires; consider a low-quality placeholder image to avoid gray-flash on slow connections.
5. `CityRestaurantGrid.tsx:70` shows "Restaurant" as cuisine fallback verbatim — same filler the hero card comments explicitly drop (line 272-273). Apply consistent suppression.

---

## Bigger bets

**A. Unified card component for all list surfaces.**
There are now at least three card implementations: `RestaurantCard` (compact + hero variants), `CityRestaurantGrid` inline JSX, and the `FavoritesSection` inline pattern referenced in `getHeroPhoto`'s JSDoc. Each diverges independently. A single `<RestaurantCard>` with a `list-row` variant (full-width, thumbnail left, ratings right, Save right-edge) would collapse this surface area and ensure every fix propagates everywhere.

**B. Surface the Gastronome Score on the card.**
The 0-10 unified score shipped on the detail page hero but is absent from every card variant. Users forming a mental shortlist from a city feed or category grid have no single-glance quality signal — they must open each restaurant to see the score that aggregates Google, Yelp, Infatuation, Beli, and accolade weight. A score badge on cards (similar to `GastronomeScoreBadge`) would close the biggest information gap between the browse and detail surfaces.

---

## Alarming

CityRestaurantGrid duplicates card rendering entirely outside the `RestaurantCard` component and has no Save action whatsoever. Given the cities page is the primary filtered browse path and `infinite scroll` was a marquee v2 fix there, the lack of Save in that context means users browsing the highest-volume surface cannot bookmark restaurants without tapping through to the detail page. This is a P0 regression in saving-lists UX even if the card component itself is [RESOLVED].
