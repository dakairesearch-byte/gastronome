# Restaurant Card — UI/UX Findings
**Specialist:** restaurant-card | **Sweep:** 2026-05-26-v2

---

## Top 5 Findings

**1. Compact variant carries zero visual weight — no photo, no thumb-stop**
The default `compact` variant (used in cities-newyork, recent, search) is purely text-and-badges. On cities-newyork-desktop the list runs hundreds of cards deep with no imagery; every row looks identical at a glance. Users cannot orient by visual memory — every restaurant must be read, not scanned.
Source: `RestaurantCard.tsx:96–131`; `cities-newyork-desktop.png` (full-page list).

**2. No save / bookmark action on any card surface**
Neither `compact` nor `hero` exposes a save-to-collection or bookmark action. The only save path is drilling into the detail page. On explore-desktop the Categories grid and Top 10 Trending list show no quick-save affordance. For users who want to build a shortlist while browsing, every save requires a round-trip navigation.
Source: `RestaurantCard.tsx:96–131`, `RestaurantCard.tsx:175–291`; `explore-desktop.png` (Trending list, no secondary actions visible).

**3. Two variants with meaningfully different rating surfaces — no user-visible cue**
`compact` renders the full stacked `SourceRatingsBar` (Google, Yelp, Infatuation, Beli). `hero` renders only Google + Yelp brand-mark inline. A restaurant with a strong Infatuation or Beli rating appears weaker in hero contexts. The variant is set by the calling page, not by data richness, so the same restaurant can look different across surfaces.
Source: `RestaurantCard.tsx:23–24`, `RestaurantCard.tsx:227–245`; `explore-desktop.png` (hero cards below Trending) vs `cities-newyork-desktop.png` (compact).

**4. Accolade border accent is invisible against white bg at 4px**
`getBorderAccent` returns `border-l-4` in red/amber/pink. At 1440px the left-edge stripe on `cities-newyork-desktop` is too thin to scan at normal reading distance — the color signal is there but fails at a glance. Users must stop and look for the stripe; it does not pre-attentively pop from a dense list.
Source: `RestaurantCard.tsx:26–33`; `cities-newyork-desktop.png` (dense Michelin list).

**5. `recent-desktop` card tap target is line-height only — no padding buffer**
The recent feed renders compact cards with `p-4 sm:p-5`. The hit area is the card div, but the `Link` wraps the entire card, making the whole card tappable. However in a very long, dense list (recent-desktop shows 100+ items) card height is compressed by the `space-y-2.5` layout — on mobile equivalents this would produce touch targets below 44px.
Source: `RestaurantCard.tsx:101`; `recent-desktop.png` (dense list with very small row height).

---

## 5 Quick Wins

**QW1. Add cuisine pill to hero body only when it replaces dropped city label**
Hero already omits city (correct — user is in a city filter context). But `showCuisine` also suppresses "Restaurant" and "Fine Dining". Add "Bar" and "American" to the suppression list — these are as content-free as "Restaurant" in most Michelin/Eater contexts.
Source: `RestaurantCard.tsx:159–162`.

**QW2. Clamp hero card name at 1 line, not 2**
`line-clamp-2` on hero name (`RestaurantCard.tsx:217`) means long names push the price/neighborhood row off-screen on smaller grid columns. Compact uses `line-clamp-1` (`:104`). Hero should too — title attribute already provides full name on hover.
Source: `RestaurantCard.tsx:217`.

**QW3. Price level `title` tooltip duplicates `aria-label` — remove `title`**
The price span has both `aria-label` and `title` set to the same string (`RestaurantCard.tsx:268–270`). Screen readers will double-announce it; sighted users get an unhelpful tooltip on hover. Remove `title`; `aria-label` is sufficient.
Source: `RestaurantCard.tsx:267–270`.

**QW4. `ExploreCollectionCard` image height is hardcoded `108px`**
The collection tile image is `style={{ height: '108px' }}` — not responsive, not a Tailwind class, not overridable via props. At wider viewports the image appears letterboxed and undersized relative to the p-4 body.
Source: `ExploreCollectionCard.tsx:54`.

**QW5. Michelin star breakdown uses plain Unicode stars, not the official logo**
`ExploreCollectionCard` renders `★★★`, `★★`, `★` as raw Unicode (`ExploreCollectionCard.tsx:89–94`). The rest of the app uses `AccoladesBadges` with the official Michelin SVG. The inconsistency undermines brand fidelity for the most prestigious signal in the product.
Source: `ExploreCollectionCard.tsx:89–94`.

---

## 2 Bigger Bets

**BB1. Thumbnail strip on compact card**
Add a 3-up thumbnail strip (56px tall, `photo_urls[0..2]`) to the compact variant, visible only when ≥1 photo exists. This requires no layout restructure — insert above the ratings bar. Gives the cities/recent feed the visual anchor it currently lacks without adopting the full hero layout, which would break the information density that makes compact useful for long lists.

**BB2. Inline save action (heart/bookmark icon) in card top-right corner**
A 36×36px icon button in the card's top-right (overlay on hero photo, inline on compact) would let users save without navigation. This is the single highest-leverage secondary action missing from every card surface. Requires `BookmarkButton` (already exists at `src/components/BookmarkButton.tsx`) to be lifted into both variants. Needs auth-gated behavior (prompt login if unauthenticated).

---

## Alarming

The `cities-newyork-desktop` screenshot shows a list of well over 100 restaurant cards rendering all at once with no pagination or virtual scrolling visible. Each compact card triggers a `SourceRatingsBar` render. If `SourceRatingsBar` is not memoized and the page fetches all restaurants client-side, this is a significant render and network payload issue on the most visited city page. Flag for the performance specialist.
Source: `cities-newyork-desktop.png` (full-page scroll length); `RestaurantCard.tsx:127`.
