# Dish-Level UX — Sweep v2 findings

Lens: dishes as first-class entities. Photos, attribution, critic count language, price, dietary tags, dish-to-menu-item join, whether the surface tells the dish story.

---

## Top 5

**1. Dish section heading buries the lead**
The section is titled "What Reviewers Mention" with a kicker "Across reviews & social." That framing positions dishes as metadata about critics, not as things a diner actually wants to eat. The word "dishes" never appears in the heading. A hungry user scanning the page has no reason to stop here.
`restaurant/[id]/page.tsx` line 523–528 · `restaurant-desktop.png` mid-page.

**2. No dish photos anywhere on the restaurant page**
Every dish chip is text-only. `restaurant_highlighted_dishes` has no photo column; `restaurant_menu_items` has no photo column either. The social-video section immediately below this block is packed with visual content (TikTok/Instagram thumbnails), which makes the dish row feel like a footnote by comparison. Dishes without photos don't feel like things worth ordering.
`restaurant/[id]/page.tsx` lines 545–678 · `restaurant-desktop.png` (compare "What Reviewers Mention" chips vs. the video gallery directly below).

**3. Mention count is shown as a bare number with no unit**
Each chip ends with a raw integer (e.g., `12`) from `dish.count`, with no label like "mentions" or "reviews". The tooltip on the rating/sentiment chip explains the sample size, but most users won't hover. A number without a unit reads as noise.
`restaurant/[id]/page.tsx` lines 666–673.

**4. No dish field in the review form — dish mentions can only come from scraped sources**
The review form (`/review/new`) has no "dishes ordered" or "highlight dish" field. User reviews are inserted into the `reviews` table with just rating, title, and content. The `restaurant_highlighted_dishes` table is fed only by LLM extraction from social/Google — Gastronome's own users can never directly signal "I recommend the duck confit." This is a structural gap: user attribution is missing from the dish layer entirely.
`review/new/page.tsx` lines 198–215 · `restaurant/[id]/page.tsx` lines 493–501 (comment confirms union of TikTok, Instagram, Google — no user reviews).

**5. Price is collected at restaurant level only, absent at dish level**
The review form captures `price_range` ($/$$/$$$) for the whole restaurant. There is no per-dish price on the detail page and no join to `restaurant_menu_items.price`. A user trying to answer "can I afford to order the thing everyone recommends?" has zero help from the dish section.
`review/new/page.tsx` lines 382–396 · `restaurant/[id]/page.tsx` (dish section has no price field, not queried from menu_items).

---

## 5 Quick Wins

**QW1. Relabel "What Reviewers Mention" → "Signature Dishes"**
Shorter, food-forward, scannable. The code comment at line 493 already uses the term "Signature Dishes" — the UI heading just hasn't caught up.
`restaurant/[id]/page.tsx` line 523.

**QW2. Replace bare mention count with "12 mentions"**
One word added after `{dish.count}` changes noise into a legible signal.
`restaurant/[id]/page.tsx` line 670.

**QW3. Add `aria-label` to each dish chip**
The dish `<span>` is not interactive and has no accessible name beyond its text content. Screen readers will read "duck confit ★ 4.2 G TT IG 12" as a run-on. Add `aria-label={`${dish.name}, ${dish.count} mentions`}` to each wrapper.
`restaurant/[id]/page.tsx` line 601.

**QW4. Surface `sample_quote` visibly, not just as a tooltip**
`dish.sampleQuote` is already fetched (line 121) and set as a `title` attribute (line 612), but tooltips are invisible on touch screens and opaque on desktop. Show the first 80 chars of the quote beneath the chip row or as a hover popover — this is the closest thing to a critic pull-quote at the dish level and currently does zero work.
`restaurant/[id]/page.tsx` line 612.

**QW5. Kicker copy "Across reviews & social" → "Most-mentioned across Google, TikTok & Instagram"**
More specific, sets honest expectations about sources, and matches the icon strip the user already sees on each chip.
`restaurant/[id]/page.tsx` line 512.

---

## 2 Bigger Bets

**BB1. Join dish chips to menu items for price + canonical name**
`restaurant_menu_items` (scraped, per CLAUDE.md) has `name` and `price`. A fuzzy-match join (normalized lowercase) between `restaurant_highlighted_dishes.dish_name` and `restaurant_menu_items.name` would unlock per-dish price display ("Duck Confit · $38") without any new scraping. This is the single highest-value data join not yet expressed in the UI; the data exists in two tables that are never joined on this page.
Tables: `restaurant_highlighted_dishes`, `restaurant_menu_items` · `restaurant/[id]/page.tsx` line 119–125 (dishes query — add join or second fetch).

**BB2. Add a "dishes ordered" multi-select to the review form**
When a user selects a restaurant in the review form, fetch its `restaurant_highlighted_dishes` (or `restaurant_menu_items`) and present a pill-picker: "What did you order? (optional)." Write selections to a new `review_dishes` join table. This closes the user-attribution gap (finding #4) and feeds the dish leaderboard with first-party signal — currently every dish mention is inferred by LLM from social captions, which is lossy and biased toward TikTok-viral items.
`review/new/page.tsx` (new section after Rating, before Quick Thought) · requires new `review_dishes` table and backfill path into `restaurant_highlighted_dishes`.

---

## Alarming

**No dietary or allergen signal at the dish level.** The `restaurant_highlighted_dishes` table has no dietary-tag column (vegan, gluten-free, halal, etc.), and the review form has no allergy/diet field. For an app that surfaces dish recommendations to diners who may have hard dietary constraints, recommending "the duck confit" to someone who can't eat it — with no caveat — is a genuine trust and safety gap. This requires a schema addition before the dish layer becomes a recommendation surface rather than a curiosity.
`restaurant/[id]/page.tsx` dish section (entire) · CLAUDE.md database tables (no dietary columns listed).
