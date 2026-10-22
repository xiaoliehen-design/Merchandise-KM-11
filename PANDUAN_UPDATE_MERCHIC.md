# Panduan Update MERCHIC – Merchandise Kemenkeu Mengajar 11

## Urutan instalasi produksi (penting)

1. **Backup terlebih dahulu** kode GitHub lama, database Supabase, dan konfigurasi Cloudflare. Jangan reset/menghapus tabel yang ada.
2. Buka **Supabase → SQL Editor** pada project yang digunakan website produksi. Pastikan migrasi `001` sampai `006` sebelumnya sudah diterapkan. Jalankan isi file **`supabase/migrations/007_merchic_launch_promos_audit_bundle_covers.sql`** sekali, lalu pastikan tidak ada error. Migrasi ini hanya menambah tabel/kolom dan memperbarui fungsi `create_order_atomic` yang sudah ada. Migrasi mempertahankan pesanan dan produk sebelumnya.
3. Unggah/replace file source dari ZIP ini ke repository GitHub yang tersambung dengan Cloudflare Worker (jangan commit file `.dev.vars` atau kunci rahasia). **Jangan hapus** nilai runtime `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `CART_SECRET`, atau konfigurasi ongkir yang masih digunakan.
4. Install dependensi (`npm install`), jalankan `npm run build` dan pengujian (`npm test`, `npm run test:promos`, `npm run test:bundles`). Push ke branch deploy bila semua lulus, kemudian cek log build Cloudflare. Nama Worker `km11-merch-store` sengaja dipertahankan agar domain dan pengaturan deployment tidak berubah, tetapi judul aplikasi adalah **Merchic**.
5. Buka `/admin` → **Promo & diskon**; tentukan tanggal akhir diskon launching, bila ada, dan buat kode promo. Masuk **Produk → Kelola Paket → Edit**, lalu upload foto sampul yang diinginkan. Buka **Aktivitas admin** untuk memeriksa catatan perubahan.
6. Opsional: menu admin **Pengaturan** menerima username Instagram dan nomor WhatsApp layanan pelanggan dengan format internasional (mis. `6281234567890`). Website menampilkan tautan yang benar hanya jika admin mengisi datanya.
7. Lakukan uji transaksi di environment yang terpisah dari produksi dahulu: varian biasa, satu paket, e-money custom, pickup, pengiriman, bukti bayar, verifikasi admin, dan pelacakan. **Jangan transfer uang riil saat pengujian.**

## Aturan diskon dan contoh

- **Launching**: default diskon **15%** produk satuan, **20%** paket. Admin boleh mengatur tingkat masing-masing antara 15% sampai 20%, menonaktifkan, atau menetapkan waktu akhir. Tanpa waktu akhir, diskon launching terus aktif sampai admin menonaktifkannya.
- **Diskon tambahan permanen**: **10%** ketika subtotal harga merchandise *sebelum diskon* **lebih besar dari Rp500.000**, bukan sama dengan Rp500.000. Diskon ini dihitung setelah launching, tidak termasuk ongkir, dan tetap berlaku walaupun promo launching dimatikan.
- **Kode promo**: satu kode per pesanan, boleh berlaku bersamaan dengan kedua diskon otomatis di atas. Kode dapat berupa **persentase** atau **potongan nominal**, dengan tanggal mulai/akhir (opsional), nilai minimal transaksi merchandise sebelum diskon, dan sakelar status aktif.
- **Urutan**: harga merchandise asli → diskon launching → diskon permanen 10% (jika lolos ambang) → kode promo → ongkir. Nilai diskon tidak bisa membuat harga merchandise negatif. Seluruh nilai rupiah dibulatkan ke rupiah terdekat.
- **Contoh**: merchandise biasa Rp600.000 mendapat launching 15% (−Rp90.000), lalu tambahan 10% dari Rp510.000 (−Rp51.000), kemudian kode promo 10% atas Rp459.000 (−Rp45.900). Jadi harga merchandise **Rp413.100**, belum termasuk ongkir.

## Fitur dan lokasi kode

| Kebutuhan | Implementasi |
| --- | --- |
| Hero offline dan brand Merchic | `public/hero/merchic-kemenkeu-shopping.webp`, `public/brand/merchic-logo.png`, `src/StorePage.tsx`, `src/Layout.tsx`, `src/styles.css` |
| Kalkulasi promo aman di backend | `worker/promotions.ts`, `worker/index.ts` (`/api/pricing/quote` dan `/api/orders`) |
| Kelola promo dan tanggal | `src/AdminPage.tsx` tab **Promo & diskon**, tabel `promo_codes`, setting `launch_*` |
| Diskon pada checkout dan receipt | `src/CartCheckoutPage.tsx`, kolom `orders.launch_discount`, `volume_discount`, `promo_discount`, `promo_code` |
| Sampul paket | `product_bundles.cover_image_url`, `cover_image_path`, upload bucket `product-images` via `/api/admin/bundles/:id/cover` |
| Log aktivitas per admin | `admin_audit_logs`, `/api/admin/audit-logs`, tab **Aktivitas admin** |

## Keamanan, batasan, dan rollback

- Harga paket/produk, ongkir, nominal diskon, masa berlaku, dan minimal transaksi diverifikasi kembali di **Worker**; browser tidak berwenang menentukan total akhir. Nilai yang dibayar harus mengikuti respons server saat order dibuat.
- Log menyimpan identitas admin, metode HTTP, target rute tindakan, dan waktu, **bukan** password, token, atau isi formulir pribadi. Catatan tersedia untuk operasi admin yang berhasil dan login. Bila penyimpanan log mengalami kegagalan terpisah, Worker melaporkannya ke console; operasi bisnis tidak diulang secara otomatis.
- Foto sampul memakai bucket publik `product-images` yang sudah dipakai foto produk; maksimal 5 MB, PNG/JPG/WebP. Jika belum ada sampul, kartu paket masih menampilkan kolase foto lama.
- Foto hero merupakan **visual AI ilustratif**, bukan dokumentasi acara/pegawai sebenarnya. Identitas wajah dan detail desain barang pada visual tidak boleh diperlakukan sebagai foto resmi kegiatan.
- Pengujian lokal file-source telah dilakukan dengan skrip proyek dan pengujian unit promo. Build production lengkap perlu dijalankan dengan dependensi npm dan sambungan Supabase/Cloudflare di lingkungan Anda; **belum diuji lewat deployment live** di sini.
- Untuk rollback, kembalikan commit sebelumnya. Hindari menghapus tabel promosi/audit atau kolom baru jika ada transaksi yang sudah menggunakan fitur tersebut.

## Pembaruan kontak (12 Oktober 2026)

Tambahan setelah migrasi 007: jalankan `supabase/migrations/008_merchic_official_contacts.sql` sekali. WhatsApp adalah **+62 811-3446-578** dan Instagram **@km_dkijakarta**. Menu Instagram dan WhatsApp di header, informasi kontak di footer, serta tombol chat mengarah langsung ke kontak tersebut. Lihat `PANDUAN_KONTAK_MERCHIC.md`.
