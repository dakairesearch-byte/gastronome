-- User bookmarks + collections (cross-device persistence).
--
-- REVIEW BEFORE APPLYING. Bookmarks/collections were previously
-- localStorage-only, so saves vanished on any device switch and were
-- destroyed by "Clear Site Data". This adds per-user server-side
-- storage. The client (src/lib/collections.ts) keeps localStorage as a
-- synchronous cache and syncs through to these tables when signed in;
-- it degrades gracefully to localStorage-only if these tables are
-- absent, so shipping the client code before applying this migration
-- is safe.
--
-- RLS posture: each user can only see and mutate their OWN rows. The
-- anon key cannot read anyone's saves. Idempotent: tables guarded with
-- IF NOT EXISTS; policies dropped-then-created.

-- ---------- favorites (flat bookmark list) ----------
create table if not exists user_favorites (
  user_id       uuid not null references auth.users (id) on delete cascade,
  restaurant_id uuid not null references restaurants (id) on delete cascade,
  created_at    timestamptz not null default now(),
  primary key (user_id, restaurant_id)
);

-- Newest-first reads per user ("Your Favorites" rail).
create index if not exists user_favorites_user_created_idx
  on user_favorites (user_id, created_at desc);

-- ---------- named collections ----------
create table if not exists user_collections (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  name       text not null check (char_length(name) between 1 and 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists user_collections_user_idx
  on user_collections (user_id, created_at desc);

-- ---------- collection membership ----------
create table if not exists user_collection_items (
  collection_id uuid not null references user_collections (id) on delete cascade,
  restaurant_id uuid not null references restaurants (id) on delete cascade,
  added_at      timestamptz not null default now(),
  primary key (collection_id, restaurant_id)
);

create index if not exists user_collection_items_collection_idx
  on user_collection_items (collection_id, added_at desc);

-- ---------- RLS ----------
alter table user_favorites        enable row level security;
alter table user_collections      enable row level security;
alter table user_collection_items enable row level security;

-- Favorites: full CRUD on own rows only.
drop policy if exists "own favorites" on user_favorites;
create policy "own favorites" on user_favorites
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Collections: full CRUD on own rows only.
drop policy if exists "own collections" on user_collections;
create policy "own collections" on user_collections
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Collection items: access gated through ownership of the parent
-- collection (the item table has no user_id of its own).
drop policy if exists "own collection items" on user_collection_items;
create policy "own collection items" on user_collection_items
  for all
  using (
    exists (
      select 1 from user_collections c
      where c.id = user_collection_items.collection_id
        and c.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from user_collections c
      where c.id = user_collection_items.collection_id
        and c.user_id = auth.uid()
    )
  );
