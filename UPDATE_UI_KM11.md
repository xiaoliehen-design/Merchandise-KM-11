# Update UI KM11 — 8 Oktober 2026

1. Warna dan ukuran pada dashboard produk kini ditambah satu per satu melalui Enter atau tombol Tambah; daftar menjadi chip yang bisa dihapus. Menempel beberapa nilai dipisah koma/baris baru lalu menekan Tambah juga didukung. Draf yang belum ditambahkan akan ikut tersimpan jika klik Simpan produk.
2. Perbaikan editor spesifikasi agar teks kosong/sebagian tidak hilang saat mengetik sebelum tombol Simpan diklik.
3. Editor produk disusun menjadi Informasi, Varian, dan Detail/media. Daftar produk dengan kartu tertata, gambar terbatasi proporsinya, pencarian dan penghitung produk.
4. Semua paragraf deskriptif pada header menu admin, keterangan login admin, dan keterangan dua area katalog yang diminta sudah dihapus. Field **Deskripsi produk** dipertahankan, karena merupakan data produk yang dapat diedit admin.
5. Favicon PNG/ICO menggunakan logo resmi Kemenkeu Mengajar 11 yang sudah ada di repo, di atas latar biru dan aksen warna merchandise.
6. Teks penjelas panjang di bagian atas checkout dan di bawah ringkasan order dihapus. Tombol aksi checkout tetap ada dengan label **Konfirmasi pesanan**, sehingga proses pemesanan tetap berfungsi.
7. Integrasi Supabase, endpoint API, hero merchandise, konfigurasi Cloudflare, dan skema database tidak diubah.

## Cara deploy
Timpa isi repository dengan isi folder `km11-merch-store`, commit dan push ke GitHub, tunggu build & deploy Cloudflare sukses. Refresh browser menggunakan Ctrl+Shift+R untuk memperbarui favicon lama dari cache. Jika favicon masih globe, coba tab baru/incognito.
