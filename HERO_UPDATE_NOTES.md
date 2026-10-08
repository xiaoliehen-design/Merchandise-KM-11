# Update hero landing page KM11 — 8 Oktober 2026

Perubahan:
- `src/StorePage.tsx`: kolase produk pada hero diganti menjadi satu gambar merchandise baru.
- `src/styles.css`: menampilkan satu gambar secara responsif pada desktop, tablet, dan ponsel dengan rasio 4:3 dan `object-fit: contain`.
- `public/hero/km11-merchandise-showcase.png`: gambar unggahan asli tanpa perubahan.
- `public/hero/km11-merchandise-showcase.webp`: versi teroptimasi (untuk loading lebih cepat), dengan PNG sebagai fallback.

Hal yang dipertahankan: seluruh backend Worker, integrasi Supabase, katalog produk, checkout, admin, dan pengaturan Cloudflare dari ZIP input.

Pengujian yang dilakukan:
- Perbandingan byte PNG input dan salinan: identik.
- Validasi kedua gambar: dapat dibaca dan berukuran 1448 x 1086 piksel.
- Pemeriksaan sintaks/transpilasi 13 file TS/TSX: lolos.
- `npm test`: lolos (struktur proyek, endpoint dasar, migrasi, aset).
- Isi Worker, wrangler, dan berkas API kunci: identik dengan ZIP input.

Batas pengujian: build production belum diverifikasi karena pengunduhan dependency melalui npm timeout; pratinjau Chromium headless juga timeout di lingkungan pengujian. Jalankan `npm install`, `npm run build`, dan `npm test` pada lingkungan CI/GitHub sebelum deployment.

Cara memasang: ekstrak ZIP ini, salin isi folder `km11-merch-store` ke root repository GitHub (replace berkas dengan yang baru), commit, dan deploy ulang via Cloudflare. Tidak perlu mengubah Supabase URL/secret untuk penggantian hero ini.
