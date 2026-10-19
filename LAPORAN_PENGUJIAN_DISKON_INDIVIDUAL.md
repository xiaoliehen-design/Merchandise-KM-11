# Hasil Pemeriksaan Update Diskon Individual — 19 Oktober 2026

## Ruang lingkup perubahan

- Produk mendapat pengaturan `item_discount_enabled`, `item_discount_type` (percent/fixed), dan `item_discount_amount` pada form tambah/edit produk.
- Diskon individual berlaku hanya pembelian satuan produk; diskon paket global tetap dikelola terpisah.
- Katalog menampilkan harga khusus, quote checkout dan pembuatan pesanan menghitung harga ulang server-side; tambahan Rp15.000 untuk pakaian XXL+ tetap berjalan.
- Pencatatan terpisah `orders.item_discount` disiapkan melalui migrasi Supabase 011; informasi juga muncul di receipt serta ekspor admin.

## Pemeriksaan otomatis lokal (LULUS)

1. `scripts/test-item-discounts.mjs`: diskon persen, diskon tetap per unit, diskon di atas harga hingga 100%, diskon nonaktif, XXL, campuran produk, paket yang mengecualikan diskon anak paket, dan kombinasi dengan diskon global, volume, dan kode promo.
2. Eksekusi bagian kalkulasi **quote aktual dan persiapan order aktual** menggunakan Supabase tiruan (tanpa koneksi produksi): hasil subtotal, diskon, dan total cocok di semua skenario yang diperiksa.
3. `scripts/test-merchic-promos.mjs`: lulus pengujian promo launching/volume/kode seperti sebelum perubahan.
4. `scripts/test-oversize-pricing.mjs`: lulus uji surcharge Rp15.000 untuk varian XXL+ termasuk dalam paket.
5. `scripts/test-size-chart.mjs`, `scripts/test-bundles.mjs`, `scripts/test-contacts.mjs`, `scripts/test-shipping-tracking.mjs`, `scripts/test-order-address.mjs`, dan `scripts/test-orders-admin.mjs`: lulus di lingkungan ini.
6. TypeScript 23 sumber .ts/.tsx berhasil diparse dan ditranspile tanpa kesalahan sintaks; modul murni `shared/*` dan `worker/promotions.ts` lulus strict typecheck global TypeScript.
7. Migrasi SQL diverifikasi secara statis bahwa kolom baru ada dan nilai `item_discount` dicatat dalam fungsi `create_order_atomic`.

## Keterbatasan pemeriksaan

- **Full `npm run build` belum dapat dijalankan** karena dependensi Vite/React tidak terpasang dan instalasi npm mengalami kegagalan resolusi jaringan (`EAI_AGAIN`). Script `test-color-images.mjs` juga tidak dapat dijalankan karena dependensi runtime tidak tersedia.
- **Tidak ada akses ke database produksi**, sehingga eksekusi nyata migrasi Supabase 011, transaksi database langsung, serta deployment Cloudflare belum diverifikasi.
- Setelah memperoleh dependensi di komputer/CI Anda, jalankan `npm ci` (jika tersedia lock file; bila tidak ada gunakan `npm install`), `npm run build`, `npm run test:item-discounts`, `npm run test:oversize`, dan lakukan uji end-to-end checkout terlebih dahulu sebelum menggunakan situs secara luas.
