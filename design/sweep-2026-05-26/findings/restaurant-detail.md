# restaurant-detail

**Lens:** Does the restaurant detail page efficiently orient a user who just tapped through — hero impression, source ratings, dish signals, booking access, and social proof — before they bounce?
**Reviewed:** screenshot (restaurant-desktop.png) + source files (src/app/restaurants/[id]/page.tsx).

## Top 3 findings

1. [P0] **What's wrong:** The Google Maps embed in the sidebar is showing a live "Google Maps Platform rejected your request" error (API key failure), confirmed by the primer and visible in the screenshot mid-sidebar. The map area renders as a white block with red error text.
   **Why it matters:** A broken map is the first thing users see in the sidebar — it signals a broken product and removes the primary spatial-orientation tool (neighborhood, distance, transit) that drives "should I go here?" decisions.
   **What to do:** Add a runtime guard: if the iframe `src` key is missing or the embed errors, fall back to a static Google Maps link button pointing to `https://www.google.com/maps/search/?api=1&query=${lat},${lng}` (the fallback URL already exists at page.tsx line 823). Separately fix the `NEXT_PUBLIC_GOOGLE_MAPS_EMBED_KEY` env var in production.
   **Why you'd want to do this:** A broken API widget is the #1 trust killer on a detail page; fixing it restores confidence in the product's data reliability, which is Gastronome's core value proposition.
   (effort: S — fallback URL already coded, just needs a conditional render)

2. [P1] **What's wrong:** The hero photo is rendered at `opacity-30` (page.tsx line 297), making the restaurant's primary image nearly invisible under the dark overlay. For JoJo (a 1-star Michelin restaurant with a distinctive interior), a flagship photo at 30% opacity fails to create appetite or place identity.
   **Why it matters:** The hero (the large image/banner at the top of the page) is the primary emotional hook — it communicates ambiance (the mood/feel of a space) before any text. At 30% opacity the user cannot read the photo; it may as well be a solid dark rectangle.
   **What to do:** Increase the photo opacity to 50–60% and tighten the gradient overlay (`from-black/90 via-black/50 to-transparent`) so the bottom-third remains legible for the name/address, while the upper photo breathes. Test with at least 3 restaurant photos across lighting conditions.
   **Why you'd want to do this:** A recognizable, atmospheric hero drives stay-time and confidence that you are looking at the right place — critical when a user has arrived from a card click and is confirming their intent.
   (effort: S — single CSS value change + gradient tweak)

3. [P1] **What's wrong:** "The Story" (the restaurant's editorial description) is the last item in the main column, after the Ratings Dashboard and the entire On Social video section (page.tsx lines 681–775 before 730–775). On a viewport like the screenshot, users scroll through aggregated ratings and a video gallery before learning what the restaurant is.
   **Why it matters:** Scroll depth before key info — knowing that JoJo is "an elegant townhouse restaurant by Jean-Georges Vongerichten with a seasonal French menu" — is the orienting context that makes every subsequent rating and dish name meaningful. Burying it last inverts the natural reading order (who → what → how good).
   **What to do:** Move "The Story" section directly below the hero/accolades banner and before the Ratings Dashboard. Keep the video gallery (On Social) last in the column — discovery/entertainment content belongs after comprehension content.
   **Why you'd want to do this:** Users who understand what a restaurant is first will engage more deeply with ratings and dishes; they are also less likely to bounce because the page makes sense immediately.
   (effort: S — reorder JSX blocks, no data changes needed)

## Quick wins (≤3, no severity tag)

1. **What's wrong:** The hero shows only a single `avgRating` number (line 286–287: Google rating, or Yelp if null) with a star icon, but no label saying it is Google or an average. A user who just came from a search filtered by Yelp score will not know which source this star represents.
   **Why it matters:** Unattributed numbers on an aggregator undermine the core premise — users chose Gastronome for multi-source clarity.
   **What to do:** Add a source label next to the hero rating ("4.3 Google" using the `GoogleGIcon` component already imported at line 12, or "avg." if aggregating). Four words, zero new data fetches.
   **Why you'd want to do this:** Source transparency in the hero reinforces Gastronome's differentiator (multi-source aggregation) at the very first impression.
   (effort: S)

2. **What's wrong:** Dish chips display source-split icons (G, TT, IG) and sentiment chips, but the only way to see the `sampleQuote` is a `title` tooltip (page.tsx line 612) — invisible on touch devices and undiscoverable on desktop.
   **Why it matters:** The sample quote is the most human, persuasive element in the dish data ("it's what got me to order it") and it is inaccessible to the majority of users.
   **What to do:** Show the first 60 characters of `sampleQuote` inline below the dish chip row, styled as a pull-quote (italics, secondary color). Or surface it on tap/click in a small popover (a small floating card) — either beats the current tooltip-only pattern.
   **Why you'd want to do this:** Social proof at the dish level is a conversion driver for reservations; surfacing quotes turns "mentioned 12 times" into "people specifically said X."
   (effort: S–M)

3. **What's wrong:** There is no reservation or booking CTA (call-to-action button) anywhere on the page. The contact row (page.tsx lines 377–419) has phone, website, and Instagram, but no link to OpenTable, Resy, or the restaurant's booking page.
   **Why it matters:** "I want to go here" is the conversion goal of the entire detail page. Forcing users to navigate away to find a booking link adds friction at the highest-intent moment.
   **What to do:** Add an optional `reservation_url` field (or derive it from the restaurant's website domain) and render a prominent "Reserve a Table" button in the hero contact row and/or at the top of the sidebar above the map.
   **Why you'd want to do this:** A booking CTA is the single action most correlated with restaurant-discovery app retention; it closes the loop from discovery to intent.
   (effort: M — requires schema field + UI)

## One bigger bet (optional)

**What's wrong:** The hero is a thin text+dimmed-photo strip. Competitors (Eater, Infatuation, Resy) use a full-bleed (edge-to-edge) photo hero with the restaurant name anchored at the bottom. Gastronome's hero currently prioritizes navigation chrome (Back, Bookmark, Share) over the photo.
**Why it matters:** A full-bleed hero creates immediate place identity and ambiance signal before a user reads a single word. The current design feels like a listing, not a restaurant profile.
**What to do:** Expand the hero to a fixed 480px tall full-bleed image (with the existing gradient), move Back/Bookmark/Share into a floating top bar (overlaid, not reserved space), and increase name to 3xl–4xl. Use the existing `photo_url || google_photo_url` chain (line 285).
**Why you'd want to do this:** Full-bleed heroes consistently increase scroll depth and time on page for media-rich discovery products.
**The tradeoff:** Taller hero pushes the Ratings Dashboard and core info below the fold on shorter laptop viewports (1280×800 or less) — requires user testing to confirm the tradeoff is net-positive.
(effort: M)

## Alarming (optional, 1 line)

Live Google Maps API key rejection error is visible in production to all users — classified as P0 infrastructure break, not a design issue, but surfaced here because it is the most visible defect on the page.
