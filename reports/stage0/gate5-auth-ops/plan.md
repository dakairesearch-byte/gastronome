# Gate 5 — Operational Auth: mailer_autoconfirm OFF + Google OAuth ON

**Date:** 2026-06-10  
**Gate:** gate5  
**Prepared by:** stage0-planner  
**Status:** Awaiting owner decision

---

## Context

The engagement report (§8 Stage 0, gate 5) and LAUNCH_CHECKLIST.md (P1) both flag two
interlocked auth changes that must be resolved before the community/rating features
in Stage 2 can ship:

1. **Google OAuth is wired in code but disabled at the provider level.** Every user who
   clicks "Sign in with Google" is redirected to a raw 400 JSON page (onboarding-01,
   UIUX Catalog P0, 3/3 panel). This is currently the only broken P0 in the auth flow.

2. **`mailer_autoconfirm` is ON.** Email verification is skipped; any address (real or
   fake) gets straight into the app. The engagement report (§6 item 2, §2 rollout
   phase 1) states: "autoconfirm OFF before any public aggregate number renders."
   With autoconfirm ON, identity costs nothing — fake emails are free sybil pipes.

**Current state verified via DB query (2026-06-10):**
- 6 total users; 5 confirmed (3 seeded demo accounts + 2 real); 1 unconfirmed
  (homehomeliberty@gmail.com, stuck pending confirmation since 2026-04-11)
- 0 Google OAuth users — provider never enabled
- `auth_leaked_password_protection` advisor: WARN — HaveIBeenPwned check is OFF
- No Google provider rows in auth config

**Why this gate exists:** turning autoconfirm OFF makes every future email signup
dependent on successful email delivery. If SMTP is not configured before the switch,
all new signups silently break. The two changes are therefore coupled: you cannot
safely flip autoconfirm without a decision on SMTP.

---

## Proposed Changes

### A. Google Cloud OAuth Client — create and wire
### B. Supabase provider enablement + redirect allowlist
### C. `mailer_autoconfirm=false` + `password_hibp_enabled=true` via Management API
### D. SMTP provider selection (autoconfirm OFF makes this load-bearing)
### E. Interim code guard for broken Google buttons (draft patch)

---

## Options

### Option A — Full production-ready path (RECOMMENDED)
Enable Google OAuth + flip autoconfirm OFF + configure Resend for SMTP + enable HIBP
password protection. All done before any invite or public traffic. The 1 stuck
unconfirmed user gets a manual confirm (or a re-send from the dashboard).

**Tradeoffs:**
- Requires ~1 hour of dashboard work and a Resend account (free tier covers early volume)
- New email signups require inbox confirmation — adds one step to the signup funnel
- Correct sequencing for Stage 2 (trust substrate); without it, the submit_verdict()
  RPC and identity ladder have no meaningful tier differentiation
- Removes the sybil pipe that the engagement report calls out explicitly

### Option B — Google OAuth only, autoconfirm stays ON for now
Enable Google OAuth now; defer autoconfirm/SMTP decision until beta launch.

**Tradeoffs:**
- Fixes the P0 broken button immediately (high-visibility win)
- Autoconfirm ON means Google Tier-1 users (w=0.5) share the platform with
  unlimited Tier-0 fake-email accounts (w=0.05) — the identity ladder works but
  the sybil economics remain soft until autoconfirm is flipped
- Still acceptable during private beta with <50 real users; becomes problematic
  the moment the referral or Founding Critic mechanic is enabled
- SMTP decision deferred but must precede any mass email (waitlist digest, weekly movers)

### Option C — Email-only with autoconfirm OFF now, Google OAuth later
Flip autoconfirm OFF and configure SMTP, defer Google OAuth.

**Tradeoffs:**
- Removes the sybil pipe immediately
- Leaves the P0 broken button in place — every user who tries Google gets a JSON 400
  (currently the only signup path that is visibly broken)
- Not recommended: the interim patch (§E of RUNBOOK.md) hides the button, not fixes
  it; hiding the only social-login option before adding it is a downgrade

---

## Recommendation

