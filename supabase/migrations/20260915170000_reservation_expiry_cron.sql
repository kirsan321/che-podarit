-- Auto-release unconfirmed reservations 14 days after the event date (see release_expired_reservations()).
create extension if not exists pg_cron with schema pg_catalog;
grant usage on schema cron to postgres;
select cron.schedule('release-expired-reservations', '15 3 * * *', $$select public.release_expired_reservations()$$);
