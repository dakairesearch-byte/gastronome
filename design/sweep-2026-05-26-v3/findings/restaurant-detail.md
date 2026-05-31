# Restaurant Detail — v3 Re-Sweep Findings

Lens: post-click detail page — hero, Gastronome Score, source attribution,
dishes, map, booking, scroll depth, mobile layout.
Sample: JoJo (NYC, 1 Michelin ★). Screenshots: restaurant-desktop.png,
restaurant-mobile.png. Source: src/app/restaurants/[id]/page.tsx.

---

## Top 5 Issues

### 1. No booking / reservation CTA anywhere on the page [STILL-OPEN]
For a restaurant that is likely bookable via Resy or OpenTable, there is
zero call-to-action to actually reserve a table. The hero has phone,
website, and Instagram links (page.tsx line 394–436) but nothing that
converts intent into a booking. A user who arrives from a list saying
"I want to eat here" has no next step beyond the restaurant's own website.
This is the single biggest gap between Gastronome's value prop and the
detail page's utility.
`[P1]` `[M]` — API key to Resy/OpenTable is not required; a deep-link
button (e.g., `https://resy.com/search?query=JoJo`) costs one line.

### 2. "By the Numbers" scoreboard shows raw scales without context [STILL-OPEN]
Google shows "4.3 / 5" and Yelp "3.7 / 5" side by side in the scoreboard
(desktop screenshot, left column). The numbers are on different scales
(Google 5-max, Yelp 5-max, Infatuation 10-max) and a new user reading
"3.7 vs 4.3" could reasonably conclude Yelp is worse when both might be
strong. No legend, no visual weight indicator, no note that the Gastronome
Score above has already normalized these. The buildScoreSources function
(page.tsx line 229–268) surfaces all three raw scales simultaneously.
`[P1]` `[S]` — Add a one-line subtitle ("Each source rated on its own
scale; the Gastronome Score above normalizes them") or a mini bar aligned
to /10.

### 3. Signature Dishes render as plain text chips — no hierarchy or
visual anchor [STILL-OPEN]
The "Signature Dishes" section (page.tsx lines 562–694) displays dishes as
pill chips in a `flex-wrap` row. In the desktop screenshot the dishes run
together with no ranking signal — the #1 most-mentioned dish looks
identical to the #6. The rank field exists in the data (fetched and sorted
by rank at line 127) but is not surfaced in the UI. On mobile, the chip
row wraps into a visually noisy grid with no clear top-pick signal.
`[P1]` `[S]` — Render rank 1 as a slightly larger "headline" chip or add
a subtle "Most Mentioned" label on the first chip.

### 4. Dish source icons ("G", "TT", "IG") are 14×14 px and
tooltip-only on mobile [STILL-OPEN]
The per-dish source indicators (GoogleGIcon at 11px, TT and IG at 14×14)
rely on title/hover tooltips to explain what "G", "TT", "IG" mean
(page.tsx lines 641–682). On mobile there is no hover. A user who sees
"TT · IG" next to "Duck Confit" gets no explanation without tapping
elsewhere. The chips are also so small (11–14 px) that they are
effectively invisible in the mobile screenshot.
`[P1]` `[S]` — Either show a one-time legend line below the section
heading ("Sources: G = Google, TT = TikTok, IG = Instagram") or expand
abbreviations on first render via aria-label that is also visible on small
screens.

### 5. Map tile (static fallback) is a square placeholder with zero
real geographic information [REGRESSION]
The Google Maps API error is gone — the fix shipped. But the fallback is
an aspect-square light-grey box with a pin emoji and the neighborhood name
(page.tsx lines 929–970). In the desktop screenshot this renders as a
large grey square labeled "Lenox Hill / Open in Google Maps →" with no
actual map imagery. This is better than an error message, but is still
inert — it provides less orientation than a static map tile API call
(Mapbox, Google Static Maps, or even an OpenStreetMap tile). The fix
removed the error but did not restore meaningful map context.
`[P1]` `[M]` — Replace the gray placeholder with a Google Static Maps
image (`maps.googleapis.com/maps/api/staticmap`) which works with the
existing GOOGLE_PLACES_API_KEY and does not require the Maps Embed API.

---

## Quick Wins (≤5)

1. **[RESOLVED] Hero photo opacity** — confirmed fixed. Photo renders at
   55% opacity (page.tsx line 306, comment mentions bump from 30%→55%).
   Visually verified in desktop screenshot.

2. **[RESOLVED] Google Maps raw error gone** — the "API rejected" iframe
   is replaced by the static fallback + action buttons. No error text
   visible in either screenshot.

3. **[RESOLVED] Gastronome Score in hero** — "8.1 / 10 · Gastronome
   Score · 2 sources" appears prominently below the restaurant name in
   both screenshots. Info popover wired correctly
   (GastronomeScoreBadge.tsx lines 40–53).

4. **[RESOLVED] Breadcrumb navigation** — "FRENCH › JoJo" trail visible
   in hero (desktop screenshot top-left). Breadcrumb.tsx correctly passes
   `light` mode for dark hero backgrounds (Breadcrumb.tsx line 28).

5. **[NEW] Dishes section heading "Across reviews & social" has no
   companion link or count when dishes do render** — the "Top 6" counter
   (page.tsx line 554) uses a plain text label with no link to more. If
   the restaurant has 12 dishes fetched but only 6 shown, users have no
   way to discover the rest. Add "View all dishes →" if `rawDishes.length
   > 6`.

---

## Bigger Bets

### A. Replace "Similar Restaurants" sidebar with a context-aware "You
might also like" module that acknowledges *why* items are similar
The current sidebar (page.tsx lines 1009–1030) renders up to 4 related
RestaurantCards with no explanation of the relationship — they appear
because they share cuisine + city or trend nearby. A user clicking away
from a Michelin-starred French restaurant to a card labeled "New York,
French" with no score comparison gets no decision support. A re-framing
that shows: "Also French in NYC, ranked higher/lower by Gastronome Score"
turns the sidebar into a genuine comparison tool rather than a page-filler.

### B. Add a "Price" signal to the hero contact strip
The hero shows phone, website, and Instagram (page.tsx lines 394–436) but
no price range, despite `price_level` likely being available from the
Google Places enrichment (the enrichWithGooglePlaces.ts script fetches it).
Price is the second filter users apply after cuisine — showing "$$$" in
the hero would complete the "can I eat here?" decision without a scroll.
Check `restaurant.price_level` in the database.ts types; if present, a
single chip in the contact strip is a 1-line addition.

---

## Optional Alarming

**[NEW] Tooltip popover for Gastronome Score is clipped on mobile.**
The methodology tooltip (GastronomeScoreBadge.tsx line 64) is positioned
`top-full left-0 w-72`. On a mobile screen (~390 px wide), a 288 px
(`w-72`) popover anchored to the left of the hero could overflow the right
edge of the viewport. The desktop screenshot shows it correctly because
the hero is wide. On mobile the hero content is narrower and the popover
may render off-screen or be clipped — unverifiable from the static
screenshot but highly likely. Add `max-w-[calc(100vw-2rem)]` and confirm
`left-0` doesn't bleed past the right edge on small screens.
