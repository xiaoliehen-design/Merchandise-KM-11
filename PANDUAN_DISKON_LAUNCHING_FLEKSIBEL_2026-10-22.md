# Pembaruan diskon launching fleksibel — 22 Oktober 2026

## Perubahan
- Dashboard **Admin > Promo & diskon** sekarang mengizinkan dua nilai terpisah: **Diskon produk biasa** dan **Diskon paket**, masing-masing **0 sampai 100%**, dengan maksimal **dua angka desimal** (misalnya 0, 5, 12,5, 23,75, atau 100).
- Angka **15% untuk produk** dan **20% untuk paket** adalah nilai awal ketika setting belum dibuat di database, **bukan lagi batas wajib**. Data promo yang tersimpan tidak direset atau ditimpa saat deploy.
- Nilai 0% berarti kategori tersebut tidak diberi diskon launching; katalog tidak akan menampilkan badge promo 0%.
- Judul promo di katalog/admin mengikuti nama yang disimpan; tidak lagi menampilkan angka batas 15–20% yang menyesatkan.
- Backend `/api/admin/promotions/launch` menggunakan validasi 0–100% (maksimal dua angka desimal), sama dengan form admin, dan menolak input di luar rentang.
- Kalkulasi harga untuk katalog, preview checkout, dan pembuatan pesanan tetap memakai persentase terbaru dari pengaturan Supabase. Diskon produk individual menggantikan diskon launching hanya untuk produk tersebut; diskon tambahan transaksi di atas Rp500.000 serta kode promo tetap berlaku sesuai aturan sebelumnya.

## Cara menggunakan
1. Deploy semua isi ZIP ini ke Cloudflare Worker/Pages melalui repositori Github seperti biasa. **Jangan deploy hanya UI:** endpoint backend juga harus diperbarui.
2. Login dashboard admin, pilih **Promo & diskon**.
3. Isi dua persentase sesuai keinginan admin (0–100%; misalnya produk 10% dan paket 35%).
4. Atur nama promo, tanggal akhir (opsional) dan status aktif, lalu klik **Simpan pengaturan promo**.
5. Periksa diskon di katalog dan di preview checkout; pesanan baru menggunakan nilai server yang tersimpan.

Tidak ada perubahan skema database: **tidak perlu menjalankan migrasi SQL baru**. Penawaran pada pesanan lama tidak diubah.

## Pemeriksaan lokal
- `npm run build`
- `npm run test:launch-flexible`
- `npm run test:promos`
- `npm run test:item-discounts`
- `npm test`
