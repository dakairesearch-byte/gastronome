# Source Attribution — v3 Re-Sweep Findings

Specialist: source-attribution | Sample restaurant: JoJo (NYC, 1 Michelin star)
Screenshots: restaurant-desktop, restaurant-mobile, explore-desktop, home-desktop
Files reviewed: SourceBadge.tsx, AccoladesBadges.tsx, GastronomeScoreBadge.tsx, score.ts, RestaurantCard.tsx, restaurants/[id]/page.tsx

---

## Status on v2 Issues

**[RESOLVED]** Mixed denominators — SourceBadge now always renders `rating/maxRating` (e.g. `4.3/5`, `8.1/10`) via the `ratingDisplay` calculation at SourceBadge.tsx:27. The v2 core complaint ("7.0/10 looks worse than 4.3/5 with no context") is fixed.

**[RESOLVED]** Inline source label — non-compact badges show `source.label` text alongside the icon letter (SourceBadge.tsx:46-49). No more single-letter "G" orphans needing a tooltip to identify the source.

**[RESOLVED]** Gastronome Score added — the hero now leads with a bold `8.1 / 10` unified number plus a source count label and methodology popover (GastronomeScoreBadge.tsx). Score is computed as a credibility-weighted average with renormalization over present sources (score.ts). Accolades intentionally excluded — the separation is clean and defensible.

**[RESOLVED]** Accolade badges: year suffix added (`Michelin Star '24`, `Eater 38 '25`, `James Beard Winner '23`), title tooltips present, JBF and Eater wrapped in BadgeLink (AccoladesBadges.tsx:97-129).

**[RESOLVED]** JBF/Eater wrapped in BadgeLink — both badges now use the BadgeLink component (AccoladesBadges.tsx:97, 119) matching the Michelin pattern.

---

## Top 5 Findings

**1. Hero-card rating cluster shows raw numbers with no denominator [STILL-OPEN]**
The `HeroVariant` in RestaurantCard.tsx (lines 365-383) renders Google and Yelp ratings as plain numerals (`4.3`, `3.7`) beside brand icons — no `/5` denominator and no label beyond the icon. A user seeing `4.3` next to `G` and `3.7` next to the Yelp burst cannot know these are /5 without domain knowledge. The compact SourceBadge correctly shows `4.3/5` but the hero card bypasses it entirely. Visible on explore-desktop cards.
[P1] Effort: S — replace raw numerals in HeroVariant with `{rating.toFixed(1)}/5` or reuse SourceBadge compact mode.

**2. Gastronome Score tooltip omits per-source weights — "credibility-weighted" is unexplained [NEW]**
The popover (GastronomeScoreBadge.tsx:79-95) shows each source's native → normalized conversion but never reveals the actual weights (Infatuation 30%, Google 30%, Yelp 20%, Beli 20% per score.ts:22-27). A skeptical user who opens the tooltip to understand "why is it 8.1?" still cannot verify the blend — they only see the inputs, not how they're combined. The tooltip says "credibility-weighted" but gives no definition of credibility. On restaurant-desktop the tooltip is the only transparency mechanism.
[P1] Effort: S — append weight percentages as a footnote row in the breakdown list; one line of JSX.

**3. Beli entirely absent from source coverage visible in screenshots [STILL-OPEN]**
JoJo shows Google + Yelp + Infatuation in "By the Numbers" (restaurant-desktop, restaurant-mobile). Beli has a full color slot in SourceBadge (colorMap `beli`) and a weight in score.ts (0.2), but does not appear for this restaurant. When Beli data is missing, the Gastronome Score silently drops its weight and renormalizes — correct behavior — but the score section shows no indication that a fourth source exists but is uncovered. Users who know Beli can't tell if the restaurant isn't on Beli or if Gastronome hasn't scraped it yet. No "Coverage" or "Sources not yet available" signal exists anywhere.
[P2] Effort: M — add a muted "Beli not yet available" placeholder row in the By the Numbers grid when `beli_score` is null; this is honest and reduces "why no Beli?" support confusion.

