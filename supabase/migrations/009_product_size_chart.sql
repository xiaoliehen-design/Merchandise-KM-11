-- Merchic KM11 | Size chart per produk
-- Jalankan pada Supabase SQL Editor SEBELUM deploy Worker baru.
-- Aman dijalankan berulang kali; tidak menghapus produk atau foto lama.
BEGIN;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS size_chart_url text;
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS size_chart_path text;

COMMENT ON COLUMN public.products.size_chart_url IS
  'Public URL panduan ukuran opsional untuk ditampilkan di katalog dan pemilihan paket.';
COMMENT ON COLUMN public.products.size_chart_path IS
  'Path file panduan ukuran di bucket product-images untuk ganti/hapus.';

COMMIT;

SELECT column_name, data_type FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'products'
  AND column_name IN ('size_chart_url', 'size_chart_path')
ORDER BY column_name;
