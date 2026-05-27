# Onboarding — UX Findings
_Sweep v2 · 2026-05-26 · Lens: first-time user experience_

---

## Top 5 Issues

**1. Returning user must walk through all four panes to reach sign-in**
The "Already have an account? Sign in" escape hatch only appears on pane 4 (account step). A returning user who lands on `/onboarding` has no visible sign-in path on panes 1–3 and must click Continue three times before seeing it. The nav bar shows "SIGN IN" but during onboarding that link presumably loops back to `/onboarding` via middleware.
_Source: `OnboardingFlow.tsx` line 422 (escape hatch rendered only when `step === 'account'`); `onboarding-1-desktop.png` (pane 1 has no sign-in prompt)._

**2. No anonymous / browse-first path — mandatory gate with no preview of value**
Every visitor, including returning visitors who simply want to browse, must complete a 4-pane signup before seeing any restaurant data. There is zero in-flow content to substantiate the pitch — the source badges on pane 1 are static chips with no live data, and pane 2's feature grid is entirely abstract. Users cannot evaluate the product before committing.
_Source: `page.tsx` comment at line 10 ("No escape hatch; anonymous browsing has been removed"); `onboarding-1-desktop.png` / `onboarding-2-desktop.png` (no actual restaurant cards or real ratings shown)._

**3. Progress indicator is ambiguous: dots don't label what's ahead**
The pill-dot progress bar shows 4 steps as unlabeled dots. A user on pane 1 cannot tell that step 4 is account creation — they discover the signup requirement only after investing time in panes 1–3. This is a deceptive pattern that inflates drop-off at the signup gate.
_Source: `OnboardingFlow.tsx` lines 270–283 (dots rendered with no labels); `onboarding-1-desktop.png` (dot row visible, no step names)._

**4. Two divergent onboarding flows exist in parallel with incompatible feature sets**
`OnboardingFlow.tsx` (standalone `/onboarding`) collects one city; `OnboardingSteps.tsx` (embedded in `SignInModal`) collects up to 3 cities plus cuisine preferences. A user who signs up via the standalone page never sees cuisine collection; a user who signs up via the modal gets a richer setup. The two flows share no state and produce different profile completeness.
_Source: `OnboardingFlow.tsx` line 44 (`STEPS: ['problem','solution','city','account']`) vs `OnboardingSteps.tsx` lines 27–28 (`STEPS: ['welcome','cities','cuisines','done']`); `SignInModal.tsx` line 199 (`setPhase('onboarding')`)._

**5. City step requires a selection to enable Continue, but offers no "I'll decide later" path**
Continue is disabled until a city is clicked (`OnboardingFlow.tsx` line 105). Users who live in a city not yet supported (the list is 6 cities) are stuck — they cannot proceed without picking a city they don't live in. There is no skip or "add my city" affordance.
_Source: `OnboardingFlow.tsx` lines 103–107 (`canProceed` returns false when `step === 'city'` and `selectedCity` is empty); `onboarding-3-desktop.png` (Continue button visibly dimmed, 6 cities shown)._

---

## 5 Quick Wins

**QW1. Show "Sign in" link on panes 1–3, not just pane 4.**
One-line conditional change: render the escape hatch outside the `step === 'account'` guard. Eliminates the forced march for returning users.
_`OnboardingFlow.tsx` line 422._

**QW2. Label the progress dots with step names (Problem · Solution · City · Account).**
Replace the bare dot row with labeled steps (tiny text beneath each dot). Users know upfront that step 4 is account creation.
_`OnboardingFlow.tsx` lines 270–283._

**QW3. Add a "Skip for now" link on the city step.**
Allow `selectedCity` to remain empty and treat it as "no preference." The `canProceed` guard already defaults city to null when saving; the only blocker is the UI gate.
_`OnboardingFlow.tsx` line 105 — change `!!selectedCity` to `true`; add skip link._

**QW4. Fix the broken logo image on onboarding panes.**
`/Logo.jpg` fails to load (broken image icon visible in all three onboarding screenshots and the mobile view). The card renders the Gastronome name in a broken img box, undermining first impression.
_`OnboardingFlow.tsx` line 261 (`src="/Logo.jpg"`); `onboarding-1-desktop.png` (broken img icon top of card)._

**QW5. Use a `<Link>` instead of `<a href>` for the sign-in escape hatch.**
The existing anchor at line 432 does a full page navigation rather than client-side routing, breaking the SPA transition and potentially causing the middleware to loop unauthenticated users back to `/onboarding`.
_`OnboardingFlow.tsx` line 432 (`<a href="/auth/login">`)._

---

## 2 Bigger Bets

**BB1. Embed a live restaurant preview inside the pitch panes.**
Replace or supplement the static source-badge chips on pane 1 and the abstract feature grid on pane 2 with 2–3 real restaurant cards (read-only, no auth required). Users see actual aggregated ratings before committing to signup. This converts the funnel from "trust me" to "see for yourself" and is the single highest-leverage change for TTFV.
_`OnboardingFlow.tsx` `ProblemStep` / `SolutionStep` components (lines 449–629); `OnboardingRestaurantPreview.tsx` already exists as a component per the primer source map — evaluate whether it can be embedded here._

**BB2. Consolidate the two onboarding flows into one.**
Merge `OnboardingFlow.tsx` and `OnboardingSteps.tsx` into a single wizard that runs regardless of entry path (standalone page or post-signup modal). Shared component means cuisine preferences are collected for all users, city selection is consistent (support skip + multi-city), and the profile completeness gap closes. The `SignInModal` onboarding phase can import the unified wizard and pass `onComplete` as a callback.
_`OnboardingFlow.tsx` and `OnboardingSteps.tsx` — both files; `SignInModal.tsx` lines 196–199 (phase switch)._

---

## Alarming

**The `is_critic: true` flag is hardcoded on every signup through `SignInModal`.**
`SignInModal.tsx` line 185: every account created via the modal sets `is_critic: true` in user metadata. If `is_critic` gates any elevated content or trust level, every new user silently receives that privilege. This is either dead metadata (harmless but noisy) or a trust/permissions bug.
_`SignInModal.tsx` line 185._
