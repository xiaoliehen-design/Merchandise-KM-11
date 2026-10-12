-- Merchic KM11 – kontak resmi, 12 Oktober 2026.
-- Jalankan setelah 001_init.sql. Aman dijalankan ulang.
-- Tidak mengubah pesanan, produk, harga, atau data pelanggan.
-- Disetel eksplisit mengikuti kontak resmi terbaru dari pengelola.
insert into public.app_settings (key, value, updated_at)
values
  ('social_whatsapp', '628113446578', now()),
  ('social_instagram', 'km_dkijakarta', now())
on conflict (key) do update
set value = excluded.value, updated_at = excluded.updated_at;
