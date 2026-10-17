# Pembaruan Merchic KM11 — Nama Promo & Harga XXL+

**Tanggal:** 17 Oktober 2026

## Yang berubah

1. Pada `/admin` → **Promo & diskon**, ada field **Nama promo yang tampil ke pembeli**. Bisa ditulis `Diskon launching`, `Promo Hari Guru`, `Promo Spesial KM11`, dan sebagainya (3–80 karakter). Tekan **Simpan pengaturan promo**. Nama tersebut tampil di bagian penawaran landing page, rincian potongan checkout, dan tanda terima setelah order dibuat. Diskon produk biasa tetap antara **15–20%** dan diskon paket tetap **15–20%**. Batas akhir dan checkbox aktif/nonaktif tetap berfungsi.
2. Pakaian berukuran **XXL, 2XL, XXXL, 3XL, 4XL, dst.** mendapat **tambahan Rp15.000 per item**, dihitung otomatis dari ukuran yang dipilih, bukan dari perubahan harga dasar di database. Ukuran **XL dan lebih kecil tidak terkena tambahan biaya**. Di paket, satu item XXL = +Rp15.000; dua item XXL = +Rp30.000. Tambahan diterapkan **sebelum diskon** dan mengikuti persentase reguler atau paket masing-masing.
3. Estimasi checkout dan pembuatan order memverifikasi produk, paket, ukuran, dan harga dari server Supabase. Biaya tambahan masuk ke subtotal, basis diskon, total akhir, dan `order_items.unit_price` / `line_total` yang tersimpan. Keranjang lama otomatis dihitung ulang pada saat checkout.
4. Diskon **10% untuk subtotal sebelum diskon di atas Rp500.000** dan **kode promo tambahan** tidak diubah.

## Deploy

1. Buat cadangan repositori produksi, lalu replace isi proyek memakai ZIP ini dan push ke repo GitHub yang sudah terhubung ke Cloudflare.
2. Deploy Cloudflare Workers/Assets seperti sebelumnya (`npm install`, `npm run build`, atau `npm run deploy` sesuai konfigurasi). Tidak perlu mengubah variabel/secrets Cloudflare.
3. Tidak perlu migrasi database baru. Kolom `app_settings` lama sudah dapat menampung nama promo baru. Jika ingin menambahkan nama default sebelum pertama kali disimpan, jalankan SQL **opsional** `supabase/migrations/010_promo_display_name.sql` (membutuhkan tabel `app_settings` dari migrasi 001). SQL ini tidak menimpa pengaturan yang sudah ada.
4. Masuk dashboard → **Promo & diskon**, ubah namanya, tekan simpan, lalu refresh halaman storefront dan checkout untuk melihat nama baru.
5. Uji harga untuk produk yang memiliki ukuran S/XL, XXL, 2XL/3XL, dan paket yang memuat pakaian XXL. Pastikan subtotal **sebelum diskon** bertambah Rp15.000 untuk setiap pakaian XXL+.
6. Jalankan `npm run test:promos` dan `npm run test:oversize` setelah dependency terpasang. Tes mencakup validasi harga server dan beberapa skenario ukuran/paket.

## Contoh nominal (sebelum ongkir & kode promo)

| Kasus | Harga dasar | Tambahan ukuran | Diskon otomatis | Harga setelah diskon |
|---|---:|---:|---:|---:|
| Kaos XL, promo produk 15% | Rp100.000 | Rp0 | Rp15.000 | Rp85.000 |
| Kaos XXL, promo produk 15% | Rp100.000 | Rp15.000 | Rp17.250 | Rp97.750 |
| Paket yang memuat dua pakaian XXL+, promo paket 20% | Rp160.000 | Rp30.000 | Rp38.000 | Rp152.000 |

*Contoh di atas menggunakan harga ilustratif. Jika subtotal asli melebihi Rp500.000 atau menggunakan kode promo, potongan tambahan berlaku sesuai aturan yang sudah ada.*

## Kompatibilitas & catatan

- Data lama pada `orders`, `order_items`, `products`, dan `product_bundles` **tidak diubah secara massal**. Riwayat pesanan yang telah tersimpan tidak dihitung ulang.
- Nama promo merupakan **label tampilan**, bukan nama field database. Kolom teknis lama (`launch_*`) sengaja tetap dipertahankan agar kompatibel dengan pelaporan dan migrasi yang sudah ada.
- Berlaku bagi item yang tercatat mempunyai pilihan ukuran baju XXL ke atas pada katalog; kartu e-money dikecualikan.
- Penghitungan ulang selalu dilakukan saat quote dan saat order; tidak cukup hanya mengubah angka harga di browser.
