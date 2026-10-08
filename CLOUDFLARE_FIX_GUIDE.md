# Perbaikan error SUPABASE_URL di KM11 Merchandise

## Diagnosis dari file yang diunggah (8 Oktober 2026)

- `worker/index.ts` membaca variable dengan **benar** melalui `c.env.SUPABASE_URL` (Hono pada Cloudflare Workers).
- Error `Server belum dikonfigurasi: SUPABASE_URL` berasal dari middleware `/api/*`: Worker **yang benar-benar menerima request** tidak melihat binding dengan nama tersebut.
- Dalam ZIP awal, `wrangler.jsonc` belum mengandung `keep_vars`. Deployment lewat Wrangler dapat menimpa variable biasa (bukan secret) yang dibuat lewat dashboard Cloudflare. Ini salah satu penjelasan yang paling sesuai dengan gejala, tetapi penyebab pastinya harus dicek pada aplikasi yang sedang aktif.

## Perubahan dalam versi ini

1. `wrangler.jsonc`: `"keep_vars": true` supaya Wrangler mempertahankan environment variables yang dikelola lewat dashboard.
2. `/api/health`: sekarang **tetap berfungsi** walaupun database belum terkonfigurasi. URL ini hanya menampilkan **nama** binding yang belum ditemukan, bukan isi binding, secret, atau API key.
3. `/api/health`: memberikan `revision` agar kamu bisa melihat apakah kode Worker terbaru benar-benar sudah tayang.
4. `scripts/self-test.mjs`: ada pemeriksaan untuk memastikan solusi di atas tidak terhapus pada versi berikutnya.

## Cara memasang

1. Ekstrak ZIP dan upload **isi folder `km11-merch-store`** untuk menggantikan file sumber pada GitHub repo yang benar (pastikan file `wrangler.jsonc` ini ikut diganti).
2. Di Cloudflare, buka **Workers & Pages → Worker yang mengelola domain KM11**. Cocokkan **nama Worker** (file ini memakai `km11-merch-store`) dan **domain/route** di bagian Settings/Domains.
3. Di **Settings → Variables and Secrets** untuk Worker dan environment **Production** yang benar, atur nama berikut tepat (case-sensitive):
   - `SUPABASE_URL` (URL `https://<project-ref>.supabase.co`)
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `CART_SECRET`
   - `RAJAONGKIR_API_KEY` (dibutuhkan untuk ongkir real-time, tetapi tidak termasuk syarat health/catalog)
4. Set key sensitif sebagai **Secret** (khususnya service role, cart secret, RajaOngkir API key). `SUPABASE_URL` boleh menjadi Variable.
5. Trigger deploy lewat Cloudflare/GitHub. Untuk project Vite ini, build `npm run build` dan deploy `npx wrangler deploy` dari folder yang mengandung `wrangler.jsonc`; atau `npm run deploy` yang menjalankan keduanya.
6. Buka URL **domain website yang sama** ditambah `/api/health`, contohnya: `https://domain-km11.example/api/health`.

## Cara membaca hasil `/api/health`

**A. Output mengandung `revision: "km11-config-check-2026-10-08-v1"`, `configured: true`, dan `missing_bindings: []`:**
Worker baru sudah aktif dan semua binding wajib terbaca. Buka `/api/products`. Jika error masih muncul, kemungkinan berikutnya adalah Supabase (tabel/migration, kunci, atau konektivitas) dan pesannya akan berbeda.

**B. `revision` ada, tetapi `missing_bindings` memuat `SUPABASE_URL`:**
Worker yang aktif belum menerima URL. Periksa lagi variable pada **Worker yang sama dengan domain**, environment Production vs Preview, dan lakukan redeploy. Tidak perlu membuat `VITE_SUPABASE_URL` karena frontend memang tidak melakukan query langsung ke Supabase.

**C. `/api/health` masih menghasilkan `Server belum dikonfigurasi: SUPABASE_URL` atau tidak memuat `revision`:**
Kemungkinan besar domain masih dilayani **deployment lama** atau Worker lain. Cocokkan domain, route, deploy status, branch GitHub, dan root directory project. `keep_vars` hanya berpengaruh apabila versi ini benar-benar di-deploy ke Worker target.

**D. `/api/health` menampilkan HTML website bukan JSON:**
Routing `/api/*` belum diarahkan ke Worker API yang benar, atau domain terhubung ke deployment Pages/Worker lain.

## Keamanan

Screenshot konfigurasi berisi credential dalam bentuk yang dapat terbaca. **Rotasi** credential yang terekspos, terutama service-role key Supabase dan RajaOngkir API key. Jangan menaruh nilai secret di GitHub, `wrangler.jsonc`, atau `VITE_*`; jangan kirim nilai lengkap kunci untuk debugging. Isi credential tidak pernah dimasukkan ke ZIP ini.

## Batas pemeriksaan

Paket ini diperbaiki dari source ZIP. Tidak ada akses yang diberikan ke akun Cloudflare, GitHub repo, domain yang sedang aktif, maupun Supabase sehingga kami **tidak mengklaim** sudah memperbaiki deployment production dari sini.
