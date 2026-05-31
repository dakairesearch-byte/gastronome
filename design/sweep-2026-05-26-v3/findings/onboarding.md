# Onboarding — v3 Re-Sweep Findings
Lens: first-time UX, empty account, guided first task, geolocation, sign-in vs anonymous, escape hatches.

---

## Status tags

### [RESOLVED] Sign-in escape hatch on all panes
v2 P0. Returning users had to click Continue three times before seeing "Sign in." Now visible on every pane via the `!user && !awaitingConfirmation` guard. Screenshot confirms: "Already have an account? Sign in" below the card on pane 1 (both desktop and mobile). `OnboardingFlow.tsx:445–468`.

### [RESOLVED] City step no longer hard-blocks
v2 P0. `canProceed` is unconditionally `true` (`OnboardingFlow.tsx:116`); a "Not seeing your city? You can continue without picking" affordance replaces the frozen Continue button. Confirmed in source — no gate remains.

### [RESOLVED] sr-only step labels
v2 quick win. Each `<li>` now wraps a `<span className="sr-only">Step N of 4: {label}</span>` (`OnboardingFlow.tsx:299–303`). The `<ol>` carries `aria-label="Step N of 4"`. Screen readers can navigate the progress indicator meaningfully.

### [RESOLVED] Logo fixed
v2 P0. The Gastronome logo renders correctly in both screenshots (desktop + mobile, onboarding-1). Middleware redirect that was breaking `/public` assets is gone.

### [RESOLVED] is_critic hardcode removed
v2 finding. `handleSignUp` no longer sets `is_critic: true` in the profile upsert. Confirmed by absence in `OnboardingFlow.tsx:204–215`.

---

## Top 5 findings

### 1. [NEW] No anonymous browse path — zero escape from the funnel
The component comment at line 36–42 is explicit: "Anonymous browsing has been removed per product direction." A first-time visitor who wants to poke around before committing cannot do so. The only exits are "Sign in" (for returning users) or completing all four panes. Someone arriving from a restaurant link or social share hits the wall immediately. There is no "Browse as guest" or "Skip and explore" option. This is a conversion-rate trap disguised as a product decision — curiosity-driven visitors bounce before they can see what they're signing up for.
**[P0] Effort: M** — requires a product decision, then either a guest session or a route bypass for direct-link arrivals.
Source: `OnboardingFlow.tsx:36–42`, component doc + `onboarding-1-desktop.png`.

### 2. [NEW] No geolocation offered — city selection is manual and list-constrained
The city step (pane 3) shows a finite pill-button list of `is_active` cities sorted by `restaurant_count`. There is no "Use my location" affordance. A user in Chicago or Miami who can't find their city in the list sees only the "Not seeing your city? Continue without picking" note — a reassurance that still leaves them cityless. Browser geolocation + a reverse-geocode against the `cities` table would pre-select the right pill for the majority of users, or at least confirm "we cover your city." Without it, the pane reads as "pick one of our six cities" rather than "tell us where you are."
**[P1] Effort: M** — `navigator.geolocation` + a lat/lng→nearest-city lookup against existing `cities` table data (has slug but likely not coordinates; may need a coordinates column first).
Source: `OnboardingFlow.tsx:657–770`, `onboarding-1-desktop.png` (city pane not captured but evident from source).

### 3. [NEW] Footer and navigation render behind/below onboarding on mobile — visual noise on first impression
The mobile screenshot shows the full bottom nav bar (Home / Explore / Search / Community / Sign in) and the full footer visible below the onboarding card. A new visitor on mobile sees navigation for an app they haven't joined yet. The footer logo renders twice (onboarding logo + footer logo). This clutters the first impression and makes the flow feel embedded in an already-running app rather than a dedicated welcome experience.
**[P1] Effort: S** — hide footer and bottom nav when onboarding is the active page (check `pathname === '/'` and `!authChecked || !user` in the layout, or wrap the onboarding route in a shell-less layout).
Source: `onboarding-1-mobile.png` (bottom nav and footer both visible beneath card).

