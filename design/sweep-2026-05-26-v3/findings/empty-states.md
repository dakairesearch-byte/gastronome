# Empty States — v3 RE-SWEEP findings

Specialist: empty-states | Date: 2026-05-30

---

## Status tags against v2 findings

- **[RESOLVED]** EmptyState component now accepts `secondaryCtaHref` / `onSecondaryCtaClick` — the dead-end "no escape route" pattern is fixed at the component level (`EmptyState.tsx` lines 22–24, 76–85).
- **[RESOLVED]** Tone prop added: `attention` renders amber halo; `neutral` renders emerald. No longer success-coded for failure states (`EmptyState.tsx` lines 29–31, 52–53).
- **[RESOLVED]** Search zero-state now names the most-restrictive filter ("the Google ≥4.1★ filter is the most restrictive") via `mostRestrictiveFilterLabel` logic (`search/page.tsx` lines 463–475).
- **[RESOLVED]** Home empty rails reworded (per primer — not directly visible in my screenshots but confirmed shipped).
- **[RESOLVED]** Restaurant empty-dishes now shows "Menu coming soon" graceful state (per primer; confirmed fix landed).

---

## Top 5 findings

**1. [STILL-OPEN] Unauth profile page — bare text, no icon, no CTA, not using EmptyState**
The profile page renders a raw `<p>` tag ("You need to be signed in to see your profile.") centered in ~70vh of whitespace. No icon, no sign-in button, no route to onboarding — pure dead end. The `EmptyState` component exists for exactly this purpose and is unused here. Both desktop and mobile screenshots confirm this. `profile/page.tsx` lines 103–116.
[P0] Effort: XS (swap bare `<p>` for `<EmptyState>` with `UserCircle` icon + `ctaText="Sign in"` + `ctaHref="/onboarding"`)

**2. [STILL-OPEN] Community "Coming Soon" — no sign-up hook, no escape CTA, design system mismatch**
Community page renders a bespoke Coming Soon screen (`community/page.tsx`) that skips the `EmptyState` component entirely and offers zero next action — no "notify me", no "explore restaurants instead", nothing. It's a dead end dressed in editorial styling. The square icon container with `border-radius: rounded-sm` clashes with the circular halos everywhere else. Community screenshot confirms.
[P1] Effort: S (add a secondary CTA linking to `/explore` or an email-capture form; align icon container to the site's rounded-full pattern, or consciously document the square as intentional)

**3. [NEW] Recent feed — filtered empty state has no CTA to broaden or reset filter**
`recent/page.tsx` lines 99–108: when a filter chip (e.g. "Reviews") yields zero events, the `EmptyState` is called with `title="Nothing yet"` and no `ctaText`/`ctaHref` at all. The user is stuck — they must manually tap a different chip. The component now supports a secondary CTA; it isn't wired here. The recent-mobile screenshot shows a very long scroll of results, so this only fires on sparse filters, but it's still a dead end. Contrast with search, which correctly wires both CTAs.
[P1] Effort: XS (pass `ctaText="Show all activity"` + `onCtaClick` that sets filter to `'all'`)

**4. [STILL-OPEN] Profile — empty individual collection shows no path to add restaurants**
`profile/page.tsx` lines 534–544: an empty named collection shows italic placeholder text ("Empty — add restaurants from any detail page.") with a dashed border. There is no link to Explore or Search. A user who just created a collection has nowhere to go from within the panel itself.
[P2] Effort: XS (add a small "Browse restaurants" link — `href="/explore"` — beneath the placeholder text)

**5. [NEW] Search zero-state — "Start searching" idle state uses neutral/emerald tone even though Search icon on neutral looks like a success confirmation**
`search/page.tsx` lines 604–606: the idle zero-state (no query, no filters) correctly uses `tone="neutral"` but the emerald Search icon halo reads like a "search succeeded with zero results" affordance rather than an invitation. The tone is `attention` only when there's an active query or filter — but on first land (no query, no filters) the emerald halo is slightly misleading. Low severity, but contrast with other apps that use a muted/gray idle halo. Screenshot: search-desktop shows this idle state.
[P2] Effort: XS (either add a third tone `'idle'` with a gray/slate halo, or simply omit the halo entirely in the idle case)

---

## Quick wins (≤ 5 minutes each)

1. **Profile unauth → EmptyState** — replace lines 103–116 in `profile/page.tsx` with `<EmptyState icon={UserCircle} tone="attention" title="Sign in to see your profile" description="…" ctaText="Sign in" ctaHref="/onboarding" />`. Immediate P0 fix.
2. **Recent filtered empty → add CTA** — `recent/page.tsx` line 103: pass `ctaText="Show all activity"` and `onCtaClick` resetting the filter. One prop.
3. **Empty collection → add Browse link** — `profile/page.tsx` line 543: add a `<Link href="/explore">` beneath the dashed-border placeholder.
4. **Community → add secondary CTA** — `community/page.tsx` after the `<p>` description block: add an `<a href="/explore">` or use `EmptyState`'s `secondaryCtaText`.
5. **Tone audit pass** — grep for `<EmptyState` without `tone=` — any call site that resolves to the default `neutral` in a failure context is a candidate to flip to `attention`. Currently search (lines 603–627) and recent (line 100) are the only consumers; both can be verified in 2 minutes.

---

## Bigger bets

**A. Consistent EmptyState adoption across all bespoke screens**
Community and profile each hand-rolled their own empty-state UI rather than using the shared component. A design-system audit pass should enforce that `EmptyState` is the single pattern — enforced either by a lint rule (no `flex flex-col items-center justify-center` without importing `EmptyState`) or a Storybook story that documents the contract. Medium effort, high consistency payoff.

**B. Community "Coming Soon" → waitlist / notify-me flow**
The community surface is in-nav and accessible to every visitor, but it's a dead end. Converting it to a simple email-capture ("Get early access") would turn every community visit into a signal of demand and a potential return-user hook. Requires a Supabase table + edge function for the capture, plus a confirmation state. Medium effort, high conversion leverage.

---

## Alarming

The unauth profile page (P0 above) is worse than it looks: on mobile (profile-mobile screenshot), the "You need to be signed in" text appears roughly one-third of the way down a largely blank screen, with no bottom nav CTA and no sign-in button anywhere in view. A first-time visitor tapping "Profile" from the bottom nav hits a white wall with one line of text and no affordance to proceed. This is the single worst dead-end in the app and costs sign-up conversions every time.
