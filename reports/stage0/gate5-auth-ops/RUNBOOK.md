# RUNBOOK — Gate 5: Operational Auth

**Execute in the order listed. Steps marked BLOCKER must complete before the next step.**

---

## Step 1 — Deploy the interim code guard (BLOCKER: do first, takes 5 min)

Deploy the draft patch `google-button-guard.patch` (in this directory) before touching
any Supabase config. This prevents new visitors from hitting the JSON 400 while the
OAuth client is being configured.

```
cd /path/to/epicurious
git apply reports/stage0/gate5-auth-ops/google-button-guard.patch
# Verify: NEXT_PUBLIC_GOOGLE_AUTH is not set → Google buttons hidden
# Push + trigger Vercel deploy
```

The patch hides the Google button when `NEXT_PUBLIC_GOOGLE_AUTH` is unset or `"0"`.
You will un-hide it in Step 4 after verifying the OAuth client works.

---

## Step 2 — Google Cloud OAuth client creation

**Console path:** https://console.cloud.google.com/apis/credentials

1. Select (or create) the project you use for Gastronome's Maps/Places keys.
2. Click **Create Credentials → OAuth client ID**.
3. Application type: **Web application**.
4. Name: `Gastronome Supabase Auth` (or similar).
5. **Authorized JavaScript origins** — add both:
   - `https://gastronome.vercel.app`
   - `https://trwdqzsfgeydafojajbh.supabase.co`
6. **Authorized redirect URIs** — add exactly:
   - `https://trwdqzsfgeydafojajbh.supabase.co/auth/v1/callback`
7. Click **Create**. Copy the **Client ID** and **Client Secret** — you will need them
   in Step 3.

> Note: if you have a custom domain (e.g. gastronome.app), add it to Authorized
> JavaScript origins now. You can add more origins later without re-creating the client.

**Verification:** the OAuth consent screen must be configured (user type: External,
scopes: email + profile + openid). For testing with <100 users you can stay in
"Testing" mode; move to "In production" before broad public launch.

---

## Step 3 — Supabase: enable Google provider + URL configuration (BLOCKER)

### 3a. Enable the Google provider

**Dashboard path:**
https://supabase.com/dashboard/project/trwdqzsfgeydafojajbh/auth/providers

1. Find **Google** in the provider list.
2. Toggle **Enable Sign in with Google** → ON.
3. Paste **Client ID** and **Client Secret** from Step 2.
4. Click **Save**.

### 3b. Add redirect URLs to the allowlist

**Dashboard path:**
https://supabase.com/dashboard/project/trwdqzsfgeydafojajbh/auth/url-configuration

Under **Redirect URLs**, add:
- `https://gastronome.vercel.app/**`
- `http://localhost:3000/**` (for local dev; remove before public launch if desired)

The trailing `/**` glob covers all callback paths (e.g. `/auth/callback?next=/`).

**Verify:** `curl -I "https://trwdqzsfgeydafojajbh.supabase.co/auth/v1/authorize?provider=google&redirect_to=https://gastronome.vercel.app/auth/callback"` should return **302**, not 400.

---

## Step 4 — Enable the Google button in the app (un-hide)

Set the env var in Vercel and redeploy:

**Dashboard path:** https://vercel.com/your-team/epicurious/settings/environment-variables

Add (Production + Preview scope):
```
NEXT_PUBLIC_GOOGLE_AUTH=1
```

Trigger a redeploy (Vercel → Deployments → Redeploy, or push a commit).

**Verify end-to-end:** open https://gastronome.vercel.app, trigger the sign-in modal,
click "Sign in with Google" → should redirect to accounts.google.com, not a JSON page.

---

## Step 5 — SMTP decision and setup (BLOCKER before Step 6)

### Why this is now load-bearing

With `mailer_autoconfirm=false` (Step 6), every new email signup requires a
confirmation email to be delivered within ~24 hours (Supabase default OTP expiry).
The **Supabase built-in mailer is rate-limited at ~3 emails/hour** and is explicitly
not for production use.

### Provider comparison

| Provider | Free tier | Setup complexity | Deliverability | Recommendation |
|---|---|---|---|---|
| **Resend** | 3,000 emails/month, 100/day free | Low — API key + DNS (2 records) | Excellent; built for devs | **Recommended** |
| **Postmark** | 100 emails/month free (dev) | Medium — account approval ~24h | Excellent; strong transactional reputation | Good choice if already using Postmark |
| **AWS SES** | 62,000 emails/month free (if sending from EC2) | High — IAM policy, SMTP creds, domain verification | Excellent at scale | Overkill for <1,000 users/month |
| **Supabase built-in** | Rate-limited ~3/hr | Zero | Poor for production | Beta only, not for launch |

**Recommendation: Resend.** Setup takes ~20 minutes (DNS propagates in ~10 min),
free tier covers Gastronome's entire early growth phase (3,000/month), and
Supabase has a first-party Resend integration in the dashboard.

