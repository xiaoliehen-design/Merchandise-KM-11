import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const ts = require('typescript')
const transpiled = ts.transpileModule(fs.readFileSync('worker/bundlePricing.ts', 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext }
})
const { allocateBundlePrice } = await import(`data:text/javascript;base64,${Buffer.from(transpiled.outputText).toString('base64')}`)
for (const [price, count] of [[25000, 2], [25000, 3], [1, 3], [0, 4], [100000.02, 7], [0.01, 12]]) {
  const list = allocateBundlePrice(price, count)
  assert.equal(list.length, count)
  assert.equal(Math.round(list.reduce((sum, value) => sum + value, 0) * 100), Math.round(price * 100))
  assert.ok(list.every(value => value >= 0))
}
for (const [price, count] of [[-1,2], [1,0], [1,13], [1.001,2], [Infinity,2]]) assert.throws(() => allocateBundlePrice(price, count))
const worker = fs.readFileSync('worker/index.ts','utf8')
const sql = fs.readFileSync('supabase/migrations/006_product_bundles.sql','utf8')
assert.ok(worker.includes("allocateBundlePrice(Number(bundle.price), childIds.length)"))
assert.ok(worker.includes("const bundle = byBundle.get(String(item.bundleId))"))
assert.ok(worker.includes('checkout_line_index'))
assert.ok(sql.includes('v_line_index := v_line_index + 1'))
const store = fs.readFileSync('src/StorePage.tsx','utf8')
assert.ok(store.indexOf('bundles.map(bundle =>') < store.indexOf('products.map(p => <ProductCard'))
assert.ok(store.includes('onDesign(p, item => saveDesign(p,item))'))
assert.ok(store.includes('Pilih warna') && store.includes('Pilih ukuran'))
console.log('TEST BUNDLES PASS: 6 valid price allocations, 5 invalid inputs, bundle routing, sorted catalog, required configuration and ordered checkout.')