### 4. [STILL-OPEN] No guided first task after onboarding completes
After sign-up, the user is routed to `/` (`router.push('/')`, `OnboardingFlow.tsx:256`). The home page has "Suggestions in {city}" but no onboarding-complete moment: no "Here's what to do first," no highlighted restaurant to click, no empty-state prompt in the Favorites rail. The user lands cold with no directed action. The "Your favorites" section on the home desktop screenshot shows an empty state with a button, but there is no contextual prompt tying it to the just-completed onboarding. First task completion is the strongest predictor of long-term retention; right now there is none.
**[P1] Effort: M** — add a `?onboarding=done` query param to the redirect, render a dismissible "Start by saving a restaurant" banner or highlight on home. No onboarding rework needed.
Source: `OnboardingFlow.tsx:256`, `home-desktop.png` (Favorites empty state visible, no "welcome" moment).

### 5. [NEW] ConfirmEmailStep has no resend-email affordance and no timer
When `!data.session` (email-confirm flow), the user sees "Check your email — click the link to activate." There is no "Resend email" button, no explanation of how long the link is valid, and no fallback if the email lands in spam. This is a dead end: the user is told to wait with zero agency. Email confirmation flows have notoriously high abandonment when there is no resend path.
**[P2] Effort: S** — add a "Resend confirmation email" button (call `supabase.auth.resend()`), a 60-second cooldown timer, and a note about checking spam.
Source: `OnboardingFlow.tsx:986–1019`.

---

## Quick wins (≤1 hr each)

1. **Progress dots are not keyboard-interactive but carry `aria-current="step"` on a `<span>`.** `aria-current` is valid on interactive elements; on a decorative span inside a list it does nothing useful for AT users who already get the sr-only text. Either remove `aria-current` from the span (the sr-only text is sufficient) or make the dots interactive step-jumps. `OnboardingFlow.tsx:293`.

2. **"Back" button is `opacity-0` on step 1 but still focusable** (`disabled:opacity-0` via Tailwind, `OnboardingFlow.tsx:376–385`). An invisible focusable button is a keyboard trap. Add `tabIndex={-1}` or `aria-hidden={true}` when `stepIndex === 0`, or replace opacity-0 with `invisible` + `pointer-events-none`.

3. **"Step N of 4" is duplicated** — once in the sr-only `aria-label` on the `<ol>`, once as visible text in the footer bar (`OnboardingFlow.tsx:394`), and once per dot as sr-only. A screen reader user hears the step count three times per pane. Consolidate: keep the footer visible label, remove the `aria-label` from the `<ol>` (the sr-only items already announce it).

4. **Terms and Privacy Policy link is unlinked plain text** (`OnboardingFlow.tsx:939`). "By signing up you agree to our Terms and Privacy Policy." Neither "Terms" nor "Privacy Policy" is an anchor. Link them or remove the copy — unlinked legal text is worse than no legal text (it implies documents exist that users cannot read).

5. **City step eyebrow says "Step 3 — personalize"** (`OnboardingFlow.tsx:679`) while panes 1 and 2 say "The problem" / "The solution." The step-number prefix is inconsistent with the editorial framing of the other panes. Standardize: either all panes get "Step N —" or none do.

---

## Bigger bets

### A. Introduce a "peek before you commit" anonymous mode
The removal of anonymous browsing is described in the code as a product decision, but the onboarding's own pitch depends on users believing the value prop — which they can't verify without access. A lightweight "preview mode" (30-minute session, read-only, no saves, no profile) would let curious visitors confirm the app is worth joining before surrendering their email. Precedent: Spotify's 30-second song previews, Notion's guest docs. This is a 0-to-1 conversion play, not a retention play.

### B. Post-onboarding guided-first-task rails ("Your Gastronome Starter")
After onboarding completes, show a dismissible home-page banner with three sequential micro-tasks: (1) Save your first restaurant, (2) Explore the top 10 in {city}, (3) Follow another foodie. Each task has a checkbox and a direct-link CTA. This pattern (used by Linear, Figma, Notion) reliably increases day-7 retention by giving users a reason to return before habitual use forms. The city preference just set during onboarding is the seed — use it to power pre-filtered recommendations immediately.

---

## No alarming regressions found
All five v2 onboarding issues that were targeted are confirmed resolved in source and screenshots. The new findings (no guest mode, no geolocation, noisy mobile layout, no post-onboarding task, no resend on confirm) are net-new gaps, not regressions introduced by the fix session.
