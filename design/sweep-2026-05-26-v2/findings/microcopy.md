# Microcopy findings — sweep 2026-05-26-v2

Specialist: microcopy | Lens: every string in the UI — button labels, error messages, empty states, tooltips, form labels, pitch copy, voice consistency.

---

## Top 5 findings

**F1. "Sign in" / "Log in" / "Sign out" — three verbs, one action**
- Impact: erodes trust through inconsistency; users wonder if they're different paths
- Evidence: desktop nav uses "Sign in" (Navigation.tsx:136); mobile menu uses "Log in" for the same unauthenticated primary button (Navigation.tsx:254); the exit action is "Sign out" (Navigation.tsx:234); auth-login-desktop.png modal pill reads "SIGN IN" while the CTA button also reads "SIGN IN" — so far consistent — but the mobile hamburger diverges with "Log in"
- Fix: standardise on "Sign in" / "Sign out" everywhere; kill "Log in"
- Files: `src/components/Navigation.tsx:254` (Log in), `:234` (Sign out) vs `:136` (Sign in)

**F2. Review page voice is a brand alien — emerald, casual, inconsistent register**
- Impact: a user who just read the serif, editorial home page hits a Google-Material-looking form in a completely different tone
- Evidence: review-new-desktop.png shows plain gray Tailwind form with no design-system tokens; copy says "Amazing tacos, best I've had!" as a placeholder — exclamation-mark-casual vs. the rest of the app's restrained voice; loading state says "Publishing..." (ellipsis, sentence-case) while the auth modal says "Signing in…" (Unicode ellipsis, same case — slightly better but still inconsistent); submit button alternates between "Publish Review" and "Post Review" depending on creative mode
- Fix: pick one verb ("Post") or ("Publish") and use it regardless of mode; apply design-system typography tokens; drop the exclamation mark placeholder
- Files: `src/app/review/new/page.tsx:545`, `:289`, `:451`

**F3. Onboarding pane 1 body copy makes the problem about noise, not the user**
- Impact: weak conversion hook — the pitch is descriptive rather than empathetic
- Evidence: onboarding-1-desktop.png body: "Google says it's a 4.3. Yelp says 3.8. Your TikTok feed has five hot takes. The Infatuation wrote a paragraph. You just want to know — is this place actually good?" — the closing question is good but buried after a dry list of platforms; the reader's frustration arrives last
- Fix: lead with the feeling ("You just want to know if it's actually good. But…"), then surface the platform chaos as evidence
- Files: `src/app/onboarding/page.tsx` (rendered string visible in onboarding-1-desktop.png)

**F4. "Saved Collections" section header vs. "Bookmark" icon — mismatched save vocabulary**
- Impact: users don't know whether they are "saving," "bookmarking," or "collecting"; the hover state shows a Bookmark icon but the section is labelled Collections
- Evidence: home-desktop.png section header "Saved Collections"; page.tsx:105 `<SectionHeader title="Saved Collections" />`; on hover the overlay renders a `<Bookmark>` icon (page.tsx:122); the auth modal subheading says "save restaurants" (SignInModal.tsx:289); the nav has no "Save" affordance at all
- Fix: commit to one noun — "Collections" if curated lists are the metaphor, "Bookmarks" if it's per-item saving; use that noun consistently in headers, icons, and CTA copy
- Files: `src/app/page.tsx:105`, `:122`; `src/components/auth/SignInModal.tsx:289`

**F5. "Curated Selection" supertitle above "Suggestions" is redundant and precious**
- Impact: the supertitle adds no meaning — the section is already named; "Curated" as a descriptor for trending restaurants chosen by algorithm is misleading
- Evidence: home-desktop.png shows "CURATED SELECTION" in small-caps above the h2 "Suggestions"; the restaurants shown are trending algorithmic results, not hand-picked (page.tsx:62-66 fetches `topTrendingRestaurants`)
- Fix: drop the supertitle or replace with "Trending this week" — accurate and energising
- Files: `src/app/page.tsx:84`

---

## 5 quick wins

**Q1. "Every restaurant score, one search." (onboarding welcome) vs. "Every restaurant rating in one place." (footer) — two taglines, one product**
- Fix: pick one; the footer version is wordier but warmer; the onboarding version is punchier — use punchier everywhere
- Files: `src/components/auth/OnboardingSteps.tsx:279`; footer (onboarding-1-desktop.png footer text)

**Q2. Loading state "Creating…" on signup button lacks the object — creating *what*?**
- Fix: "Creating account…" — two words, no ambiguity
- Files: `src/components/auth/SignInModal.tsx:684`

**Q3. Password placeholder "Your password" is filler that adds zero hint**
- Fix: either remove placeholder entirely (the label already says "Password") or use "At least 6 characters" on signup only
- Files: `src/components/auth/SignInModal.tsx:629`

**Q4. Error message "Session expired" on onboarding finish is raw backend language**
- Fix: "Your session timed out — please sign in again" (action-oriented, human)
- Files: `src/components/auth/OnboardingSteps.tsx:119`

**Q5. "A taste of {city}" preview label in city-picker is the one genuinely on-brand micro-moment — but only cities with photos show it, making it feel broken when absent**
- Fix: show the label unconditionally; if no preview rows load, show "Top-rated restaurants coming soon" — preserve the warm voice rather than silently hiding the section
- Files: `src/components/auth/OnboardingSteps.tsx:361`

---

## 2 bigger bets

**B1. Rename "Creative Mode" — it's a feature name, not a user-facing concept**
The review form branches on `creativeModeEnabled` but the toggle is buried in Profile settings with the label "Creative Mode." Users who want to write a full review have no idea this switch exists; those who find it don't know what "creative" means. The Sparkles icon link reads "More options" (review/new/page.tsx:289) — better, but it points to Profile rather than enabling the mode inline. Consider "Full review" vs "Quick rating" as the framing, surfaced directly on the review form as a toggle (not a profile setting). The copy cascade — form title, placeholders, button label, character limits — already forks correctly; the only missing piece is a legible in-context control.
- Files: `src/app/review/new/page.tsx:275-291`

**B2. The sign-up value proposition is functional, not aspirational**
Modal subheading on signup mode: "Create an account to save and share favorites" (SignInModal.tsx:291). This is what accounts do on every app — it says nothing about why Gastronome is worth joining. A foodie-confident replacement: "Join to track every restaurant you've tried, want to try, and loved." That mirrors the app's actual data model (reviews + bookmarks + collections) and speaks to the restaurant-obsessed user the brand targets. The onboarding pitch (pane 2, onboarding-2-desktop.png) is stronger — "We pull together critic reviews, crowd ratings, and social buzz so you can decide where to eat in one glance instead of six tabs" — but that copy never appears at the moment of account creation friction. Pull a shortened version into the signup subheading.
- Files: `src/components/auth/SignInModal.tsx:291`

---

## Alarming

**Navigation.tsx:254 — "Log in" in the mobile menu primary CTA.** This is the highest-friction auth entry point for mobile users and the only place in the product that uses "Log in." It will ship as a brand inconsistency to every unauthenticated mobile visitor. One-line fix.
