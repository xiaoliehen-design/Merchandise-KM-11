/**
 * Merchic shipping-rate waterfall:
 *   1. RajaOngkir (primary API key)
 *   2. AgenWebsite
 *   3. RajaOngkir (second account/API key)
 *
 * Each call uses secrets only on the Worker. Never assume that an AgenWebsite
 * subdistrict ID is a RajaOngkir destination ID. Currency is IDR and weight grams.
 */
export type ShippingEnv = {
  CART_SECRET: string
  RAJAONGKIR_API_KEY?: string
  RAJAONGKIR_API_KEY_2?: string
  RAJAONGKIR_BASE_URL?: string
  RAJAONGKIR_MOCK?: string
  AGENWEBSITE_API_KEY?: string
  AGENWEBSITE_BASE_URL?: string
  AGENWEBSITE_ORIGIN_POSTAL_CODE?: string
}
export type ShippingProvider = 'rajaongkir' | 'agenwebsite' | 'rajaongkir_2' | 'mock'
export type Destination = {
  id: string
  label: string
  zip_code?: string
  provider: 'rajaongkir' | 'agenwebsite'
  source?: 'rajaongkir' | 'agenwebsite' | 'rajaongkir_2'
  token: string
}
export type VerifiedDestination = {
  id: string
  label: string
  zip_code: string
  provider: Destination['provider']
}
export type Quote = {
  courier: string
  service: string
  description: string
  cost: number
  etd: string
  provider: ShippingProvider
}

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
  let diff = 0
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ mac.charCodeAt(i)
  if (diff !== 0) throw new Error('Pilihan tujuan tidak valid. Cari tujuan lagi.')
  let obj: Record<string, unknown>
  try { obj = decode(payload) } catch { throw new Error('Pilihan tujuan tidak valid. Cari tujuan lagi.') }
  if (typeof obj.exp !== 'number' || obj.exp < Date.now() || obj.exp > Date.now() + SIGN_LIFETIME_MS ||
    typeof obj.id !== 'string' || obj.id.length > 100 || !/^(ro|aw):[a-zA-Z0-9_-]+$/.test(obj.id) ||
    (expectedId && obj.id !== expectedId) || typeof obj.label !== 'string' || obj.label.length > 300 ||
    !['rajaongkir', 'agenwebsite'].includes(String(obj.provider)) ||
    (obj.id.startsWith('ro:') && obj.provider !== 'rajaongkir') ||
    (obj.id.startsWith('aw:') && obj.provider !== 'agenwebsite')) throw new Error('Pilihan tujuan kedaluwarsa. Cari tujuan lagi.')
  return { id: obj.id, label: obj.label, zip_code: zip(obj.zip_code), provider: obj.provider as VerifiedDestination['provider'] }
}
async function jsonFetch(url: string, init: RequestInit, fetchFn: RequestFetch, timeout = 7000): Promise<any> {
  const res = await fetchFn(url, { ...init, signal: AbortSignal.timeout(timeout) })
  const body: any = await res.json().catch(() => null)
  if (!res.ok || !body) throw new Error(`HTTP ${res.status}`)
  if (body.meta?.status === 'error' || body.success === false) throw new Error('Penyedia menolak permintaan.')
  return body
}
const roBase = (env: ShippingEnv) => (env.RAJAONGKIR_BASE_URL || 'https://rajaongkir.komerce.id/api/v1').replace(/\/+$/, '')
const awBase = (env: ShippingEnv) => (env.AGENWEBSITE_BASE_URL || 'https://api.agenwebsite.com/v1').replace(/\/+$/, '')
const text = (x: unknown) => String(x ?? '').trim()
const zip = (x: unknown) => /^\d{5}$/.test(text(x)) ? text(x) : ''
const isMock = (env: ShippingEnv) => env.RAJAONGKIR_MOCK === 'true'
const roKeys = (env: ShippingEnv) => [env.RAJAONGKIR_API_KEY, env.RAJAONGKIR_API_KEY_2]

