import fs from 'node:fs'
import path from 'node:path'

const required = [
  'worker/index.ts','src/App.tsx','src/AdminPage.tsx','src/CartCheckoutPage.tsx',
  'supabase/migrations/001_init.sql','wrangler.jsonc','public/brand/km11-logo-white.png','public/brand/km11-logo-blue.png','public/hero/notebook-blue.png','public/hero/mug-blue.png','public/hero/keychain.png','public/hero/slop-white.png'
]
const failures = []
for (const file of required) if (!fs.existsSync(file)) failures.push(`Missing ${file}`)

const worker = fs.readFileSync('worker/index.ts','utf8')
for (const route of ['/api/orders','/api/track/:receipt','/api/admin/login','/api/admin/products','/api/admin/orders/:id/verify','/api/admin/orders/:id/tracking']) {
  if (!worker.includes(route)) failures.push(`Missing Worker route ${route}`)
}
const sql = fs.readFileSync('supabase/migrations/001_init.sql','utf8')
for (const token of ['create table public.products','create table public.orders','create table public.order_items','create table public.pickup_locations','create table public.payment_methods','create_order_atomic','payment-proofs']) {
  if (!sql.toLowerCase().includes(token.toLowerCase())) failures.push(`Migration missing ${token}`)
}
for (const img of ['public/brand/km11-logo-white.png','public/hero/notebook-blue.png','public/hero/mug-blue.png','public/hero/keychain.png','public/hero/slop-white.png']) {
  if (fs.existsSync(img) && fs.statSync(img).size < 5000) failures.push(`Brand/hero asset looks unexpectedly small: ${img}`)
}
const storePage = fs.readFileSync('src/StorePage.tsx','utf8')
if (storePage.includes('/theme/payung-biru.png') || storePage.includes('/theme/payung-putih.png')) failures.push('Landing hero still uses umbrella artwork')
if (!storePage.includes('/brand/km11-logo-white.png')) failures.push('Landing hero does not use official KM11 logo asset')
const wrangler = fs.readFileSync('wrangler.jsonc','utf8')
if (!wrangler.includes('"/api/*"')) failures.push('Cloudflare API routing is not configured')

if (failures.length) {
  console.error('Self-test failed:\n- ' + failures.join('\n- '))
  process.exit(1)
}
console.log('Self-test OK: project structure, core routes, migration, and assets are present.')
