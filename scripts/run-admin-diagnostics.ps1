# KM11 — tes login admin lokal tanpa menyimpan password atau kunci API.
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw 'Node.js belum terpasang (node -v).' }
$url = Read-Host 'Project URL Supabase [Enter = https://mosyindhynattzhgohlo.supabase.co]'
if ([string]::IsNullOrWhiteSpace($url)) { $url = 'https://mosyindhynattzhgohlo.supabase.co' }
$nip = Read-Host 'NIP yang ingin dites [Enter = 199811272018011002]'
if ([string]::IsNullOrWhiteSpace($nip)) { $nip = '199811272018011002' }
$role = Read-Host 'SUPABASE_SERVICE_ROLE_KEY (tersembunyi)' -AsSecureString
$anon = Read-Host 'SUPABASE_ANON_KEY (tersembunyi)' -AsSecureString
$pass = Read-Host 'Password login admin yang ingin diuji (tersembunyi)' -AsSecureString
try {
  $env:SUPABASE_URL = $url.Trim()
  $env:KM11_ADMIN_NIP = $nip.Trim()
  $env:SUPABASE_SERVICE_ROLE_KEY = [System.Net.NetworkCredential]::new('', $role).Password
  $env:SUPABASE_ANON_KEY = [System.Net.NetworkCredential]::new('', $anon).Password
  $env:KM11_ADMIN_PASSWORD = [System.Net.NetworkCredential]::new('', $pass).Password
  & node .\diagnose-admin-login.mjs
  $returnCode = $LASTEXITCODE
  exit $returnCode
} finally {
  @('SUPABASE_URL','KM11_ADMIN_NIP','SUPABASE_SERVICE_ROLE_KEY','SUPABASE_ANON_KEY','KM11_ADMIN_PASSWORD') | ForEach-Object {
    Remove-Item -Path ('Env:' + $_) -ErrorAction SilentlyContinue
  }
  $pass = $null; $role = $null; $anon = $null
}
