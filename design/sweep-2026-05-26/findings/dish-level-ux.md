# dish-level-ux

**Lens:** Are dishes treated as first-class entities — with photos, attribution, price, and a clear link to the menu?
**Reviewed:** `restaurant-desktop.png` + `src/app/restaurants/[id]/page.tsx`.

## Top 3 findings

1. [P0] **What's wrong:** The "What Reviewers Mention" section shows dishes as plain text pills — no photos, no prices, no menu link. The data model (page.tsx:121) fetches `avg_rating`, `positive_pct`, and `sample_quote` but never connects a dish pill to a corresponding `restaurant_menu_items` row (a separate table that holds price and menu context).
   **Why it matters:** A user who sees "Duck Confit · ★4.8" has no way to know the price, confirm it's still on the menu, or act on that recommendation. The dish feels like a tag, not a product.
   **What to do:** Join `restaurant_highlighted_dishes` to `restaurant_menu_items` on normalized name at query time and surface price inline (e.g., "Duck Confit · $38 · ★4.8") as a secondary line inside an expanded pill or card layout.
   **Why you'd want to do this:** Closing the dish→price gap is the single action most likely to make a dish recommendation feel bookable rather than decorative — directly supporting conversion intent.
   (effort: M)

2. [P1] **What's wrong:** The source-attribution strip (platform icons G / TT / IG inside each dish pill) is tooltip-only — hover reveals the count, but the icons themselves carry no visible numeric labels. On the screenshot the icon row is ~11px and nearly invisible. Users have no scannable sense of how many voices back a dish.
   **Why it matters:** "X critics recommend the X" is this lens's core promise. Burying mention counts behind a hover-only title attribute (page.tsx:626–660) means the social proof that distinguishes Gastronome from a plain menu is invisible to most users (especially touch users on mobile).
   **What to do:** Show the total `dish.count` prominently beside the dish name (e.g., "7 mentions") and make the source icons scannable — either visible badges with counts or a short "G·4 TT·2 IG·1" string instead of icon-only tooltips.
   **Why you'd want to do this:** Explicit mention counts are the primary trust signal for aggregated dish data; showing them rewards the data pipeline investment and differentiates from Yelp/Google.
   (effort: S)

3. [P1] **What's wrong:** The section heading "What Reviewers Mention" (page.tsx:527) is ambiguous — it sounds like it could be complaints, ambiance notes, or service comments. The screenshot shows no explanatory sub-copy. A first-time user cannot tell whether these pills represent dishes, themes, or adjectives.
   **Why it matters:** Ambiguous labeling (jargon: information scent — the cue that tells you what clicking or reading will yield) causes users to skip the section entirely, wasting the richest dish data on the page.
   **What to do:** Rename to "Dishes Critics Talk About" or add a one-line descriptor: "Most-mentioned dishes across Google reviews, TikTok, and Instagram." The sub-label "Across reviews & social" (page.tsx:516) is close but too generic.
   **Why you'd want to do this:** Clearer labeling increases engagement with the section, which in turn increases time-on-page and shares — both tracked conversion signals.
   (effort: S)

## Quick wins (≤3, no severity tag)

1. **What's wrong:** `dish.sampleQuote` is fetched and populated (page.tsx:121, 612) but rendered only as a `title` attribute tooltip — invisible on touch, never seen by most desktop users.
   **Why it matters:** A real reviewer quote ("The best duck confit I've had outside of Paris") is the highest-trust dish signal on the page; hiding it behind hover wastes the most persuasive copy.
   **What to do:** Surface the `sampleQuote` as a visible one-line italic excerpt below the dish name when the pill is expanded or in a card layout.
   **Why you'd want to do this:** Visible quotes drive social proof and differentiate dish recommendations from anonymous star counts.
   (effort: S)

2. **What's wrong:** Dietary / allergen tags are entirely absent from the dish section. The data model has no `dietary_tags` column exposed in the query (page.tsx:121).
   **Why it matters:** Users with dietary restrictions make decisions at the dish level, not the restaurant level — no tags means they must leave the page to check.
   **What to do:** If `restaurant_menu_items` carries dietary flags (gluten-free, vegan, etc.), surface them as small color-coded labels on the matched dish pill.
   **Why you'd want to do this:** Dietary filtering is a high-intent user need; meeting it in-page reduces drop-off for a significant user segment.
   (effort: M)

3. **What's wrong:** The "On Social" video gallery (page.tsx:727) appears immediately after the dish section with no visual connection. A TikTok video that features the duck confit could reinforce the dish pill above it, but the two sections are entirely siloed.
   **Why it matters:** Users browsing dish recommendations and then scrolling past unrelated video thumbnails miss an opportunity to see the dish in action — the most compelling form of social proof.
   **What to do:** Tag each video with the dish it features (if the caption data already exists) and show a "See it on TikTok →" micro-link inside the dish pill.
   **Why you'd want to do this:** Cross-linking dish pills to video clips is a high-differentiation feature no major aggregator currently offers.
   (effort: M)

## One bigger bet (optional)

**What's wrong:** Dishes are rendered as a flat, unordered pill cloud (page.tsx:545 `flex flex-wrap gap-2`). There is no visual hierarchy, no photo, and no way to distinguish the #1 dish from the #6 dish despite a `rank` field being fetched (page.tsx:124).
**Why it matters:** A user deciding what to order wants to know the restaurant's signature dish immediately — the current layout treats "Foie Gras" and a side dish with 1 mention identically.
**What to do:** Redesign the top dish as a featured card (photo from menu item or Google image, name large, mention count, sample quote, price) and demote dishes 2–6 to pills below it. This mirrors the mental model of "what is this place known for."
**Why you'd want to do this:** A featured dish card is a highly shareable, screenshot-able UI element that drives social sharing of individual restaurant pages — compounding discovery.
**The tradeoff:** Requires a dish photo source (not currently stored on `restaurant_highlighted_dishes`) and a more complex layout that may feel heavy if the top dish has thin data. Risk of over-promising on dish quality when `mention_count` is low.
(effort: L)

## Alarming (optional, 1 line)

The `restaurant_menu_items` table exists in the schema (CLAUDE.md) but is never queried on the restaurant detail page — all the menu price and context data is silently absent from the dish surface users actually see.
