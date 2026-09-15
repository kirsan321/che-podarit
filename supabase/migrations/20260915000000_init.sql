-- Che Podarit: initial schema
-- Roles: recipient (authenticated owner of a wishlist) and giver (anonymous, identified by share token + giver_key cookie)

create extension if not exists pgcrypto;

-- ---------- enums ----------
create type item_kind as enum ('exact', 'direction');      -- exact product vs "something like this"
create type item_priority as enum ('want', 'nice');        -- "очень хочу" / "было бы приятно"
create type item_status as enum ('active', 'received');

-- ---------- profiles ----------
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now()
);

create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)));
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users for each row execute function handle_new_user();

-- ---------- wishlists ----------
create table wishlists (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles(id) on delete cascade,
  title text not null default 'Мой список',
  show_reservations boolean not null default false,   -- surprise mode: off by default
  created_at timestamptz not null default now()
);
create index wishlists_owner_idx on wishlists(owner_id);

-- ---------- wish items ----------
create table wish_items (
  id uuid primary key default gen_random_uuid(),
  wishlist_id uuid not null references wishlists(id) on delete cascade,
  kind item_kind not null default 'exact',
  title text not null,
  url text,
  image_url text,
  source text,                       -- wb | ozon | ym | other
  price numeric(12,2),               -- exact: reference price at add time
  price_min numeric(12,2),           -- direction: budget range
  price_max numeric(12,2),
  currency text not null default 'RUB',
  priority item_priority not null default 'nice',
  comment text,                      -- "size M", "any color but red"
  tags text[] not null default '{}',
  anti_tags text[] not null default '{}',
  occasion_tags text[] not null default '{}',
  visible boolean not null default true,   -- false = hidden from givers ("only me")
  status item_status not null default 'active',
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  received_at timestamptz
);
create index wish_items_wishlist_idx on wish_items(wishlist_id);

-- ---------- share links ----------
create table share_links (
  id uuid primary key default gen_random_uuid(),
  wishlist_id uuid not null references wishlists(id) on delete cascade,
  token text not null unique default encode(gen_random_bytes(24), 'base64url'),  -- 192 bits
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);
create index share_links_wishlist_idx on share_links(wishlist_id);

-- ---------- giver events ----------
create table giver_events (
  id uuid primary key default gen_random_uuid(),
  share_link_id uuid not null references share_links(id) on delete cascade,
  giver_key text not null,           -- anonymous id stored in the giver's cookie
  occasion text,
  event_date date,
  budget int,                        -- null = no limit
  created_at timestamptz not null default now()
);
create index giver_events_link_idx on giver_events(share_link_id);

-- ---------- reservations ----------
create table reservations (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references wish_items(id) on delete cascade,
  event_id uuid not null references giver_events(id) on delete cascade,
  created_at timestamptz not null default now(),
  confirmed_at timestamptz,          -- giver pressed "gifted"
  released_at timestamptz            -- cancelled or auto-expired
);
create unique index reservations_one_active_per_item on reservations(item_id) where released_at is null;
create index reservations_event_idx on reservations(event_id);

-- ---------- RLS: owners ----------
alter table profiles enable row level security;
alter table wishlists enable row level security;
alter table wish_items enable row level security;
alter table share_links enable row level security;
alter table giver_events enable row level security;
alter table reservations enable row level security;

create policy "own profile" on profiles for all using (id = auth.uid()) with check (id = auth.uid());
create policy "own wishlists" on wishlists for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "own items" on wish_items for all
  using (exists (select 1 from wishlists w where w.id = wishlist_id and w.owner_id = auth.uid()))
  with check (exists (select 1 from wishlists w where w.id = wishlist_id and w.owner_id = auth.uid()));
create policy "own share links" on share_links for all
  using (exists (select 1 from wishlists w where w.id = wishlist_id and w.owner_id = auth.uid()))
  with check (exists (select 1 from wishlists w where w.id = wishlist_id and w.owner_id = auth.uid()));
-- Owner may read reservations only when surprise mode is off; who reserved is never exposed (no join to giver_events for owners).
create policy "own reservations when allowed" on reservations for select
  using (exists (
    select 1 from wish_items i join wishlists w on w.id = i.wishlist_id
    where i.id = item_id and w.owner_id = auth.uid() and w.show_reservations
  ));
