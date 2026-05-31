# Accessibility — v3 Re-sweep Findings
**Specialist:** accessibility | **Date:** 2026-05-26 | **Standard:** WCAG 2.1 AA

---

## v2 Fix Verification

| v2 Item | Status |
|---|---|
| Focus ring gold→slate | [RESOLVED] |
| Sign-in modal focus trap | [RESOLVED] |
| prefers-reduced-motion guard | [RESOLVED] |
| Skip link | [RESOLVED] |
| aria-current on nav | [RESOLVED] |
| Descriptive alt text (nav logo) | [RESOLVED] |
| Secondary-text contrast bumped (#5E5E5E) | [RESOLVED] |

All seven v2 accessibility commitments confirmed in source.

---

## Top 5 Findings

### 1. Mobile nav dialog missing focus trap [STILL-OPEN]
**P0 | Effort: S**
The hamburger drawer in `Navigation.tsx:178-299` uses `role="dialog"` and `aria-modal="true"` but has no focus-trap logic. The sign-in modal (same file, `SignInModal.tsx:103-132`) received a full trap in v2; the mobile nav drawer did not. A keyboard or switch-access user pressing Tab will cycle out of the panel into the blurred page behind it — screen readers will read page content as if the drawer were not open. The close button at line 202 is the only escape, and it is unreachable via Tab once focus escapes.
- Screenshot: `home-mobile.png` (drawer visible)
- Source: `Navigation.tsx:178-299` — no `keydown` listener, no focusable-query logic

### 2. Onboarding progress dots are decoration-only with no text equivalent [NEW]
**P1 | Effort: S**
`OnboardingSteps.tsx:140-153` renders four `<span>` dots (width/color driven by current index) to show step progress. None carry an `aria-label`, live-region update, or `sr-only` text announcing which step is current. The step counter "1 / 4" at line 209 is visible text but is not an `aria-live` region, so a screen-reader user who activates "Continue" receives no announcement that the view has changed. The onboarding flow has four distinct steps; silent transitions violate WCAG 4.1.3 Status Messages and make the flow opaque to AT users.
- Screenshot: `onboarding-1-desktop.png` (progress dots visible, no label observed)
- Source: `OnboardingSteps.tsx:140-153, 208-212`

### 3. City/cuisine toggle buttons expose no selected state to AT [NEW]
**P1 | Effort: S**
`CitiesStep` and `CuisinesStep` (`OnboardingSteps.tsx:328-413, 434-460`) render selection buttons styled with gold background when chosen. Neither uses `aria-pressed` nor `role="checkbox"` — the only selected signal is visual (gold fill + checkmark icon). Screen readers will announce every button identically regardless of selection state. At maximum selection, buttons are `disabled` but the visual cue is near-white text on white background (color `var(--color-border)` on `var(--color-background)`) — color-only distinction with no `aria-disabled` explanation.
- Source: `OnboardingSteps.tsx:332-351, 438-457`

### 4. Nav "Sign in" button overrides global :focus-visible with a partial re-declaration [REGRESSION]
**P2 | Effort: XS**
`Navigation.tsx:143` adds `focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2` as Tailwind utilities directly on the Sign in button but omits `focus-visible:outline-[color(secondary)]`. Tailwind's default `outline` color is browser-UA (typically black on most systems, but undefined). This means the button may render a different-colored ring than the rest of the site, breaking the consistent slate (#2C3E50) focus ring established in `globals.css:131-143`. The hamburger button (line 161) does not have this override and inherits the global correctly.
- Source: `Navigation.tsx:143`
- Screenshot: `home-desktop.png` (Sign in button, top-right)

### 5. Search-mobile bottom nav active state is color-only [STILL-OPEN]
**P2 | Effort: XS**
`BottomNav.tsx:55` sets active tab color to `var(--color-primary)` (gold #D4A574) vs inactive `var(--color-text-secondary)` (#5E5E5E). The contrast ratio of gold on white is approximately 2.4:1 — below the 3:1 minimum for non-text UI components (WCAG 1.4.11). The stroke-width change (2.5 active vs 1.5 inactive, line 58) provides a non-color secondary cue for icons, but the 10px text labels beneath have no weight or other differentiation beyond color. `aria-current="page"` is correctly set (line 52) for AT, but low-vision users who are not using AT remain at risk.
- Screenshot: `search-mobile.png` (bottom nav, Search tab active in gold)
- Source: `BottomNav.tsx:55-58`

---

## Quick Wins (≤ 1 day each)

1. **Add focus trap to mobile nav drawer** — copy the `trapFocus` pattern from `SignInModal.tsx:103-121` verbatim into `Navigation.tsx`. Wire to a `keydown` listener on `document` when `mobileOpen` is true. ~15 lines. (`Navigation.tsx:178`)

2. **Fix Sign in button focus ring** — remove the partial Tailwind override on `Navigation.tsx:143`; the global `:focus-visible` rule in `globals.css:137-143` already handles it correctly. One-line deletion.

3. **Add `aria-pressed` to city/cuisine toggle buttons** — `aria-pressed={on}` on every selection button in `CitiesStep` and `CuisinesStep`. Zero styling changes needed. (`OnboardingSteps.tsx:332, 438`)

4. **Announce step changes in onboarding** — wrap the step counter `<span>` in an `aria-live="polite"` region so screen readers announce "2 / 4" when Continue is pressed. (`OnboardingSteps.tsx:208`)

5. **Add `sr-only` current-step text to progress dots** — inside the dot `<span>` at `OnboardingSteps.tsx:143`, add `<span className="sr-only">Step {i+1}{i === idx ? ' (current)' : ''}</span>`. No visual change.

---

## Bigger Bets (multi-day)

**A. Onboarding flow: full AT audit of the modal-embedded wizard**
The modal-within-modal pattern (sign-in dialog → onboarding dialog replacing the auth form) is unusual. When the phase switches to `'onboarding'` (`SignInModal.tsx:790`), `aria-labelledby="signin-modal-title"` still points to the now-hidden auth heading. The onboarding content has its own `h2`s but no `aria-labelledby` update. A thorough fix involves either updating the dialog label on phase change or splitting into two separate dialog instances with explicit open/close lifecycle. This also surfaces the "dismissal is blocked during onboarding" behavior (`handleBackdrop` line 302): there is no AT-reachable explanation for why Escape stops working mid-flow.

**B. Color contrast audit of accolade and rating chips**
`globals.css:29-37` defines the accolade tokens (red-400, amber-400, pink-400) and rating tokens (green-600, yellow-600). These appear as colored text or border chips against white card backgrounds and against the dark `var(--color-secondary)` navy footer. None were verified in v2 contrast tables. The amber-400 rating warning color (#ca8a04 on white) needs checking — amber chips on cream (#FFFEFB) are borderline at ~4.6:1 for small text and may fail at font weights below 700. A full pass with a contrast checker across all chip/badge states is warranted.

---

## Alarming

None at P0-critical severity beyond finding #1 (nav focus trap gap). The sign-in modal focus trap shipped correctly; the nav drawer was simply not updated in parallel. No invisible content, no missing form labels, no title-less iframes observed in the reviewed surfaces.
