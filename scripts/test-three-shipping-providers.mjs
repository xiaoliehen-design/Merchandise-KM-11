import assert from 'node:assert/strict'
import { readFileSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
// Prefer project's devDependency; fall back to global TypeScript in limited test runners.
let ts
try { ts = require('typescript') } catch {
  ts = require('/opt/nvm/versions/node/v22.16.0/lib/node_modules/typescript/lib/typescript.js')
}

const src = readFileSync(new URL('../worker/shippingFallback.ts', import.meta.url), 'utf8')
const tmp = mkdtempSync(join(tmpdir(), 'merchic-shipping-three-'))
const js = ts.transpileModule(src, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText
writeFileSync(join(tmp, 'shipping.mjs'), js)
const { findDestinations, getShippingQuotes, verifyDestination, signDestination } = await import(pathToFileURL(join(tmp, 'shipping.mjs')).href)
const env = { CART_SECRET: 'more-than-long-enough-test-secret', RAJAONGKIR_API_KEY: 'RO_MAIN', RAJAONGKIR_API_KEY_2: 'RO_SECOND', AGENWEBSITE_API_KEY: 'AW', AGENWEBSITE_ORIGIN_POSTAL_CODE: '10110' }
const settings = { shipping_origin_id: '31555', shipping_origin_postal_code: '10110' }
const roPlace = { id: 'ro:68423', label: 'Menteng, Jakarta Pusat', zip_code: '10310', provider: 'rajaongkir' }
const awPlace = { id: 'aw:999', label: 'Menteng, Jakarta Pusat', zip_code: '10310', provider: 'agenwebsite' }
const roData = { data: [{ id: 68423, label: 'Menteng, Jakarta Pusat', zip_code: '10310' }] }
const awData = { success: true, data: { locations: [{ subdistrict_id: '999', label: 'Menteng, Jakarta Pusat', postal_code: '10310' }] } }
const roRate = { data: [{ code: 'jne', service: 'REG', cost: 24000, description: 'Reguler', etd: '2 hari' }] }
const awRate = { success: true, data: { rates: [{ courier_code: 'jnt', service_code: 'EZ', cost: 27000, service_name: 'Express', etd_text: '3 hari' }] } }
const mkFetch = ({ ro1Search = roData, ro2Search = roData, awSearch = awData, ro1Rates = roRate, ro2Rates = roRate, awRates = awRate } = {}) => {
  const calls = []
  const get = (value) => value instanceof Error ? Promise.resolve({ ok: false, status: 503, json: async () => ({}) }) : Promise.resolve({ ok: true, status: 200, json: async () => value })
  const fn = (url, init) => {
    const provider = init.headers?.key === 'RO_MAIN' ? 'ro1' : init.headers?.key === 'RO_SECOND' ? 'ro2' : 'aw'
    const kind = url.includes('domestic-destination') || url.includes('/locations/search') ? 'search' : 'rate'
    calls.push([provider, kind])
    const response = provider === 'ro1' ? (kind === 'search' ? ro1Search : ro1Rates)
      : provider === 'ro2' ? (kind === 'search' ? ro2Search : ro2Rates)
      : (kind === 'search' ? awSearch : awRates)
    return get(response)
  }
  return { fn, calls }
}
let count = 0
const ok = (condition, detail) => { assert.ok(condition, detail); count++ }
const fail = new Error('offline')
{
  const { fn, calls } = mkFetch()
  const places = await findDestinations(env, 'Menteng', fn)
  ok(places[0].source === 'rajaongkir', 'primary search preferred')
  ok(JSON.stringify(calls) === JSON.stringify([['ro1','search']]), 'one lookup when primary succeeds')
  const verified = await verifyDestination(env, places[0].token, places[0].id)
  ok(verified.id === roPlace.id, 'signed destination verified')
  await assert.rejects(() => verifyDestination(env, places[0].token + 'A'))
  count++
  await assert.rejects(() => verifyDestination(env, places[0].token, 'ro:111'))
  count++
}
{
  const { fn, calls } = mkFetch({ ro1Search: fail })
  const places = await findDestinations(env, 'Menteng', fn)
  ok(places[0].source === 'agenwebsite', 'automatic fallback AW search')
  ok(calls.map(c => c[0]).join(',') === 'ro1,aw', 'first then second search')
}
{
  const { fn, calls } = mkFetch({ ro1Search: fail, awSearch: fail })
  const places = await findDestinations(env, 'Menteng', fn)
  ok(places[0].source === 'rajaongkir_2', 'third source available when first two offline')
  ok(calls.map(c => c[0]).join(',') === 'ro1,aw,ro2', 'full search waterfall exact order')
}
{
  const { fn } = mkFetch({ ro1Search: { data: [] }, awSearch: { data: { locations: [] } } })
  const places = await findDestinations(env, 'Menteng', fn)
  ok(places[0].source === 'rajaongkir_2', 'empty search responses trigger subsequent provider')
}
{
  const { fn, calls } = mkFetch({ awSearch: fail })
  const places = await findDestinations(env, 'Menteng', fn, true)
  ok(places[0].source === 'rajaongkir_2', 'manual AW search falls back to second Raja account')
  ok(calls.map(c => c[0]).join(',') === 'aw,ro2', 'manual AW search skips main')
}
{
  const { fn, calls } = mkFetch()
  const quotes = await getShippingQuotes(env, roPlace, 800, settings, fn)
  ok(quotes[0].provider === 'rajaongkir' && quotes[0].cost === 24000, 'primary quote')
  ok(calls.length === 1 && calls[0][0] === 'ro1', 'no extra billable calls on success')
}
{
  const { fn, calls } = mkFetch({ ro1Rates: fail })
  const quotes = await getShippingQuotes(env, roPlace, 800, settings, fn)
  ok(quotes[0].provider === 'agenwebsite' && quotes[0].cost === 27000, 'AW quote automatic fallback')
  ok(calls.map(c => c[0]).join(',') === 'ro1,aw', 'quote order first > second')
}
{
  const { fn, calls } = mkFetch({ ro1Rates: fail, awRates: fail })
  const quotes = await getShippingQuotes(env, roPlace, 800, settings, fn)
  ok(quotes[0].provider === 'rajaongkir_2' && quotes[0].cost === 24000, 'second account quote fallback')
  ok(calls.map(c => c[0]).join(',') === 'ro1,aw,ro2', 'rate calls exactly in required order')
}
{
  const { fn, calls } = mkFetch({ ro1Rates: fail, awRates: fail })
  const quotes = await getShippingQuotes({ ...env, AGENWEBSITE_ORIGIN_POSTAL_CODE: '' }, roPlace, 300, { shipping_origin_id: settings.shipping_origin_id }, fn)
  ok(quotes[0].provider === 'rajaongkir_2', 'third quote when AW origin not configured')
  ok(calls.map(c => c[0]).join(',') === 'ro1,ro2', 'unavailable AW skipped safely')
}
{
  const { fn, calls } = mkFetch({ ro1Rates: fail, awRates: fail })
  const quotes = await getShippingQuotes(env, awPlace, 350, settings, fn)
  ok(quotes[0].provider === 'rajaongkir_2', 'backup Raja resolves AW destination using strict match')
  ok(calls.map(c => c[0]).join(',') === 'aw,ro2,ro2', 'second Raja used first for mapping then rate')
}
{
  const { fn } = mkFetch({ awRates: fail, ro2Search: { data: [
    { id: 68423, label: 'Menteng, Jakarta Pusat', zip_code: '10310' },
    { id: 68424, label: 'Menteng, Jakarta Pusat', zip_code: '10310' }
  ] } })
  await assert.rejects(() => getShippingQuotes(env, awPlace, 350, settings, fn), /Ongkir belum tersedia/)
  count++ // ambiguous identity never silently priced
}
{
  const { fn } = mkFetch({ awRates: fail })
  await assert.rejects(() => getShippingQuotes(env, { ...awPlace, zip_code: '' }, 350, settings, fn))
  count++
}
{
  const { fn, calls } = mkFetch()
  const quotes = await getShippingQuotes(env, roPlace, 500, settings, fn, 'rajaongkir_2')
  ok(quotes[0].provider === 'rajaongkir_2', 'checkout preserves chosen backup provider')
  ok(calls.map(c => c[0]).join(',') === 'ro2', 'checkout never silently switches to primary')
}
{
  const { fn, calls } = mkFetch()
  const quotes = await getShippingQuotes(env, roPlace, 500, settings, fn, 'agenwebsite')
  ok(quotes[0].provider === 'agenwebsite', 'checkout preserves chosen AW provider')
  ok(calls.map(c => c[0]).join(',') === 'aw', 'AW revalidation does not consume other provider')
}
{
  const { fn, calls } = mkFetch({ ro2Rates: fail })
  await assert.rejects(() => getShippingQuotes(env, roPlace, 500, settings, fn, 'rajaongkir_2'), /tidak dapat diverifikasi/)
  ok(calls.map(c => c[0]).join(',') === 'ro2', 'no silent fallback at final checkout')
}
{
  const { fn, calls } = mkFetch({ ro1Rates: { data: [{ ...roRate.data[0], cost: 0 }] } })
  const quotes = await getShippingQuotes(env, roPlace, 500, settings, fn)
  ok(quotes[0].provider === 'agenwebsite', 'zero or invalid cost rejected')
  ok(calls.map(c => c[0]).join(',') === 'ro1,aw', 'invalid costs trigger AW')
}
{
  const { fn } = mkFetch({ ro1Rates: fail, awRates: fail, ro2Rates: fail })
  await assert.rejects(() => getShippingQuotes(env, roPlace, 500, settings, fn), /Ongkir belum tersedia/)
  count++
}
{
  const { fn } = mkFetch({ ro1Search: fail, awSearch: fail, ro2Search: fail })
  await assert.rejects(() => findDestinations(env, 'Menteng', fn), /Pencarian tujuan belum tersedia/)
  count++
}
{
  const { fn } = mkFetch()
  const signed = await signDestination(env, { id: 'aw:999', label: 'Menteng', zip_code: '10310', provider: 'rajaongkir' })
  await assert.rejects(() => verifyDestination(env, signed.token), /tidak valid|kedaluwarsa/)
  count++
  await assert.rejects(() => getShippingQuotes(env, roPlace, 0, settings, fn), /Berat/)
  count++
  await assert.rejects(() => getShippingQuotes(env, roPlace, 200, settings, fn, 'INVALID'), /tidak valid/)
  count++
}
{
  const { fn } = mkFetch()
  const quotes = await getShippingQuotes({ ...env, RAJAONGKIR_MOCK: 'true' }, roPlace, 500, settings, fn)
  ok(quotes[0].provider === 'mock', 'mock isolated')
}
console.log(`PASS ${count} targeted assertions: 3-provider search/quotes, API outages, empty/invalid rates, AW/RO mapping, pinned-checkout provider, token integrity, mock`)
