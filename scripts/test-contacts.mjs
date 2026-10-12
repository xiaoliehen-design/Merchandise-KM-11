import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = f => readFileSync(new URL('../' + f, import.meta.url), 'utf8')
const defaults = read('src/contact.ts')
const layout = read('src/Layout.tsx')
const admin = read('src/AdminPage.tsx')
const worker = read('worker/index.ts')
const migration = read('supabase/migrations/008_merchic_official_contacts.sql')
assert.match(defaults, /https:\/\/www\.instagram\.com\/km_dkijakarta\//)
assert.match(defaults, /https:\/\/wa\.me\/628113446578/)
assert.match(layout, /href=\{contact\.instagram\}/)
assert.match(layout, /href=\{contact\.whatsapp\}/)
assert.match(layout, /merchic-contact-links/)
assert.match(layout, /merchic-whatsapp/)
assert.match(admin, /social_instagram: 'km_dkijakarta'/)
assert.match(admin, /social_whatsapp: '628113446578'/)
assert.match(worker, /settings\.social_instagram \|\| 'km_dkijakarta'/)
assert.match(worker, /settings\.social_whatsapp \|\| '628113446578'/)
assert.match(migration, /\('social_whatsapp', '628113446578'/)
assert.match(migration, /\('social_instagram', 'km_dkijakarta'/)
assert.match(migration, /on conflict \(key\) do update/i)
console.log('13 checks OK: kontak official, 3 lokasi UI, admin, fallback API, migrasi.');
