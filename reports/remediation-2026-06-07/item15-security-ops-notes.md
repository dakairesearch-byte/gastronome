# Item 15b/15c — Security & Ops notes

**Worker:** W5-security-ops · **Date:** 2026-06-07

---

## 15b — Enable leaked-password protection (HaveIBeenPwned)

**Status:** NOT applied — requires owner action in the dashboard. `needsOwnerApproval = true`.

**Why not auto-applied:** This is a GoTrue **Auth config** flag, not a database
object. None of the available Supabase MCP tools (`execute_sql`,
`apply_migration`, `list_tables`, `get_advisors`, `generate_typescript_types`,
`search_docs`, branch/project mgmt) can toggle Auth settings. It cannot be set
via SQL. It must be changed in the dashboard or via the Management API.

**Exact dashboard step:**
1. Open https://supabase.com/dashboard/project/trwdqzsfgeydafojajbh/auth/providers
   (or **Authentication → Policies / Password settings**, depending on dashboard version:
   **Authentication → Configuration → Password / Sign In & Up**).
2. Find **"Leaked password protection"** (a.k.a. "Check passwords against HaveIBeenPwned").
3. Toggle it **ON** and Save.

**Alternative (Management API, owner runs with a personal access token):**
```bash
curl -X PATCH \
  "https://api.supabase.com/v1/projects/trwdqzsfgeydafojajbh/config/auth" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"password_hibp_enabled": true}'
```

**Verify:** re-run the security advisor; the
`auth_leaked_password_protection` WARN should disappear.

Ref: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

---

## 15c — Remaining `get_advisors` security/perf warnings (for the final report)

Captured after Items 13 & 14 were applied (2026-06-07).

### Cleared by this remediation
- **`rls_disabled_in_public` (ERROR ×16)** → **all cleared** by Item 14. The 16
  backup/scratch tables now have RLS enabled (no policy = service_role-only). They
  now show only as `rls_enabled_no_policy` (INFO), which is the intended secure
  end-state for service-role-only tables.
- **profiles.email anon exposure** → hardened by Item 13 (column SELECT on
  `email` restricted to `service_role`; anon/authenticated denied).

### Still open (NOT in W5 items 13–15 scope to fix; flagged for owner / schema-guardian)

1. **`extension_in_public` (WARN ×2)** — `pg_trgm` and `unaccent` are installed in
   the `public` schema.
   - Remediation: move to a dedicated `extensions` schema:
     `ALTER EXTENSION pg_trgm SET SCHEMA extensions;`
     `ALTER EXTENSION unaccent SET SCHEMA extensions;`
   - **Decision-gated / risky:** any view, index, generated column, or function
     using `similarity()`, `%` operator, `unaccent()`, or trigram GIN/Gist indexes
     resolves these unqualified via `search_path`. Moving the schema can break
     those call sites and indexes until `search_path`/qualified names are updated.
     Do NOT move blindly — audit dependents first, then schedule. `needsOwnerApproval`.
   - Ref: https://supabase.com/docs/guides/database/database-linter?lint=0014_extension_in_public

2. **`rls_policy_always_true` (WARN ×1)** — `public.waitlist_signups` has an
   INSERT policy `"Anyone can join waitlist"` with `WITH CHECK (true)` for
   `anon, authenticated`. This is *probably intentional* (a public waitlist needs
   open INSERT), but it lets anyone insert arbitrary rows.
   - Suggested hardening (optional, behavior-preserving for legit signups): add a
     lightweight CHECK so only well-formed rows insert, e.g.
     `WITH CHECK (email IS NOT NULL AND char_length(email) <= 320)`, plus a unique
     index on `email` and rate-limiting at the edge. Confirm intent before changing
     (changing an INSERT policy is decision-gated). `needsOwnerApproval`.
   - Ref: https://supabase.com/docs/guides/database/database-linter?lint=0024_permissive_rls_policy

3. **`rls_enabled_no_policy` (INFO, many tables)** — expected/benign. Applies to
   the 16 Item-14 tables plus pre-existing service-role-only tables
   (`fetch_logs`, `restaurant_menu_fetches`, `dish_dict`, `accolades_*`,
   `video_dish_mentions`, etc.). INFO level = no anon exposure; safe to leave.
   If any of these *should* be anon-readable, add an explicit SELECT policy — but
   none appear to need it (they are internal pipeline/audit tables).

### Performance advisors
Not separately fetched here (out of items 13–15 scope). Recommend a dedicated
`get_advisors(type=performance)` pass during the final report — unindexed FKs and
unused-index notices commonly appear and are cheap wins, but none were touched by
W5's changes.
