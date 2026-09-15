-- Events created by an anonymous giver (identified by the giver_key cookie), with their active reservations.
-- Used by the "Daryu" tab and by the deck page to validate that an event belongs to the caller.
create or replace function my_giver_events(p_giver_key text)
returns table (
  event_id uuid, token text, link_revoked boolean, recipient_name text, occasion text, event_date date,
  budget int, created_at timestamptz, reserved_count int, reserved_items jsonb
)
language sql security definer set search_path = public stable as $$
  select e.id, l.token, l.revoked_at is not null, p.display_name, e.occasion, e.event_date, e.budget, e.created_at,
    (select count(*) from reservations r where r.event_id = e.id and r.released_at is null)::int,
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'reservation_id', r.id, 'item_id', i.id, 'kind', i.kind, 'title', i.title, 'url', i.url,
        'image_url', i.image_url, 'source', i.source, 'price', i.price, 'price_min', i.price_min,
        'price_max', i.price_max, 'confirmed', r.confirmed_at is not null) order by r.created_at)
      from reservations r join wish_items i on i.id = r.item_id
      where r.event_id = e.id and r.released_at is null), '[]'::jsonb)
  from giver_events e
  join share_links l on l.id = e.share_link_id
  join wishlists w on w.id = l.wishlist_id
  join profiles p on p.id = w.owner_id
  where p_giver_key is not null and length(p_giver_key) >= 16 and e.giver_key = p_giver_key
  order by e.created_at desc
$$;

grant execute on function my_giver_events(text) to anon, authenticated;
