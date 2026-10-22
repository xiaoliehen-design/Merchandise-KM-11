# Pembaruan diskon launching fleksibel — 22 Oktober 2026

## Yang berubah

- Diskon produk reguler dan paket dapat ditentukan terpisah oleh admin **0–100%** dengan maksimal **2 angka desimal** (contoh 0%, 7,5%, 12,34%, 50%, 100%).
- Default yang sudah tersimpan di Supabase **tidak berubah**. Jika belum pernah dikonfigurasi, default masih 15% untuk produk biasa dan 20% untuk paket.
- Validasi diperbarui di frontend serta endpoint Worker `PUT /api/admin/promotions/launch`. Nilai di luar rentang, kosong, atau lebih dari 2 angka desimal ditolak.
- Informasi diskon launching di bagian depan website mengikuti persentase aktual yang admin simpan, bukan teks tetap “15–20%”.
- Sistem tetap menghitung diskon berdasar harga katalog dari Supabase melalui Worker pada preview checkout **dan** pembuatan pesanan.
- Diskon tambahan 10% untuk subtotal merchandise sebelum diskon **lebih dari** Rp500.000, kode promo, dan urutan penerapannya tidak berubah.
- Nilai 0% berarti tanpa diskon launching pada kategori tersebut; sakelar promo launching bisa menonaktifkan potongan launching untuk semua kategori.

## Cara memperbarui website

1. Buat cadangan repository dan konfigurasi Cloudflare/Supabase produksi.
2. Timpa source repository dengan isi direktori `km11-merch-store` dari ZIP ini (atau lakukan merge jika ada perubahan produksi yang lebih baru).
3. Jalankan `npm install`, `npm run test:promos`, dan `npm run build`, lalu deploy seperti biasa ke Cloudflare.
4. Buka `/admin` → **Promo & diskon** → masukkan persentase baru (mis. reguler 10, paket 15) → **Simpan diskon launching**.
5. Cek informasi promo di halaman toko dan subtotal pada checkout untuk produk biasa maupun paket.

**Tidak diperlukan migrasi SQL atau perubahan Cloudflare Secret/Variable.** Angka diskon tersimpan dalam `app_settings`, menggunakan kunci yang sudah ada: `launch_standard_percent` dan `launch_bundle_percent`.

**Catatan:** Jika repository yang berjalan telah ditambah fitur baru setelah ZIP sumber ini dibuat, gabungkan perubahan spesifik pada file `src/AdminPage.tsx`, `src/StorePage.tsx`, `worker/index.ts`, dan `worker/promotions.ts`, agar fitur baru tersebut tidak tertimpa.
