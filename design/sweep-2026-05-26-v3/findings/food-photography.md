# Food Photography — v3 Re-Sweep

**Lens:** image treatment, aspect ratios, cropping, no-image fallbacks, quality variance, compact-card thumbnails, hero opacity.

---

## Status on v2 items

- **[RESOLVED]** Hero photo opacity 30% → 55% — confirmed at `page.tsx:305` (`opacity-55`). The JoJo curtain photo is clearly legible in restaurant-desktop.png.
- **[RESOLVED]** Thai stock photo de-duplication — `restaurant.ts:30` now uses a distinct pad-thai URL, no longer sharing the ramen-bowl shot.
- **[RESOLVED]** `isStockFallbackPhoto` helper added — exists at `restaurant.ts:72-76`.
- **[RESOLVED]** Compact cards now show an 80×80 thumbnail — confirmed at `RestaurantCard.tsx:158-185` (`w-20 h-20`). Visible in explore-mobile.png categories and cities-newyork-mobile.png list.
- **[RESOLVED]** Hero card photo alt text is descriptive — `RestaurantCard.tsx:291-293` builds cuisine-context alt.

---

## Top 5 Findings

**1. `isStockFallbackPhoto` is defined but never called — stock photos pass as real photos everywhere** [STILL-OPEN]
The v2 quick-win shipped the helper (`restaurant.ts:72`) but no component imports or calls it. `RestaurantCard` hero and compact thumbnails, `FavoritesSection`, `SuggestionCard`, and the restaurant detail page all display cuisine-keyed Unsplash shots with zero indication they are generic. Users cannot distinguish "real restaurant photo" from a plate of pasta that has nothing to do with the restaurant.
`src/lib/restaurant.ts:72` — `src/components/RestaurantCard.tsx` (no import)
[P1] Effort: S (add a small "Stock photo" pill or subtle opacity/border to HeroVariant when `isStockFallbackPhoto(photo)` is true — the helper is already correct)

**2. Cities NYC mobile list is entirely photo-free — compact cards fall back to monogram initials for most restaurants** [NEW]
cities-newyork-mobile.png shows ~25 compact cards in a row; nearly every one shows a letter initial (gray gradient box) rather than a thumbnail. The 80×80 slot is there, but upstream `photo_url` and `google_photo_url` are null for most NYC rows, so `getHeroPhoto` returns null and `setThumbnailFailed` is never even reached. The monogram fallback is functional but a wall of gray squares flanked by text is visually inert. This is a data-coverage issue surfaced by the UI improvement.
`RestaurantCard.tsx:133` — `cities-newyork-mobile.png`
[P1] Effort: L (requires backfilling Google Photos for NYC restaurants; UI can partially mitigate with a colored initial derived from cuisine hue rather than flat gray)

**3. Hero card `objectPosition: 'center 30%'` is applied unconditionally — crops faces/food out of portrait-oriented photos** [STILL-OPEN]
`RestaurantCard.tsx:324` hard-codes `style={{ objectPosition: 'center 30%' }}` on all hero-card images regardless of whether the photo is portrait (plated dish from above) or landscape (room shot). For typical food overhead shots, 30% from top means the main subject is pushed below the crop window. The restaurant detail hero (`page.tsx:305`) does not set objectPosition at all (defaults to `center center`), which is inconsistent. No per-photo focal-point data is stored.
`RestaurantCard.tsx:324` — explore-desktop.png (Categories grid)
[P1] Effort: M (drop the hard-coded 30% offset on hero cards; revert to `center center` as default; optionally store a per-photo `focal_y` percent in the DB for precise control later)

**4. `american` cuisine fallback URL duplicates `GENERIC_PHOTO_FALLBACK`** [NEW]
`restaurant.ts:38` maps `american` to the same Unsplash URL as `GENERIC_PHOTO_FALLBACK` (`photo-1504674900247-0877df9cc836`). This means `isStockFallbackPhoto` returns `true` for American cuisine correctly (the URL appears in `CUISINE_PHOTO_FALLBACK`), but visually a generic burger/food shot is used for both "unknown cuisine" and "American" — and `isStockFallbackPhoto` would report true for the generic fallback twice since it is also in the values list. More importantly, American BBQ, diners, and comfort food deserve a distinct shot.
`src/lib/restaurant.ts:38` vs `:9`
[P2] Effort: S (swap in a distinct American diner/comfort food Unsplash URL for the `american` key)

**5. Compact card thumbnail photo chain omits `yelp_photo_url`** [NEW]
`RestaurantCard.tsx:99-106` (`getHeroPhoto`) checks `photo_url → photo_urls[0] → google_photo_url → null`. It never falls through to `yelp_photo_url`, which the shared `getRestaurantPhotoUrl` in `restaurant.ts:57-64` does include. Restaurants that have only a Yelp photo will show a monogram in the compact card but render a real photo in `FavoritesSection` and `SuggestionCard` (which use the shared helper). Inconsistent photo presence depending on surface.
`RestaurantCard.tsx:99-106` vs `restaurant.ts:57-64`
[P2] Effort: S (add `|| restaurant.yelp_photo_url` to `getHeroPhoto` in RestaurantCard, or replace it with the shared `getRestaurantPhotoUrl` import)

---

## Quick Wins

1. **Wire `isStockFallbackPhoto` in `HeroVariant`** — one import + one conditional to show a `"Stock photo"` pill (bottom-left, semi-transparent). The helper is already correct. `RestaurantCard.tsx:260`. [S]
2. **Fix `american` cuisine URL** — replace the duplicate generic URL with a unique American comfort-food shot. One line in `restaurant.ts:38`. [S]
3. **Add `yelp_photo_url` to `getHeroPhoto`** — or import the shared `getRestaurantPhotoUrl`. Closes the inconsistency. `RestaurantCard.tsx:104`. [S]
4. **Extend cuisine fallback palette** — `steakhouse`, `seafood`, `greek`, `spanish`, `middle eastern`, and `caribbean` are missing keys; they fall through to the generic shot silently. Add 6 cuisine-appropriate Unsplash URLs. `restaurant.ts:16`. [S]
5. **Remove hard-coded `objectPosition: 'center 30%'` from hero card** — revert to CSS default `center center` until focal-point data is stored. `RestaurantCard.tsx:324`. [S]

---

## Bigger Bets

**A. Per-restaurant focal-point storage.** Add a `photo_focal_y` column (0–100, percent from top) to the `restaurants` table. The enrichment pipeline can default it to 50; a future admin tool lets editors nudge it per photo. Components read `objectPosition: \`center ${restaurant.photo_focal_y ?? 50}%\`` — solves cropping for the entire app permanently rather than per-component patches.

**B. Google Photo backfill for NYC (and all cities).** The cities-newyork-mobile screenshot reveals the photo backfill has not run for most NYC restaurants. Running `enrichWithGooglePlaces.ts` for the ~500 NYC rows that lack `google_photo_url` would transform the compact-card feed from a monogram grid into a visual one — no UI changes needed. Coordinate with data-steward lane; use the existing rate-limit of 100ms/req.

---

## Alarming

The `isStockFallbackPhoto` helper was the headline food-photography quick-win in v2 and was shipped as code — but zero UI components call it. It is dead code today. Users are shown Unsplash stock photos of arbitrary dishes with no disclosure, which is actively misleading on a product whose value proposition is authentic restaurant intelligence. This should be treated as a P0 trust issue, not a cosmetic P2.
