# Merchic KM11 — Fallback Otomatis Tiga Provider Ongkir

## Hasil audit source sebelumnya

- **Cek ongkir dan lokasi utama**: Komerce RajaOngkir, `RAJAONGKIR_API_KEY`.
- **Cek ongkir dan lokasi fallback pertama**: AgenWebsite Rate API, `AGENWEBSITE_API_KEY`.
- **Tracking resi / invoice**: 17TRACK, `TRACK17_API_KEY` (tetap; tidak masuk waterfall ongkir).
- Sistem lama belum mempunyai key ketiga untuk RajaOngkir akun kedua.

## Hasil update ini

Urutan otomatis **untuk pencarian tujuan dan harga kirim**:

1. RajaOngkir akun **utama** (`RAJAONGKIR_API_KEY`).
2. AgenWebsite (`AGENWEBSITE_API_KEY`).
3. RajaOngkir **akun kedua** (`RAJAONGKIR_API_KEY_2`).

Jika sebuah API error/timeout/kuota habis (mis. 429), tidak dikonfigurasi, atau tidak memberikan hasil valid, sistem mencoba penyedia berikutnya secara **berurutan**. Bila primer berhasil, provider cadangan tidak dipanggil sehingga kuotanya tidak terpakai. Harga di UI diberi label provider yang mengeluarkannya, misalnya `RajaOngkir akun 2 (fallback 2)`.

### Catatan penting tentang pemetaan wilayah

- RajaOngkir memiliki `destination_id` tersendiri; AgenWebsite memakai `subdistrict_id` yang **tidak boleh** disamakan.
- Saat tujuan awal dipilih dari **RajaOngkir**, akun RajaOngkir kedua dapat menggunakan ID RajaOngkir tersebut untuk mengutip tarifnya.
- Saat tujuan awal dipilih dari **AgenWebsite**, fallback ketiga ke RajaOngkir hanya boleh menghitung tarif jika sistem menemukan **satu** padanan unik dengan **kode pos dan nama lokalitas yang sama** pada RajaOngkir kedua. Bila tidak ditemukan atau ambigu, transaksi tidak dipaksa menggunakan ongkir salah; pelanggan diminta mencari ulang lokasi.
- Tujuan yang dipilih pelanggan ditandatangani (HMAC) dan hanya berlaku **30 menit**. Penghitungan terakhir pada checkout mengecek **provider yang dipilih pelanggan**, tidak diam-diam beralih ke harga lain saat provider utama pulih.
- Pada saat memilih tujuan khusus AgenWebsite, provider itu dicoba terlebih dahulu karena ID lokasi AgenWebsite tidak dapat dipakai secara langsung pada RajaOngkir. Backup ke akun RajaOngkir kedua tetap dicoba dengan pemetaan aman di atas.

## Konfigurasi Cloudflare

Buka **Cloudflare → Workers & Pages → Worker Merchic → Settings → Variables and Secrets** untuk environment **Production**:

| Nama | Jenis | Isi |
|---|---|---|
| `RAJAONGKIR_API_KEY` | **Secret** | Shipping Cost API Key RajaOngkir **akun utama** yang sudah digunakan |
| `AGENWEBSITE_API_KEY` | **Secret** | AgenWebsite Rate API key yang sudah digunakan |
| `RAJAONGKIR_API_KEY_2` | **Secret BARU** | Shipping Cost API Key RajaOngkir **akun kedua** (berbeda dengan key pertama) |
| `RAJAONGKIR_BASE_URL` | Variable | `https://rajaongkir.komerce.id/api/v1` (boleh tetap seperti sebelumnya) |
| `AGENWEBSITE_BASE_URL` | Variable opsional | `https://api.agenwebsite.com/v1` |
| `RAJAONGKIR_MOCK` | Variable | **`false` pada production** |
| `AGENWEBSITE_ORIGIN_POSTAL_CODE` | Variable opsional | Kode pos asal 5 digit, atau isi dalam menu Pengaturan admin |
| `TRACK17_API_KEY` | Secret | Tetap untuk tracking resi |

**Tidak ada migrasi SQL baru.** Tidak ada perubahan tabel Supabase maupun data pesanan dan produk. `RAJAONGKIR_API_KEY_2` wajib diset agar fallback ketiga dapat digunakan. Pakai **Shipping Cost API Key**, bukan Shipping Delivery API Key. Jangan taruh API key pada kode React, `wrangler.jsonc`, GitHub, atau chat publik.

Di **Dashboard Admin → Pengaturan**, pastikan `RajaOngkir Origin ID` dan `Kode pos asal AgenWebsite` benar. Titik asal RajaOngkir tetap dipakai untuk akun pertama dan kedua. Pastikan izin penggunaan multi-akun memenuhi ketentuan penyedia; sistem ini tidak menjamin tambahan kuota atau pengabaian pembatasan dari RajaOngkir.

## Instalasi

1. Simpan ZIP proyek sebelumnya sebagai backup.
2. Unggah/replace source dengan ZIP terbaru ke GitHub atau repo sumber Cloudflare.
3. Tambahkan secret `RAJAONGKIR_API_KEY_2` pada environment Production.
4. Pastikan variabel lama tidak hilang lalu **deploy ulang**.
5. Jalankan `npm install`, `npm run build`, `npm run test:shipping3` dalam lingkungan dengan akses dependensi, kemudian lakukan tes manual di staging dan production.

### Skenario pengujian

- Normal: RajaOngkir utama memberi tarif; backup tidak terpanggil.
- RajaOngkir utama error/429: AgenWebsite memberi tarif.
- RajaOngkir utama + AgenWebsite error/429 atau tidak punya tarif: RajaOngkir kedua memberi tarif.
- Jika dua provider lebih dulu gagal tetapi provider ketiga tidak punya tarif: tampilkan pesan kegagalan **tanpa ongkir palsu**.
- Bila checkout sebelumnya memilih AgenWebsite/RajaOngkir kedua, konfirmasi akhir memakai layanan tersebut dan harga server-side, **bukan mengganti secara diam-diam**.
- Pickup dan pelacakan 17TRACK tetap berjalan terpisah dan tidak terpengaruh.

## Keterbatasan dan keamanan

- Jangan menguji kegagalan dengan menghapus key pada website production; gunakan staging/mocks.
- API ongkir hanya **estimasi harga**, bukan pemesanan kurir atau pencetakan resi.
- Kode mengatasi kegagalan API/kuota melalui fallback, tetapi tidak dapat menjamin bahwa kurir tertentu selalu tersedia di semua provider.
- Agar kuota tidak habis karena bot, disarankan membuat Cloudflare WAF Rate Limiting pada `/api/shipping/*` dan pantau dashboard pemakaian masing-masing penyedia.
- Perubahan sudah diuji melalui simulasi respons provider. Untuk memastikan seluruh proses nyata, uji dengan ketiga API key yang aktif, dari alamat checkout sampai konfirmasi pesanan.

Dokumentasi: [RajaOngkir Shipping Cost](https://www.rajaongkir.com/docs/shipping-cost/endpoint-rajaongkir-for-search-base/calculate-domestic-cost), [AgenWebsite Rate API](https://www.agenwebsite.com/documentation/agenwebsite-rate-api/agenwebsite-rate-api-changelog/).