-- giver_events: no direct access for anyone; givers go through RPC below.

-- ---------- RPC for givers (anonymous, token-scoped) ----------
create or replace function resolve_link(p_token text) returns share_links
language sql security definer set search_path = public stable as $$
  select * from share_links where token = p_token and revoked_at is null
$$;

-- Public wishlist for givers: visible active items, no owner-only fields, reserved flag included.
create or replace function public_wishlist(p_token text)
returns table (
  wishlist_id uuid, owner_name text, item_id uuid, kind item_kind, title text, url text, image_url text,
  source text, price numeric, price_min numeric, price_max numeric, priority item_priority, comment text,
  tags text[], anti_tags text[], occasion_tags text[], reserved boolean
)
language sql security definer set search_path = public stable as $$
  select w.id, p.display_name, i.id, i.kind, i.title, i.url, i.image_url, i.source,
         i.price, i.price_min, i.price_max, i.priority, i.comment, i.tags, i.anti_tags, i.occasion_tags,
         exists (select 1 from reservations r where r.item_id = i.id and r.released_at is null)
  from share_links l
  join wishlists w on w.id = l.wishlist_id
  join profiles p on p.id = w.owner_id
  join wish_items i on i.wishlist_id = w.id
  where l.token = p_token and l.revoked_at is null and i.visible and i.status = 'active'
  order by i.sort_order, i.created_at
$$;

create or replace function create_giver_event(p_token text, p_giver_key text, p_occasion text, p_event_date date, p_budget int)
returns uuid language plpgsql security definer set search_path = public as $$
declare l share_links; v_id uuid;
begin
  l := resolve_link(p_token);
  if l.id is null then raise exception 'invalid_token'; end if;
  insert into giver_events (share_link_id, giver_key, occasion, event_date, budget)
  values (l.id, p_giver_key, p_occasion, p_event_date, p_budget) returning id into v_id;
  return v_id;
end $$;

-- Reserve an item for an event. Fails if already reserved by someone else.
create or replace function reserve_item(p_token text, p_giver_key text, p_event_id uuid, p_item_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare l share_links; v_id uuid;
begin
  l := resolve_link(p_token);
  if l.id is null then raise exception 'invalid_token'; end if;
  if not exists (select 1 from giver_events e where e.id = p_event_id and e.share_link_id = l.id and e.giver_key = p_giver_key)
    then raise exception 'invalid_event'; end if;
  if not exists (select 1 from wish_items i where i.id = p_item_id and i.wishlist_id = l.wishlist_id and i.visible and i.status = 'active')
    then raise exception 'invalid_item'; end if;
  insert into reservations (item_id, event_id) values (p_item_id, p_event_id) returning id into v_id;
  return v_id;
exception when unique_violation then
  raise exception 'already_reserved';
end $$;

create or replace function release_reservation(p_token text, p_giver_key text, p_reservation_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update reservations r set released_at = now()
  from giver_events e join share_links l on l.id = e.share_link_id
  where r.id = p_reservation_id and r.event_id = e.id and e.giver_key = p_giver_key and l.token = p_token and r.released_at is null;
end $$;

create or replace function confirm_reservation(p_token text, p_giver_key text, p_reservation_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update reservations r set confirmed_at = now()
  from giver_events e join share_links l on l.id = e.share_link_id
  where r.id = p_reservation_id and r.event_id = e.id and e.giver_key = p_giver_key and l.token = p_token;
end $$;

-- Auto-release unconfirmed reservations 14 days after the event date (called by cron).
create or replace function release_expired_reservations() returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  update reservations r set released_at = now()
  from giver_events e
  where r.event_id = e.id and r.released_at is null and r.confirmed_at is null
    and e.event_date is not null and e.event_date + 14 < current_date;
  get diagnostics n = row_count;
  return n;
end $$;

grant execute on function public_wishlist(text), create_giver_event(text,text,text,date,int),
  reserve_item(text,text,uuid,uuid), release_reservation(text,text,uuid), confirm_reservation(text,text,uuid)
  to anon, authenticated;
revoke execute on function resolve_link(text), release_expired_reservations() from anon, authenticated;
