-- Maintain restaurants.avg_rating / review_count from user reviews via trigger.
--
-- REVIEW BEFORE APPLYING. Replaces the racy client-side read-modify-write in
-- the review composer pages (review/new, restaurants/[id]/review), where two
-- concurrent submissions clobber each other's count. After applying, remove the
-- manual avg_rating/review_count updates from those client pages (the code
-- changes already stop writing them).
--
-- NOTE: this defines avg_rating as the mean of *user* review ratings for the
-- restaurant. Confirm this matches the intended meaning before applying — some
-- surfaces have historically shown google_rating in the same field.

create or replace function public.recompute_restaurant_rating(p_restaurant_id uuid)
returns void
language sql
as $$
  update restaurants r
  set review_count = sub.cnt,
      avg_rating   = sub.avg
  from (
    select count(*)::int as cnt,
           round(avg(rating)::numeric, 2) as avg
    from reviews
    where restaurant_id = p_restaurant_id
  ) sub
  where r.id = p_restaurant_id;
$$;

create or replace function public.reviews_aggregate_trigger()
returns trigger
language plpgsql
as $$
begin
  if (tg_op = 'DELETE') then
    perform public.recompute_restaurant_rating(old.restaurant_id);
    return old;
  end if;
  perform public.recompute_restaurant_rating(new.restaurant_id);
  -- On an UPDATE that moves a review between restaurants, refresh the old one too.
  if (tg_op = 'UPDATE' and new.restaurant_id is distinct from old.restaurant_id) then
    perform public.recompute_restaurant_rating(old.restaurant_id);
  end if;
  return new;
end $$;

drop trigger if exists trg_reviews_aggregate on reviews;
create trigger trg_reviews_aggregate
  after insert or update or delete on reviews
  for each row execute function public.reviews_aggregate_trigger();

-- Backfill existing rows once so counts are consistent at apply time.
update restaurants r
set review_count = coalesce(sub.cnt, 0),
    avg_rating   = sub.avg
from (
  select restaurant_id,
         count(*)::int as cnt,
         round(avg(rating)::numeric, 2) as avg
  from reviews
  group by restaurant_id
) sub
where r.id = sub.restaurant_id;
