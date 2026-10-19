import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const ts = require('typescript')
function loadSource(path) {
  const txt = readFileSync(new URL(path, import.meta.url), 'utf8')
  const js = ts.transpileModule(txt, {compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText
  return import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'))
}
const { itemUnitDiscount } = await loadSource('../shared/productDiscount.ts')
const { sizeSurcharge } = await loadSource('../shared/sizePricing.ts')
const { computeDiscounts } = await loadSource('../worker/promotions.ts')
const onPercent = {item_discount_enabled:true,item_discount_type:'percent',item_discount_amount:30}
const onFixed = {item_discount_enabled:true,item_discount_type:'fixed',item_discount_amount:50000}
assert.equal(itemUnitDiscount(onPercent,115000),34500,'XXL must be included in % discount base')
assert.equal(itemUnitDiscount(onFixed,115000),50000)
assert.equal(itemUnitDiscount({...onFixed,item_discount_amount:999999},115000),115000,'no negative unit amount')
assert.equal(itemUnitDiscount({...onFixed,item_discount_enabled:false},115000),0,'disabled individual promo')
assert.equal(itemUnitDiscount({...onFixed,item_discount_amount:0},115000),0)
assert.equal(itemUnitDiscount({...onPercent,item_discount_amount:100},115000),115000)
const settings = {name:'Promosi KM11',enabled:true,standard:15,bundle:20,endAt:null}
const direct = computeDiscounts(230000,0,null,settings,new Date(),69000)
assert.equal(direct.itemDiscount,69000)
assert.equal(direct.launchDiscount,0)
assert.equal(direct.payableSubtotal,161000)
assert.equal(computeDiscounts(230000,0,null,{...settings,enabled:false},new Date(),69000).payableSubtotal,161000)
const stacked = computeDiscounts(600000,60000,{code:'SAVE10',active:true,discount_type:'percent',amount:10,min_order_amount:0,starts_at:null,ends_at:null},settings,new Date(),90000)
assert.deepEqual([stacked.launchDiscount,stacked.itemDiscount,stacked.volumeDiscount,stacked.promoDiscount,stacked.payableSubtotal],[60000,90000,45000,40500,364500])

const worker = readFileSync(new URL('../worker/index.ts',import.meta.url),'utf8')
const quoteSource = worker.slice(worker.indexOf("app.post('/api/pricing/quote'"),worker.indexOf("\napp.post('/api/orders'"))
let quoteHandler
const ids=['shirt','cup','hoodie','bundle']
const products = [
  { id:'shirt',name:'Kaos KM11',base_price:100000,colors:[],sizes:['M','XXL'],product_type:'standard', ...onPercent },
  { id:'cup',name:'Mug',base_price:80000,colors:[],sizes:[],product_type:'standard',item_discount_enabled:false,item_discount_type:'percent',item_discount_amount:0 },
  { id:'hoodie',name:'Hoodie',base_price:120000,colors:[],sizes:['M','2XL'],product_type:'standard',...onFixed }
]
const bundles = [{id:'bundle',price:190000,product_ids:['shirt','cup']}]
const fakeDb = {from: table=> ({select:()=>({in:(_name,values)=>({eq:async()=>({data:(table==='products'?products:bundles).filter(p=>values.includes(p.id)),error:null})})})})}
const isUuid=id=>ids.includes(String(id))
const cleanText=(value,max=500)=>String(value??'').trim().slice(0,max)
const discountSettings=async()=>settings
const computeOffer=async (_env,subtotal,launchBase,code,itemDiscount=0)=>({...computeDiscounts(subtotal,launchBase,null,settings,new Date(),itemDiscount),launchName:settings.name})
const compiled=ts.transpileModule(quoteSource,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText
new Function('app','service','discountSettings','computeOffer','isUuid','sizeSurcharge','itemUnitDiscount','cleanText',compiled)(
  {post:(_path,fn)=>{quoteHandler=fn}},()=>fakeDb,discountSettings,computeOffer,isUuid,sizeSurcharge,itemUnitDiscount,cleanText
)
const quote=items=>quoteHandler({req:{json:async()=>({items})},env:{},json:x=>x})
const sizeXXL=await quote([{productId:'shirt',size:'XXL',qty:2}])
assert.equal(sizeXXL.originalSubtotal,230000)
assert.equal(sizeXXL.itemDiscount,69000)
assert.equal(sizeXXL.launchDiscount,0)
assert.equal(sizeXXL.payableSubtotal,161000)
assert.equal(sizeXXL.lineItems[0].itemDiscount,69000)
const mixed=await quote([{productId:'shirt',size:'XXL',qty:1},{productId:'cup',qty:1},{productId:'hoodie',size:'M',qty:1}])
assert.equal(mixed.originalSubtotal,315000)
assert.equal(mixed.itemDiscount,84500)
assert.equal(mixed.launchDiscount,12000)
assert.equal(mixed.payableSubtotal,218500)
const bundle=await quote([{bundleId:'bundle',qty:1,bundleItems:[{productId:'shirt',size:'XXL'},{productId:'cup'}]}])
assert.equal(bundle.originalSubtotal,205000)
assert.equal(bundle.launchDiscount,41000)
assert.equal(bundle.itemDiscount,0,'Individual discount excluded for bundled constituents')
const fixed=await quote([{productId:'hoodie',size:'2XL',qty:2}])
assert.equal(fixed.originalSubtotal,270000)
assert.equal(fixed.itemDiscount,100000)
assert.equal(fixed.payableSubtotal,170000)

// Extract the real order preparation fragment (before fulfillment/shipping) and compare
// the totals with the quote for the same database, variants, and quantities.
const orderPart=worker.slice(worker.indexOf("app.post('/api/orders'"),worker.indexOf('  const itemRows = preparedItems.map(x => x.row)'))
const start=orderPart.indexOf('  const b: any =')
assert.ok(start>0,'order handler not found')
const fragment=orderPart.slice(start).replace(/return c\.json\(\{ error: ([^}]+) \}, (\d+)\)/g, "throw new Error(String($1))")
const transpiled=ts.transpileModule(`async function prepareOrder(c) {\n${fragment}\n return {subtotal,launchBase,itemDiscount,receiptLines};\n}`,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText
const prepOrder=new Function('service','discountSettings','isUuid','cleanText','validateVariant','sizeSurcharge','itemUnitDiscount','allocateBundlePrice','parsePngDataUrl', transpiled+'; return prepareOrder;')(
  ()=>fakeDb,discountSettings,isUuid,cleanText,
  (product,item)=>{if(product.sizes.length&&!product.sizes.includes(item.size))throw Error('invalid size');},sizeSurcharge,itemUnitDiscount,
  (price,n)=>Array.from({length:n},(_,i)=>Math.floor(price/n)+(i<price%n?1:0)),()=>undefined)
// In this fixture synthetic products are returned by *.in(...).eq(...), with same DB source as the quote.
for(const items of [
  [{productId:'shirt',size:'XXL',qty:2}],
  [{productId:'shirt',size:'XXL',qty:1},{productId:'cup',qty:1},{productId:'hoodie',size:'M',qty:1}],
  [{bundleId:'bundle',qty:1,bundleItems:[{productId:'shirt',size:'XXL'},{productId:'cup'}]}],
  [{productId:'hoodie',size:'2XL',qty:2}]
]) {
  const expected=await quote(items)
  const prepared=await prepOrder({req:{json:async()=>({items,customer:{fullName:'A',email:'a@example.com',phone:'08123456789'}})}})
  const computed=computeDiscounts(prepared.subtotal,prepared.launchBase,null,settings,new Date(),prepared.itemDiscount)
  assert.equal(prepared.subtotal,expected.originalSubtotal)
  assert.equal(prepared.itemDiscount,expected.itemDiscount)
  assert.equal(computed.launchDiscount,expected.launchDiscount)
  assert.equal(computed.payableSubtotal,expected.payableSubtotal)
}
const migration=readFileSync(new URL('../supabase/migrations/011_individual_product_discounts.sql',import.meta.url),'utf8')
for(const col of ['item_discount_enabled','item_discount_type','item_discount_amount','item_discount']) assert.match(migration,new RegExp(col))
assert.match(migration,/coalesce\(\(p_order->>'item_discount'\)::numeric,0\)/)
assert.match(worker,/item_discount: discounts\.itemDiscount/)
assert.match(worker,/itemUnitDiscount\(p, prepared\.row\.unit_price\)/)
assert.match(worker,/itemUnitDiscount\(product, price\)/)
console.log('PASS: item discount %/Rp, disabled, XXL, mixed cart, bundle exception, global/volume/code stacking, quote = order preparation, SQL snapshot')
