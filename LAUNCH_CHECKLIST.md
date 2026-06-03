# Gastronome — Launch Checklist

Owner-only setup + maintenance steps to get the app fully functional in
production. Everything here requires dashboard access, secrets, or accounts
that can't be done from the codebase. Items are grouped by priority.

**Project refs**
- Supabase project: `trwdqzsfgeydafojajbh` — https://supabase.com/dashboard/project/trwdqzsfgeydafojajbh
- Production URL: https://gastronome.vercel.app
- Repo: github.com/dakairesearch-byte/gastronome

---

## 🔴 P0 — Blockers (app is broken/insecure in prod without these)

### 1. Set the Google Maps keys in Vercel (prod) + redeploy
The interactive Discover map + static map tiles + search autocomplete are blank
in prod until these client env vars exist **and a build runs after adding them**
(`NEXT_PUBLIC_*` vars are baked in at build time).
- [ ] Vercel → Project → Settings → Environment Variables, add (Production scope):
  - `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` = your Maps key
  - `NEXT_PUBLIC_GOOGLE_PLACES_API_KEY` = your Maps key (same one is fine)
- [ ] **Redeploy** after saving (Deployments → Redeploy, or push a commit).
- [x] Key is HTTP-referrer-restricted and `gastronome.vercel.app` is allowlisted — verified.
- [ ] Verify Maps JavaScript API, Maps Static API, and Places API are all enabled on the key.

### 2. Rotate the originally-leaked API keys
Keys were committed/inlined earlier in the repo's history (and in `scripts/*.sh`).
- [ ] Rotate `GOOGLE_PLACES_API_KEY` (server) + the Supabase service-role key if ever exposed.
- [ ] Move any inline secrets in `scripts/*.sh` to env vars; never commit new secrets.
- [ ] Confirm `.env.local` stays gitignored (it is).

### 3. Set remaining prod / CI env vars
- [ ] `NEXT_PUBLIC_SITE_URL` = https://gastronome.vercel.app (canonical URLs, sitemap, OG)
- [ ] `SENTRY_DSN` (+ `NEXT_PUBLIC_SENTRY_DSN`) if using Sentry
- [ ] `ADMIN_USER_IDS` (comma-separated auth UUIDs allowed into /admin)
- [ ] GitHub Actions secrets for CI (Supabase URL/anon key, etc.) so the workflow + nightly health check run.

---

## 🟠 P1 — Auth & accounts

### 4. Enable Google sign-in (Supabase)
Code is fully wired (onboarding button + sign-in modal). It currently shows
"Google sign-in isn't enabled yet" because the provider is off.
- [ ] Google Cloud Console → Credentials → Create OAuth client ID (Web). Authorized redirect URI:
  `https://trwdqzsfgeydafojajbh.supabase.co/auth/v1/callback`
- [ ] Supabase → Authentication → Providers → Google → enable + paste Client ID + Secret.
- [ ] Supabase → Authentication → URL Configuration → add `https://gastronome.vercel.app/**` to Redirect URLs.
- [ ] Verify: the OAuth authorize endpoint should 302 to accounts.google.com (currently 400 "provider is not enabled"). Ping me and I'll re-check.
- [x] Email sign-up works (auto-confirm on; 3 users exist).

### 5. Decide on email verification
`mailer_autoconfirm` is **ON** — emails are NOT verified (anyone can sign up with
a fake address and get straight in). Fine for beta; revisit before emailing users.
- [ ] If you turn autoconfirm OFF, configure custom SMTP (Supabase's default mailer is rate-limited and not for production).

### 6. Supabase security hardening
- [ ] Authentication → enable **Leaked password protection** (HaveIBeenPwned).
- [ ] Review RLS once more before opening signups widely (profiles email PII is already locked down).

---

## 🟡 P2 — Data freshness & ranking

### 7. Full data re-enrichment
Catalog was last enriched **May 13** — ratings, review counts, photos, videos,
and menus are all stale. The Gastronome Score is only as good as this data.
- [ ] Re-run Google Places enrichment (ratings, review counts, photos, coords).
- [ ] Refresh Yelp ratings/counts.
- [ ] Re-pull TikTok/Instagram videos.

### 8. Refresh `social_score` nightly
The new social-buzz signal reflects the **last video pull**. Schedule the
idempotent backfill (in `supabase/migrations/20260601000000_add_social_score_column.sql`)
to re-run after each nightly video enrichment so buzz stays current.
- [ ] Wire `social_score` recompute into the nightly job.

### 9. Trending re-base decision
The trending algorithm (`src/lib/ranking/trending.ts`) uses a 30-day window;
with stale data it may be flat. Decide whether to re-base after the data refresh.

---

## 🟢 P3 — Legal & polish

### 10. Legal review
- [ ] Have counsel review the Privacy Policy + Terms drafts (`/privacy`, `/terms`) before public launch.

### 11. Optional follow-ups noted during build
- [ ] "Search this area" on the Discover map currently filters the already-fetched top-40 by viewport (an honest notice is shown). A true geographic DB re-query is a deferred enhancement.
- [ ] Accolade-aware scoring: deliberately NOT folded into the Gastronome Score (kept pure ratings + social). Revisit if Michelin/JBF spots with polarizing crowd reviews feel under-ranked.

---

## ✅ Shipped this cycle (for reference)
- Discover v2: one page, two modes (Browse = Top-10 Trending + editorial; Map = full Beli-style) + persistent search; QA-fixed (editorial deep-links, map hover, near-me, toggle).
- Gastronome Score rebuilt: calibrated-absolute + Bayesian volume shrink + cross-source consensus penalty + consensus-gated TikTok/IG boost. 0 tens, ~2% ≥9.0.
- `restaurants.social_score` column added + backfilled in prod (97% coverage).
- Email auth verified working; Google sign-up wired into onboarding + modal (pending provider enablement above).
- Google Maps code wired to env vars; key restriction + domain allowlist verified.
