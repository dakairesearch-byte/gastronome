# Saving & Lists — v3 Re-sweep Findings
Specialist: saving-lists | Date: 2026-05-30
Screenshots: restaurant-desktop, explore-mobile, profile-desktop, profile-mobile
Source: BookmarkButton.tsx, collections.ts, profile/page.tsx, RestaurantCard.tsx

---

## Resolved items (confirmed)

- [RESOLVED] **Save button on cards** — BookmarkButton variant="card" sits at `absolute top-2 right-2 z-[2]` on both compact and hero variants (RestaurantCard.tsx:239, 310). Visible in explore-mobile.
- [RESOLVED] **Supabase sync** — CollectionsSync.tsx is mounted in root layout (layout.tsx:98), calls `initCollectionsSync` on sign-in and `teardownCollectionsSync` on sign-out. Write-through is implemented in collections.ts for all four operations: toggleFavorite, createCollection, addToCollection, removeFromCollection.
- [RESOLVED] **Undo on save toast** — 3-second toast with an Undo button shown when `lastAction` is set (BookmarkButton.tsx:215-226). Extended from 2s for keyboard users.
- [RESOLVED] **aria-label matches visible text** — Primary button uses "Save restaurant" / "Unsave restaurant" / "Sign in to save" tied to state (BookmarkButton.tsx:183-189).
- [RESOLVED] **Sign-in gate** — unauthenticated Save clicks open the sign-in modal rather than silently writing to localStorage (BookmarkButton.tsx:111-114).

---

## Top 5 findings

**1. No way to remove a single restaurant from Favorites on the profile page** [STILL-OPEN] [P1] Effort: S
The CollectionSection in profile/page.tsx renders each saved restaurant as a plain `<Link>` with no remove/unsave affordance (profile/page.tsx:553-616). Custom collections can be deleted wholesale, but a user cannot unsave a single restaurant from their Favorites list without navigating back to that restaurant's detail page and toggling the bookmark off. This is the primary management surface for saves and it is missing the most basic per-item action.

**2. Collection-popover focus is not trapped and first-focusable element is not auto-focused** [STILL-OPEN] [P1] Effort: S
When the "Save to a named list" popover opens, focus stays on the chevron button — it does not move into the popover, and there is no focus trap (BookmarkButton.tsx:228-308). Keyboard users must Tab through the whole page to reach the collection list or the "New collection" input. The popover has `role="menu"` but menu items use `role="menuitemcheckbox"`, which requires keyboard navigation via arrow keys — those are not implemented.

**3. List-count subtitle in CollectionsPanel is broken/misleading** [NEW] [P2] Effort: XS
The count label at profile/page.tsx:338-340 reads: if total is 1 show "1 list", otherwise show `${favorites.length > 0 ? 1 : 0} + ${collections.length} lists`. So with 3 favorites and 2 collections it shows "1 + 2 lists" — the 1 represents the Favorites group, not the restaurant count, but that is non-obvious. With 0 favorites and 2 collections it shows "0 + 2 lists". This is confusing and the "+" reads as arithmetic.

**4. Profile page shows "You need to be signed in" with no CTA to sign in** [STILL-OPEN] [P2] Effort: XS
Both profile-desktop and profile-mobile screenshots show the bare message "You need to be signed in to see your profile." with no Sign In button or link (profile/page.tsx:103-116). A user landing here unauthenticated gets a dead end. The bottom nav shows "Sign in" on mobile (profile-mobile.png) but the page body offers nothing.

**5. Supabase write-through fires silently on migration absence — no user signal** [NEW] [P2] Effort: M
`initCollectionsSync` returns early without any indicator if the `user_favorites` / `user_collections` tables return errors (collections.ts:113-115). The comment correctly calls this "localStorage-only mode" but the user is never told their saves are not syncing. If the migration has not been applied in production, every sign-in silently degrades to local-only without the user knowing cross-device sync is broken.

---

## Quick wins (≤5)

1. **Fix list-count label** (profile/page.tsx:338-340): Change to `${favorites.length + collections.reduce((s,c) => s + c.restaurantIds.length, 0)} saved` or simply show "Favorites · N restaurants" as a subtitle — no new logic needed. [NEW] Effort: XS

2. **Add "Remove" button to CollectionSection items** (profile/page.tsx:553-616): Wrap each list item in a relative container and add an `×` icon button that calls `toggleFavorite(r.id)` for the Favorites section and `removeFromCollection(id, r.id)` for named collections. Functions already exist in collections.ts. [STILL-OPEN] Effort: S

3. **Add Sign In link to the unauthenticated profile state** (profile/page.tsx:103-116): One `<button onClick={() => openSignInModal({ mode: 'signin' })}>Sign in</button>` next to the message. [STILL-OPEN] Effort: XS

4. **Auto-focus the "New collection" input when popover opens** (BookmarkButton.tsx:278): Add `autoFocus` to the input — it is already autoFocus in the profile page's inline create form; just mirror that here. [STILL-OPEN] Effort: XS

5. **Add aria-label to the chevron/dropdown button that disambiguates it from the Save button** (BookmarkButton.tsx:202): Current label is "Save to a named list" — good, but add `title` only when there is no tooltip risk; the `title` attribute is already there (line 203) so this is confirmed correct; no action needed here — flag dismissed.

---

## Bigger bets

**A. Keyboard navigation inside the collection popover**
The popover declares `role="menu"` and its items use `role="menuitemcheckbox"`, which per ARIA spec means arrow-key navigation is expected — Tab should not move focus between items. Currently neither arrow-key handling nor focus management is implemented (BookmarkButton.tsx:228-308). Fixing this correctly means: auto-focus first item (or the input) on open, implement Up/Down arrow movement, handle Home/End, return focus to the chevron button on close. Medium engineering effort but meaningful for power users and accessibility compliance. Effort: M.

**B. Cross-device sync status indicator**
The sync layer degrades silently to localStorage-only when tables are missing or RLS blocks. For a product whose v2 headline fix was "bookmarks now sync to Supabase," users have no way to know if they are actually syncing. A small indicator on the profile Collections tab — e.g., a sync status chip ("Synced", "Local only") driven by whether `initCollectionsSync` completed successfully — would make the persistence model legible without a major architecture change. Requires surfacing the sync result from `initCollectionsSync` (currently `void`) and storing it in a module-level flag. Effort: M.

---

## Alarming

The `writeFavorites` cap of 200 IDs (collections.ts:201) silently drops any favorites beyond 200 on every write, including on server-pull during `initCollectionsSync`. If a power user has >200 server-side favorites, calling `writeFavorites(serverFavorites)` will silently truncate their local cache each sign-in. This is a data-loss risk specific to the server→local path; the cap makes sense for localStorage safety but should not apply when writing server data.
