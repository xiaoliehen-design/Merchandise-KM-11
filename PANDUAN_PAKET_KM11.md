# KM11 Merchandise — Pembaruan Fitur Paket

## Urutan pemasangan (penting)

1. Pastikan Supabase SQL Editor mengarah ke **proyek yang sama** dengan `SUPABASE_URL` di Cloudflare Workers **Runtime / Production**.
2. Backup data Supabase bila memungkinkan. **Jalankan `supabase/migrations/006_product_bundles.sql` satu kali** di SQL Editor. Migrasi ini membuat tabel `product_bundles` dan kolom `order_items.checkout_line_index`, serta memperbarui fungsi `create_order_atomic` agar urutan item pesanan stabil. Tidak menjalankan migrasi 001–005 ulang.
3. Replace seluruh kode repository GitHub dengan folder `km11-merch-store/` dari ZIP ini (jangan upload folder pembungkus dua tingkat). Commit/push dan pastikan deployment Cloudflare **Success**.
4. Bersihkan cache browser (`Ctrl+Shift+R`). Buka Admin → Produk: tombol **Tambah paket** ada di sebelah **Tambah produk**.
5. Klik Tambah paket, masukkan nama/harga/deskripsi, pilih produk aktif (maksimal 12 produk berbeda), dan simpan. Paket tampil **di bagian paling atas katalog**.
6. Pada customer: klik paket → pilih warna/ukuran produk → desain kartu e-money jika ada → klik **Simpan desain untuk paket** → **Tambah paket ke keranjang**. Paket hanya masuk keranjang setelah seluruh item dipenuhi.
7. Uji checkout paket (termasuk kartu e-money jika ada), lalu cek order di Admin → Pesanan: setiap produk penyusun paket muncul sebagai item dengan nama diawali nama paket. Total gabungan item dihitung dari harga paket, bukan akumulasi harga satuannya. File preview PNG desain tetap tersimpan pada masing-masing item kartu.

## Ketentuan

- Satu konfigurasi paket = satu paket di keranjang. Untuk membeli dua paket dengan pilihan berbeda, tambahkan paket dua kali. Pada checkout, setiap konfigurasi paket ditampilkan sebagai `1 paket` supaya pilihan desain tidak tergandakan tanpa sengaja.
- Item paket harus merupakan **produk aktif** saat disimpan admin maupun saat checkout.
- Harga paket dan item didapat ulang dari database pada server; browser tidak dapat mengubah harga checkout.
- Migrasi memodifikasi fungsi `create_order_atomic` agar metadata desain kartu dan barang lain ditempel ke item yang benar. Jika sebelumnya fungsi ini telah dikustomisasi manual, audit/backup fungsi tersebut sebelum menjalankan SQL 006.
- Karena ada tabel baru, **SQL 006 wajib berhasil sebelum kode baru dideploy**. Jika belum, permintaan `/api/bundles` akan gagal.
- Endpoint paket menggunakan service role key hanya di Worker. Jangan commit credential ke GitHub.

## Pengujian lokal

Setelah `npm install` berhasil:

```bash
npm test
npm run test:bundles
npm run build
```

Pengujian paket menguji pembagian harga dalam satuan sen dan beberapa pemeriksaan statis kontrak integrasi. Build Cloudflare dan database Production harus diuji setelah deployment.
