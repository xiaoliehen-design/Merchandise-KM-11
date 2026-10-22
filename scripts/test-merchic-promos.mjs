import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const ts = require('typescript')
const content = readFileSync(new URL('../worker/promotions.ts', import.meta.url),'utf8')
const js = ts.transpileModule(content, {compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText
const { computeDiscounts, isValidLaunchPercent } = await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'))
const settings={enabled:true,standard:15,bundle:20,endAt:null}
const regular = computeDiscounts(100000,15000,null,settings)
assert.equal(regular.launchDiscount,15000)
assert.equal(regular.volumeDiscount,0)
assert.equal(regular.payableSubtotal,85000)
const packageDeal = computeDiscounts(200000,40000,null,settings)
assert.equal(packageDeal.payableSubtotal,160000)
assert.equal(computeDiscounts(500000,75000,null,settings).volumeDiscount,0,'500k tepat tidak eligible')
const tier = computeDiscounts(600000,90000,null,settings)
assert.equal(tier.volumeDiscount,51000)
assert.equal(tier.payableSubtotal,459000)
const code={code:'MERCHIC10',active:true,discount_type:'percent',amount:10,min_order_amount:500000,starts_at:null,ends_at:null}
const stacked=computeDiscounts(600000,90000,code,settings)
assert.equal(stacked.promoDiscount,45900)
assert.equal(stacked.payableSubtotal,413100)
assert.equal(stacked.launchDiscount+stacked.volumeDiscount+stacked.promoDiscount,186900)
const discountOff=computeDiscounts(600000,90000,null,{...settings,enabled:false})
assert.equal(discountOff.launchDiscount,0)
assert.equal(discountOff.volumeDiscount,60000,'volume promo persists')
assert.equal(discountOff.payableSubtotal,540000)
assert.equal(computeDiscounts(100000,15000,{...code,code:'ALLFREE',discount_type:'fixed',amount:999999,min_order_amount:0},settings).payableSubtotal,0)
assert.throws(()=>computeDiscounts(100000,15000,code,settings),/minimal/)
assert.throws(()=>computeDiscounts(600000,90000,{...code,active:false},settings),/tidak aktif/)
assert.throws(()=>computeDiscounts(600000,90000,{...code,ends_at:'2020-01-01T00:00:00Z'},settings),/kedaluwarsa/)
assert.throws(()=>computeDiscounts(600000,90000,{...code,starts_at:'2099-01-01T00:00:00Z'},settings),/belum mulai/)
const expired=computeDiscounts(100000,15000,null,{...settings,endAt:'2025-01-01T00:00:00Z'})
assert.equal(expired.launchDiscount,0)
// Launching rate must be flexible but bounded; invalid client inputs must be rejected by Worker.
for (const rate of [0, 0.01, 1, 7.5, 12.34, 17.25, 50, 99.99, 100]) {
  assert.equal(isValidLaunchPercent(rate), true, `valid launch rate ${rate}`)
  const price = 100000
  const quote = computeDiscounts(price, Math.round(price * rate / 100), null, {...settings,standard:rate})
  assert.equal(quote.launchDiscount, Math.round(price * rate / 100), `discount at ${rate}%`)
  assert.equal(quote.payableSubtotal, price - quote.launchDiscount, `total at ${rate}%`)
}
for (const rate of [-1, -0.01, 100.01, 101, 12.345, NaN, Infinity, -Infinity, null, '', '10', false]) {
  assert.equal(isValidLaunchPercent(rate), false, `invalid launch rate ${String(rate)}`)
}
// Independent percentages for product / bundle and stacking with permanent volume discount.
const custom = {enabled:true,standard:7.5,bundle:35,endAt:null}
const regularCustom = computeDiscounts(100000, Math.round(100000 * custom.standard / 100), null, custom)
const bundleCustom = computeDiscounts(100000, Math.round(100000 * custom.bundle / 100), null, custom)
assert.equal(regularCustom.payableSubtotal, 92500)
assert.equal(bundleCustom.payableSubtotal, 65000)
const volumeCustom = computeDiscounts(600000, Math.round(600000 * 0.125), null, {...custom,standard:12.5})
assert.equal(volumeCustom.launchDiscount,75000)
assert.equal(volumeCustom.volumeDiscount,52500)
assert.equal(volumeCustom.payableSubtotal,472500)
console.log('PASS: Merchic promo scenarios, including 0–100% customizable launching, two decimals, invalid rates, independent bundle/regular, and stacking')
