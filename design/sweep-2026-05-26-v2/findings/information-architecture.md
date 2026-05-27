# information-architecture
**Lens:** Content organization, mental models, hierarchy clarity (city → neighborhood → restaurant → dish → review source), concept duplication, label consistency. **Reviewed:** `home-desktop.png`, `cities-desktop.png`, `explore-desktop.png`, `profile-desktop.png`; `src/app/page.tsx`, `src/app/cities/page.tsx`, `src/app/explore/page.tsx`, `src/components/Navigation.tsx`.

## Top 5 findings

**[P0] "Cities" is missing from primary nav, orphaned to the footer.**
Nav: Home / Explore / Community / Profile only (Navigation.tsx:12–17). Cities appears only in the footer "MORE" column (cities-desktop.png). The /cities H1 reads "Explore Cities" (cities/page.tsx:151), colliding with the "Explore" nav item — non-designers conflate them.
**Effort:** Low — add Cities to `navItems`; rename H1 to "Cities."

**[P1] Home "Suggestions" and /explore share the same algorithm, same default city, no stated purpose difference.**
Both run trending for New York (page.tsx:14, explore/page.tsx:90). This is *parallel navigation* (two surfaces with overlapping scope, no declared contract) — users have no basis to choose between them.
**Effort:** Medium — label Home as personalized/recency-aware; Explore as city-first editorial.

**[P1] "Saved Collections" are hardcoded editorial tiles mislabeled as personal content.**
Four static constants (page.tsx:20–53) use possessive framing implying user-saved items. No user created them. Signed-in users will search in vain to edit or delete them.
**Effort:** Low — rename section "Editorial Picks" or "Curated Starting Points."

**[P2] The neighborhood level of the hierarchy does not exist anywhere in the UI.**
Cities page skips straight from city stats to a flat restaurant list (cities-desktop.png). A user wanting "something in the West Village" has no path shorter than free-text search. The gap is invisible from navigation.
**Effort:** High — requires data enrichment and a new browse dimension.

**[P2] Profile nav item is always visible but leads to a blank dead end for unauthenticated users.**
profile-desktop.png: full-width blank with "You need to be signed in to see your profile." No CTA, no redirect. Navigation.tsx:32 already holds `user` — the fix is right there.
**Effort:** Low — inline sign-in prompt or auth-gate the nav item.

## Quick wins (max 5, no severity)

1. Add "Cities" to `navItems` (Navigation.tsx:12–17) — one click to the second hierarchy tier from anywhere.
2. Rename /cities H1 from "Explore Cities" to "Cities" to end naming collision with Explore nav (cities/page.tsx:151).
3. Rename home "Saved Collections" → "Curated Collections" to drop the false personal-data implication (page.tsx:105).
4. Footer: move "Recent" from "MORE" column into "EXPLORE" — its current grouping next to "Cities" is arbitrary.
5. Profile empty state: add an inline "Sign in" button so the broken branch self-resolves rather than silently failing.

## Bigger bets (max 2)

**Differentiate Home (personalized) from Explore (city-first editorial).** Both run the same trending query for the same default city. Personalized Home (home city, bookmarks, recency) vs. editorial Explore would make them complementary. **The tradeoff:** personalization requires auth; logged-out users get a degraded home experience unless a meaningful anonymous fallback is designed.

**Surface the neighborhood layer.** The stated hierarchy includes neighborhood but no UI renders it — filter chips or a browse grouping on city pages would complete the IA. **The tradeoff:** neighborhood data quality is uneven across cities; a half-populated layer risks looking broken and undermining trust in the aggregator's core data promise.

## Alarming

"Hidden Gems" appears as a "Saved Collection" tile on Home (page.tsx:47) and independently in Explore's Categories grid (explore/page.tsx:45–47) — identical algorithmic criteria (google_rating ≥ 4.3, review_count ≤ 500), two entry points, zero cross-referencing. Same concept, split identity.
