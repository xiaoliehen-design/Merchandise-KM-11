/** KM11 shipping providers. Keys and tokens remain on the Worker. */
export type ShippingEnv = {
  CART_SECRET: string
  RAJAONGKIR_API_KEY?: string
  RAJAONGKIR_BASE_URL?: string
  RAJAONGKIR_MOCK?: string
  AGENWEBSITE_API_KEY?: string
  AGENWEBSITE_BASE_URL?: string
  AGENWEBSITE_ORIGIN_POSTAL_CODE?: string
}
export type Destination = { id: string; label: string; zip_code?: string; provider: 'rajaongkir' | 'agenwebsite'; token: string }
export type VerifiedDestination = { id: string; label: string; zip_code: string; provider: Destination['provider'] }
export type Quote = { courier: string; service: string; description: string; cost: number; etd: string; provider: 'rajaongkir' | 'agenwebsite' | 'mock' }

type RequestFetch = typeof fetch
const encode = (value: object) => btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(value)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const decode = (value: string) => JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0)))) as Record<string, unknown>
const SIGN_LIFETIME_MS = 30 * 60 * 1000
async function signature(secret: string, payload: string) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const digest = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload))
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('')
}
export async function signDestination(env: ShippingEnv, entry: Omit<Destination, 'token'>): Promise<Destination> {
  const payload = encode({ ...entry, exp: Date.now() + SIGN_LIFETIME_MS })
  return { ...entry, token: `${payload}.${await signature(env.CART_SECRET, payload)}` }
}
export async function verifyDestination(env: ShippingEnv, token: string, expectedId?: string): Promise<VerifiedDestination> {
  const [payload, mac, extra] = (token || '').split('.')
  if (!payload || !mac || extra || !/^[a-f0-9]{64}$/.test(mac) || payload.length > 3000) throw new Error('Pilihan tujuan tidak valid. Cari tujuan lagi.')
  const expected = await signature(env.CART_SECRET, payload)
  // Constant-length constant-work comparison; avoids exposing a forgery oracle.
  let diff = 0
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ mac.charCodeAt(i)
  if (diff !== 0) throw new Error('Pilihan tujuan tidak valid. Cari tujuan lagi.')
  let obj: Record<string, unknown>
  try { obj = decode(payload) } catch { throw new Error('Pilihan tujuan tidak valid. Cari tujuan lagi.') }
  if (typeof obj.exp !== 'number' || obj.exp < Date.now() || obj.exp > Date.now() + SIGN_LIFETIME_MS ||
    typeof obj.id !== 'string' || obj.id.length > 100 || !/^(ro|aw):[a-zA-Z0-9_-]+$/.test(obj.id) ||
    (expectedId && obj.id !== expectedId) || typeof obj.label !== 'string' || obj.label.length > 300 ||
    !['rajaongkir', 'agenwebsite'].includes(String(obj.provider))) throw new Error('Pilihan tujuan kedaluwarsa. Cari tujuan lagi.')
  return { id: obj.id, label: obj.label, zip_code: String(obj.zip_code || ''), provider: obj.provider as VerifiedDestination['provider'] }
}
async function jsonFetch(url: string, init: RequestInit, fetchFn: RequestFetch, timeout = 7000): Promise<any> {
  const res = await fetchFn(url, { ...init, signal: AbortSignal.timeout(timeout) })
  const body: any = await res.json().catch(() => null)
  if (!res.ok || !body) throw new Error(`HTTP ${res.status}`)
  return body
}
const roBase = (env: ShippingEnv) => (env.RAJAONGKIR_BASE_URL || 'https://rajaongkir.komerce.id/api/v1').replace(/\/+$/, '')
const awBase = (env: ShippingEnv) => (env.AGENWEBSITE_BASE_URL || 'https://api.agenwebsite.com/v1').replace(/\/+$/, '')
const text = (x: unknown) => String(x ?? '').trim()
const zip = (x: unknown) => /^\d{5}$/.test(text(x)) ? text(x) : ''
function isMock(env: ShippingEnv) { return env.RAJAONGKIR_MOCK === 'true' }

