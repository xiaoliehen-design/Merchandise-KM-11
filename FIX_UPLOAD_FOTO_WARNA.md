# KM11 Merchandise — perbaikan upload foto per warna

## Apa yang diperbaiki?

- Respons JSON yang berisi error object sekarang tidak berubah menjadi `[object Object]`.
- Error foto warna menyebutkan warna, tahap (Storage/DB), dan alasan dari Supabase.
- Bila foto Biru sudah tersimpan tetapi Putih gagal, form mempertahankan foto Biru dan hanya Putih yang perlu dicoba ulang.
- Ada tombol **Periksa penyimpanan foto** pada halaman **Admin > Produk**. Diagnosis dilakukan di backend yang sudah memverifikasi sesi admin; tidak menampilkan API key.
- Endpoint internal: `GET /api/admin/products/upload-check` (memerlukan Bearer token admin). Diagnosis mengecek kolom foto warna dan pengaturan bucket `product-images`.
- Kolom database dan konfigurasi bucket dijaga melalui migrasi tambahan `supabase/migrations/005_color_photo_upload_repair.sql`.

## Cara menerapkan (urutannya penting)

1. Login Supabase Dashboard pada **proyek yang sama** dengan `SUPABASE_URL` runtime Cloudflare Production.
2. Buka **SQL Editor**. Jalankan `supabase/migrations/005_color_photo_upload_repair.sql`. Ini tidak menghapus akun, produk, atau pesanan; hanya memastikan dua kolom foto warna serta bucket `product-images` dengan konfigurasi gambar yang benar.
3. Ekstrak ZIP fullstack ini. Salin isi folder `km11-merch-store` untuk mengganti repository GitHub (bukan menambah folder `km11-merch-store` di dalam root jika aplikasi sekarang berada di root). Commit dan push, lalu tunggu Cloudflare deploy berhasil.
4. Masuk ke **Admin > Produk > Periksa penyimpanan foto**. Hasil yang diharapkan: `Database dan bucket foto tampak siap.`
5. Edit produk payung, pastikan varian **Biru** dan **Putih** sudah ada. Unggah foto masing-masing, lalu klik **Simpan produk**.
6. Di katalog, pilih Biru dan Putih bergantian. Foto harus berubah sesuai warna; gambar yang dipilih ikut masuk keranjang.

## Jika tombol pemeriksaan menyebutkan masalah

- **Kolom foto warna bermasalah:** jalankan ulang migrasi 005, pastikan SQL Editor dan Cloudflare menunjuk proyek yang sama.
- **Bucket belum ada/bermasalah:** migrasi 005 membuat atau memperbaiki bucket `product-images`. Periksa menu **Storage** di Supabase.
- **MIME/ukuran:** gunakan JPG, PNG, WebP maksimal 5 MB per file.
- **Gagal izin upload:** pastikan runtime Cloudflare Production memiliki `SUPABASE_SERVICE_ROLE_KEY` yang benar dari proyek yang sama; jangan menaruh key tersebut di frontend/GitHub.
- **Masih error:** salin teks error lengkap yang ditampilkan di Admin, **tanpa menyertakan key atau password**. Jangan hapus akun/produk untuk mencoba memperbaikinya.

## Cek database setelah upload

```sql
SELECT name, colors, color_images, color_image_paths
FROM public.products
WHERE lower(name) LIKE '%payung%'
ORDER BY created_at DESC;
```

`color_images` harus berisi URL berbeda untuk warna Biru dan Putih. Jika kolom tersebut kosong, foto belum berhasil di-upload/disimpan.

## Catatan testing

Tes lokal: pengujian pemilihan foto warna, parsing error, validasi sintaks file TS/TSX, dan self-test proyek. Build production dan koneksi Supabase proyek aktif harus diperiksa setelah deployment.
