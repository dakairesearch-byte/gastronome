# restaurant-card

**Lens:** How well the repeating list-item unit communicates identity, earns a tap, and supports secondary actions (save, share, dismiss).
**Reviewed:** `explore-desktop.png` screenshot + `RestaurantCard.tsx`, `ExploreCollectionCard.tsx`.

## Top 3 findings

1. [P0] **What's wrong:** The compact variant (used for the Top 10 Trending list, search results, and profile lists) renders no photo at all — every card is a white rectangle of text (screenshot: left column of Trending list). At the scale the explore page is seen, these cards read as a spreadsheet, not a restaurant discovery surface.
   **Why it matters:** Without a visual anchor, users cannot tell at a glance whether "Carbone" is a cozy Italian trattoria or a glitzy red-sauce institution — they must read all the way through to the cuisine/neighborhood line. Scan time and cognitive load both increase, and emotional desire to visit is never triggered.
   **What to do:** Add an optional `thumbnail` slot to the compact variant — a 48×48 px circular or square image pulled from the same `getHeroPhoto` fallback chain already in the file (line 72–79). Display it flush-left, letting name + metadata wrap beside it. This does not require a layout change — just an `img` before the text block.
   **Why you'd want to do this:** Photo presence is the single highest-lift trust signal in restaurant selection. Competitors (Google Maps, Yelp lists, Infatuation) always show a photo; the current card gives up that emotional hook entirely for the most-visited list on the explore page.
   (effort: S)

2. [P1] **What's wrong:** Neither card variant has a bookmark/save action. The entire card is wrapped in a `<Link>` (compact: line 97; hero: line 175), so any secondary action — save, share, dismiss — requires navigating away from the list first.
   **Why it matters:** Tap targets (interactive areas) for save require users to open a detail page, perform an action, then navigate back. This friction compounds across the 10–150 items on the explore page and is a known conversion killer in collection-building apps. There is a `BookmarkButton` component in the codebase — it is simply never mounted on the card.
   **What to do:** Float a `BookmarkButton` in the top-right corner of the card image area (hero variant) or right edge of the row (compact). Use `e.preventDefault(); e.stopPropagation()` to intercept the click before it reaches the parent `<Link>`. Minimum tap target 44×44 px per WCAG 2.5.5.
   **Why you'd want to do this:** "Save for later" is the primary CTA for discovery-mode browsing; the current design forces a full page load for an action most users want to perform in one tap.
   (effort: M)

3. [P1] **What's wrong:** The accolade border-accent (the colored left border — red for Michelin, amber for James Beard, pink for Eater 38; lines 27–32) carries editorial prestige information with no text label. A user who does not already know the color code gets no signal from it.
   **Why it matters:** First-time and casual users, exactly the audience most in need of guidance, cannot decode the red left stripe on "Carbone" without a tooltip or legend. The information density appears high but delivers zero value to the uninitiated — a pattern called "glanceable but illegible."
   **What to do:** Pair each accent with a micro-label or icon: replace the bare border with a `title` attribute on the card div (aria-described) AND add a 1-letter badge ("M" / "JB" / "E38") or the corresponding `AccoladesBadges` row — which the hero variant already renders (line 283) but the compact variant gates behind `hasAccolades` without visual color-coding alignment (line 123).
   **Why you'd want to do this:** Decoded accolades are the app's core differentiator; making them legible converts a decorative flourish into a genuine decision signal.
   (effort: S)

## Quick wins (≤3, no severity tag)

1. **What's wrong:** `ExploreCollectionCard` uses a hard-coded pixel height of `108px` for the image area (line 54), making it brittle across screen densities and viewport widths — images are cropped with no control over focal point.
   **Why it matters:** Category tiles like "Michelin Stars" may show an unappealing crop (e.g., a table edge rather than food), undermining the editorial quality signal the card is meant to convey.
   **What to do:** Replace `style={{ height: '108px' }}` with `aspect-ratio: 16/9` or `aspect-[4/3]` (Tailwind) so the image scales proportionally. Add `object-position: center` already present on the img; consider `object-position: center top` for food photography where the dish is typically in the upper half.
   **Why you'd want to do this:** Proportional images look intentional; fixed heights look like a prototype constraint that shipped.
   (effort: S)

2. **What's wrong:** The compact card's hover state changes only shadow and Y-translate (line 99: `hover:shadow-lg hover:-translate-y-1`). Focus state (keyboard navigation, tab key) is identical to the resting state — no visible focus ring.
   **Why it matters:** Keyboard users and users of browser-level accessibility (a11y) features receive no confirmation that a card is focused, failing WCAG 2.4.7 (focus visible).
   **What to do:** Add `focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2` to the card's `className`. The `focus-visible` pseudo-class ensures the ring only appears for keyboard navigation, not mouse clicks.
   **Why you'd want to do this:** Legal risk aside, keyboard accessibility widens the addressable audience and is trivially cheap to add.
   (effort: S)

3. **What's wrong:** `ExploreCollectionCard` drops the `description` prop entirely (it is in the interface at line 11 but never rendered). The component comment says it was removed to keep 4 tiles per row above the fold (line 27), but this leaves the card with only a title and curator — the "Conscious Picks" and "Hidden Gems" categories visible in the screenshot have no copy explaining what they contain.
   **Why it matters:** For non-obvious category names, users cannot tell what they will find before committing a click, reducing CTR (click-through rate) on the most valuable editorial real estate on the page.
   **What to do:** Add a single line of description text (max 1 line, `line-clamp-1`) below the title. At the current tile width (~220 px on desktop) this fits without disrupting the grid. Alternatively, show it on hover as a tooltip overlay on the image.
   **Why you'd want to do this:** A one-line tease increases click confidence without expanding the card footprint.
   (effort: S)

## One bigger bet (optional)

**What's wrong:** The two card variants — compact (text-only list) and hero (photo grid) — share no visual language. A user moving between the Top 10 Trending list and the Categories grid on the same explore page encounters what feel like two different products.
**Why it matters:** Inconsistent card grammars increase cognitive load and reduce trust in the app's editorial coherence — users subconsciously wonder if the data sources are the same.
**What to do:** Unify around a single "restaurant card" with a `size` prop: `sm` (current compact, adds 48 px thumbnail), `md` (current hero), `lg` (editorial spotlight with full bleed image + overlay text). All three share the same border-accent, badge, and secondary-action system. Design tokens — already partially in place via `globals.css` — handle spacing differences.
**Why you'd want to do this:** A unified card system reduces future design debt, makes A/B testing easier (swap `size` prop, not a whole component), and presents a coherent brand to users regardless of which surface they land on.
**The tradeoff:** The compact list's information density (10 restaurants in one viewport) drops slightly when thumbnails are added; power users who treat the Trending list as a quick data scan may prefer the current no-image version. Consider making the thumbnail opt-in via a list/grid toggle.
(effort: L)

## Alarming (optional)

The entire card in both variants is a single `<Link>` with no secondary action, no dismiss, no share — adding any of those later will require restructuring the DOM to avoid nested interactive elements, which is a WCAG 4.1.2 violation if done carelessly.
