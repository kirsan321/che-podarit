-- Lets the public page distinguish an empty-but-valid list from a revoked/unknown token.
create or replace function share_link_valid(p_token text) returns boolean
language sql security definer set search_path = public stable as $$
  select exists (select 1 from share_links where token = p_token and revoked_at is null)
$$;
grant execute on function share_link_valid(text) to anon, authenticated;
