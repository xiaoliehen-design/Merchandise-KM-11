-- OPTIONAL, no schema change needed.
-- The Worker will automatically create launch_name on first admin save.
-- Applying this adds the default title without overwriting a customized name.
insert into public.app_settings (key, value)
values ('launch_name', 'Diskon launching')
on conflict (key) do nothing;
