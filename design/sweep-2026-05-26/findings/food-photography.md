# food-photography

**Lens:** How images are sourced, cropped, displayed, and gracefully replaced when absent across restaurant cards.
**Reviewed:** `explore-desktop.png` + `RestaurantCard.tsx` + `restaurant.ts`.

## Top 3 findings

1. [P1] **What's wrong:** The hero card uses a fixed `aspect-[16/10]` ratio (`RestaurantCard.tsx:180`) but Google Places photo URLs (`google_photo_url`) are served at whatever resolution the upstream photo was uploaded — often portrait or square. `object-cover` masks this by cropping aggressively, but food subjects end up headless or plate-less with no control over focal point.
   **Why it matters:** A cropped-out plate or a shot of just a ceiling ruins the card's "eye-catchiness" goal stated in the component comment, and erodes trust in the aggregated data quality.
   **What to do:** Add `object-position: center 30%` (a CSS rule that biases crop toward the upper third, where food typically sits in food photography) as a default, and expose an `object_position` field in the DB for per-restaurant overrides.
   **Why you'd want to do this:** Even a heuristic crop-bias produces noticeably better framing without a scrape or manual curation pass.
   (effort: S)

2. [P1] **What's wrong:** The fallback chain in `restaurant.ts:55–61` (`getRestaurantPhotoUrl`) tries `photo_url → google_photo_url → yelp_photo_url → cuisine stock photo`; but `RestaurantCard.tsx:72–79` (`getHeroPhoto`) uses a *different* chain (`photo_url → photo_urls[0] → google_photo_url → null`) that skips both `yelp_photo_url` and the cuisine-keyed Unsplash fallbacks. Cards in the hero variant can therefore render the gray initial-letter placeholder (screenshot: Categories grid, `explore-desktop.png`) even when a Yelp photo or stock image would fill the slot.
   **Why it matters:** A letter-on-gradient placeholder communicates "no data here" and weakens the visual grid exactly where the app is trying to sell discovery.
   **What to do:** Replace `getHeroPhoto` in `RestaurantCard.tsx` with a call to the shared `getRestaurantPhotoUrl` from `restaurant.ts`, then pass `onError={() => setPhotoFailed(true)}` to fall through to the cuisine stock photo.
   **Why you'd want to do this:** Eliminates two divergent fallback implementations in a single import swap; category grids will look consistently populated.
   (effort: S)

3. [P2] **What's wrong:** Every cuisine-keyed Unsplash stock fallback in `restaurant.ts:16–37` uses `?w=800&q=80` — an 800 px wide JPEG at 80% quality — regardless of where the image is rendered (hero card thumbnail ≈ 350 px wide at 1440 viewport, or a full-bleed detail hero).
   **Why it matters:** Cards download 2–3× more bytes than needed; on a 30-card Explore grid that is roughly 7–10 MB of avoidable image data, slowing first-meaningful-paint (the point at which the user sees real content).
   **What to do:** Use responsive Unsplash sizing parameters (`?w=400&q=75` for card thumbnails, `?w=1200&q=85` for detail heroes) via a helper that accepts a `size` argument, or switch to Next.js `<Image>` with `sizes` so the browser picks the right srcset entry.
   **Why you'd want to do this:** Halves image payload on the Explore grid with zero visual quality loss; also unblocks using `<Image>` for automatic WebP conversion.
   (effort: M)

## Quick wins (≤3, no severity tag)

1. **What's wrong:** `japanese` and `thai` cuisine keys in `restaurant.ts:20,28` point to the same Unsplash URL (the ramen bowl photo), so Thai restaurants show a ramen fallback.
   **Why it matters:** A user filtering for Thai sees what looks like a Japanese noodle restaurant — incorrect cuisine signal before they click.
   **What to do:** Replace the `thai` entry with a distinct Thai-food Unsplash photo (e.g. `photo-1559847844-5315695dadae`).
   **Why you'd want to do this:** One-line fix; removes a misleading cuisine signal at zero cost.
   (effort: S)

2. **What's wrong:** No photo attribution or licensing credit is rendered anywhere on the hero card or detail page. Google Places photos require attribution per the API Terms of Service (ToS).
   **Why it matters:** Legal exposure from ToS non-compliance; Google can revoke API access.
   **What to do:** Render a small "Photo: Google" credit overlay on cards when the source is `google_photo_url`, matching the same pattern used for rating source logos elsewhere in the app.
   **Why you'd want to do this:** ToS compliance; low implementation cost; already have a brand-icon system to draw from.
   (effort: S)

3. **What's wrong:** The `compact` variant of `RestaurantCard` has no photo at all (by design), but when it appears alongside hero cards in the same scroll context — e.g. search results mixed with Explore collections — the visual rhythm lurches between photo-rich and photo-free rows.
   **Why it matters:** Users read inconsistent card density as broken or incomplete rather than intentional.
   **What to do:** Document the intended mixing rule (compact-only contexts vs. hero-only contexts) and add a lint comment or prop guard to prevent accidental mixing.
   **Why you'd want to do this:** Prevents future regressions without requiring a visual redesign.
   (effort: S)

## One bigger bet (optional)

**What's wrong:** All hero photos are static JPEGs from Google/Yelp or Unsplash stock. The app already aggregates TikTok/Instagram video metadata (`restaurant_videos` table per `CLAUDE.md`) but never surfaces a video thumbnail or short loop on the card.
**Why it matters:** Video thumbnails are demonstrably more engaging than static food photography for discovery-oriented surfaces; competitors (Eater, The Infatuation) already use motion on cards.
**What to do:** Fall through to `restaurant_videos.thumbnail_url` as a final image source before the Unsplash stock fallback; optionally auto-play a muted 3-second loop on card hover.
**Why you'd want to do this:** Differentiates from static aggregators; re-uses data the pipeline already collects.
**The tradeoff:** Video assets are heavier (even thumbnails can be larger JPEGs); hover autoplay adds layout/performance complexity and can feel distracting in a dense grid. Start with thumbnail-only before adding motion.
(effort: L)
