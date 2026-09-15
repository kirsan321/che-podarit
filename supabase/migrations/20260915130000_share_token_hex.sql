-- encode(..., 'base64url') is not a valid Postgres encoding; use hex (48 chars = 192 bits), URL-safe.
alter table share_links alter column token set default encode(gen_random_bytes(24), 'hex');
