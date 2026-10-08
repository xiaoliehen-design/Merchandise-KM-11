-- KM11 Merchandise - admin account upgrade
-- Safe to run after an earlier version of 001_init.sql.

alter table public.admins add column if not exists display_name text;
update public.admins
set display_name = username
where display_name is null or btrim(display_name) = '';
