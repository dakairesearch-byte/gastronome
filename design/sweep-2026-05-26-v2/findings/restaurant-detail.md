# Restaurant Detail — UX Findings
Specialist: restaurant-detail | Sweep: 2026-05-26-v2

---

## Top 5 Findings

**1. Hero image is nearly invisible — 30% opacity buries visual identity**
The hero photo is rendered at `opacity-30` behind an 80% black gradient, leaving the page visually dark and undifferentiated. Users lose the "place feel" that would prime appetite and confidence before scrolling.
Fix: raise to ~55–65% opacity with a tighter gradient base; or use a full-bleed image with bottom gradient only.
Source: `page.tsx:298` (`opacity-30`); visible in `restaurant-desktop.png` hero.

**2. No reservation / booking CTA anywhere on the page**
The page exposes phone and website links at 50% white opacity in the hero (easy to miss) but offers no direct booking action — no OpenTable, Resy, or even a prominent "Reserve a Table" button. For a Michelin-starred restaurant this is a high-intent missing action.
Fix: add a sticky or top-of-sidebar CTA block with reservation link if available, or at minimum surface the phone number in a tappable button pattern at a higher prominence tier.
Source: `page.tsx:377–419` (contact row at `rgba(255,255,255,0.5)`); `restaurant-desktop.png` sidebar (empty above map).

**3. Broken Google Maps embed visible in production — dead sidebar real estate**
The map iframe renders a Google error ("Google Maps Platform rejected your request…") per the noted live API error. On mobile the map placeholder becomes a blank grey rectangle with only "View on Google Maps" below it. This is the first thing in the sidebar column, so the error is immediately visible above the fold on desktop.
Fix: wrap the iframe in an error-boundary or `onError` handler; fall back to a static map image or just show a clean address card + directions link when the embed fails.
Source: `page.tsx:799–816` (iframe with no error fallback); `restaurant-desktop.png` sidebar; `restaurant-mobile.png` grey map block.

**4. Dish chips are tiny, tooltip-only — the app's most differentiating data is nearly invisible**
The "What Reviewers Mention" section renders dishes as small pill chips; the source-split icons (GoogleGIcon, TT, IG) are 11–14px with the actual counts accessible only via `title` tooltips. On mobile these chips wrap into an unreadable cluster. This is the primary unique signal Gastronome provides over competitors yet it gets less visual weight than the ratings dashboard.
Fix: expand top dishes to a ranked list (name + confidence chip + bar or donut for source split) at full column width, with `sampleQuote` surfaced inline on at least the top 2 dishes.
Source: `page.tsx:545–678` (chip layout); `restaurant-mobile.png` dish section.

**5. Single-column scroll on mobile buries the map below 3 full sections**
On mobile the sidebar (map + similar restaurants) moves below the entire main column. A user wanting directions must scroll past Ratings Dashboard, On Social (a video), The Story, then a blank grey map. Critical wayfinding context is far below the fold.
Fix: on mobile, insert a condensed location/action row (address + "Get Directions" link + phone) immediately below the hero accolades banner, rather than relying solely on the sidebar map.
Source: `page.tsx:441` (grid reflows to single column at `lg:`); `restaurant-mobile.png` map position.

---

## 5 Quick Wins

**QW1. Hero rating shows only one source despite multi-source being the value prop**
`avgRating` falls back to google_rating then yelp_rating as a single star in the hero (`page.tsx:286, 364–374`). The hero could show a micro row of G/Y/Infatuation pills the same way the dashboard does.

**QW2. "Ratings Dashboard" section label is generic and internal-sounding**
`page.tsx:460`: label reads "Ratings Dashboard" — feels like a dev section title. Rename to "Critics Say" or "By the Numbers" to match editorial voice.

**QW3. Accolades banner only appears if `hasAccolades` is true — no placeholder for restaurants mid-recognition cycle**
`page.tsx:280–284, 425–437`: restaurants without accolades have a visual gap where the warm amber band would be. No harm per se, but worth noting — the page height jumps between restaurants causing layout shift in navigation.

**QW4. Share button uses generic Web Share API text without description or star count**
`page.tsx:316–323`: the `text` prop is cuisine + neighborhood only. Including the top score (e.g. "4.3 Google · Michelin Star") would make shared links more compelling.

**QW5. `alt=""` on hero image is correct for decorative use, but the page has no visible restaurant photo with descriptive alt text**
`page.tsx:296`: hero image is entirely decorative (`alt=""`). If the image is the restaurant exterior or interior, adding descriptive alt text aids screen reader users without breaking visual presentation.

---

## 2 Bigger Bets

**BB1. Unified "Verdict" card above the fold**
Currently a user must scroll through hero → accolades banner → ratings dashboard to form a coherent first impression. A single above-the-fold "verdict card" synthesizing Gastronome's cross-source score, the top 2 dishes, and one editorial quote (from `sampleQuote`) would let users make a go/no-go decision without scrolling. This is the product's core UX promise and the current layout defers it.
Source: page structure `page.tsx:288–492`.

**BB2. Ambiance / occasion signals are entirely absent**
The page has ratings, dishes, videos, description, and a map — but no signals for occasion fit (date night vs. business lunch vs. solo bar), noise level, dress code, or price-per-head beyond what might appear in the description text. Competitors (Resy, Eater) surface these as structured chips. Adding even 3–4 structured occasion tags to the DB and rendering them in the hero or sidebar would meaningfully differentiate the detail page for discovery-mode users.
Source: `page.tsx` sidebar `778–864` — only map + similar restaurants; no occasion/vibe block.

---

## Alarming

**The Google Maps embed has no error fallback.** The screenshot confirms the error is user-visible in production. The iframe uses an IIFE to build the `src` URL (`page.tsx:799–816`) with no `onError`, no loading state, and no fallback UI. On mobile this degrades to a blank grey block occupying a quarter of the page height. Fixing this is a one-day fix that prevents a clearly broken production surface from shipping further.