export async function findDestinations(env: ShippingEnv, query: string, fetchFn: RequestFetch = fetch, forceFallback = false): Promise<Destination[]> {
  const q = text(query).slice(0, 80)
  if (q.length < 3) throw new Error('Ketik minimal 3 karakter.')
  if (isMock(env)) return Promise.all([{ id:'ro:1',label:`${q} (MOCK)`,zip_code:'10110',provider:'rajaongkir' as const }].map(d => signDestination(env,d)))
  let primaryFailed = forceFallback || !env.RAJAONGKIR_API_KEY
  if (!forceFallback && env.RAJAONGKIR_API_KEY) {
    try {
      const data = await jsonFetch(`${roBase(env)}/destination/domestic-destination?search=${encodeURIComponent(q)}&limit=15&offset=0`, { headers: { key:env.RAJAONGKIR_API_KEY } }, fetchFn)
      if (data.meta?.status === 'error') throw new Error(text(data.meta.message))
      const entries: Array<Omit<Destination,'token'>> = (Array.isArray(data.data)?data.data:[]).filter((v:any) => /^[\w-]+$/.test(String(v.id || '')))
        .map((v:any)=>({ id:`ro:${v.id}`, label:text(v.label), zip_code:zip(v.zip_code),provider:'rajaongkir' as const }))
      if (entries.length) return Promise.all(entries.map(d=>signDestination(env,d)))
      primaryFailed = true
    } catch { primaryFailed = true }
  }
  if (!primaryFailed || !env.AGENWEBSITE_API_KEY) return []
  const data = await jsonFetch(`${awBase(env)}/locations/search?q=${encodeURIComponent(q)}&limit=15`, { headers: {'x-api-key':env.AGENWEBSITE_API_KEY} }, fetchFn)
  if (data.success === false) throw new Error('Pencarian lokasi AgenWebsite gagal.')
  const entries: Array<Omit<Destination,'token'>> = (Array.isArray(data.data?.locations) ? data.data.locations : [])
    .filter((v:any) => /^[\w-]+$/.test(String(v.subdistrict_id||'')))
    .map((v:any)=>({ id:`aw:${v.subdistrict_id}`,label:text(v.label),zip_code:zip(v.postal_code),provider:'agenwebsite' as const }))
  return Promise.all(entries.map(d=>signDestination(env,d)))
}

export async function getShippingQuotes(env:ShippingEnv, d:VerifiedDestination, weight:number, settings:Record<string,string>, fetchFn:RequestFetch = fetch):Promise<Quote[]> {
  const grams = Math.ceil(weight)
  if (!Number.isFinite(grams) || grams < 1 || grams > 500000) throw new Error('Berat pengiriman tidak valid.')
  if (isMock(env)) return [{courier:'jne',service:'REG',description:'Simulasi saja',cost:22000,etd:'2-3 hari',provider:'mock'}]
  const errors: string[]=[]
  if (d.provider === 'rajaongkir' && env.RAJAONGKIR_API_KEY && settings.shipping_origin_id) {
    try {
      const form = new URLSearchParams({ origin:settings.shipping_origin_id,destination:d.id.slice(3),weight:String(grams),courier:settings.shipping_couriers || 'jne:sicepat:jnt:ninja:tiki:anteraja:pos',price:'lowest' })
      const data = await jsonFetch(`${roBase(env)}/calculate/domestic-cost`, { method:'POST',headers:{key:env.RAJAONGKIR_API_KEY,'Content-Type':'application/x-www-form-urlencoded'},body:form }, fetchFn)
      if (data.meta?.status === 'error') throw new Error(text(data.meta.message))
      const result:Quote[]=(Array.isArray(data.data)?data.data:[]).map((v:any)=>({courier:text(v.code || v.name).toLowerCase(),service:text(v.service),description:text(v.description || v.name),cost:Number(v.cost),etd:text(v.etd),provider:'rajaongkir' as const})).filter((v:Quote)=>v.courier && v.service && Number.isFinite(v.cost) && v.cost>0)
      if (result.length) return result
      errors.push('Tidak ada tarif RajaOngkir yang tersedia.')
    } catch { errors.push('RajaOngkir tidak dapat memberikan tarif.') }
  } else if (d.provider==='rajaongkir') errors.push('RajaOngkir belum siap.')

  if (!env.AGENWEBSITE_API_KEY) throw new Error(`${errors.join(' ')} AGENWEBSITE_API_KEY belum diatur.`)
  const origin = zip(settings.shipping_origin_postal_code || env.AGENWEBSITE_ORIGIN_POSTAL_CODE)
  if (!origin) throw new Error(`${errors.join(' ')} Atur kode pos asal AgenWebsite (5 digit) di Pengaturan atau AGENWEBSITE_ORIGIN_POSTAL_CODE.`)
  const destinationLocation=d.provider==='agenwebsite' ? {subdistrict_id:d.id.slice(3)} : d.zip_code ? {postal_code:zip(d.zip_code)} : null
  if (!destinationLocation || Object.values(destinationLocation).some(v=>!v)) throw new Error(`${errors.join(' ')} Kode pos tujuan tidak tersedia untuk fallback. Cari ulang alamat tujuan melalui AgenWebsite.`)
  try {
    const data=await jsonFetch(`${awBase(env)}/rates`,{method:'POST',headers:{'Content-Type':'application/json','x-api-key':env.AGENWEBSITE_API_KEY},body:JSON.stringify({shipper:{postal_code:origin},destination:destinationLocation,weight:grams,sort:'cheapest'})},fetchFn)
    if (data.success === false) throw new Error('AgenWebsite menolak perhitungan ongkir.')
    const rates:Quote[]=(Array.isArray(data.data?.rates)?data.data.rates:[]).map((v:any)=>({courier:text(v.courier_code).toLowerCase(),service:text(v.service_code),description:text(v.service_name || v.courier_name),cost:Number(v.cost),etd:text(v.etd_text),provider:'agenwebsite' as const})).filter((v:Quote)=>v.courier && v.service && Number.isFinite(v.cost) && v.cost>0)
    if (rates.length) return rates
  } catch { throw new Error(`${errors.join(' ')} AgenWebsite juga gagal memberikan tarif. Coba lagi atau hubungi admin.`) }
  throw new Error(`${errors.join(' ')} AgenWebsite tidak memiliki tarif untuk tujuan ini.`)
}