**Option A.** Do both changes together, in the order specified in RUNBOOK.md.
Google OAuth first (fixes the P0), then autoconfirm OFF (flips the sybil economics),
with Resend as SMTP. The full sequence takes ~1 hour; implementation can start the
same day this gate is answered.

The interim code patch (hiding the Google button behind `NEXT_PUBLIC_GOOGLE_AUTH`)
should be deployed immediately regardless of which option is chosen, to prevent new
visitors from hitting the JSON 400 while the provider setup is in progress.

---

## Rollout Steps

See RUNBOOK.md (in this directory) for the exact console paths, curl commands, and
verification steps. High-level order:

1. Deploy interim patch (hide broken Google button) — no config change needed
2. Google Cloud Console: create OAuth 2.0 client ID
3. Supabase dashboard: enable Google provider, add redirect URI, add origins
4. Remove `NEXT_PUBLIC_GOOGLE_AUTH` guard (or set to `"1"`) + redeploy
5. Set up Resend account + generate API key
6. Supabase Management API: PATCH auth config — SMTP settings + autoconfirm=false + hibp=true
7. Verify the 1 stuck unconfirmed user (manual confirm or resend)
8. Smoke test: Google sign-in, email sign-up, confirmation email delivery

---

## Rollback Plan

**Google OAuth rollback:** Supabase dashboard → Authentication → Providers → Google →
disable. Takes effect immediately. No data loss; existing email users unaffected.

**autoconfirm rollback:** Supabase Management API PATCH or dashboard toggle
→ set `mailer_autoconfirm: true`. Existing confirmed users stay confirmed. New signups
revert to instant-confirm. The 1 currently-unconfirmed user stays unconfirmed either way.

**SMTP rollback:** revert SMTP fields to empty in Management API PATCH → Supabase
reverts to its internal rate-limited mailer. Acceptable for <5 signups/hour.

---

## Success Metrics

- GET `/auth/v1/authorize?provider=google` returns 302 (not 400) within 10s of setup
- New email signup with a real address receives confirmation email within 60s
- New email signup with a fake address (e.g. x@x.x) is accepted by the form but
  never receives a confirmation; the account stays unconfirmed
- No existing confirmed user (5 accounts) loses session or is forced to re-authenticate
- HaveIBeenPwned advisor clears from the security lints

---

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Resend domain not verified → emails land in spam | Medium | Use Supabase's default mailer during the few hours of setup; switch to Resend only after domain verification |
| The 1 stuck unconfirmed user can't sign in after autoconfirm OFF | Low | That account was already stuck (confirmation_sent_at 2026-04-11, never confirmed); manually confirm via dashboard or have them re-request |
| Google OAuth client misconfigured → 400 on callback | Medium | Test the authorize URL before merging the button-guard removal |
| SMTP rate limit hit before Resend is live | Low | Only 5 existing users; no referral mechanic is live; risk window is <1 hour |
| `mailer_autoconfirm` flag name differs across Supabase versions | Low | Verified field name in Management API v1 docs; curl command in RUNBOOK.md uses the correct key |

---

## Dependency map (Stage 0 sequencing)

Gate 5 (this gate) must be complete before:
- **Stage 2** (trust substrate): the `submit_verdict()` RPC stamps `identity_tier`; that
  field is meaningless if Google OAuth is off (no Tier-1 users exist) and if autoconfirm
  is ON (Tier-0 accounts are free)
- **Any public aggregate number** ("% would return · N diners"): engagement report §2
  phase 1 rollout states autoconfirm OFF is a hard prereq before any community stat renders
- **Founding Critic / referral mechanic** (Stage 6): engagement report §5 item 10
  explicitly states "turn autoconfirm OFF before any referral mechanic"

Gate 5 is INDEPENDENT of:
- Gate 1 (public read / middleware flip) — can proceed in parallel
- Gate 2 (community layer placement + reviews-table revival) — can proceed in parallel
- Gate 3 (Engagement decision gate in CLAUDE.md) — unrelated
- Gate 4 (trending decay formula) — unrelated
