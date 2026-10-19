import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const ts = require('typescript')

async function loadSource(file) {
  const source = readFileSync(new URL(file, import.meta.url), 'utf8')
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
  return import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'))
}
const { sizeSurcharge, isOversize } = await loadSource('../shared/sizePricing.ts')
const { computeDiscounts } = await loadSource('../worker/promotions.ts')
const { itemUnitDiscount } = await loadSource('../shared/productDiscount.ts')
const clothing = { id: '1', name: 'Kaos KM11', sizes: ['S', 'M', 'L', 'XL', 'XXL', '3XL'], colors: [], base_price: 100000 }
const clothing2 = { id: '2', name: 'Hoodie KM11', sizes: ['M', 'XL', '2XL', 'XXXL'], colors: [], base_price: 80000 }
const cup = { id: '3', name: 'Mug KM11', sizes: [], colors: [], base_price: 40000 }
const card = { id: '4', name: 'Kartu KM11', sizes: ['XXL'], colors: [], base_price: 35000, product_type: 'emoney_card' }
for (const size of ['XXL', 'XXXL', 'XXXXL', '2XL', '3XL', '4XL', '12XL', 'xxl', ' 3 xl ']) assert.equal(isOversize(size), true, size)
for (const size of ['S', 'M', 'L', 'XL', 'XS', '', 'XXS']) assert.equal(isOversize(size), false, size)
assert.equal(sizeSurcharge(clothing, 'XXL'), 15000)
assert.equal(sizeSurcharge(clothing, 'XL'), 0)
assert.equal(sizeSurcharge(clothing, 'invalid'), 0)
assert.equal(sizeSurcharge(clothing2, '2XL'), 15000)
assert.equal(sizeSurcharge(clothing2, 'XXXL'), 15000)
assert.equal(sizeSurcharge(cup, null), 0)
assert.equal(sizeSurcharge(card, 'XXL'), 0)
const settings = { name: 'Promo Oktober', enabled: true, standard: 15, bundle: 20, endAt: null }
assert.equal(computeDiscounts(115000, Math.round(115000 * .15), null, settings).payableSubtotal, 97750)
assert.equal(computeDiscounts(190000, Math.round(190000 * .20), null, settings).payableSubtotal, 152000)
assert.equal(computeDiscounts(115000, Math.round(115000 * .15), null, { ...settings, name: 'Hari Guru' }).payableSubtotal, 97750, 'Renaming must not change arithmetic')

// Exercise the ACTUAL Worker quote handler with a fake Supabase database.
const worker = readFileSync(new URL('../worker/index.ts', import.meta.url), 'utf8')
const quoteSource = worker.slice(worker.indexOf("app.post('/api/pricing/quote'"), worker.indexOf("\napp.post('/api/orders'"))
assert.ok(quoteSource.length > 1000, 'Pricing quote handler not found')
const transpiledQuote = ts.transpileModule(quoteSource, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText
let quoteHandler
const fakeApp = { post: (_path, handler) => { quoteHandler = handler } }
const allProducts = [clothing, clothing2, cup, card].map(p => ({ ...p, product_type: p.product_type || 'standard' }))
const bundles = [{ id: 'b', price: 160000, product_ids: ['1', '2', '3'] }]
const fakeSupabase = { from: table => ({ select: () => ({ in: (_key, ids) => ({ eq: async () => ({ data: (table === 'products' ? allProducts : bundles).filter(p => ids.includes(p.id)), error: null }) }) }) }) }
// Only format-check IDs for these synthetic fixtures; the real server uses UUIDs.
const isUuid = v => ['1', '2', '3', '4', 'b'].includes(String(v))
const cleanText = (v, max=500) => String(v ?? '').trim().slice(0, max)
const discountSettings = async () => settings
const computeOffer = async (_env, subtotal, launchBase) => ({ ...computeDiscounts(subtotal, launchBase, null, settings), launchName: settings.name })
new Function('app', 'service', 'discountSettings', 'computeOffer', 'isUuid', 'sizeSurcharge', 'itemUnitDiscount', 'cleanText', transpiledQuote)(fakeApp, () => fakeSupabase, discountSettings, computeOffer, isUuid, sizeSurcharge, itemUnitDiscount, cleanText)
assert.equal(typeof quoteHandler, 'function')
const quote = items => quoteHandler({ req: { json: async () => ({ items, promoCode: '' }) }, env: {}, json: response => response })
const single = await quote([{ productId: '1', qty: 2, size: 'XXL' }])
assert.equal(single.originalSubtotal, 230000)
assert.equal(single.launchDiscount, 34500)
assert.equal(single.payableSubtotal, 195500)
assert.equal(single.lineItems[0].surcharge, 30000)
assert.equal(single.lineItems[0].lineTotal, 230000)
assert.equal(single.launchName, 'Promo Oktober')
const bundle = await quote([{ bundleId: 'b', qty: 1, bundleItems: [{ productId: '1', size: 'XXL' }, { productId: '2', size: '2XL' }, { productId: '3' }] }])
assert.equal(bundle.originalSubtotal, 190000)
assert.equal(bundle.launchDiscount, 38000)
assert.equal(bundle.payableSubtotal, 152000)
assert.equal(bundle.lineItems[0].surcharge, 30000)
const normal = await quote([{ productId: '1', qty: 1, size: 'XL' }, { productId: '3', qty: 1 }])
assert.equal(normal.originalSubtotal, 140000)
assert.equal(normal.lineItems[0].surcharge, 0)
await assert.rejects(quote([{ productId: '1', qty: 1, size: '6XL' }]), /Pilih ukuran/)
await assert.rejects(quote([{ bundleId: 'b', qty: 1, bundleItems: [{ productId: '1', size: 'XXL' }] }]), /tidak sesuai/)
assert.match(worker, /const finalUnitPrice = unitPrice \+ sizeSurcharge\(p, size\)/, 'Order item surcharge must be calculated server-side')
assert.match(worker, /launchBase \+= Math\.round\(bundleLineTotal \* offerSettings\.bundle \/ 100\)/, 'Bundle promo must use surcharge-inclusive price')
assert.match(worker, /launch_name: name/, 'Promo name must be persisted in settings')
console.log('PASS: oversized sizes, exclusions, 15k per item, single & bundle quote, discounts, validation, editable title')
