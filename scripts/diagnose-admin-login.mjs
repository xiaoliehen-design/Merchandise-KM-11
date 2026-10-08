/**
 * Diagnostics KM11 Admin (read-only except login attempt to Supabase Auth).
 * Run on a trusted local computer only; never paste keys/passwords in chat.
 * Environment (set temporarily by run-admin-diagnostics.ps1):
 *  SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY, KM11_ADMIN_NIP, KM11_ADMIN_PASSWORD
 */
const env = process.env;
const url = (env.SUPABASE_URL || '').trim().replace(/\/+$/, '').replace(/\/rest\/v1$/, '');
const nip = (env.KM11_ADMIN_NIP || '').trim();
const password = env.KM11_ADMIN_PASSWORD || '';
const secret = (env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
const anon = (env.SUPABASE_ANON_KEY || '').trim();

if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url)) throw Error('Project URL tidak valid. Gunakan https://PROJECT_ID.supabase.co');
if (!/^\d{18}$/.test(nip)) throw Error('NIP harus terdiri dari 18 digit.');
if (!password || !secret || !anon) throw Error('NIP password, anon key dan service role key harus diisi.');

function safeDescription(s) { return String(s || '').toLowerCase().slice(0, 250); }
function classifyFailure(status, body) {
  const code = safeDescription(body?.code || body?.error_code || body?.error);
  const msg = safeDescription(body?.msg || body?.message || body?.error_description || body?.error);
  if (code.includes('invalid_credentials') || msg.includes('invalid login credentials')) return 'Password tidak cocok, akun tidak ditemukan, atau akun tidak diperbolehkan masuk (invalid_credentials).';
  if (code.includes('email_not_confirmed') || msg.includes('email not confirmed')) return 'Email akun belum dikonfirmasi di Supabase Auth.';
  if (code.includes('email_provider_disabled') || msg.includes('email logins are disabled')) return 'Login email/password dinonaktifkan di Supabase Auth Providers.';
  if (code.includes('over_request_rate_limit') || msg.includes('rate limit')) return 'Supabase menerapkan pembatasan percobaan login (rate limit); tunggu sebelum mencoba kembali.';
  if (msg.includes('invalid api key') || msg.includes('invalid jwt') || msg.includes('api key')) return 'API key tidak cocok dengan Supabase project / tidak valid.';
  if (status >= 500) return 'Supabase Auth sedang bermasalah atau tidak tersedia.';
  return `HTTP ${status}; kode ${code || '(tidak tersedia)'}. Periksa Supabase Auth logs.`;
}
async function req(path, key, options = {}) {
  let res;
  try {
    res = await fetch(url + path, {
      method: options.method || 'GET',
      headers: { apikey: key, Authorization: 'Bearer ' + key, ...(options.body ? { 'Content-Type': 'application/json' } : {}) },
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: AbortSignal.timeout(20000)
    });
  } catch (err) {
    const code = err?.cause?.code || err?.code || 'NETWORK_ERROR';
    throw Error(`Tidak tersambung ke ${new URL(url).hostname}: ${code}. Periksa DNS/HTTPS.`);
  }
  const txt = await res.text();
  let body = null;
  try { body = JSON.parse(txt); } catch { body = { error: 'Non-JSON response' }; }
  return { status: res.status, ok: res.ok, body };
}

async function main() {
  console.log('\nDIAGNOSIS LOGIN KM11 — tidak menampilkan key, password, atau token');
  console.log('Project:', new URL(url).hostname);
  console.log('NIP:', nip);
  const qs = new URLSearchParams({ select: 'username,auth_email,auth_user_id,active', username_lower: `eq.${nip}`, limit: '1' });
  const db = await req(`/rest/v1/admins?${qs.toString()}`, secret);
  if (!db.ok) {
    console.log(`\n[DB GAGAL] HTTP ${db.status}. ${classifyFailure(db.status, db.body)}`);
    console.log('Kemungkinan service role key tidak sesuai, tabel admins tidak tersedia, atau izin database bermasalah.');
    process.exitCode = 1; return;
  }
  const rows = db.body;
  if (!Array.isArray(rows) || rows.length !== 1) {
    console.log('\n[DB GAGAL] Username tidak ditemukan persis satu baris dalam public.admins.');
    process.exitCode = 1; return;
  }
  const adm = rows[0];
  if (!adm.active || !adm.auth_email || !adm.auth_user_id) {
    console.log('\n[DB GAGAL] Akun admin nonaktif / kolom Auth tidak terhubung.');
    process.exitCode = 1; return;
  }
  console.log('[DB OK] Akun admin aktif dan memiliki ID Auth.');

  const au = await req(`/auth/v1/admin/users/${encodeURIComponent(adm.auth_user_id)}`, secret);
  if (!au.ok) {
    console.log(`[AUTH ADMIN GAGAL] HTTP ${au.status}. ${classifyFailure(au.status, au.body)}`);
    process.exitCode = 1; return;
  }
  const user = au.body?.user || au.body;
  if (user?.id !== adm.auth_user_id || user?.email?.toLowerCase() !== adm.auth_email?.toLowerCase()) {
    console.log('[AUTH ADMIN GAGAL] ID / email Supabase Auth berbeda dari tabel admins.');
    process.exitCode = 1; return;
  }
  if (!user.email_confirmed_at && !user.confirmed_at) {
    console.log('[AUTH ADMIN GAGAL] Email belum terkonfirmasi di Auth.');
    process.exitCode = 1; return;
  }
  console.log('[AUTH ADMIN OK] Pengguna Auth ada, email cocok, dan sudah terkonfirmasi.');

  // Use the same password-grant endpoint as Supabase signInWithPassword.
  const login = await req('/auth/v1/token?grant_type=password', anon, {
    method: 'POST', body: { email: adm.auth_email, password }
  });
  if (!login.ok) {
    console.log(`[LOGIN GAGAL] ${classifyFailure(login.status, login.body)}`);
    console.log('Jika API key dianggap tidak valid, bandingkan ANON KEY pada Cloudflare Runtime dengan project ini.');
    console.log('Jika invalid_credentials, cek/reset password awal di Supabase Authentication (jangan hapus akun).');
    process.exitCode = 1; return;
  }
  if (!login.body?.access_token || login.body?.user?.id !== adm.auth_user_id) {
    console.log('[LOGIN GAGAL] Token/ID Auth hasil login tidak valid atau berbeda.');
    process.exitCode = 1; return;
  }
  console.log('[LOGIN OK] Supabase menerima password; token cocok dengan tabel admins.');
  console.log('\nKESIMPULAN: kredensial Supabase dan pencocokan akun berjalan dengan baik.');
  console.log('Jika website masih gagal, kemungkinan konfigurasi Runtime Production Worker salah atau kode deployed belum terbaru.');
}
await main().catch(e => { console.error('DIAGNOSIS GAGAL:', e.message); process.exitCode = 1; });
