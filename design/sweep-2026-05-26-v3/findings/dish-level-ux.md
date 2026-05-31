# Dish-Level UX — Sweep v3 findings (RE-SWEEP 2026-05-26)

Lens: dishes as first-class entities — photos, attribution, price, dietary tags, Signature Dishes section + empty state. Desktop and mobile.

---

## Status of v2 findings

**[RESOLVED] QW1 — "What Reviewers Mention" renamed "Signature Dishes".**
The heading now reads "Signature Dishes" with kicker "Across reviews & social." This is live in the code (page.tsx line 542) and visible in both screenshots. The v2 P0 rename is done.

**[RESOLVED] v2 P0 #4 — Empty-state graceful handling.**
When `dishes.length === 0` the section now shows a dashed box: "Menu coming soon — our dish recommendations come from reviews and social posts, and we're still gathering them for {name}." Plus a "View the menu on the restaurant's site →" link when `restaurant.website` exists. Code: page.tsx lines 698–759.

**[STILL-OPEN] QW2 — Bare mention count has no unit.**
`{dish.count}` still renders as a raw integer (e.g., "12") with no "mentions" label. Code: page.tsx line 686–690. Visible in desktop screenshot — the trailing number in each chip is unreadable to a first-time visitor.

**[STILL-OPEN] v2 #2 — No dish photos.**
Chips remain text-only. The database has no photo column on `restaurant_highlighted_dishes`. Directly below the dish row, the video gallery renders rich thumbnails (restaurant-desktop.png mid-section). The contrast makes the dish chips feel thin.

**[STILL-OPEN] v2 #4 — User reviews cannot attribute dishes.**
No `review_dishes` table or "dishes ordered" field on the review form. Dish signals are still purely LLM-extracted from TikTok/Instagram/Google.

**[STILL-OPEN] v2 #5 / BB1 — No dish-level price.**
No join to `restaurant_menu_items.price`. A user cannot see what any recommended dish costs. Data exists in two tables, never joined in the UI.

**[STILL-OPEN] v2 QW4 — `sample_quote` only in tooltip.**
`dish.sampleQuote` is set as `title` attribute (page.tsx line 629) — invisible on mobile (restaurant-mobile.png shows no quote text in the dish area) and only visible on desktop hover. The closest thing to a critic pull-quote does no visible work on either platform.

**[STILL-OPEN] Dietary/allergen gap (v2 Alarming).**
No dietary tags at the dish or restaurant level. Still not flagged as resolved anywhere in primer.md.

---

## Top 5

**1. [STILL-OPEN] Dish chips are anonymous — no human voice, no critic attribution [P1 · S effort]**
The kicker says "Across reviews & social" but each chip carries only icon glyphs (G, TT, IG). There is no copy like "7 critics recommend the duck confit" or "mentioned in 4 Google reviews." The source-attribution promise of the product (Gastronome aggregates voices) is absent at the dish level. On mobile (restaurant-mobile.png, Signature Dishes area) icons are barely 11px square — attribution is invisible in practice.
page.tsx lines 634–690; restaurant-mobile.png (Signature Dishes row).

**2. [STILL-OPEN] Bare mention count with no unit [P2 · XS effort]**
Every chip ends with a plain number (e.g., "12"). No unit, no label. On first glance it reads like a rating or a price. One word — "mentions" — would fix this. Previously filed as v2 QW2 and still unaddressed.
page.tsx lines 683–690; restaurant-desktop.png (chip row, trailing digit).

**3. [STILL-OPEN] `sample_quote` is tooltip-only — invisible on mobile [P1 · S effort]**
The most legible dish-level signal — a real sentence from a real reviewer — is buried in a `title` attribute that touch screens can never surface. On mobile (restaurant-mobile.png) the Signature Dishes row shows chips with no textual evidence for why these dishes are recommended. Showing 80 chars of the top-dish quote inline would give the section editorial credibility.
page.tsx line 629; restaurant-mobile.png (Signature Dishes section).

**4. [STILL-OPEN] No dish-level price; menu join is unfired [P1 · M effort]**
`restaurant_menu_items` holds scraped prices but the dishes query (page.tsx lines 122–128) never joins to it. A user deciding "can I afford the thing everyone recommends?" gets zero help. The data exists; the join does not.
page.tsx lines 122–128 (query) vs. CLAUDE.md table list (`restaurant_menu_items` has `name`, `price`).

**5. [NEW] Empty-state copy contradicts the section heading [P2 · XS effort]**
The section heading is "Signature Dishes." The empty-state body text reads "Menu coming soon — our dish recommendations come from reviews and social posts." "Menu coming soon" implies the app is waiting for a menu upload; the real situation is that signals haven't been aggregated yet. The copy also mixes "dish recommendations" with "menu" in a way that confuses the data model. Better: "We haven't surfaced dish highlights for {name} yet — check back soon."
page.tsx lines 741–758; restaurant-desktop.png (dashed empty-state box visible in screenshot).

---

## Quick Wins (5)

**QW1.** Add "mentions" after `{dish.count}`: `{dish.count} mention{dish.count !== 1 ? 's' : ''}`. page.tsx line 688. XS.

**QW2.** Replace `title={dish.sampleQuote}` with a visually rendered quote beneath the top-ranked chip (max 80 chars, italic, secondary color). page.tsx line 629. S.

**QW3.** Fix empty-state copy: replace "Menu coming soon" with "Dish highlights not yet available for {restaurant.name}." page.tsx line 741. XS.

**QW4.** Add `aria-label` to each dish chip wrapper: `${dish.name}, ${dish.count} mentions across ${[...sources].join(', ')}`. page.tsx line 619. XS — accessibility + screen-reader dish reading.

**QW5.** Show the total mention count in the section kicker: "Top {dishes.length} · {total} total mentions" instead of just "Top {dishes.length}". Gives social proof at the section level. page.tsx lines 554–555. XS.

---

## 2 Bigger Bets

**BB1. Join `restaurant_highlighted_dishes` to `restaurant_menu_items` for price.**
Fuzzy-normalize dish names (lowercase, strip punctuation) and do a second `.select('name,price').eq('restaurant_id', restaurantId)` fetch at page load. Where a match exists, render "Duck Confit · $38" inline in the chip. No new scraping needed — data exists. This turns the dish section from "what people mention" into "what you should order and what it costs."
page.tsx lines 122–128 (add parallel fetch); database: `restaurant_menu_items`.

**BB2. Inline a quoted critic sentence per dish ("X people say: '...'").**
`sample_quote` is already fetched for all dishes (page.tsx line 206). Instead of hiding it in a tooltip, render the top dish's quote as a pull-quote below the chip row, attributed to source (e.g., "★ Google · 4.2"). Pair with a "See more" expand for dishes 2–6. This is the single biggest editorial differentiator available without new data — the content already exists and is doing zero visible work.
page.tsx lines 206, 629.

---

## Alarming

**[STILL-OPEN] No dietary or allergen signal at dish level.**
`restaurant_highlighted_dishes` has no dietary-tag column. The app will increasingly recommend specific dishes to users — "the duck confit," "the tasting menu" — with no disclosure of allergens. As dish data coverage grows this becomes a trust-and-safety gap, not just a feature gap. A dietary tag schema (even a simple string array: `['gluten-free', 'vegan']`) should be designed before dish recommendations become prominent.
CLAUDE.md database tables (no dietary columns); page.tsx dish section (entire).
