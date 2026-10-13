# Fitur Size Chart Merchic KM11

## Langkah update produksi

1. Di proyek Supabase yang digunakan Cloudflare Worker produksi, buka **SQL Editor** lalu jalankan seluruh isi `supabase/migrations/009_product_size_chart.sql` (sekali; aman diulang).
2. Pastikan bucket **`product-images`** tersedia, `public`, dan mengizinkan JPG/PNG/WebP hingga **5 MB** (menggunakan bucket yang sama dengan foto produk). Jika belum, jalankan migrasi `005_color_photo_upload_repair.sql` terlebih dahulu.
3. Replace/push file proyek yang sudah direvisi ke GitHub, lalu deploy ulang Cloudflare Worker. Tidak perlu secret/variable baru.
4. Masuk **Admin → Produk → Edit produk → Varian produk → Size chart produk**. Produk harus memiliki paling sedikit satu ukuran. Pilih gambar lalu **Simpan produk**. Admin dapat mengganti atau menghapus chart melalui bagian yang sama.
5. Buka katalog sebagai pelanggan. **Tombol Info di samping Ukuran** tersedia jika size chart sudah diunggah. Klik untuk melihat gambar dalam pop-up; tersedia juga pada modal pilihan varian paket.

## Perilaku dan batasan

- Size chart disimpan **per produk**, bukan per ukuran/warna. Tidak mengubah harga, stok, keranjang, pengiriman, atau mekanisme e-money.
- Tombol Info hanya tampil untuk produk yang memiliki ukuran **dan** sudah menyimpan size chart. Produk tanpa chart tetap dapat dibeli tanpa pop-up kosong.
- Format valid PNG/JPG/WebP maksimal 5 MB. Upload dikirim melalui API admin yang memerlukan autentikasi, dan file disimpan dalam `product-images/products/<product-id>/size-charts/`.
- Menghapus seluruh ukuran atau mengganti produk menjadi kartu e-money akan menghapus referensi size chart, berikut berkas lama (jika disimpan dengan pola path fitur ini). Menghapus produk juga membersihkan file chart.
- Jika upload gagal, perubahan produk yang sudah tersimpan tidak akan terduplikasi saat admin mencoba menyimpan ulang. Pilihan file baru tetap ada untuk dicoba ulang.
