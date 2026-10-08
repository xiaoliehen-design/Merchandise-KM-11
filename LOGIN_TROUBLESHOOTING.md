# KM11 — Diagnosis dan perbaikan login admin (8 Oktober 2026)

## Temuan audit

- `src/AdminPage.tsx` memanggil `POST /api/admin/login`, dan `src/api.ts` mengirim JSON `{username,password}`. Alur frontend benar.
- Login backend menelusuri `public.admins.username_lower`, lalu `auth.signInWithPassword()` menggunakan `auth_email`. Password hanya berada di Supabase Auth.
- Script pendaftaran massal v3 memverifikasi hanya `Auth user exists` dan `admins.auth_user_id` cocok. Ia **tidak menguji login password**.
- **Bug terkonfirmasi:** backend lama mengabaikan error saat query `admins`. Error database dan API key bisa salah ditampilkan sebagai **"Username atau password salah."**
- **Perbaikan:** login backend sekarang membedakan gagal query database (502), gagal konfigurasi Auth (502), email belum dikonfirmasi (403), dan login tidak sah (401). Login juga memvalidasi bahwa `data.user.id === admins.auth_user_id`.

## Cara memeriksa penyebab tepat di Windows

1. Buka PowerShell. Masuk ke folder `scripts` di project ini.
2. Jalankan: `powershell -NoProfile -ExecutionPolicy Bypass -File .\run-admin-diagnostics.ps1`
3. Gunakan **URL proyek Supabase asli**, **service role key**, **anon key** dari proyek yang sama; masukkan password lewat prompt tersembunyi. Jangan kirim isi key, password, atau file `.dev.vars` ke siapa pun.
4. Baca hasil langkah `[DB ...]`, `[AUTH ADMIN ...]`, `[LOGIN ...]`.

Interpretasi:

| Hasil | Perbaikan |
| --- | --- |
| DB GAGAL | Runtime `SUPABASE_URL` dan `SUPABASE_SERVICE_ROLE_KEY`, tabel `admins`, grant/RLS Supabase |
| AUTH ADMIN GAGAL | Hubungan `admins.auth_user_id`, akun Auth, email konfirmasi |
| LOGIN GAGAL (invalid_credentials) | Periksa/reset password di Supabase Auth. Jangan menghapus akun/tabel lagi. |
| LOGIN GAGAL (invalid api key) | Koreksi `SUPABASE_ANON_KEY` agar berasal dari proyek yang sama. |
| LOGIN OK, tetapi website gagal | Runtime Variables Production pada Worker/route yang aktif masih salah, atau deployment lama. Periksa `/api/health` dan Cloudflare Workers Logs. |

## Deployment

1. Ganti kode repository dengan paket ini (tanpa menimpa konfigurasi secrets Cloudflare).
2. Deploy ke Worker yang melayani domain website kamu.
3. Pada **Runtime variables and secrets / Production**, pastikan `SUPABASE_URL=https://mosyindhynattzhgohlo.supabase.co` dan anon/service_role dari proyek **yang sama**. `CART_SECRET` juga wajib ada.
4. Pastikan `/api/health` memiliki `revision=km11-login-diagnostics-2026-10-08-v2` dan `configured=true`.
5. Ulangi login admin melalui website. Jika muncul error 502, lihat Worker Logs untuk kode error Supabase (jangan tempel key/password ke log).

## Keamanan

NIP tidak aman sebagai password jangka panjang: segera ganti password semua akun dengan password unik setelah berhasil masuk. Rotate API key jika pernah terlihat dalam screenshot. Jangan masukkan Service Role Key dalam source code, repository, atau frontend.
