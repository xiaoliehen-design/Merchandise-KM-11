# KM11 Merchandise — Cloudflare build fix paket (8 Oktober 2026)

## Error yang diperbaiki
Cloudflare `npm run build` berhenti saat `tsc -b`:
- TS2339 / TS2353: `bundleId` dan `bundleItems` tidak dikenal pada `CartItem`.
- TS7006: parameter `x`, `part`, dan `index` dianggap `any` sebagai akibat dari tipe item paket tidak ada.
- TS2783: `productId` dan `name` ditulis sebelum spread yang dapat menimpanya.

## File yang diubah
1. `src/types.ts`: menempatkan properti opsional `bundleId` dan `bundleItems: BundleCartComponent[]` pada `CartItem` (baris keranjang), bukan pada `BundleCartComponent` (item penyusun).
2. `src/StorePage.tsx`: menaruh spread `...prev[product.id]` sebelum identitas `productId` dan `name` agar tidak tertimpa.

Tidak ada perubahan pada database, migrasi SQL, desain kartu, foto per warna, maupun aturan harga paket.

## Pengujian lokal
- TypeScript `--strict` pada model data dan contoh pemakaian paket: lulus.
- Transpilasi sintaks 16 file TypeScript/TSX: lulus.
- `node scripts/self-test.mjs`: lulus.
- `node scripts/test-bundles.mjs`: lulus (6 pembagian harga valid; 5 invalid).
- `node scripts/test-color-images.mjs`: lulus (5 skenario).
- Build production lengkap **belum** diuji pada lingkungan lokal karena pemasangan dependency npm mengalami timeout. Wajib validasi hasil `npm run build` di Cloudflare setelah upload.

## Deploy
1. Extract ZIP, upload isi `km11-merch-store` ke *root* repository GitHub yang terhubung Cloudflare.
2. Commit/push perubahan lalu tunggu build `npm run build`.
3. Tidak perlu menjalankan SQL baru bila migrasi `006_product_bundles.sql` sudah dijalankan.
4. Jika migrasi 006 belum dijalankan, jalankan dahulu di Supabase proyek yang sama dengan Worker Production.
5. Uji paket di Admin, pilihan warna/ukuran, desain e-money, keranjang, checkout, dan riwayat pesanan sebelum dipakai pengguna.
