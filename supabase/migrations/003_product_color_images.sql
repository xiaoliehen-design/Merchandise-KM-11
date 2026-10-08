-- KM11 Merchandise — foto spesifik untuk setiap varian warna
-- Jalankan SATU KALI di Supabase SQL Editor pada proyek yang sudah berisi tabel products.
-- Aman dijalankan ulang; tidak menghapus produk, foto utama, ataupun pesanan.

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS color_images jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS color_image_paths jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.products.color_images IS
  'Peta nama warna persis seperti kolom colors ke public URL foto warna.';
COMMENT ON COLUMN public.products.color_image_paths IS
  'Peta nama warna ke path file di bucket product-images untuk penggantian dan pembersihan.';

-- Konfirmasi kolom baru (tidak menampilkan credential).
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'products'
  AND column_name IN ('color_images', 'color_image_paths')
ORDER BY column_name;
