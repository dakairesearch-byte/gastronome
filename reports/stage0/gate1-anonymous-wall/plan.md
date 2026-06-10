# Gate 1 — Reverse the No-Anonymous-Browsing Decision

**Date:** 2026-06-10
**Gate:** gate1-anonymous-wall
**Status:** Awaiting owner decision (see QUESTIONS.md Q-002)
**Implementation time if approved:** ~2 hours (middleware edit + ?next= threading); zero DB or RLS changes needed.

---

## Context: what the current wall costs

Every anonymous request to any non-exempt path in `src/lib/supabase/middleware.ts` lines 92-97
hits a 307 redirect to `/onboarding` with `url.search = ''`. This is by design — the comment
reads "there's no way to browse without an account by design." It was a deliberate product call.

**Reversing it is this gate's entire purpose.** The costs of the wall are:

| Cost | Quantification |
|---|---|
| Zero SEO indexing | Googlebot GETs `/restaurants/[id]` and receives HTTP 307 → `/onboarding`. Every restaurant page in the 3,340-restaurant catalog returns a redirect. Google indexes zero restaurant pages. The sitemap at `robots.ts` / `sitemap.ts` is paginated and already correct — but crawler access is blocked. |
| Broken shared links | Every shared link (iMessage, group chat, social) redirects recipients to onboarding instead of the page they were sent. The conversion sequence is: click → onboarding → sign-up → home (not the shared page). The user never sees what they were sent. UIUX catalog item **onboarding-02** (P0 panel consensus ⭐) documents this exact defect. |
| Growth loops dead | Every sharing mechanic in the engagement report (Score Card OG images, Settle It, Taste Match cards, Beli import share, weekly movers digest) transmits through a pasted URL. Today all of them dead-end at the onboarding wall. |
| K-factor denominator broken | The sharing coefficient K = invites × conversion rate. Conversion rate is zero (user lands on wrong page, bounces) so K ≈ 0 regardless of invitation volume. |

**Important:** the wall does not protect any non-public data. Public `SELECT` for the
`anon` role comes from THREE migrations, not one (corrected by overseer F1-access-auth,
verified against live `pg_policy` 2026-06-10):

- `001_aggregator_pivot.sql` — `restaurants`, `cities`, `restaurant_videos`
- `20260411_profiles_rls.sql` — `profiles`, `reviews`, `follows`, `review_photos`
  (email PII on profiles locked down separately in `20260531000005`)
- `20260530000001_aggregator_tables_rls.sql` — `restaurant_highlighted_dishes`,
  `restaurant_top_dishes`, `restaurant_menu_items`, `restaurant_michelin_history`,
  `restaurant_jbf_history`, `restaurant_eater38_history`

