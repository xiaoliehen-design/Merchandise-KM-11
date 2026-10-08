# KM11 Merchandise — Foto produk otomatis sesuai warna

Versi ini mengubah produk standar agar setiap warna memiliki foto tersendiri. Tidak ada perubahan pada harga, pesanan lama, autentikasi admin, atau desain e-money.

## WAJIB: Migrasi database satu kali

1. Buka Supabase Dashboard → proyek KM11 → SQL Editor → New query.
2. Salin dan jalankan isi `supabase/migrations/003_product_color_images.sql`.
3. Verifikasi hasil menampilkan dua kolom: `color_images` dan `color_image_paths`.
4. Deploy ZIP baru melalui repository GitHub yang terhubung ke Cloudflare. Tetap gunakan runtime secrets yang benar; tidak perlu variable baru.

Jangan jalankan `001_init.sql` ulang untuk proyek yang sudah berjalan. Migrasi 003 bersifat aditif dan bisa dijalankan ulang.

## Cara memakai

1. Login **Dashboard Admin → Produk → Edit** produk, misalnya "Payung KM11".
2. Tambahkan **Biru** dan **Putih** pada bagian Warna (Enter atau tombol Tambah).
3. Pada bagian **Foto untuk setiap warna**, unggah foto Biru untuk pilihan Biru dan foto Putih untuk pilihan Putih. Format JPG/PNG/WebP maks 5 MB per file.
4. Klik **Simpan produk**. Website menyimpan produk dahulu, lalu file tiap warna ke bucket Supabase `product-images`.
5. Buka katalog. Memilih Biru menampilkan foto Biru; memilih Putih menampilkan foto Putih. Foto warna yang dipilih juga dipakai sebagai thumbnail pada keranjang dan ringkasan checkout.

### Hal yang perlu diketahui

- Produk baru tidak bisa disimpan dengan pilihan warna yang belum memiliki foto. Ini menghindari katalog menampilkan warna A dengan foto B.
- Produk tanpa pilihan warna masih menggunakan foto produk utama seperti sebelumnya.
- Produk lama tanpa foto per warna tetap bisa ditampilkan menggunakan foto utama, tetapi saat diedit/disimpan kembali admin akan diminta mengunggah foto setiap warna.
- Kolom foto utama masih ada sebagai fallback, terutama untuk produk tanpa warna dan kartu e-money custom.
- Ketika foto warna diganti, gambar lama akan dibersihkan dari Supabase Storage setelah penyimpanan berhasil. Saat warna dihapus, referensi foto varian ikut dibersihkan.
- Jika sebagian upload mengalami error, jangan membuat produk baru lagi: buka produk yang sama dan ulangi penyimpanan. Script menyimpan ID produk hasil pembuatan pertama.
- URL foto varian disimpan di `color_images`, path pengelolaannya di `color_image_paths`. Keduanya adalah JSON object per produk, sehingga tidak perlu tabel foto tambahan.

## Cara verifikasi SQL

```sql
SELECT name, colors, color_images FROM public.products ORDER BY created_at DESC LIMIT 20;
```

Harus terlihat contoh seperti:

```json
{
  "Biru": "https://.../products/.../colors/blue.png",
  "Putih": "https://.../products/.../colors/white.png"
}
```

## Catatan deployment

Tidak perlu menambah Cloudflare Environment Variables khusus fitur ini. Jika muncul error `column products.color_images does not exist` atau `Could not find the color_images column`, migrasi 003 belum dijalankan (atau Supabase proyek yang diakses Worker berbeda).
