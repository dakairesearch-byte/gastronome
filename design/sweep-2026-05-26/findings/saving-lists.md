# saving-lists

**Lens:** How easily users can save restaurants, organize them into named lists, access saved items across devices, and share those lists with others.
**Reviewed:** screenshot (`restaurant-desktop.png`) + `BookmarkButton.tsx` + `restaurants/[id]/page.tsx`.

## Top 3 findings

1. [P0] **What's wrong:** Bookmarks and collections live only in localStorage — they are never written to the database.
   **Why it matters:** A user who saves "Anniversary spots" on their laptop sees an empty list on their phone. Any cleared browser data silently deletes all saves with no warning. The sign-in gate (BookmarkButton.tsx line 106) implies persistence but delivers none.
   **What to do:** Migrate favorites and collections to Supabase (`profiles` or a dedicated `user_collections` table). Use the existing auth session (`user` state, line 49) already in the component to scope rows to the signed-in user. Keep localStorage as an optimistic (immediately visible) cache, sync on mount and on change.
   **Why you'd want to do this:** Cross-device persistence is table stakes for any "save for later" feature; without it, power users who curate lists churn when they switch devices.
   (effort: L)

2. [P1] **What's wrong:** The "Save" button and the collections chevron (▾) are visually indistinguishable tiny controls in the hero (restaurant-desktop.png, top-right cluster). Nothing on the page explains that collections ("Anniversary spots", "Quick lunches") exist at all — there is no "My Lists" entry point in the nav and no prompt to try collections after the first save.
   **Why it matters:** A user who has never seen the popover (affordance: a visual hint that an action is possible) has no reason to click the unlabeled ▾. The feature is effectively hidden; most users will use only the flat favorites toggle and never discover named lists.
   **What to do:** On the hero button, replace the bare ▾ chevron with a text label: "Save to list ▾". After the first successful favorite toggle, show a one-time tooltip: "Organize into a list — tap ▾ to create one." Add a "My Lists" link to the profile nav dropdown.
   **Why you'd want to do this:** Collections are the stickiest part of a save system; users who curate lists return more often to plan meals. Discovery of the feature is a prerequisite to any of that value.
   (effort: S)

3. [P1] **What's wrong:** There is no share-a-list feature. The `ShareButton` component (page.tsx line 316) shares the individual restaurant URL; there is no mechanism to share a named collection ("Here's my Tokyo ramen list") with a friend.
   **Why it matters:** Social sharing of curated lists is a major viral loop (a growth mechanic where existing users recruit new ones) for discovery apps. Without it, lists are private by default and offer no social proof or word-of-mouth value.
   **What to do:** Generate a public read-only URL per collection (e.g. `/lists/[shareToken]`) when the user clicks "Share list." The token can be a short UUID stored alongside the collection in Supabase. The recipient sees a simple, unauthed page showing the list.
   **Why you'd want to do this:** Shareable lists are the primary way Beli, Eater, and The Infatuation build organic installs; a single well-curated list shared in a group chat can drive dozens of new signups.
   (effort: M)

## Quick wins (≤3, no severity tag)

1. **What's wrong:** The `aria-label` on the main bookmark button reads "Bookmark" / "Remove bookmark" (BookmarkButton.tsx line 165) but the visible label says "Save" / "Saved." Screen-reader users hear a different word than sighted users see.
   **Why it matters:** Inconsistent accessible names confuse users of assistive technology and fail WCAG 2.5.3 (Label in Name).
   **What to do:** Change `aria-label` to match the visible text: `isFavorite ? 'Remove from saved' : 'Save'`.
   **Why you'd want to do this:** Quick one-line fix; eliminates an accessibility regression with no visual impact.
   (effort: S)

2. **What's wrong:** The "Save to collection" popover has no empty-state call to action with examples. It shows only "No collections yet. Create one below." (BookmarkButton.tsx line 213) with no name suggestions.
   **Why it matters:** A blank text field with no placeholder examples ("e.g. Date night, Tokyo trip") stalls users who don't yet know what they'd name a list.
   **What to do:** Add 2–3 tappable name chips ("Date night", "Want to try", "Tokyo trip") inside the empty state that pre-fill the input on tap.
   **Why you'd want to do this:** Reduces the blank-canvas anxiety that stops first-time collection creation; costs one afternoon of frontend work.
   (effort: S)

3. **What's wrong:** The toast confirmation ("Saved to favorites") auto-dismisses after 2 seconds (BookmarkButton.tsx line 81) with no action link. Users who save by accident have no fast undo path.
   **Why it matters:** Accidental taps — common on mobile — leave the user with unwanted saves they may not notice until much later.
   **What to do:** Add an "Undo" button inside the toast that calls `toggleFavorite` again. Extend dismiss time to 4 seconds when Undo is present.
   **Why you'd want to do this:** Standard pattern in Gmail, iOS, and every major app; dramatically reduces accidental-save frustration at no architectural cost.
   (effort: S)

## One bigger bet (optional)

**What's wrong:** Collections are flat name-only buckets with no metadata — no cover photo, no description, no ordering, no city tag. A list called "Anniversary spots" looks identical in the UI to "Quick lunches."
**Why it matters:** Rich list metadata is what makes shareable lists feel editorial and worth passing along. Bare name lists feel like a to-do app, not a food authority.
**What to do:** Add optional cover photo (pulled from any restaurant already in the list), city tag, and a one-line description field to the collection schema. Render these on the `/lists/[shareToken]` page and on the "My Lists" profile tab.
**Why you'd want to do this:** Transforms a utility feature into a content format — shareable lists with photos and context look like mini-editorials and compete with Eater and Infatuation's curated guides.
**The tradeoff:** Schema migration required; adds surface area for users to ignore (most will never fill in descriptions), and a cover-photo picker adds meaningful UI complexity. Scope to "optional at creation, editable later" to keep the happy path fast.
(effort: L)

## Alarming (optional)

localStorage-only persistence means every saved restaurant and every named collection is silently destroyed on "Clear Site Data" — a button many privacy-conscious users and browser extensions trigger routinely, with no warning from the app.
