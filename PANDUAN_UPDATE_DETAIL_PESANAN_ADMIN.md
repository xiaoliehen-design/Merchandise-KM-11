# Merchic KM11 — Update Daftar Pesanan & Export Excel (13 Oktober 2026)

## Yang berubah

1. **Admin > Pesanan > kolom Item:** setiap produk sekarang menampilkan `Warna: ...` dan/atau `Ukuran: ...` bila nilai tersedia. Urutan mengikuti `checkout_line_index`, sehingga variant per item tidak tertukar; nilai historis dibaca dari `order_items`, bukan dari produk saat ini. Nama custom dan tautan unduh desain e-money tetap tersedia.
2. **Kolom Metode kirim / Pickup:** jika `Kirim`, tampilkan kurir (contoh JNE/J&T), layanan (REG/YES, jika ada), tujuan pengiriman (jika ada) dan nomor resi (jika telah diinput). Jika `Ambil di tempat`, tampilkan nama dan alamat lokasi serta jadwal slot yang dipilih. Waktu slot dikonversi ke **WIB (Asia/Jakarta)** dan menunjukkan awal–akhir.
3. **Export Excel:** workbook berisi tiga sheet: `Orders` (rincian order + daftar item, warna/ukuran per item, layanan kirim, pickup), `Items` (satu baris per produk lengkap varian + metode pemenuhan), `Summary` (rekap). Kolom lama seperti `Kurir`, `Resi`, `Warna`, dan `Ukuran` dipertahankan.
4. **Filter ekspor:** Excel memuat order yang terlihat sesuai filter status dan kolom pencarian. Untuk semua order, pilih `Semua status` dan kosongkan pencarian. Jika tidak ada hasil, ekspor tidak dijalankan dan muncul pesan.

## Sumber data

- `public.order_items.variant_color` dan `public.order_items.variant_size` menyimpan varian yang dibeli.
- `public.orders.shipping_courier`, `shipping_service`, `shipping_destination_label`, `tracking_number` menyimpan info pengiriman.
- `public.orders.pickup_location_name`, `pickup_location_address`, `pickup_slot_starts_at`, `pickup_slot_ends_at` menyimpan snapshot informasi pengambilan.

**Tidak perlu migrasi SQL tambahan**: semua kolom di atas sudah disediakan dalam migrasi sebelumnya. Order lama yang tidak menyimpan atribut tertentu akan menampilkan `Belum tercatat` (atau mengosongkan kolom Excel), bukan membuat nilai asumsi. Jika order sudah terhapus dari database, update ini tidak mengembalikan data tersebut.

## Cara menerapkan

1. Pastikan database Supabase sudah menjalankan seluruh migrasi sebelumnya (`001` sampai `008`). Pembaruan kali ini tidak mengubah tabel.
2. Ekstrak ZIP fullstack terbaru. Replace project GitHub Merchic dengan isi folder `km11-merch-store` (pertahankan secret dan environment variables Cloudflare di dashboard).
3. Deploy ulang Cloudflare Worker/Pages sesuai proses yang telah digunakan. Buka dashboard admin dan lakukan refresh browser (Ctrl+F5).
4. Buka menu `Pesanan`, coba buka pesanan `Kirim` dan `Pickup`, pastikan varian dan rincian pengiriman tampil. Klik `Export Excel` dan periksa sheet `Orders` dan `Items`.

## QA dan pengujian

- `node --experimental-strip-types scripts/test-orders-admin.mjs` (Node 22+) menguji varian, urutan item, informasi kurir dan layanan, slot pickup WIB, serta isi pemetaan data ekspor.
- `node scripts/self-test.mjs`
- `node scripts/test-color-upload-fix.mjs`
- `node scripts/test-bundles.mjs`
- `node scripts/test-contacts.mjs`
- `node scripts/test-merchic-promos.mjs`

Syntax TS/TSX dan uji logika dapat dijalankan di lingkungan pengembangan. **Build penuh `npm run build` dan verifikasi integrasi pada database produksi belum dilakukan di lingkungan ini** karena pemasangan dependensi npm tidak berhasil diselesaikan. Sebelum mengganti produksi, jalankan `npm install`, `npm run build`, dan uji pesanan nyata di staging jika tersedia.
