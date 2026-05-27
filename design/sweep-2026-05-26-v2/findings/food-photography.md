# Food Photography — UI/UX Findings
_Sweep v2 · 2026-05-26 · Lens: image treatment, aspect ratios, fallbacks, quality variance, attribution, transitions, hero treatment_

---

## Top 5 Findings

**F1 — Compact card has zero photo surface; hero variant is opt-in and rarely used**
The default `variant="compact"` renders no image at all (`RestaurantCard.tsx:96–132`). The entire cities-newyork feed (`cities-newyork-desktop.png`) is photo-free — hundreds of cards show only text and rating bars. For a food discovery app, the absence of photography in the primary list view removes the single strongest purchase signal and makes the feed indistinguishable from a spreadsheet.
_Source: `RestaurantCard.tsx:23`, `cities-newyork-desktop.png`_

**F2 — Hero aspect ratio (16:10) produces squat, wide frames that clip faces and plating**
`HeroVariant` fixes `aspect-[16/10]` (`RestaurantCard.tsx:180`). At ~320px card width that yields ~200px of height — barely enough to show a full plate. Restaurant photography is typically portrait- or square-oriented from phones; forcing it into a wide landscape crop systematically cuts the most appetizing part (top of the dish, garnish). A 4:3 or 1:1 ratio would preserve more dish detail at grid widths.
_Source: `RestaurantCard.tsx:180`, `explore-desktop.png` category grid_

**F3 — No skeleton or blur-up transition; images pop in from blank gray**
Image loading uses a plain `<img>` with `loading="lazy"` and no placeholder (`RestaurantCard.tsx:183–189`). The `bg-gray-100` container sits visible until the network delivers the photo. On the restaurant detail hero (`restaurant-desktop.png`) the dark banner image loads against a gray background with no progressive reveal — the shift is jarring, especially on slower connections.
_Source: `RestaurantCard.tsx:179–188`, `restaurant-desktop.png`_

**F4 — Fallback first-letter monogram is too subtle to carry visual weight**
When a photo fails, `HeroVariant` renders the restaurant's first letter at `text-3xl font-light opacity-0.5` over a pale gradient (`RestaurantCard.tsx:207–209`). On the light-colored accolade gradients this is nearly invisible — a 50%-opacity gray letter on `#f9fafb` approaches 1.5:1 contrast. The fallback communicates "image missing" rather than identity.
_Source: `RestaurantCard.tsx:193–210`_

**F5 — `getRestaurantPhotoUrl` silently falls through to stock Unsplash; no attribution shown**
`restaurant.ts:55–62` resolves `photo_url → google_photo_url → yelp_photo_url → cuisine-keyed Unsplash stock`. The stock URL is returned without any flag or metadata indicating it's a generic placeholder. Callers render it identically to a real restaurant photo — no "photo coming soon" badge, no attribution for the Unsplash photographer, and no visual distinction when the stock shot is used. This is a licensing concern (Unsplash requires attribution in many contexts) and a trust issue (a French restaurant stock image on a barbecue joint misleads users).
_Source: `restaurant.ts:8–42`, `restaurant.ts:55–62`_

---

## 5 Quick Wins

**QW1 — Add `photo_url_is_stock` boolean flag to `getRestaurantPhotoUrl` return**
Return `{ url, isStock }` so callers can conditionally render an "Illustrative photo" label or a distinct fallback treatment. Zero schema change needed; pure lib refactor.
_Source: `restaurant.ts:55–62`_

**QW2 — Increase fallback monogram contrast and size**
Change `opacity: 0.5` to `opacity: 0.7` and `text-3xl` to `text-5xl font-semibold`. Immediate readability gain with two-character change.
_Source: `RestaurantCard.tsx:205–208`_

**QW3 — Add `transition-opacity` fade-in class to hero `<img>`**
`className="... opacity-0 group-loaded:opacity-100 transition-opacity duration-300"` paired with an `onLoad` handler toggling a CSS class gives a ~10-line blur-up effect without a third-party library.
_Source: `RestaurantCard.tsx:183–189`_

**QW4 — Deduplicate the `japanese`/`sushi` and `ramen`/`thai` stock URLs**
`restaurant.ts:20–21` maps both `japanese` and `sushi` to the identical Unsplash URL; `restaurant.ts:23` and `restaurant.ts:29` duplicate ramen for Thai food. Distinct, accurate shots cost nothing — just different Unsplash IDs.
_Source: `restaurant.ts:20–29`_

**QW5 — Add `alt` text beyond restaurant name for hero images**
`alt={restaurant.name}` (`RestaurantCard.tsx:185`) tells screen readers nothing about the image content. When a cuisine-stock photo is shown, `alt={`${restaurant.cuisine} food at ${restaurant.name}`}` is more descriptive and covers the stock-image case accurately.
_Source: `RestaurantCard.tsx:185`_

---

## 2 Bigger Bets

**BB1 — Introduce a thumbnail-strip micro-gallery on the restaurant detail page**
`restaurant-desktop.png` shows a single wide hero banner for JoJo with no supporting images — just a TikTok/Instagram social feed below. A 3–5 image horizontal strip (sourced from `photo_urls[]`) immediately above the ratings dashboard would give users a more complete visual picture of the space, plating, and vibe before committing. The `photo_urls` array already exists on the Restaurant type; this is a display feature, not a data change.
_Source: `RestaurantCard.tsx:72–79` (array exists), `restaurant-desktop.png`_

**BB2 — Switch the compact card to a 2-column image-left layout as the new default**
Rather than a pure text card, a small 80×80px square thumbnail to the left of the name+ratings row would inject food photography across every feed (recent, cities, search results) with minimal vertical height increase. The `getRestaurantPhotoUrl` helper already resolves a URL for every restaurant. This single layout change would transform the visual density of the app across all its list surfaces — the most impactful photography improvement available without a data pipeline change.
_Source: `RestaurantCard.tsx:96–131`, `cities-newyork-desktop.png`, `recent-desktop.png`_

---

## Alarming

**The cuisine-keyed stock photo fallback (`restaurant.ts:16–42`) is served from Unsplash without per-photo attribution or a Unsplash API `utm_source` parameter.** Unsplash's API Terms of Service require `utm_source=gastronome&utm_medium=referral` on all hotlinked images and visible attribution ("Photo by X on Unsplash") in most non-API hotlink contexts. The app uses direct `?w=800&q=80` hotlinks, not the Unsplash API, which is a separate ToS violation (hotlinking is only permitted via the API). This requires either migrating to the Unsplash API (with proper attribution UI) or self-hosting the fallback images in Supabase Storage.
_Source: `restaurant.ts:8–42`_