**4. Michelin year field is a type cast, not a real DB column — may silently show no year [NEW]**
AccoladesBadges.tsx:42 casts `restaurant` to `Restaurant & { michelin_year?: number | null }` to access `michelin_year`, and similarly for `jbf_year` (line 95) and `eater_year` (line 117). If the underlying `restaurants` table does not actually have these columns, the cast succeeds in TypeScript but the value is `undefined` at runtime — `yearSuffix(undefined)` returns `''` and the badge silently drops the year. On restaurant-desktop, JoJo's Michelin badge shows no year suffix, which either means the column is absent or null. The year was the explicit v2 fix goal; if it's silently blank the fix is cosmetically shipped but functionally missing.
[P1] Effort: S — confirm columns exist in database.ts / migrations; if absent, add the migration or remove the year suffix feature entirely rather than leaving the cast to fail silently.

**5. Home-desktop cards show no source attribution whatsoever [NEW]**
The "Suggestions in New York" rail on home-desktop uses the compact RestaurantCard variant. These cards render SourceRatingsBar (which correctly shows SourceBadge pills) — but the home-desktop screenshot shows only a star rating and review count in tiny gray text below each card name, with no visible Google/Yelp/Infatuation badge. It is unclear whether SourceRatingsBar is being passed data or if the home page query omits rating fields. Users on home cannot distinguish which source rated that restaurant 4.6 — the core attribution promise is invisible at the discovery layer.
[P1] Effort: S (investigation) / M (fix) — verify that the home page query selects `google_rating`, `yelp_rating`, `infatuation_rating` and that `SourceRatingsBar` renders for those cards.

---

## Quick Wins

1. **HeroVariant denominator** (RestaurantCard.tsx:365-383): append `/5` to Google and Yelp numerals — one character change per span. Effort: XS.
2. **Weight footnote in Gastronome Score popover** (GastronomeScoreBadge.tsx): add a `<p>` after the breakdown list showing the weights as percentages. Effort: XS.
3. **Michelin badge year verification**: grep `michelin_year` in `src/types/database.ts` — if absent, either add the column or remove the cast. Effort: XS to verify, S to migrate.
4. **SourceBadge compact on hero cards**: swap the manual Google/Yelp span cluster in HeroVariant for `<SourceRatingsBar compact />` — removes duplicate rendering logic and inherits denominator fix for free. Effort: S.
5. **Accolades banner on restaurant-mobile**: the banner renders below the hero (page.tsx:442-454); on mobile screenshot it is visible but tight. Confirm AccoladesBadges wraps to two lines without clipping — currently `flex-wrap gap-1.5` which should be fine but needs QA with a 3-badge restaurant.

---

## Bigger Bets

**Source coverage map**: Add a persistent "Coverage" section in the By the Numbers panel listing all four rating sources (Google, Yelp, Infatuation, Beli) and marking each as "available" or "not yet scraped." This transforms missing data from a silent absence into an honest gap — directly supporting the aggregator credibility pitch. Requires a UI component + backfill status from pipeline audit logs. Effort: L.

**Gastronome Score methodology page**: The popover explanation is good but ephemeral and non-shareable. A `/methodology` page (linked from the popover) that explains the weighting rationale, sample calculations, and how accolades are kept separate would give press, skeptical users, and restaurant owners a canonical reference. Makes "credibility-weighted" a real promise, not marketing copy. Effort: M.

---

## Alarming

The `michelin_year`, `jbf_year`, and `eater_year` fields are accessed via TypeScript type casts (`restaurant as Restaurant & { michelin_year?: number | null }`) with no runtime guard. If these columns are missing from the DB schema, every accolade badge silently drops its year — but no test or TypeScript error will surface this. The v2 fix for "stale accolades not showing year" may be fully cosmetic. Check `src/types/database.ts` and the latest migration before marking this resolved.
