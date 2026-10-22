import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const ts = require('typescript')
const transpile = source => ts.transpileModule(source, {compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext}}).outputText
const source = readFileSync(new URL('../shared/launchDiscount.ts', import.meta.url), 'utf8')
const { isValidLaunchPercent } = await import('data:text/javascript;base64,' + Buffer.from(transpile(source)).toString('base64'))

for (const value of [0, 5, 7.5, 12.25, 23.75, 50, 99.99, 100]) {
  assert.equal(isValidLaunchPercent(value), true, `${value}% should be accepted`)
}
for (const value of [-0.01, 100.01, 12.345, Number.POSITIVE_INFINITY, NaN, null, undefined, '10', '15-20']) {
  assert.equal(isValidLaunchPercent(value), false, `${String(value)} should be rejected`)
}

// Exercise actual Cloudflare Worker route handler without hitting production Supabase.
const worker = readFileSync(new URL('../worker/index.ts', import.meta.url), 'utf8')
const start = worker.indexOf("app.put('/api/admin/promotions/launch'")
const end = worker.indexOf('\nfunction promoPayload', start)
assert.ok(start > 0 && end > start, 'Launch-promo endpoint must exist')
let launchHandler
const saved = new Map()
const fakeService = () => ({from: table => {
  assert.equal(table, 'app_settings')
  return { upsert: async (rows, options) => {
    assert.equal(options.onConflict, 'key')
    rows.forEach(row => saved.set(row.key, row.value))
    return {error: null}
  }}
}})
const cleanText = (value, max=500) => String(value ?? '').trim().slice(0, max)
const readSettings = async () => ({
  name: saved.get('launch_name'), enabled: saved.get('launch_enabled') !== 'false',
  standard: Number(saved.get('launch_standard_percent')), bundle: Number(saved.get('launch_bundle_percent')),
  endAt: saved.get('launch_end_at') || null
})
const code = transpile(worker.slice(start, end))
new Function('app', 'cleanText', 'service', 'discountSettings', 'isValidLaunchPercent', code)(
  {put: (route, handler) => {assert.equal(route, '/api/admin/promotions/launch');launchHandler = handler}},
  cleanText, fakeService, readSettings, isValidLaunchPercent
)
assert.equal(typeof launchHandler, 'function')
const send = body => launchHandler({req: {json: async () => body}, env: {}, json: (data, status = 200) => ({data, status})})
for (const [standard, bundle] of [[0,0], [7.5, 12.25], [10,35], [23.75,99.99], [100,100]]) {
  const response = await send({name:'BRIEFDA DAY', standard, bundle, enabled:true, endAt:null})
  assert.equal(response.status, 200, `save should succeed for ${standard}% / ${bundle}%`)
  assert.equal(response.data.standard, standard)
  assert.equal(response.data.bundle, bundle)
  assert.equal(saved.get('launch_standard_percent'), String(standard))
  assert.equal(saved.get('launch_bundle_percent'), String(bundle))
}
for (const [standard,bundle] of [[-1,15],[10,101],[12.345,20],['10',20],[10,'20'],[null,15],[undefined,20],[NaN,20]]) {
  const response = await send({name:'Diskon launching', standard, bundle, enabled:true})
  assert.equal(response.status,400, `should reject invalid percentage ${String(standard)} / ${String(bundle)}`)
}
assert.equal((await send({name:'Diskon launching',standard:10,bundle:20,enabled:false,endAt:'2030-12-31T15:30:00.000Z'})).data.enabled, false)
assert.equal(saved.get('launch_end_at'), '2030-12-31T15:30:00.000Z')
assert.equal((await send({name:'Diskon launching',standard:10,bundle:20,endAt:'invalid-date'})).status,400)

// Existing business rule: individual product discount overrides launch discount for that item;
// lifetime volume tier is calculated AFTER applying launch and individual discounts.
const computeSource = readFileSync(new URL('../worker/promotions.ts', import.meta.url), 'utf8')
const { computeDiscounts } = await import('data:text/javascript;base64,' + Buffer.from(transpile(computeSource)).toString('base64'))
for (const [standard, bundle] of [[0,0], [7.5,12.25], [10,35], [50,100], [100,100]]) {
  const subtotal = 300000, a = 100000, b = 200000
  const launch = Math.round(a * standard/100) + Math.round(b * bundle/100)
  const actual = computeDiscounts(subtotal, launch, null, {enabled:true,standard,bundle,endAt:null})
  assert.equal(actual.launchDiscount, launch)
  assert.equal(actual.payableSubtotal, subtotal-launch)
}
const mixed = computeDiscounts(600000,Math.round(250000*0.075)+Math.round(200000*0.35),null,{enabled:true,standard:7.5,bundle:35,endAt:null},new Date(),45000)
assert.equal(mixed.itemDiscount,45000)
assert.equal(mixed.volumeDiscount,Math.round((600000-mixed.launchDiscount-45000)*.10))
assert.ok(mixed.payableSubtotal >= 0)
const allFree = computeDiscounts(100000,100000,null,{enabled:true,standard:100,bundle:100,endAt:null})
assert.equal(allFree.payableSubtotal,0)
const store = readFileSync(new URL('../src/StorePage.tsx',import.meta.url), 'utf8')
assert.match(store, /launch\.standard > 0/)
assert.match(store, /launch\.bundle > 0/)
const admin = readFileSync(new URL('../src/AdminPage.tsx',import.meta.url),'utf8')
assert.match(admin,/min="0" max="100" step="0\.01"/)
assert.doesNotMatch(admin,/15[–-]20%/)
console.log('PASS: flexible launch promo (0–100%, decimals, API saving & rejecting invalid input, persisted values, disabled/end date, pricing, stacking, UI)')
