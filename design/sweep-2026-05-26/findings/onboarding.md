# onboarding

**Lens:** Does a brand-new visitor quickly understand Gastronome's value, feel motivated to hand over an email, and land on a home screen that feels personally relevant?
**Reviewed:** home-desktop.png screenshot + OnboardingFlow.tsx, OnboardingSteps.tsx, onboarding/page.tsx.

## Top 3 findings

1. [P0] **What's wrong:** No escape hatch until step 4. Every anonymous visitor is force-redirected to /onboarding (page.tsx:comment, OnboardingFlow.tsx:44 "No escape. Anonymous browsing has been removed") and must walk through two pitch screens before they can even pick a city — let alone browse a restaurant. The "Already have an account? Sign in" link only appears on the final pane (OnboardingFlow.tsx:422).
   **Why it matters:** Returning users who land on /onboarding for any reason (cleared cookies, incognito) must click through three steps they've already seen before they can sign in. New users with any skepticism bounce before they see real content.
   **What to do:** Surface the "Sign in" link on every pane (top-right corner of the card), not just pane 4. Add a secondary "Browse first" text link on panes 1–2 that shows a single city's explore page without saving preferences — remove it later once logged in.
   **Why you'd want to do this:** Sign-in friction directly suppresses return visits; browse-first (known as "anonymous preview") lets skeptical users verify the product works before committing an email.
   (effort: S)

2. [P1] **What's wrong:** The home screen shown post-onboarding (home-desktop.png) displays "Recent Searches," "Your Favorites," and "Saved Collections" — all empty — alongside a "Suggestions" grid. The empty-state (the UI shown when a section has no content yet) for "Your Favorites" shows a faint amber CTA button, but "Recent Searches" renders only a soft-grey caption ("Your recent searches will appear here") with no prompt to act. A brand-new user lands on a page that is mostly hollow.
   **Why it matters:** Empty accounts signal a dead product. A first-time user who completes onboarding expecting a personalized feed sees a skeleton of the experience. Time-to-value (the moment the user gets something useful) is delayed until they manually search or explore.
   **What to do:** Replace the three empty personal sections with a single first-task prompt: "Start by searching for a restaurant you love" with an inline search bar, or redirect new users to /explore instead of / for their first session. Persist the redirect only until they have at least one search or bookmark.
   **Why you'd want to do this:** First-session activation rate (user completes at least one meaningful action) is a leading indicator of 30-day retention; filling the screen with pre-seeded suggestions or a clear call-to-action prevents drop-off at the moment of highest intent.
   (effort: M)

3. [P1] **What's wrong:** The city step in OnboardingFlow.tsx (CityStep, line 631) accepts a single city via tap-to-select pills, but provides no geolocation (the browser's GPS/IP-location feature). The user must recognize their city by name in a list ordered by restaurant count. OnboardingSteps.tsx (the in-app variant) allows up to 3 cities (MAX_CITIES = 3, line 25) but the main flow allows only 1 — an inconsistency a user who re-opens settings will find confusing.
   **Why it matters:** A user traveling or unsure of the city list spelling must scroll and guess. Failing to auto-detect location means the personalization step — the entire point of step 3 — adds friction rather than delight. The 1-vs-3 city discrepancy means post-onboarding settings feel like a different product.
   **What to do:** Add a "Use my location" button at the top of the CityStep that calls the browser Geolocation API and auto-selects the nearest city. Reconcile the max-cities limit to 3 in both flows (or explicitly cap to 1 everywhere with a clear reason).
   **Why you'd want to do this:** Reducing the effort of the personalization step increases completion rate; geolocation is a well-established pattern (Yelp, OpenTable) that users expect and trust.
   (effort: M)

## Quick wins (≤3, no severity tag)

1. **What's wrong:** The progress indicator (the pill-shaped dots above the card in OnboardingFlow.tsx:271) uses only color to communicate position — the active dot widens to 28px but there is no label, no "Step 2 of 4" text visible inside the card header itself.
   **Why it matters:** A user who drops out mid-flow and returns has no verbal cue about how much is left; the step counter in the footer ("Step 2 of 4", line 374) is below the fold on short viewports.
   **What to do:** Add a small "Step 2 of 4 — Pick your city" label directly below the progress dots, visible without scrolling.
   **Why you'd want to do this:** Labeled progress reduces abandonment on multi-step flows; the cost is three lines of JSX.
   (effort: S)

2. **What's wrong:** The ConfirmEmailStep (OnboardingFlow.tsx:945) says "Click the link to activate your account, then come right back" — but the user has no way back. There is no "Resend email" button and no timer shown. If the confirmation email is delayed or lands in spam, the user is stranded on a dead-end screen.
   **Why it matters:** Email confirmation failure is the single highest drop-off point in email/password signup flows. A stranded user refreshes, gives up, or creates a duplicate account.
   **What to do:** Add a "Resend confirmation email" button (debounced 60 s) and a "Check spam folder" hint beneath the email address.
   **Why you'd want to do this:** Measurably reduces support tickets ("I never got the email") and recovers signups that would otherwise be permanently lost.
   (effort: S)

3. **What's wrong:** The WelcomeStep in OnboardingSteps.tsx (line 256) and the ProblemStep in OnboardingFlow.tsx (line 449) cover essentially the same ground — "ratings are scattered" — in two different components used in two different contexts. If copy drifts between them, a user who sees both (authed-but-unfinished path) gets a contradictory pitch.
   **Why it matters:** Duplicated pitch copy is a maintenance trap; the authed-unfinished path (page.tsx:28) skips directly to city selection in OnboardingFlow but the modal variant (OnboardingSteps) restarts from welcome — so the redundancy affects real user paths.
   **What to do:** Extract shared pitch copy into a single constant or component; document which flow each component belongs to with a comment at the top of each file.
   **Why you'd want to do this:** One source of truth prevents silent copy drift and makes A/B testing the pitch message possible without touching two files.
   (effort: S)

## One bigger bet (optional)

**What's wrong:** The entire onboarding flow (4 panes, mandatory account creation) gates all content behind sign-up. The home screen after completion (home-desktop.png) shows a "Suggestions" grid but the personalization — city + cuisine — was only city-level in OnboardingFlow. The Suggestions section appears to draw from platform-wide data, not city-tuned data, since cuisine preferences are only collected in the OnboardingSteps modal variant, not in the main OnboardingFlow (OnboardingFlow.tsx collects only `selectedCity`; cuisine preferences are never asked).
**Why it matters:** The promise of a feed "made for you" (OnboardingSteps.tsx:479) is only half-delivered — users set a city but never pick cuisines in the primary flow, so the Suggestions grid cannot be cuisine-personalized on first load.
**What to do:** Add a cuisine selection step to OnboardingFlow (between CityStep and SignUpStep), saving `favorite_cuisines` alongside `home_city` in the `handleSignUp` path. The city + cuisines combination gives the recommendation engine enough signal to meaningfully differentiate the Suggestions grid on day 1.
**Why you'd want to do this:** A genuinely personalized first home screen is the fastest path from "this is neat" to "I need this app"; it converts the onboarding investment into visible product value in the first 30 seconds post-signup.
**The tradeoff:** Adding a step increases form length and drop-off risk at each additional pane; test with a skippable step first to measure cuisine-preference completion rate before making it required.
(effort: L)

## Alarming (optional, 1 line)

No sign-in link exists on panes 1–3; a returning user who lands on /onboarding (e.g., after clearing cookies) is forced through the full pitch before they can log in — a regression risk every time auth state is lost.
