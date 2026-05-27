# Accessibility — WCAG 2.1 AA Findings

Lens: color contrast, focus order, keyboard navigation, screen reader announcements, alt text, form labels, focus traps in modals, motion preferences, ARIA dialog/landmark usage.

---

## Top 5 Findings

**A1 — No focus trap in the Sign-in modal**
Focus is moved into the modal on open (line 95, SignInModal.tsx), and Escape closes it (line 98), but Tab cycles out into the blurred background page. WCAG 2.1 SC 2.1.2. Modal focus must be contained within the dialog boundary; keyboard users can currently reach the navigation bar and footer behind the overlay.
`src/components/auth/SignInModal.tsx:91-106` / `auth-login-desktop.png`

**A2 — Secondary text color fails WCAG AA contrast**
`--color-text-secondary: #757575` on `--color-background: #FFFEFB` produces a contrast ratio of approximately 4.43:1, which narrowly passes for normal text (≥4.5:1 required). However this token is widely used at `text-xs` (10–11 px) size — navigation labels (letterSpacing 0.16em, 12px uppercase), the "Curated Selection" label, and the "SIGN IN / New account" mode pill. Text below 18px regular / 14px bold requires 4.5:1. At rendered 10–12 px these instances fail.
`src/app/globals.css:20` / `src/components/Navigation.tsx:88` / `auth-login-desktop.png`

**A3 — Restaurant card images: alt text is the restaurant name only**
`RestaurantCard` hero variant sets `alt={restaurant.name}` on the food photo. This repeats the adjacent `<h3>` text and conveys nothing about the image content (the dish, the ambience, the restaurant interior). Screen reader users hear the restaurant name twice in sequence with no additional context. For decorative images the fix is `alt=""`, but these photos are meaningful content.
`src/components/RestaurantCard.tsx:184` / `home-desktop.png`

**A4 — Mobile nav overlay lacks `role="dialog"` and `aria-modal`**
The mobile hamburger slide-out panel renders as a plain `<div>` with no ARIA role, no `aria-modal`, and no `aria-label`. Screen reader users in mobile Safari/VoiceOver will read through the full overlay as if it were inline content. Contrast: the Sign-in modal correctly uses `role="dialog" aria-modal="true" aria-labelledby` (SignInModal.tsx:299). The nav overlay does not.
`src/components/Navigation.tsx:160-276` / `home-desktop.png`

**A5 — `scroll-behavior: smooth` not gated behind `prefers-reduced-motion`**
`globals.css:39` applies `scroll-behavior: smooth` unconditionally on `<html>`. The card hover `scale-110` zoom (RestaurantCard.tsx:187, duration 700ms) and the Saved Collections `scale-110` (page.tsx:119) are also unconditional. Users who have enabled the OS "Reduce Motion" preference will still receive all three motion effects. WCAG 2.1 SC 2.3.3 (AAA) and the broadly expected AA practice per WCAG 2.2 Guideline 2.3.
`src/app/globals.css:39` / `src/components/RestaurantCard.tsx:187`

---

## 5 Quick Wins

**QW1 — Add `aria-current="page"` to active nav links.**
`isActivePath` correctly identifies the active route but does not set `aria-current`. One attribute, full screen-reader current-page semantics.
`src/components/Navigation.tsx:73-102`

**QW2 — The "G" brand avatar in the modal is not hidden from AT.**
The decorative `<div>` with the letter "G" inside the sign-in header has no `aria-hidden="true"`. Screen readers announce it as unlabelled content between the logo and the heading.
`src/components/auth/SignInModal.tsx:346-356`

**QW3 — `<main>` landmark exists but no skip-to-main link.**
`layout.tsx:79` wraps children in `<main>`. Adding a visually-hidden "Skip to content" anchor before the `<Navigation />` takes one link and one CSS class and saves keyboard users from tabbing through 5+ nav items on every page load.
`src/app/layout.tsx:77-80`

**QW4 — Accolade border-left color used as sole differentiator.**
`getBorderAccent` uses red / amber / pink border-left to signal Michelin / JBF / Eater 38 tier. This is color-only information. A brief visually-hidden `<span>` (e.g. "Michelin starred") inside the card would satisfy SC 1.4.1 without changing the visual design.
`src/components/RestaurantCard.tsx:26-33`

**QW5 — Form inputs in modal lack `id` + `htmlFor` association.**
The `Field` component wraps a `<label>` around its child, which is valid implicit association, but the `outline-none` class on every `<input>` suppresses the native focus ring. The `:focus-visible` override in globals.css restores it globally, but only if the browser does not treat `outline-none` as an inline style reset that wins specificity. Verify in production; add explicit `id`/`htmlFor` pairs as a belt-and-suspenders fix.
`src/components/auth/SignInModal.tsx:556-666`

---

## 2 Bigger Bets

**BB1 — Onboarding progress indicator is not accessible.**
The four dot indicators on onboarding pane 1 (visible in `onboarding-1-desktop.png`) are plain `<div>`/`<span>` elements (inferred from OnboardingSteps.tsx rendering). There is no `role="tablist"` / `role="tab"` or equivalent, no `aria-label` on the step container, and no live region to announce step transitions. A screen reader user completing onboarding hears nothing about "Step 1 of 4". Implement a `<nav aria-label="Onboarding progress">` with `aria-current="step"` on the active dot, or an `aria-live="polite"` region that announces the step label on advance.
`src/components/OnboardingSteps.tsx` (inferred) / `onboarding-1-desktop.png`

**BB2 — Search results have no live-region announcement.**
The search page (`search-desktop.png`) shows loading skeletons while filters are applied. There is no `aria-live` region to announce result count changes when skeletons resolve to real cards. Keyboard-only and screen-reader users who activate a filter receive no feedback that the list has updated. This requires an `aria-live="polite"` status region that emits e.g. "42 restaurants found" after each filter change — a non-trivial coordination between the filter state and the results component, but high-value for SC 4.1.3.
`src/app/search/page.tsx` / `search-desktop.png`

---

## Alarming

**Focus ring color fails on primary button surfaces.** The global `:focus-visible` outline uses `--color-primary: #D4A574` (warm gold). On the amber-gold "Sign in" / "Continue" button backgrounds (also `--color-primary`), this produces a near-invisible same-color ring. Keyboard users cannot see focus on the most prominent call-to-action in the product.
`src/app/globals.css:62-74` / `auth-login-desktop.png` / `onboarding-1-desktop.png`
