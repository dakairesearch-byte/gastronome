-- Reviews are being removed from the product (Gastronome is now a pure
-- aggregator — no user-authored reviews). Tear down the review-rating
-- aggregation machinery added in 20260530000002_review_aggregate_trigger.sql:
--   - trg_reviews_aggregate (trigger on reviews)
--   - reviews_aggregate_trigger() (the trigger function)
--   - recompute_restaurant_rating(uuid) (the helper it called)
--
-- All guarded with IF EXISTS so this is safe to run whether or not the prior
-- migration was applied, and idempotent on re-run. The `reviews` table itself
-- and restaurants.avg_rating/review_count columns are left alone here — column
-- removal (if desired) belongs in a separate migration to keep this scoped to
-- undoing the trigger.

-- Drop the trigger first (depends on the function). The trigger only exists if
-- the `reviews` table still exists; guard with a table check to avoid erroring
-- on a "relation does not exist" if reviews was already dropped elsewhere.
do $$
begin
  if exists (
    select 1 from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where c.relname = 'reviews' and n.nspname = 'public'
  ) then
    execute 'drop trigger if exists trg_reviews_aggregate on public.reviews';
  end if;
end $$;

-- Drop the trigger function and the rating-recompute helper.
drop function if exists public.reviews_aggregate_trigger();
drop function if exists public.recompute_restaurant_rating(uuid);
