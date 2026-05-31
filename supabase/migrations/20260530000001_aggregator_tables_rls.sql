-- Aggregator tables RLS hardening.
--
-- REVIEW BEFORE APPLYING. Several aggregator tables were created outside the
-- migration history (dashboard/MCP) and may currently have RLS DISABLED, which
-- leaves them readable AND writable via the anon key. This migration enforces
-- the intended posture: public read-only, writes only via the service role
-- (which bypasses RLS, so the pipeline scripts keep working).
--
-- Idempotent: guarded on table existence; policies dropped-then-created.
-- Verify the live RLS state for each table first (a table the app reads that
-- ends up RLS-enabled with no SELECT policy will break the anon app).

do $$
declare
  t text;
  -- Public-facing aggregator data the app surfaces to anonymous visitors.
  public_read text[] := array[
    'restaurant_highlighted_dishes',
    'restaurant_top_dishes',
    'restaurant_menu_items',
    'restaurant_rating_snapshots',
    'restaurant_michelin_history',
    'restaurant_jbf_history',
    'restaurant_eater38_history'
  ];
  -- Internal/audit tables: anon gets no access; service role only.
  internal_only text[] := array[
    'restaurant_dish_signals',
    'restaurant_menu_fetches'
  ];
begin
  foreach t in array public_read loop
    if to_regclass(t) is not null then
      execute format('alter table %I enable row level security', t);
      execute format('drop policy if exists "Public read %1$s" on %1$I', t);
      execute format('create policy "Public read %1$s" on %1$I for select using (true)', t);
    end if;
  end loop;

  foreach t in array internal_only loop
    if to_regclass(t) is not null then
      execute format('alter table %I enable row level security', t);
      -- No policy = deny all to anon/authenticated; service role still bypasses.
    end if;
  end loop;
end $$;
