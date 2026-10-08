-- KM11 Merchandise | perbaikan penyimpanan foto per warna
-- Jalankan pada proyek Supabase yang dipakai oleh Worker Production.
-- Aman dijalankan ulang; tidak menghapus akun, produk, foto, atau pesanan.
BEGIN;

DO $$
BEGIN
  IF to_regclass('public.products') IS NULL THEN
    RAISE EXCEPTION 'Tabel public.products belum ada. Pastikan proyek Supabase benar dan jalankan migrasi 003 FIXED terlebih dahulu.';
  END IF;
END $$;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS color_images jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS color_image_paths jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Bucket khusus merchandise: publik untuk gambar katalog, upload tetap hanya lewat backend berotorisasi.
-- Pastikan ukuran dan MIME type konsisten dengan validasi form dan Worker (maks. 5 MB).
INSERT INTO storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
VALUES ('product-images', 'product-images', true, 5242880,
        ARRAY['image/png','image/jpeg','image/webp']::text[])
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

COMMIT;

SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'products'
  AND column_name IN ('color_images','color_image_paths')
ORDER BY column_name;

SELECT id, public, file_size_limit, allowed_mime_types
FROM storage.buckets
WHERE id = 'product-images';
