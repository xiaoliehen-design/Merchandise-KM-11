# KM11 Merchandise — RajaOngkir + AgenWebsite + 17TRACK

## Fitur

- **Ongkir utama RajaOngkir** menggunakan API Komerce yang sudah ada. Jika kosong, error, timeout, atau belum dikonfigurasi, Worker mencoba **AgenWebsite**.
- **Cari lokasi cadangan** tersedia pada checkout melalui tombol *Cari lokasi melalui AgenWebsite*. Ini berguna bila RajaOngkir memberi lokasi tanpa kode pos sehingga harga fallback tidak bisa dihitung otomatis.
- **Satu kolom pelacakan** menerima **nomor invoice KM11** (`receipt_no`) atau **nomor resi** (`tracking_number`). Kedua nomor wajib terhubung ke pesanan KM11 yang ada di Supabase.
- **17TRACK** mengembalikan status kurir terakhir serta kronologi pengiriman (jika sudah ada). Status internal order ditampilkan terpisah. Untuk pickup, informasi pengambilan tetap tersedia.
- Tanpa data dari penyedia, aplikasi menampilkan *belum tersedia*, **bukan status atau tarif buatan**.

## 1. Konfigurasi Cloudflare Runtime Production

Di **Workers & Pages → km11-merch-store → Settings → Runtime variables and secrets → Production**:

| Nama | Jenis | Keterangan |
| --- | --- | --- |
| `RAJAONGKIR_API_KEY` | Secret | API key Komerce RajaOngkir yang sudah digunakan |
| `RAJAONGKIR_BASE_URL` | Variable | `https://rajaongkir.komerce.id/api/v1` |
| `RAJAONGKIR_MOCK` | Variable | `false` untuk Production |
| `AGENWEBSITE_API_KEY` | Secret | API key AgenWebsite Rate API (`awk_live_...`) |
| `AGENWEBSITE_BASE_URL` | Variable, opsional | `https://api.agenwebsite.com/v1` |
| `TRACK17_API_KEY` | Secret | API key 17TRACK API; header HTTP `17token` |
| `AGENWEBSITE_ORIGIN_POSTAL_CODE` | Variable, opsional | Kode pos asal 5 digit. Alternatifnya, isi lewat pengaturan admin. |

**Jangan pernah** menempelkan API key dalam `wrangler.jsonc`, source code, atau GitHub. `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`, `CART_SECRET` tetap wajib dan tidak berubah.

### Cara memperoleh API key
- AgenWebsite: https://www.agenwebsite.com/products/developer-api/
- 17TRACK: https://api.17track.net/en/doc (buat akun API dan buka Settings)

Catatan: AgenWebsite v1 saat ini mendukung tarif J&T Express, Lion Parcel, SAP, SPX, dan J&T Cargo. JNE/Sicepat tidak otomatis muncul pada fallback jika provider tersebut tidak tercakup. Tidak semua resi/kurir punya informasi di 17TRACK.

## 2. Atur titik asal pengiriman

Dashboard Admin → **Pengaturan** → isi `RajaOngkir Origin ID` yang sudah digunakan dan **Kode pos asal AgenWebsite (5 digit)**, lalu **Simpan pengaturan**.

Asal dan tujuan AgenWebsite **tidak** memakai ID RajaOngkir yang sama. Sistem menggunakan ID AgenWebsite saat memilih lokasi fallback, atau menggunakan kode pos resmi yang diberikan oleh RajaOngkir jika tersedia.

## 3. Uji ongkir utama dan fallback

1. Pastikan RajaOngkir aktif dan hitung ongkir dari checkout. Label tarif menunjukkan **RajaOngkir**.
2. Untuk menguji fallback aman, gunakan lingkungan staging atau API key RajaOngkir non-produksi yang sengaja dinonaktifkan. Pencarian lokasi dan tarif akan berpindah ke **AgenWebsite**. Hindari sengaja mencabut key pada website live.
3. Jika lokasi RajaOngkir tidak memiliki kode pos, pilih **Cari lokasi melalui AgenWebsite**, lalu pilih lokasi baru.
4. Pilih tarif dan lakukan order uji. Saat checkout, Worker **menghitung ulang** tarif dari provider dan tujuan terverifikasi. Jika provider atau layanan berubah, pesanan ditolak dengan pesan untuk menghitung ulang, **bukan diam-diam mengenakan harga yang berbeda**.

**Perlu diperhatikan:** token lokasi yang dipilih berlaku selama **30 menit**. Jika checkout terlalu lama, cari lokasi lagi.

## 4. Tracking invoice dan nomor resi

1. Admin → **Pesanan** → pada pesanan pengiriman yang telah diverifikasi klik input resi.
2. Masukkan **nomor resi** dan kode kurir. Nomor tersimpan di `orders.tracking_number`, disambungkan dengan `orders.receipt_no`.
3. Backend mencoba mendaftarkan resi ke **17TRACK**. Jika registrasi gagal, resi tetap tersimpan dan admin melihat pesan kesalahan; pastikan `TRACK17_API_KEY` benar, lalu simpan ulang resi jika dibutuhkan.
4. Customer buka **Lacak**, lalu masukkan **nomor invoice** atau **nomor resi**, cukup salah satu. Website menemukan invoice dan resi yang terkait, lalu memanggil 17TRACK.
5. API 17TRACK tidak selalu langsung menyediakan riwayat setelah registrasi; status dan linimasa akan menunggu hasil dari kurir. Provider dapat mensinkronisasi data secara berkala.

**Keamanan:** Endpoint tracking publik **tidak mengirimkan nama, alamat lengkap, nomor HP, email, bukti pembayaran, atau daftar barang pelanggan**. Input resi yang tidak ada di order KM11 tidak dipakai untuk pencarian umum 17TRACK. Aktifkan *Cloudflare WAF Rate Limiting Rules* pada `/api/track/*` untuk mengurangi enumerasi invoice dan penyalahgunaan kuota tracking. Cache best-effort 2 menit di tiap instance Worker sudah disediakan, tetapi bukan pengganti WAF rate limiting.

## 5. Database

**Tidak ada migrasi database baru yang wajib**, karena skema KM11 terakhir sudah memiliki `orders.receipt_no`, `orders.tracking_number`, `orders.tracking_courier`, dan `app_settings`. Integrasi provider dilakukan melalui Cloudflare Runtime Secrets dan kode Worker.

Jika tabel `orders` / `app_settings` tidak ada pada proyek Supabase tujuan, perbaiki migrasi 001–006 terlebih dahulu. Jangan membuat tabel pengganti sembarangan jika database sudah digunakan.

## 6. Pemeriksaan sebelum Production

- Cloudflare berhasil menjalankan `npm run build` dan deploy.
- Menu Pengaturan memuat kode pos asal fallback.
- Destinasi RajaOngkir dan AgenWebsite dapat dipilih.
- Tarif fallback memiliki tanda *AgenWebsite*.
- Test invoice dan test nomor resi menghasilkan nomor invoice/resi yang sama.
- Bila resi belum ada atau provider tidak menyiapkan data, UI menyatakan *belum tersedia*.
- Pelacakan publik tidak mengungkap PII pelanggan.

Dokumentasi rujukan: RajaOngkir `https://rajaongkir.com/docs/shipping-cost/endpoint-rajaongkir-for-search-base/calculate-domestic-cost`, AgenWebsite `https://www.agenwebsite.com/documentation/agenwebsite-rate-api/agenwebsite-rate-api-rates/`, 17TRACK `https://api.17track.net/en/doc`.
