# the-chef

**Lens:** Would I be proud — or embarrassed — if a guest's first impression of my restaurant came from this page?
**Reviewed:** screenshot + source files.

## Top 3 findings

1. [P0] **What's wrong:** The whole page tells my story through other people's scores. JoJo is a 1-Michelin-star Jean-Georges room with a real point of view, and the loudest things on the screen are "Google 4.3" and "Yelp 3.7" — including a Yelp number low enough to look like a warning sign (screenshot, "Ratings Dashboard"; `page.tsx:229-265`).
   **Why it matters:** Guests anchor on the biggest number on the page. A 3.7 Yelp next to a Michelin star reads as contradictory and makes diners hesitate at the exact moment we want them to book.
   **What to do:** Lead with the editorial signal we already have — Michelin, Eater 38, JBF, Infatuation rating in a dedicated "Critical Reception" block above the Google/Yelp row. Demote crowd ratings to a smaller "What diners say" strip with sample size shown, not headline type.
   **Why you'd want to do this:** Differentiates Gastronome from Google. Anyone can show a star rating; only Gastronome can say "the critics and the crowd both rate this — here's where they agree and disagree."
   (effort: M)

2. [P0] **What's wrong:** A live Google Maps Platform error block ("Rejected API key… activate an API key in the Google Cloud Console") is rendered in plain sight, mid-page, on a Michelin restaurant (screenshot, right column; `page.tsx:781-816` — the iframe renders the error HTML inline).
   **Why it matters:** As a restaurateur this is mortifying. If a magazine printed my listing with a typesetter's error, I'd pull my support. Guests will assume the rest of the data is just as broken.
   **What to do:** Catch iframe load failure and substitute a clean static map tile (Mapbox/Apple/Google static) plus a "Get directions" button. Never let raw Google error HTML reach a guest.
   **Why you'd want to do this:** One visible infra failure poisons trust for the whole page; a clean fallback keeps the restaurant looking presentable even when an API key expires.
   (effort: S)

3. [P1] **What's wrong:** No "Signature Dishes" section is showing for JoJo even though the code fetches and renders them (`page.tsx:493-679`). The "What Reviewers Mention" block is conditional on `dishes.length > 0` and simply vanishes when the pipeline hasn't populated `restaurant_highlighted_dishes` for this restaurant.
   **Why it matters:** Dishes are the only thing a chef actually controls. A restaurant page with no dishes named is a brochure without a menu — the diner can't form an expectation of what to order, and we can't be credited or corrected on what we're famous for.
   **What to do:** Backfill highlighted dishes for every Michelin/JBF/Eater restaurant as a launch-blocker. Until then, render a graceful placeholder ("Dishes coming soon — see the menu →") that links to the website, rather than silently hiding the section.
   **Why you'd want to do this:** Dishes are the single most useful piece of pre-visit information for a diner and the single most important attribution surface for a kitchen. Missing them is the difference between a guide and a directory.
   (effort: L for full backfill; S for placeholder)

## Quick wins

- **No price, no hours, no reservation link.** A diner can't tell if JoJo is a $40 lunch or a $400 tasting, whether it's open tonight, or how to book — none of `price_level`, hours, or Resy/OpenTable surfaces in `page.tsx:288-422`. Add a compact "$$$$ · Open until 10pm · Reserve" row under the address. Effort: S.
- **"The Story" is two sentences and reads like filler** ("Elegant townhouse restaurant by Jean-Georges Vongerichten…" — screenshot, `page.tsx:761-773`). Either pull a longer editorial blurb, the chef's bio, or hide the section. A one-line description undersells a star restaurant. Effort: S.
- **No "menu changes seasonally" signal.** Menus that change weekly look identical to menus that haven't changed since 2019. Add a "Menu last updated" or "Seasonal menu — verify on site" line near dishes. Effort: S.

## One bigger bet

**Add a "Claimed by the restaurant" verification flow.** Let owners verify their page and contribute the canonical dish list, current pricing, and a current photo. Show a small verified mark when they have. (No source file — new feature.)
**Why you'd want to do this:** Solves dish attribution and seasonality at the root, gives operators a reason to link to Gastronome, and produces the cleanest data on the platform.
**The tradeoff:** Verification queue work, dispute handling, and a temporary two-class visual system where verified pages look better than unverified ones. (effort: L)

## Alarming

Yelp 3.7 displayed at the same visual weight as Google 4.3 next to a Michelin star will actively talk guests out of booking.
