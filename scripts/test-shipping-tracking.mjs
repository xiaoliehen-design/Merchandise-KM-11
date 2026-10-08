import fs from 'node:fs'
import assert from 'node:assert/strict'
import path from 'node:path'
import os from 'node:os'
import { createRequire } from 'node:module'
const require=createRequire(import.meta.url)
const ts=require('/opt/nvm/versions/node/v22.16.0/lib/node_modules/typescript')
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'km11-shipping-'))
for(const file of ['shippingFallback','tracking17']){
  const raw=fs.readFileSync(new URL(`../worker/${file}.ts`,import.meta.url),'utf8')
  const transpiled=ts.transpileModule(raw,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText
  fs.writeFileSync(path.join(temp,file+'.mjs'),transpiled)
}
const sf=await import('file://'+path.join(temp,'shippingFallback.mjs'))
const t17=await import('file://'+path.join(temp,'tracking17.mjs'))
let counter=0
const env={CART_SECRET:'test-secret-for-validation-only',RAJAONGKIR_API_KEY:'test-primary',AGENWEBSITE_API_KEY:'test-fallback',AGENWEBSITE_ORIGIN_POSTAL_CODE:'14420'}
const fakeFetch=async(url,init)=>{
  counter++
  if(url.includes('domestic-destination')) return {ok:true,json:async()=>({data:[{id:123,label:'Menteng, Jakarta 10310',zip_code:'10310'}]})}
  if(url.includes('domestic-cost')) return {ok:false,status:503,json:async()=>({})}
  if(url.includes('/v1/rates')) return {ok:true,json:async()=>({success:true,data:{rates:[{courier_code:'jnt',service_code:'jnt_ez',service_name:'Reguler',cost:15000,etd_text:'2-3 hari'}]}})}
  if(url.includes('/v1/locations/search')) return {ok:true,json:async()=>({success:true,data:{locations:[{subdistrict_id:'327101',label:'Menteng, Jakarta',postal_code:'10310'}]}})}
  throw Error('Unexpected URL '+url)
}
const dests=await sf.findDestinations(env,'Menteng',fakeFetch)
assert.equal(dests.length,1); assert.equal(dests[0].provider,'rajaongkir')
const dest=await sf.verifyDestination(env,dests[0].token,dests[0].id)
assert.equal(dest.zip_code,'10310'); assert.ok(dests[0].token.length>50)
const quotes=await sf.getShippingQuotes(env,dest,1500, {shipping_origin_id:'77'},fakeFetch)
assert.equal(quotes.length,1); assert.equal(quotes[0].provider,'agenwebsite');assert.equal(quotes[0].cost,15000)
await assert.rejects(()=>sf.verifyDestination(env,dests[0].token+'X',dests[0].id))
await assert.rejects(()=>sf.verifyDestination(env,dests[0].token,'ro:999'))
const fallback=await sf.findDestinations(env,'Menteng',fakeFetch,true)
assert.equal(fallback[0].provider,'agenwebsite')
const fallbackPlace=await sf.verifyDestination(env,fallback[0].token)
const fallbackQuotes=await sf.getShippingQuotes(env,fallbackPlace,500,{},fakeFetch)
assert.equal(fallbackQuotes[0].provider,'agenwebsite')
const mocks=await sf.getShippingQuotes({...env,RAJAONGKIR_MOCK:'true'},dest,100,{},fakeFetch)
assert.equal(mocks[0].provider,'mock')
console.log('PASS shipping: signed destination / forged token rejected / Raja -> AgenWebsite fallback / direct AgenWebsite / mock')
const accepted={accepted:[{track_info:{latest_status:{status:'Delivered',sub_status:'Delivered_Other'},latest_event:{time_utc:'2026-10-08T05:00:00Z',description:'Diterima'},tracking:{providers:[{provider:{name:'J&T'},events:[{time_utc:'2026-10-08T05:00:00Z',description:'Diterima',location:'Jakarta',stage:'Delivered'},{time_utc:'2026-10-07T05:00:00Z',description:'Dalam perjalanan',location:'Bogor'}]}]}}}]}
const normal=t17.normalize17(accepted)
assert.equal(normal.status,'Delivered');assert.equal(normal.events.length,2);assert.equal(normal.events[0].description,'Diterima')
const waiting=t17.normalize17({rejected:[{error:{message:'No tracking information'}}]})
assert.equal(waiting.trackingAvailable,false)
const apiFetch=async(url)=>({ok:true,status:200,json:async()=>({code:0,data:url.includes('gettrackinfo')?accepted:{accepted:[{number:'JX123456789'}]}})})
const registered=await t17.register17({TRACK17_API_KEY:'test-secret'},'JX123456789',apiFetch)
assert.equal(registered.ok,true)
const tracked=await t17.get17({TRACK17_API_KEY:'test-secret'},'JX123456789',apiFetch)
assert.equal(tracked.status,'Delivered')
const noKey=await t17.get17({},'JX123456789',apiFetch)
assert.equal(noKey.trackingAvailable,false)
console.log('PASS tracking: registration / 17TRACK response parsing / chronological history / unavailable tracking / no key')
console.log('PASS total 11 integration assertions, mocked provider responses; network calls:',counter)