### Resend setup steps

1. Create account at https://resend.com
2. Add and verify your domain (add the 2 DNS records Resend provides — SPF + DKIM).
   Use the same domain as your From address (e.g. `noreply@gastronome.app` or
   `noreply@yourdomain.com`). DNS propagation: typically 5-10 min.
3. Generate an API key (Resend dashboard → API Keys → Create).
4. In Supabase dashboard → Authentication → SMTP Settings:
   - SMTP Host: `smtp.resend.com`
   - Port: `465` (SSL) or `587` (TLS)
   - User: `resend`
   - Password: your Resend API key
   - Sender name: `Gastronome`
   - Sender email: `noreply@yourdomain.com`

**Alternatively**, use the Management API PATCH in Step 6 to set all SMTP fields at once.

---

## Step 6 — Management API PATCH: autoconfirm OFF + HIBP ON + SMTP

The Supabase Management API lets you set auth config programmatically. This uses a
**Management API personal access token** (create at
https://supabase.com/dashboard/account/tokens) — NOT the project service role key.
Replace `<YOUR_SUPABASE_MANAGEMENT_API_TOKEN>` in the curl below with that token.

```bash
# Replace all <...> placeholders before running.
curl -X PATCH \
  "https://api.supabase.com/v1/projects/trwdqzsfgeydafojajbh/config/auth" \
  -H "Authorization: Bearer <YOUR_SUPABASE_MANAGEMENT_API_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "mailer_autoconfirm": false,
    "password_hibp_enabled": true,
    "smtp_admin_email": "noreply@yourdomain.com",
    "smtp_host": "smtp.resend.com",
    "smtp_port": "465",
    "smtp_user": "resend",
    "smtp_pass": "<RESEND_API_KEY>",
    "smtp_sender_name": "Gastronome",
    "smtp_max_frequency": 60
  }'
```

**Important:** the Management API token is different from your service role key.
Get it at: https://supabase.com/dashboard/account/tokens

**Important (overseer note):** `smtp_port` is a *string* in the Management API auth-config
schema — sending a bare number can be rejected. The curl above uses `"465"`.

**Important (plan check — OWNER):** Supabase **leaked password protection (HIBP) is a
Pro-plan feature**. If this project is on the Free plan, `password_hibp_enabled: true`
will be rejected (or the dashboard toggle will be locked) and the
`auth_leaked_password_protection` advisor WARN cannot be cleared. If on Free plan: drop
`"password_hibp_enabled": true` from the PATCH, proceed with the rest, and either accept
the WARN or upgrade. Confirm the project plan before running Step 6.

**Alternative (dashboard-only path, no curl):**

1. Dashboard → Authentication → Email → **Confirm email** toggle → ON (this sets autoconfirm=false)
2. Dashboard → Authentication → SMTP Settings → fill in the Resend fields from Step 5
3. Dashboard → Authentication → Security → **Leaked password protection** → ON

The dashboard path and the curl PATCH are equivalent; use whichever you prefer.

---

## Step 7 — Handle the 1 stuck unconfirmed user

One user (`homehomeliberty@gmail.com`, created 2026-04-11) has never confirmed their
email. After autoconfirm is OFF this account remains unconfirmed. Options:

**Option A (recommended):** manually confirm via dashboard →
Authentication → Users → find the account → "Confirm user" button.
This allows them to sign in without re-confirming.

**Option B:** leave it. The account has never signed in (last_sign_in_at is null).
If they return, they can use "Forgot password" or request a new confirmation email.

---

## Step 8 — Smoke test checklist

- [ ] GET `/auth/v1/authorize?provider=google&redirect_to=https://gastronome.vercel.app/auth/callback`
      returns 302 (not 400)
- [ ] Sign in with Google on https://gastronome.vercel.app → redirects to Google → returns to app
- [ ] New email signup with a real address → confirmation email arrives within 60s
- [ ] New email signup → unconfirmed user cannot sign in before confirming
- [ ] Existing confirmed user (e.g. dakai.research@gmail.com) can still sign in
- [ ] HIBP: attempt to sign up with password "password123" → rejected with leaked-password error
- [ ] Supabase security advisor → `auth_leaked_password_protection` advisory clears

---

## Sequencing relative to other Stage 0 gates

| Dependency | Gate 5 relationship |
|---|---|
| Gate 1 (public read) | Independent; can run in parallel |
| Gate 2 (reviews table revival) | Independent; can run in parallel |
| Stage 2 trust substrate (submit_verdict RPC) | Gate 5 MUST complete first; identity_tier stamping is meaningless without Google OAuth |
| Any public community aggregate number | Gate 5 MUST complete first; §2 phase 1 rollout is explicit |
| Founding Critic / referral mechanic | Gate 5 MUST complete first; §5 item 10 is explicit |
| Weekly movers digest email | Resend (Step 5) must be configured first; otherwise bulk email uses the rate-limited built-in mailer |