type UnsignedDestination = Omit<Destination, 'token'>
async function roSearch(env: ShippingEnv, query: string, key: string, source: 'rajaongkir' | 'rajaongkir_2', fetchFn: RequestFetch): Promise<UnsignedDestination[]> {
  const data = await jsonFetch(`${roBase(env)}/destination/domestic-destination?search=${encodeURIComponent(query)}&limit=15&offset=0`, { headers: { key } }, fetchFn)
  if (!Array.isArray(data.data)) throw new Error('Respons lokasi RajaOngkir tidak valid.')
  return data.data.filter((v: any) => /^[\w-]+$/.test(String(v.id || '')) && text(v.label))
    .map((v: any) => ({ id: `ro:${v.id}`, label: text(v.label), zip_code: zip(v.zip_code), provider: 'rajaongkir' as const, source }))
}
async function awSearch(env: ShippingEnv, query: string, fetchFn: RequestFetch): Promise<UnsignedDestination[]> {
  const data = await jsonFetch(`${awBase(env)}/locations/search?q=${encodeURIComponent(query)}&limit=15`, { headers: { 'x-api-key': env.AGENWEBSITE_API_KEY! } }, fetchFn)
  if (!Array.isArray(data.data?.locations)) throw new Error('Respons lokasi AgenWebsite tidak valid.')
  return data.data.locations.filter((v: any) => /^[\w-]+$/.test(String(v.subdistrict_id || '')) && text(v.label))
    .map((v: any) => ({ id: `aw:${v.subdistrict_id}`, label: text(v.label), zip_code: zip(v.postal_code), provider: 'agenwebsite' as const, source: 'agenwebsite' as const }))
}

/** Search waterfall: RajaOngkir #1 > AgenWebsite > RajaOngkir #2.
 * Manual AgenWebsite search remains available but falls through to RajaOngkir #2 if unavailable.
 */
export async function findDestinations(env: ShippingEnv, query: string, fetchFn: RequestFetch = fetch, forceFallback = false): Promise<Destination[]> {
  const q = text(query).slice(0, 80)
  if (q.length < 3) throw new Error('Ketik minimal 3 karakter.')
  if (isMock(env)) return Promise.all([{ id: 'ro:1', label: `${q} (MOCK)`, zip_code: '10110', provider: 'rajaongkir' as const, source: 'rajaongkir' as const }].map(d => signDestination(env, d)))
  const keys = roKeys(env)
  const attempts: Array<() => Promise<UnsignedDestination[]>> = []
  if (!forceFallback && keys[0]) attempts.push(() => roSearch(env, q, keys[0]!, 'rajaongkir', fetchFn))
  if (env.AGENWEBSITE_API_KEY) attempts.push(() => awSearch(env, q, fetchFn))
  if (keys[1]) attempts.push(() => roSearch(env, q, keys[1]!, 'rajaongkir_2', fetchFn))
  let hadWorkingResponse = false
  for (const attempt of attempts) {
    try {
      const entries = await attempt()
      hadWorkingResponse = true
      if (entries.length) return Promise.all(entries.map(d => signDestination(env, d)))
    } catch { /* move to next configured provider; never expose keys or raw errors */ }
  }
  if (hadWorkingResponse) return []
  throw new Error('Pencarian tujuan belum tersedia pada layanan pengiriman. Periksa konfigurasi API atau coba lagi.')
}

function parseQuotes(data: any, provider: ShippingProvider): Quote[] {
  const rates = provider === 'agenwebsite' ? data.data?.rates : data.data
  if (!Array.isArray(rates)) throw new Error('Respons tarif tidak valid.')
  return rates.map((v: any) => provider === 'agenwebsite'
    ? ({ courier: text(v.courier_code).toLowerCase(), service: text(v.service_code), description: text(v.service_name || v.courier_name), cost: Number(v.cost), etd: text(v.etd_text), provider })
    : ({ courier: text(v.code || v.name).toLowerCase(), service: text(v.service), description: text(v.description || v.name), cost: Number(v.cost), etd: text(v.etd), provider }))
    .filter((v: Quote) => v.courier && v.service && Number.isFinite(v.cost) && v.cost > 0)
}

