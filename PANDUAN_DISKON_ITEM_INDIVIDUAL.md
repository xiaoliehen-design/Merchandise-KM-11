# Panduan Update — Diskon Khusus Per Produk | Merchic KM11

## Langkah pemasangan (wajib berurutan)

1. **Backup database Supabase** bila memungkinkan (terutama tabel `products`, `orders`, dan fungsi `create_order_atomic`).
2. Buka proyek Supabase yang digunakan situs produksi → **SQL Editor**, jalankan seluruh isi `supabase/migrations/011_individual_product_discounts.sql`. **Wajib dijalankan sebelum mengganti kode dan melakukan deploy**. Migrasi menambah kolom pada produk/pesanan (default aman) dan memperbarui fungsi simpan pesanan atomik.
3. Upload / replace keseluruhan folder `km11-merch-store` dari ZIP ini ke repositori GitHub yang terhubung dengan Cloudflare; jangan menghapus konfigurasi/Secrets di Cloudflare.
4. Deploy ulang Worker dan frontend. Pastikan endpoint `/api/health` menampilkan `revision: merchic-item-discounts-v2`.
5. Uji di dashboard admin: Produk → Edit → Diskon khusus produk → aktifkan → pilih persentase atau nominal → masukkan nilai → Simpan produk. Uji katalog, checkout (total penawaran harus sesuai), dan pesanan uji di metode pickup; jangan lakukan pembayaran sungguhan hanya untuk pengujian.
6. Jalankan test lokal bila dependensi telah terpasang: `npm run test:item-discounts && npm run test:oversize && npm run test:promos && npm run build`.

## Aturan diskon (diterapkan server, tidak mempercayai harga di browser)

- **Per produk satuan**: Bila diskon khusus **aktif**, gunakan diskon produk tersebut (1–100% atau nominal Rp per unit). Produk itu **tidak** mendapatkan diskon launching reguler 15–20% pada saat yang sama. Jika diskon khusus tidak aktif, produk kembali mengikuti pengaturan promo launching biasa. Diskon khusus tetap berlaku meskipun promo launching global dinonaktifkan atau masa promosinya habis.
- **Produk dalam paket**: potongan individualnya **tidak** berlaku. Harga paket + surcharge ukuran XXL+ untuk setiap pakaian di paket, dan mengikuti persentase promo paket global bila sedang aktif.
- **Ukuran XXL+**: Rp15.000 per pakaian per unit **ditambahkan lebih dahulu**, lalu dihitung persentase atau nominal diskon khusus bila berlaku. Nominal diskon tidak dapat membuat harga unit negatif.
- **Diskon belanja besar**: 10% setelah potongan launching dan individual, aktif jika subtotal awal sebelum diskon melebihi Rp500.000. Kode promo valid selanjutnya diterapkan setelah diskon belanja besar. Ongkir tidak didiskon.
- Nilai diskon dihitung dan dibulatkan di server dalam rupiah. Pada diskon khusus, pembulatan persen dilakukan per **unit**, lalu dikalikan jumlah. Estimasi checkout dan order dibuat menggunakan rumus yang sama, bahkan untuk keranjang lama.
- Ringkasan checkout, receipt, dan ekspor Excel pesanan menampilkan diskon khusus secara terpisah. Kolom database `orders.item_discount` menyimpan total potongan khusus historis setiap pesanan baru.

## Contoh

Harga kaos Rp100.000; ukuran XXL +Rp15.000 menjadi Rp115.000. Diskon khusus 30%: potongan Rp34.500; harga akhir Rp80.500 sebelum diskon transaksi lain. Diskon launching 15% **tidak** dikenakan lagi untuk kaos tersebut.

Harga mug Rp80.000; potongan khusus nominal Rp20.000: harga Rp60.000 per unit. Paket dengan mug di dalamnya **tidak** mendapat potongan khusus Rp20.000; harga paket yang berlaku dipakai.

## Perhatian

Migrasi 011 berbeda dari promo sebelumnya yang tidak membutuhkan migrasi. Jika migrasi belum berhasil, **jangan deploy kode baru**: Worker membutuhkan kolom `products.item_discount_*` di Supabase. Tidak diperlukan tambahan Secret Cloudflare untuk perubahan ini.

Untuk mengembalikan semua diskon khusus ke nonaktif tanpa mengubah kode: `update public.products set item_discount_enabled=false;` (jalankan hanya jika benar-benar ingin menonaktifkan semua promo individual).
