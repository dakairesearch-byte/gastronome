-- Defense-in-depth for waitlist_signups (created in 20260531000003).
-- RLS already blocks reads (only an INSERT policy exists), but the table-level
-- SELECT grant to the API roles still existed. Revoke it so the grant matches
-- the insert-only intent — emails are PII; only the service role reads this.
REVOKE SELECT ON public.waitlist_signups FROM anon;
REVOKE SELECT ON public.waitlist_signups FROM authenticated;
