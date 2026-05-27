# Saving & Lists — UX Findings
**Specialist:** saving-lists | **Sweep:** 2026-05-26-v2

---

## Top 5 Findings

**1. localStorage-only storage — bookmarks don't survive a new device or browser**
Saves exist solely in `localStorage` with no DB write path. A user who saves 20 restaurants on desktop finds their profile empty on mobile — the most common multi-device pattern.
Fix: Persist favorites and collections to Supabase on every toggle; read from DB on auth, fall back to local on anonymous.
Source: `src/lib/collections.ts:22–26` (FAVORITES_KEY / COLLECTIONS_KEY constants); `BookmarkButton.tsx:38` (comment confirms "no auth / DB dependency yet").

**2. Profile page is a blank wall for unauthenticated users — no save hook**
The profile screenshot shows only "You need to be signed in to see your profile." with no CTA, no preview of what a saved list looks like, and no sign-in button (the nav has one, but it's far removed from the message).
Fix: Replace the dead-air state with a sign-in prompt plus a visual mockup of what the Collections tab looks like populated, driving sign-up intent.
Source: `src/app/profile/page.tsx:102–116` (unauthenticated branch); `profile-desktop.png`.

**3. Save affordance is invisible on restaurant cards across browse flows**
The `card` variant of BookmarkButton exists (`variant='card'`) but restaurant cards shown on Home and Explore don't render it — there's no bookmark on hover or at rest in `home-desktop.png` or `restaurant-desktop.png` card rail.
Fix: Render the `card` variant bookmark on every RestaurantCard, at minimum on hover, so discovery and saving are unified gestures.
Source: `src/components/BookmarkButton.tsx:151–152` (card variant styles exist but unused in card grids); `home-desktop.png`.

**4. No "save to list" shortcut from home Saved Collections rail**
The home page shows a "Saved Collections" section with 4 collection tiles, but clicking any tile navigates to the restaurant detail — there is no inline "Add to this collection" affordance from the home feed itself.
Fix: Add an ellipsis/overflow menu per collection tile on the home rail so users can add the currently-browsed restaurant or open the collection to reorder.
Source: `home-desktop.png` (Saved Collections rail visible); `src/app/profile/page.tsx:409–432` (add-to-collection only available inside the profile Collections panel).

**5. Split-brain state: "Favorites" and "Collections" are logically unrelated**
A restaurant can be favorited without being in any collection, or in many collections without being favorited. There is no UI guidance explaining the distinction — the home rail says "Your Favorites" and separately "Saved Collections," which will confuse users who expect them to be the same concept.
Fix: Either collapse Favorites into a pinned "Favorites" collection (simplest mental model) or add a one-sentence explanation the first time a user opens the popover ("Save adds to Favorites. Use collections to organize further.").
Source: `src/lib/collections.ts:5–17` (two independent storage slots, design comment); `BookmarkButton.tsx:28–36` (popover separates the concepts silently).

---

## 5 Quick Wins

**QW1. "Save" button label doesn't reset visually on unsave**
The hero button shows "Saved" in bold when active, but the chevron `▾` next to it gives no state indication. Toggling to unsaved shows "Save" but no animation or color change on the chevron.
Source: `BookmarkButton.tsx:169–170`, `BookmarkButton.tsx:156–157`.

**QW2. Toast fires on unauthenticated path — it shouldn't**
`handleToggleFavorite` calls `openSignInModal` but also implicitly hits the toast path in some edge cases. Toast should never fire unless the save succeeded.
Source: `BookmarkButton.tsx:105–112`.

**QW3. Empty collection shows dashed-border hint with no action button**
"Empty — add restaurants from any detail page." is instructive but leaves the user stranded; add a "Browse restaurants" link.
Source: `src/app/profile/page.tsx:534–543`.

**QW4. Collection count label in header reads "1 + 2 lists" — confusing math**
The label counts Favorites as 1 and then separately counts custom collections, producing strings like "1 + 2 lists." A flat count ("3 lists") is clearer.
Source: `src/app/profile/page.tsx:338–342`.

**QW5. No sharing affordance on collections**
ShareButton exists on restaurant pages but there is no "Share this list" on any collection. A single `navigator.share` / copy-link call on the collection header would be a quick win for social utility.
Source: `src/app/profile/page.tsx:436–619` (CollectionSection has rename/delete controls but no share); `src/components/ShareButton.tsx` (component already exists).

---

## 2 Bigger Bets

**BB1. Migrate collections to Supabase with real-time sync and public/private toggle**
The entire bookmarking system is a localStorage prototype. Moving it to a `user_collections` table (with RLS: private by default, shareable via a token or public flag) would unlock cross-device sync, sharing, collaborative lists, and a meaningful social graph. The `profiles` table and Supabase auth are already in place — this is an extension, not a rewrite.
Impact: resolves Finding 1, enables QW5 at scale, and turns the profile page into a real destination.

**BB2. "Smart Lists" — auto-generated collections from the existing data model**
The app already knows each user's city, favorited restaurants, and each restaurant's cuisine/accolades. Auto-generating lists like "Your Michelin picks," "New York saves," or "Trending near you" from that data — shown in a dedicated "Lists" section on the home page — would give users immediate value from their saved data without requiring manual curation effort.
Impact: increases perceived value of saving, surfaces data the app already has, and drives re-engagement.

---

## Alarming

None meeting that threshold. The localStorage-only architecture (Finding 1) is the most critical production risk — user data loss on any device switch — but it is a known limitation already noted in the code comments, not a latent silent bug.