Live verification (2026-06-10): every table above has RLS ENABLED with a public SELECT
policy in the production DB. Note: `restaurant_rating_snapshots` does NOT exist in the
live database (the migration's existence guard skipped it silently) — any app code that
queries it fails for authed users too, so it is not a gate-1 regression, but do not cite
it as a covered table. The Supabase anon key is already safe to use for reads. The wall
is *only* a middleware redirect; removing it does not change any security boundary.

---

## The change

**Before:** any non-exempt path → anonymous user → 307 `/onboarding`.

**After:**
- **Read routes** (all `GET` navigation) → anonymous user → page renders normally (no redirect).
- **Write actions** (bookmark, review, collection, profile edit, verdict) → anonymous user → `openSignInModal()` fires from the component (already implemented in BookmarkButton, Navigation, profile/page). The modal handles sign-in and returns the user to the page they were on.
- **Authed + incomplete onboarding** → redirect to `/onboarding` unchanged (the second gate in middleware, lines 105-117, is untouched).
- **`?next=` deep-link** → the middleware preserves the original URL as a query param when redirecting to `/onboarding` during the one-time onboarding flow, so sign-up email callbacks and post-onboarding `router.push()` land on the originally-requested page. This resolves **onboarding-02**.

---

## Options

### Option A — Invert the default: allow all reads, no code changes to `ONBOARDING_EXEMPT_PREFIXES` (recommended)

Change the anonymous-visitor guard in `middleware.ts` from "redirect unless exempt" to "allow
unless the route is a write-only action." In practice this means: remove the anonymous redirect
entirely (lines 92-97). Unauthenticated reads pass through. Write actions already live in the
components (`openSignInModal`) — they do not come through middleware.

Also thread `?next=<pathname+search>` through the onboarding redirect for the second gate
(authed-but-incomplete users) so deep links survive sign-up. This is a pure addition — the
second gate code path remains at the same lines, just with the `?next=` appended and `url.search`
preserved rather than wiped.

**Pros:** smallest change, no new infrastructure, SEO clock starts immediately, shared links work.
**Cons:** `ONBOARDING_EXEMPT_PREFIXES` list becomes dead code (only `/auth`, `/api`, `/_next`,
`/favicon`, `/onboarding` still matter — but they now matter for a different reason: the onboarding
path itself must not redirect to itself). That dead code should be cleaned up in a follow-on
(non-gated) refactor once the owner approves.

**Rollout:** see staged rollout below.

---

### Option B — Exempt specific read prefixes, keep wall for everything else

Add `/restaurants`, `/explore`, `/discover`, `/cities`, `/search`, `/community` to
`ONBOARDING_EXEMPT_PREFIXES` rather than removing the anon guard. The home page `/` and other
routes stay behind the wall.

**Pros:** more conservative; only the named routes become public.
**Cons:** partial SEO (home page is still blocked); every new route needs a manual exemption;
the original motivation ("no browsing without an account") is still honored for uncharted routes.
Still requires the `?next=` fix, same work. This is approximately what the current sitemap
already describes — the sitemap only lists restaurant and city pages, not the home page.

---

### Option C — Keep the wall, fix only the `?next=` deep-link threading

Do not make anything public. Thread `?next=<pathname>` through the onboarding redirect so
shared links land correctly after sign-up. This is a strict improvement over the status quo
(fixes onboarding-02) while preserving the no-anonymous-browsing intent.

**Pros:** zero change to product philosophy; all pages require account.
**Cons:** Googlebot still indexes nothing. Shared links still require sign-up to view (high
friction). Growth loops still dead. K-factor denominator still broken. OG Score Card images
(a future item) still useless for non-users. Defers the real cost.

---

## Recommendation

**Option A.** The wall currently costs: zero SEO, zero crawler indexing of 3,340 restaurant
pages, broken shared links, dead K-factor. The wall protects nothing that RLS doesn't already
protect. Option A fixes all of it in ~2 hours. Option B is a reasonable middle ground if the
owner wants to keep home and profile behind the wall while opening restaurant/discover/city
routes — it is almost as good and easier to stage. Option C is the lowest-risk choice but
defers the structural problem.

The OG Score Card (per-restaurant og:image rendering a "8.7 · Michelin ★ · 4.8 Google"
scorecard) is explicitly scoped as a **separate later item** not in this patch. It requires
a Vercel OG image edge function (or Satori/React server render), which is a non-trivial build.
This patch is the prerequisite — Score Cards are useless while the page 307s.

---

## Staged rollout (for Option A)

**Phase 1 — Deploy and monitor (day 1):**
Remove the anonymous redirect block. The second guard (authed-but-incomplete) is unchanged.
Watch for unexpected 403s from Supabase (there should be none — RLS already grants anon
SELECT on all public restaurant tables; any 403 would indicate a table missing a SELECT policy).

**Phase 2 — Thread `?next=` (day 1, same deploy):**
Append `?next=${encodeURIComponent(pathname + search)}` to the `/onboarding` redirect for
authed-but-incomplete users. Update `OnboardingFlow.tsx` and `SignInModal.tsx` to consume
`next` and `router.push(next ?? '/')` on completion. This is the onboarding-02 fix.

**Phase 3 — SEO (passive, no action):**
Googlebot begins crawling. The paginated sitemap already returns all restaurant and city URLs.
First indexing typically takes 2-4 weeks for a new domain. No action needed.

---

## Rollback

Single-line rollback — restore the removed block in `middleware.ts`:

```ts
if (!user && !exempt) {
  const url = request.nextUrl.clone()
  url.pathname = '/onboarding'
  url.search = ''
  return NextResponse.redirect(url)
}
```

This can also be wrapped in an env-flag: `ANONYMOUS_WALL=true` restores the old behavior
(middleware runs server-side, so no `NEXT_PUBLIC_` prefix is needed). Note (overseer
correction): on Vercel an env-var change still requires a redeploy to take effect — the
flag saves a code edit, not a deploy. The patch ships the clean removal as the default;
the env-flag variant appears only as a commented-out block in the diff and must be
uncommented to use.

---

## Success metrics

| Metric | Baseline (today) | Target (30 days post-deploy) |
|---|---|---|
| Google Search Console: pages indexed | ~0 restaurant pages | >500 restaurant pages crawled |
| Shared-link conversion: % who reach the target page | ~0% (wall bounces all) | >60% |
| Signup rate from restaurant pages | Not measurable (wall) | Measurable, benchmark set |
| `onboarding-02` regression | 100% deep-link loss | 0% |

---

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Unauthenticated RLS SELECT on a table that lacks a SELECT policy | Low — public SELECT verified live (2026-06-10) across 001_aggregator_pivot + 20260411_profiles_rls + 20260530000001; any new table added later without a policy will 403 | Monitor error rate for 403s in first 24h; add "public SELECT policy" to the new-table checklist |
| Googlebot crawl budget consumed by low-value pages | Low — sitemap already scoped to restaurants + cities | robots.ts already configured; no change needed |
| Users sharing links before OG cards exist | Certain — links will show generic fallback OG image | Acceptable; the generic `/og.jpg` in `layout.tsx` is already set. Score Card is next-sprint work. |
| Write-gating regression: anon user finds a way to bypass openSignInModal | Low — write actions (bookmark, review) are component-gated AND DB-gated (RLS INSERT policies require auth) | Dual enforcement; middleware removal does not weaken write security |
| Onboarding funnel drop — users browse without signing up | Expected | This is the tradeoff being accepted. Sign-up is now pull, not push. Benchmark before/after. |

---

## What this patch does NOT include

- OG Score Card images — scoped as a separate sprint item, depends on this gate.
- `/onboarding` layout chrome removal (onboarding-04) — separate UIUX fix, non-gated.
- OnboardingFlow.tsx changes (onboarding-02 `router.push(next)`) — a follow-on PR after this gate approves. The `?next=` middleware change in this patch is the prerequisite; the onboarding flow change is a companion item.
- Any RLS change — none needed.
- Any DB migration — none needed.

---

## Files touched by the patch

| File | Change |
|---|---|
| `src/lib/supabase/middleware.ts` | Remove anonymous redirect block (lines 92-97); add `?next=` to onboarding redirect for authed-but-incomplete path; optional env-flag variant |
| `src/proxy.ts` | No change — calls `updateSession` which is the changed file |

See `middleware.patch` for the exact unified diff.