// An AgenWebsite subdistrict id is NOT a RajaOngkir id. Translate only when
// RajaOngkir returns precisely one postal-code AND locality-name match.
function locality(label: string): string {
  const first = label.split(',')[0] || ''
  return first.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\b(kelurahan|kel\.?|desa|ds\.?)\s+/g, '')
    .replace(/[^a-z0-9]+/g, ' ').trim()
}
async function roIdForDestination(env: ShippingEnv, d: VerifiedDestination, apiKey: string, source: 'rajaongkir' | 'rajaongkir_2', fetchFn: RequestFetch): Promise<string | null> {
  if (d.provider === 'rajaongkir' && d.id.startsWith('ro:')) return d.id.slice(3)
  if (d.provider !== 'agenwebsite' || !d.zip_code) return null
  const expectedLocality = locality(d.label)
  if (expectedLocality.length < 3) return null
  const candidates = await roSearch(env, d.zip_code, apiKey, source, fetchFn)
  const matches = candidates.filter(x => x.zip_code === d.zip_code && locality(x.label) === expectedLocality)
  return matches.length === 1 ? matches[0].id.slice(3) : null
}
async function roQuotes(env: ShippingEnv, d: VerifiedDestination, grams: number, settings: Record<string, string>, apiKey: string, provider: 'rajaongkir' | 'rajaongkir_2', fetchFn: RequestFetch): Promise<Quote[]> {
  if (!settings.shipping_origin_id) return []
  const roDestination = await roIdForDestination(env, d, apiKey, provider, fetchFn)
  if (!roDestination) return []
  const form = new URLSearchParams({
    origin: settings.shipping_origin_id,
    destination: roDestination,
    weight: String(grams),
    courier: settings.shipping_couriers || 'jne:sicepat:jnt:ninja:tiki:anteraja:pos',
    price: 'lowest'
  })
  const data = await jsonFetch(`${roBase(env)}/calculate/domestic-cost`, { method: 'POST', headers: { key: apiKey, 'Content-Type': 'application/x-www-form-urlencoded' }, body: form }, fetchFn)
  return parseQuotes(data, provider)
}
async function awQuotes(env: ShippingEnv, d: VerifiedDestination, grams: number, settings: Record<string, string>, fetchFn: RequestFetch): Promise<Quote[]> {
  const origin = zip(settings.shipping_origin_postal_code || env.AGENWEBSITE_ORIGIN_POSTAL_CODE)
  if (!origin) return []
  const destination = d.provider === 'agenwebsite' ? { subdistrict_id: d.id.slice(3) } : d.zip_code ? { postal_code: d.zip_code } : null
  if (!destination) return []
  const data = await jsonFetch(`${awBase(env)}/rates`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': env.AGENWEBSITE_API_KEY! },
    body: JSON.stringify({ shipper: { postal_code: origin }, destination, weight: grams, sort: 'cheapest' })
  }, fetchFn)
  return parseQuotes(data, 'agenwebsite')
}

/**
 * For display: use first available valid quote set in the requested order.
 * For final checkout: quoteProvider locks revalidation to the provider actually
 * selected by the buyer, avoiding repricing with an unrelated fallback service.
 */
export async function getShippingQuotes(
  env: ShippingEnv,
  d: VerifiedDestination,
  weight: number,
  settings: Record<string, string>,
  fetchFn: RequestFetch = fetch,
  quoteProvider?: ShippingProvider
): Promise<Quote[]> {
  const grams = Math.ceil(weight)
  if (!Number.isFinite(grams) || grams < 1 || grams > 500000) throw new Error('Berat pengiriman tidak valid.')
  if (isMock(env)) return [{ courier: 'jne', service: 'REG', description: 'Simulasi saja', cost: 22000, etd: '2-3 hari', provider: 'mock' }]
  const allProviders: Array<'rajaongkir' | 'agenwebsite' | 'rajaongkir_2'> = ['rajaongkir', 'agenwebsite', 'rajaongkir_2']
  if (quoteProvider && !allProviders.includes(quoteProvider as any)) throw new Error('Penyedia ongkir tidak valid.')
  // A manually chosen AgenWebsite location has no native RajaOngkir ID. The first
  // applicable provider is AgenWebsite, followed by a strictly matched RajaOngkir #2.
  const providers = (quoteProvider ? [quoteProvider] : d.provider === 'agenwebsite' ? ['agenwebsite', 'rajaongkir_2'] : allProviders) as typeof allProviders
  for (const provider of providers) {
    try {
      let quotes: Quote[] = []
      if (provider === 'rajaongkir' && env.RAJAONGKIR_API_KEY) quotes = await roQuotes(env, d, grams, settings, env.RAJAONGKIR_API_KEY, provider, fetchFn)
      if (provider === 'agenwebsite' && env.AGENWEBSITE_API_KEY) quotes = await awQuotes(env, d, grams, settings, fetchFn)
      if (provider === 'rajaongkir_2' && env.RAJAONGKIR_API_KEY_2) quotes = await roQuotes(env, d, grams, settings, env.RAJAONGKIR_API_KEY_2, provider, fetchFn)
      if (quotes.length) return quotes
    } catch { /* Continue to next configured provider; do not leak raw API errors. */ }
  }
  if (quoteProvider) throw new Error('Layanan ongkir yang dipilih tidak dapat diverifikasi lagi. Hitung ulang ongkir sebelum checkout.')
  throw new Error('Ongkir belum tersedia dari RajaOngkir utama, AgenWebsite, maupun RajaOngkir cadangan. Periksa lokasi/kode pos dan coba lagi.')
}
