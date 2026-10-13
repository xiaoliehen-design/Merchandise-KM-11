# Merchic KM11 — Update alamat pengiriman admin & Export Excel

**Pembaruan 13 Oktober 2026** — Melanjutkan rilis `Merchic_KM11_Fullstack_Update_Pesanan_Excel_2026-10-13.zip` (varian item, metode kirim, slot pickup).

## 1. Perubahan yang tampak

- **Admin > Pesanan:** ditambahkan kolom **Alamat lengkap pengiriman**, tepat setelah **Customer**. Untuk pesanan **Kirim**, tampilkan persis alamat detail pembeli yang dimasukkan pada checkout (`orders.address`) dengan format baris dipertahankan, disertai **Wilayah tujuan (checkout)** (`orders.shipping_destination_label`). Alamat panjang tetap dapat dibaca; tabel dapat digeser mendatar di layar kecil.
- **Pencarian pesanan:** sekarang bisa mencari berdasarkan bagian alamat atau wilayah tujuan selain receipt, nama, email, dan nomor HP.
- **Export Excel > Orders:** kolom baru **Alamat Lengkap Pengiriman**, **Alamat Detail Pembeli**, **Wilayah Tujuan** ditempatkan dekat identitas penerima. Kolom sebelumnya `AlamatKirim` dan `TujuanKirim` **tetap ada** agar laporan lama kompatibel.
- **Export Excel > Items:** kolom **NamaPembeli, HP, Alamat Lengkap Pengiriman, Alamat Detail Pembeli, Wilayah Tujuan** di awal baris, sehingga setiap produk memiliki identitas pengiriman untuk pengepakan. Warna, ukuran, kurir, layanan, nomor resi, lokasi dan slot pickup tetap disertakan.
- Kolom alamat lengkap di workbook dibuat lebih lebar, dan masing-masing sheet yang mempunyai data mendapatkan filter kolom otomatis.

## 2. Aturan data & kehati-hatian

- **Kirim:** alamat lengkap digabung dari **alamat detail asli** + **wilayah tujuan asli saat checkout**, tanpa mengarang RT/RW, nomor rumah, kode pos, dan informasi lain yang tidak dicatat. Jika wilayah tujuan sudah tertulis sama persis dalam alamat detail, tidak diulang.
- **Jika alamat detail kosong untuk order lama:** ditandai `ALAMAT DETAIL BELUM TERCATAT`; petugas perlu konfirmasi dengan pembeli sebelum mengirim. Wilayah tujuan saja **bukan** alamat lengkap.
- **Pickup:** tidak ditampilkan alamat pengiriman pelanggan karena checkout pickup tidak meminta alamat tersebut. Tempat dan jadwal pickup tetap tersedia di kolom pemenuhan dan sheet Excel.
- Data kontak dan alamat hanya muncul di menu admin berautentikasi, bukan katalog publik.
- **Tidak perlu migrasi SQL baru**; semua atribut (`orders.address` dan `orders.shipping_destination_label`) sudah tersimpan pada schema lama dan termuat melalui API admin `orders`.
- Pesanan yang tidak mengandung alamat detail sejak checkout tidak dapat diperbaiki akurasinya melalui perubahan tampilan saja. Pastikan isi alamat sebelum menempelkan label pengiriman.

## 3. Cara menerapkan di Cloudflare/GitHub

1. Ekstrak ZIP. Salin **isi folder `km11-merch-store/`** ke root repo Merchic Anda, menggantikan file versi sebelumnya.
2. Jangan hapus environment variables atau secrets di Cloudflare; tidak diperlukan environment variables tambahan.
3. Commit/push ke GitHub dan deploy via Cloudflare seperti biasa.
4. Buka **Admin > Pesanan**, klik **Refresh** dan gunakan **Ctrl+F5** jika browser masih menampilkan versi lama.
5. Periksa beberapa order **Kirim** (alamat detail + wilayah), serta **Pickup** (hanya lokasi/slot pengambilan). Klik **Export Excel**, lalu periksa alamat pada sheet `Orders` dan `Items`.

**Alternatif patch minimal:** hanya perlu replace `src/AdminPage.tsx`, `src/orderAdminData.ts`, dan `src/styles.css`. Skrip tes dan dokumentasi opsional.

## 4. Hasil pengecekan

- `npm run test:orders` — lulus (26 pemeriksaan data varian, fulfillment, Excel).
- `npm run test:addresses` — lulus (38 pemeriksaan alamat kirim, kesesuaian Excel, pickup, multiline, data kosong, sambungan checkout dan API).
- `node scripts/self-test.mjs`, `node scripts/test-color-upload-fix.mjs`, `node scripts/test-bundles.mjs`, `node scripts/test-contacts.mjs`, `node scripts/test-merchic-promos.mjs` — lulus.
- Sintaks seluruh **21 file TS/TSX** diperiksa dengan parser/transpiler TypeScript: **0 kesalahan sintaks**.
- **Build production lengkap (`npm run build`) belum berhasil diverifikasi** karena instalasi npm pada lingkungan pembuat ZIP timeout. Harap jalankan `npm install` dan `npm run build` di mesin lokal/CI Cloudflare sebelum deploy produksi, lalu lakukan pengecekan browser.

## 5. Bentuk output contoh

Pesanan pengiriman:

```
Nama: Pembeli Contoh
HP: 0812XXXXXXXX
Alamat detail dari pembeli:
Jl. Kenanga No. 12, RT 03/RW 02
Gedung A lantai 2
Wilayah tujuan (checkout):
Kel. Bungur, Kec. Senen, Jakarta Pusat, DKI Jakarta
```

Pesanan pickup:

```
Alamat pengiriman: Tidak tersedia (pickup)
Lokasi pickup: sesuai slot pilihan saat checkout
```

Contoh ini adalah data uji, bukan pesanan pelanggan sebenarnya.
