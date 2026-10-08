import { Hono } from 'hono'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

type Bindings = {
  APP_NAME: string
  SUPABASE_URL: string
  SUPABASE_ANON_KEY: string
  SUPABASE_SERVICE_ROLE_KEY: string
  RAJAONGKIR_API_KEY?: string
  RAJAONGKIR_BASE_URL: string
  RAJAONGKIR_MOCK?: string
  CART_SECRET: string
}

type Variables = { adminId?: string; adminUsername?: string }
const app = new Hono<{ Bindings: Bindings; Variables: Variables }>()

function service(env: Bindings): SupabaseClient {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } })
}
function anon(env: Bindings): SupabaseClient {
  return createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } })
}
const REQUIRED_BINDINGS = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'CART_SECRET'] as const
const WORKER_REVISION = 'km11-login-diagnostics-2026-10-08-v2'

// Report names only; environment values and secrets must never be returned to visitors.
function missingBindings(env: Bindings | undefined): string[] {
  return REQUIRED_BINDINGS.filter(key => typeof env?.[key] !== 'string' || !env[key].trim())
}
function requireEnv(env: Bindings) {
  const missing = missingBindings(env)
  if (missing.length) throw new Error(`Server belum dikonfigurasi: ${missing[0]}`)
}
function cleanText(v: unknown, max = 500) { return String(v ?? '').trim().slice(0, max) }
function isUuid(v: unknown) { return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(v || '')) }
async function sha256(input: string) { const data = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input)); return [...new Uint8Array(data)].map(b => b.toString(16).padStart(2, '0')).join('') }
function randomPath(prefix: string, file: File) { const ext = (file.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 6); return `${prefix}/${crypto.randomUUID()}.${ext || 'bin'}` }
function allowedUpload(file: File, kind: 'image' | 'proof') {
  if (file.size <= 0 || file.size > 5 * 1024 * 1024) throw new Error('File harus berukuran 1 byte sampai 5 MB.')
  const images = ['image/jpeg', 'image/png', 'image/webp']
  const allowed = kind === 'image' ? images : [...images, 'application/pdf']
  if (!allowed.includes(file.type)) throw new Error(`Format file tidak didukung (${file.type || 'unknown'}).`)
}
function isMock(env: Bindings) { return String(env.RAJAONGKIR_MOCK).toLowerCase() === 'true' }
function parsePngDataUrl(input: string) {
  const match = /^data:image\/png;base64,(.+)$/i.exec(String(input || ''))
  if (!match) throw new Error('Preview desain kartu harus berupa PNG.')
  const raw = atob(match[1])
  const bytes = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i)
  if (bytes.byteLength > 5 * 1024 * 1024) throw new Error('Preview desain kartu melebihi 5 MB.')
  return bytes
}

app.use('/api/*', async (c, next) => {
  // Health checks must work even if the production environment is incomplete.
  if (c.req.path === '/api/health') return next()
  try { requireEnv(c.env) } catch (e) { return c.json({ error: (e as Error).message }, 500) }
  await next()
})

app.use('/api/admin/*', async (c, next) => {
  if (c.req.path === '/api/admin/login' || c.req.path === '/api/admin/refresh') return next()
  const authz = c.req.header('Authorization') || ''
  const token = authz.startsWith('Bearer ') ? authz.slice(7) : ''
  if (!token) return c.json({ error: 'Sesi admin diperlukan.' }, 401)
  const { data: userData, error: userErr } = await anon(c.env).auth.getUser(token)
  if (userErr || !userData.user) return c.json({ error: 'Sesi admin tidak valid atau kedaluwarsa.' }, 401)
  const sb = service(c.env)
  const { data: admin, error } = await sb.from('admins').select('id,username,active').eq('auth_user_id', userData.user.id).eq('active', true).maybeSingle()
  if (error || !admin) return c.json({ error: 'Akun ini bukan admin aktif.' }, 403)
  c.set('adminId', admin.id); c.set('adminUsername', admin.username)
  return next()
})

app.get('/api/health', c => {
  const missing = missingBindings(c.env)
  c.header('Cache-Control', 'no-store')
  return c.json({
    ok: true,
    app: c.env?.APP_NAME || 'KM 11 Merchandise',
    revision: WORKER_REVISION,
    configured: missing.length === 0,
    missing_bindings: missing,
    time: new Date().toISOString()
  })
})

app.get('/api/products', async c => {
  const { data, error } = await service(c.env).from('products').select('*').eq('active', true).order('featured', { ascending: false }).order('created_at', { ascending: false })
  if (error) throw error
  return c.json(data || [])
})
app.get('/api/pickup-locations', async c => {
  const { data, error } = await service(c.env).from('pickup_locations').select('*,pickup_slots(*)').eq('active', true).order('name')
  if (error) throw error
  return c.json((data || []).map((p: any) => ({ ...p, slots: (p.pickup_slots || []).filter((s: any) => s.active && new Date(s.ends_at) > new Date()).sort((a: any, b: any) => a.starts_at.localeCompare(b.starts_at)), pickup_slots: undefined })))
})
app.get('/api/payment-methods', async c => {
  const { data, error } = await service(c.env).from('payment_methods').select('*').eq('active', true).order('sort_order').order('name')
  if (error) throw error
  return c.json(data || [])
})

async function cartKeys(c: any) {
  const token = cleanText(c.req.header('x-cart-token'), 200)
  if (!token) throw new Error('Cart token tidak tersedia.')
  const ip = c.req.header('CF-Connecting-IP') || c.req.header('x-forwarded-for') || 'local'
  return { tokenHash: await sha256(`${c.env.CART_SECRET}|token|${token}`), ipHash: await sha256(`${c.env.CART_SECRET}|ip|${ip}`) }
}
app.get('/api/cart', async c => {
  const { tokenHash } = await cartKeys(c)
  const { data, error } = await service(c.env).from('anonymous_carts').select('items').eq('token_hash', tokenHash).maybeSingle()
  if (error) throw error
  return c.json({ items: Array.isArray(data?.items) ? data.items : [] })
})
app.put('/api/cart', async c => {
  const { tokenHash, ipHash } = await cartKeys(c)
  const body = await c.req.json().catch(() => ({}))
  const items = Array.isArray(body.items) ? body.items.slice(0, 100) : []
  const { error } = await service(c.env).from('anonymous_carts').upsert({ token_hash: tokenHash, ip_hash: ipHash, items, updated_at: new Date().toISOString() }, { onConflict: 'token_hash' })
  if (error) throw error
  return c.json({ ok: true })
})

async function getSettings(env: Bindings) {
  const { data, error } = await service(env).from('app_settings').select('key,value')
  if (error) throw error
  return Object.fromEntries((data || []).map((r: any) => [r.key, r.value])) as Record<string, string>
}
async function rajaJson(env: Bindings, path: string, init?: RequestInit) {
  if (!env.RAJAONGKIR_API_KEY) throw new Error('RAJAONGKIR_API_KEY belum dikonfigurasi.')
  const base = (env.RAJAONGKIR_BASE_URL || 'https://rajaongkir.komerce.id/api/v1').replace(/\/$/, '')
  const res = await fetch(`${base}${path}`, { ...init, headers: { ...(init?.headers || {}), key: env.RAJAONGKIR_API_KEY } })
  const json: any = await res.json().catch(() => null)
  if (!res.ok || !json || json.meta?.status === 'error') throw new Error(json?.meta?.message || `RajaOngkir error ${res.status}`)
  return json
}
async function shippingQuotes(env: Bindings, destinationId: string, weight: number) {
  if (isMock(env)) return [
    { courier: 'jne', service: 'REG', description: 'Regular Service (mock)', cost: 22000, etd: '2-3 day' },
    { courier: 'jnt', service: 'EZ', description: 'Regular Service (mock)', cost: 20500, etd: '2-4 day' },
    { courier: 'sicepat', service: 'REG', description: 'Regular Service (mock)', cost: 21500, etd: '2-3 day' }
  ]
  const settings = await getSettings(env)
  const origin = settings.shipping_origin_id
  if (!origin) throw new Error('Admin belum mengatur RajaOngkir Origin ID.')
  const courier = settings.shipping_couriers || 'jne:sicepat:jnt:ninja:tiki:anteraja:pos'
  const form = new URLSearchParams({ origin, destination: destinationId, weight: String(Math.max(1, Math.ceil(weight))), courier, price: 'lowest' })
  const json = await rajaJson(env, '/calculate/domestic-cost', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: form })
  return (Array.isArray(json.data) ? json.data : []).map((x: any) => ({ courier: String(x.code || x.name || '').toLowerCase(), service: String(x.service || ''), description: String(x.description || x.name || ''), cost: Number(x.cost || 0), etd: String(x.etd || '') })).filter((x: any) => x.courier && x.service && Number.isFinite(x.cost))
}
app.get('/api/shipping/destinations', async c => {
  const q = cleanText(c.req.query('q'), 100)
  if (q.length < 3) return c.json({ error: 'Ketik minimal 3 karakter.' }, 400)
  if (isMock(c.env)) return c.json([
    { id: 'mock-jkt-utara', label: `${q} · Jakarta Utara (MOCK)`, zip_code: '14420' },
    { id: 'mock-jkt-pusat', label: `${q} · Jakarta Pusat (MOCK)`, zip_code: '10610' }
  ])
  const json = await rajaJson(c.env, `/destination/domestic-destination?search=${encodeURIComponent(q)}&limit=15&offset=0`)
  return c.json((json.data || []).map((x: any) => ({ id: String(x.id), label: String(x.label), zip_code: x.zip_code ? String(x.zip_code) : undefined })))
})
app.post('/api/shipping/quotes', async c => {
  const b = await c.req.json()
  const destinationId = cleanText(b.destinationId, 100), weight = Number(b.weight)
  if (!destinationId || !Number.isFinite(weight) || weight <= 0) return c.json({ error: 'Tujuan/berat tidak valid.' }, 400)
  return c.json(await shippingQuotes(c.env, destinationId, weight))
})

app.post('/api/orders', async c => {
  const b: any = await c.req.json().catch(() => null)
  if (!b || !Array.isArray(b.items) || !b.items.length) return c.json({ error: 'Keranjang kosong.' }, 400)
  if (b.items.length > 100) return c.json({ error: 'Terlalu banyak item.' }, 400)
  const customer = b.customer || {}
  const fullName = cleanText(customer.fullName, 120), email = cleanText(customer.email, 160).toLowerCase(), phone = cleanText(customer.phone, 40), address = cleanText(customer.address, 1000)
  if (!fullName || !/^\S+@\S+\.\S+$/.test(email) || phone.replace(/\D/g, '').length < 9) return c.json({ error: 'Data customer belum lengkap/valid.' }, 400)
  if (b.items.some((x: any) => !isUuid(x?.productId))) return c.json({ error: 'Produk pada keranjang tidak valid.' }, 400)
  const ids = [...new Set(b.items.map((x: any) => String(x.productId)))]
  const sb = service(c.env)
  const { data: products, error: prodErr } = await sb.from('products').select('*').in('id', ids).eq('active', true)
  if (prodErr) throw prodErr
  if ((products || []).length !== ids.length) return c.json({ error: 'Ada produk yang sudah tidak tersedia.' }, 409)
  const byId = new Map((products || []).map((p: any) => [p.id, p]))
  let subtotal = 0, weight = 0
  const preparedItems = b.items.map((i: any) => {
    const p: any = byId.get(String(i.productId))
    const qty = Math.floor(Number(i.qty))
    if (!p || !Number.isFinite(qty) || qty < 1 || qty > 999) throw new Error('Jumlah item tidak valid.')
    const color = i.color ? cleanText(i.color, 60) : null
    const size = i.size ? cleanText(i.size, 40) : null
    if (p.colors?.length && (!color || !p.colors.includes(color))) throw new Error(`Warna untuk ${p.name} tidak valid.`)
    if (p.sizes?.length && (!size || !p.sizes.includes(size))) throw new Error(`Ukuran untuk ${p.name} tidak valid.`)
    let customization: any = null
    let previewDataUrl: string | null = null
    if ((p.product_type || 'standard') === 'emoney_card') {
      const input = i.customization && typeof i.customization === 'object' ? i.customization : null
      if (!input) throw new Error(`Produk ${p.name} memerlukan desain custom.`)
      const customerName = cleanText(input.customerName, 60)
      const templateId = cleanText(input.templateId, 40)
      const templateLabel = cleanText(input.templateLabel, 80)
      previewDataUrl = String(input.previewDataUrl || '')
      if (!customerName || !templateId || !previewDataUrl) throw new Error(`Desain untuk ${p.name} belum lengkap.`)
      parsePngDataUrl(previewDataUrl)
      customization = {
        type: 'emoney_card',
        templateId,
        templateLabel,
        customerName,
        nameX: Number(input.nameX || 0),
        nameY: Number(input.nameY || 0),
        nameSize: Number(input.nameSize || 0),
        photoX: Number(input.photoX || 0),
        photoY: Number(input.photoY || 0),
        photoScale: Number(input.photoScale || 0)
      }
    }
    const line = Number(p.base_price) * qty
    subtotal += line
    weight += Number(p.weight_grams || 0) * qty
    return {
      row: { product_id: p.id, product_name: p.name, variant_color: color, variant_size: size, unit_price: Number(p.base_price), quantity: qty, line_total: line },
      customization,
      previewDataUrl
    }
  })
  const itemRows = preparedItems.map((x: any) => x.row)
  const fulfillmentType = b.fulfillmentType === 'pickup' ? 'pickup' : 'ship'
  let shippingCost = 0, shippingCourier: string | null = null, shippingService: string | null = null, destinationId: string | null = null, destinationLabel: string | null = null, pickupLocationId: string | null = null, pickupSlotId: string | null = null
  if (fulfillmentType === 'ship') {
    if (!address) return c.json({ error: 'Alamat lengkap wajib diisi.' }, 400)
    destinationId = cleanText(b.destinationId, 100); destinationLabel = cleanText(b.destinationLabel, 300)
    if (!destinationId) return c.json({ error: 'Tujuan pengiriman wajib dipilih.' }, 400)
    const requested = b.shippingQuote || {}
    const quotes = await shippingQuotes(c.env, destinationId, Math.max(1, weight))
    const match = quotes.find((x: any) => x.courier.toLowerCase() === cleanText(requested.courier, 60).toLowerCase() && x.service.toLowerCase() === cleanText(requested.service, 60).toLowerCase())
    if (!match) return c.json({ error: 'Layanan kirim tidak tersedia lagi. Silakan hitung ulang ongkir.' }, 409)
    shippingCost = Number(match.cost); shippingCourier = match.courier; shippingService = match.service
  } else {
    pickupLocationId = cleanText(b.pickupLocationId, 80); pickupSlotId = cleanText(b.pickupSlotId, 80)
    if (!isUuid(pickupLocationId) || !isUuid(pickupSlotId)) return c.json({ error: 'Lokasi/waktu pickup tidak valid.' }, 400)
    const { data: slot } = await sb.from('pickup_slots').select('id,location_id,active,starts_at,ends_at').eq('id', pickupSlotId).eq('location_id', pickupLocationId).eq('active', true).maybeSingle()
    const { data: loc } = await sb.from('pickup_locations').select('id,active').eq('id', pickupLocationId).eq('active', true).maybeSingle()
    if (!slot || !loc || new Date(slot.ends_at) <= new Date()) return c.json({ error: 'Slot pickup tidak tersedia.' }, 409)
  }
  const paymentMethodId = cleanText(b.paymentMethodId, 80)
  if (!isUuid(paymentMethodId)) return c.json({ error: 'Metode pembayaran tidak valid.' }, 400)
  const { data: pay } = await sb.from('payment_methods').select('id,name,active').eq('id', paymentMethodId).eq('active', true).maybeSingle()
  if (!pay) return c.json({ error: 'Metode pembayaran tidak tersedia.' }, 409)
  const total = subtotal + shippingCost
  const paymentUploadToken = `${crypto.randomUUID()}${crypto.randomUUID()}`.replace(/-/g, '')
  const paymentUploadTokenHash = await sha256(`${c.env.CART_SECRET}|payment|${paymentUploadToken}`)
  const { data: created, error: createErr } = await sb.rpc('create_order_atomic', { p_order: { full_name: fullName, email, phone, address: fulfillmentType === 'ship' ? address : null, fulfillment_type: fulfillmentType, pickup_location_id: pickupLocationId, pickup_slot_id: pickupSlotId, shipping_destination_id: destinationId, shipping_destination_label: destinationLabel, shipping_courier: shippingCourier, shipping_service: shippingService, shipping_cost: shippingCost, subtotal, total, payment_method_id: pay.id, payment_method_name: pay.name, payment_upload_token_hash: paymentUploadTokenHash }, p_items: itemRows })
  if (createErr) throw createErr
  const row = Array.isArray(created) ? created[0] : created
  if (preparedItems.some((x: any) => x.customization && x.previewDataUrl)) {
    const { data: insertedItems, error: itemsErr } = await sb.from('order_items').select('id').eq('order_id', row.order_id).order('created_at', { ascending: true })
    if (itemsErr) throw itemsErr
    for (let idx = 0; idx < preparedItems.length; idx++) {
      const prepared = preparedItems[idx]
      const target = insertedItems?.[idx]
      if (!target || !prepared.customization || !prepared.previewDataUrl) continue
      const bytes = parsePngDataUrl(prepared.previewDataUrl)
      const file = new File([bytes], 'design.png', { type: 'image/png' })
      const path = randomPath(`designs/${row.order_id}`, file)
      const { error: upErr } = await sb.storage.from('design-assets').upload(path, file, { contentType: 'image/png', upsert: false })
      if (upErr) throw upErr
      const { data: publicUrl } = sb.storage.from('design-assets').getPublicUrl(path)
      const { error: updateErr } = await sb.from('order_items').update({ customization: prepared.customization, design_image_path: path, design_image_url: publicUrl.publicUrl }).eq('id', target.id)
      if (updateErr) throw updateErr
    }
  }
  return c.json({ orderId: row.order_id, receiptNo: row.receipt_no, total, uploadToken: paymentUploadToken }, 201)
})

app.post('/api/orders/:receipt/payment-proof', async c => {
  const receipt = cleanText(c.req.param('receipt'), 80).toUpperCase(); const sb = service(c.env)
  const { data: order } = await sb.from('orders').select('id,status,payment_proof_path,payment_upload_token_hash').eq('receipt_no', receipt).maybeSingle()
  if (!order) return c.json({ error: 'Receipt tidak ditemukan.' }, 404)
  if (order.status !== 'new') return c.json({ error: 'Bukti bayar tidak dapat diubah setelah order diverifikasi.' }, 409)
  const uploadToken = cleanText(c.req.header('x-payment-upload-token'), 300)
  const uploadHash = uploadToken ? await sha256(`${c.env.CART_SECRET}|payment|${uploadToken}`) : ''
  if (!order.payment_upload_token_hash || uploadHash !== order.payment_upload_token_hash) return c.json({ error: 'Token upload bukti bayar tidak valid.' }, 403)
  const body = await c.req.parseBody(); const file = body.file
  if (!(file instanceof File)) return c.json({ error: 'File bukti bayar wajib dipilih.' }, 400)
  allowedUpload(file, 'proof'); const path = randomPath(`orders/${order.id}`, file)
  const { error: upErr } = await sb.storage.from('payment-proofs').upload(path, file, { contentType: file.type, upsert: false }); if (upErr) throw upErr
  if (order.payment_proof_path) await sb.storage.from('payment-proofs').remove([order.payment_proof_path]).catch(() => undefined)
  const { error } = await sb.from('orders').update({ payment_proof_path: path, payment_upload_token_hash: null, updated_at: new Date().toISOString() }).eq('id', order.id); if (error) throw error
  return c.json({ ok: true })
})

async function trackWaybill(env: Bindings, awb: string, courier: string, phone: string) {
  if (isMock(env)) return { delivered: false, summary: { courier_code: courier, courier_name: courier.toUpperCase(), waybill_number: awb, status: 'IN TRANSIT (MOCK)' }, delivery_status: { status: 'IN TRANSIT' }, manifest: [{ manifest_description: 'Paket diterima sistem mock', manifest_date: new Date().toISOString().slice(0, 10), manifest_time: '10:00', city_name: 'Jakarta' }] }
  const last5 = phone.replace(/\D/g, '').slice(-5)
  const json = await rajaJson(env, `/track/waybill?awb=${encodeURIComponent(awb)}&courier=${encodeURIComponent(courier)}${last5 ? `&last_phone_number=${encodeURIComponent(last5)}` : ''}`, { method: 'POST' })
  return json.data || null
}
app.get('/api/track/:receipt', async c => {
  const receipt = cleanText(c.req.param('receipt'), 80).toUpperCase(); const sb = service(c.env)
  const { data: o, error } = await sb.from('orders').select('id,receipt_no,status,fulfillment_type,pickup_location_id,pickup_slot_id,pickup_location_name,pickup_location_address,pickup_slot_starts_at,pickup_slot_ends_at,shipping_courier,shipping_service,total,tracking_number,tracking_courier,phone,created_at').eq('receipt_no', receipt).maybeSingle(); if (error) throw error
  if (!o) return c.json({ error: 'Receipt tidak ditemukan.' }, 404)
  let tracking: any = null, pickup: any = null
  if (o.fulfillment_type === 'ship' && o.tracking_number && o.tracking_courier) {
    try { tracking = await trackWaybill(c.env, o.tracking_number, o.tracking_courier, o.phone); if (tracking?.delivered && o.status !== 'completed') { await sb.from('orders').update({ status: 'completed', completed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', o.id); await sb.from('order_status_history').insert({ order_id: o.id, status: 'completed', note: 'Otomatis selesai: RajaOngkir menyatakan delivered.' }); o.status = 'completed' } } catch (e) { tracking = { error: (e as Error).message } }
  }
  if (o.fulfillment_type === 'pickup') {
    const { data: loc } = o.pickup_location_id ? await sb.from('pickup_locations').select('id,name,address').eq('id', o.pickup_location_id).maybeSingle() : { data: null }
    const { data: slot } = o.pickup_slot_id ? await sb.from('pickup_slots').select('id,starts_at,ends_at').eq('id', o.pickup_slot_id).maybeSingle() : { data: null }
    pickup = loc ? { ...loc, slot: slot || { starts_at: o.pickup_slot_starts_at, ends_at: o.pickup_slot_ends_at } } : { name: o.pickup_location_name, address: o.pickup_location_address, slot: { starts_at: o.pickup_slot_starts_at, ends_at: o.pickup_slot_ends_at } }
  }
  return c.json({ receiptNo: o.receipt_no, status: o.status, fulfillmentType: o.fulfillment_type, total: o.total, createdAt: o.created_at, trackingNumber: o.tracking_number, trackingCourier: o.tracking_courier, shippingCourier: o.shipping_courier, shippingService: o.shipping_service, tracking, pickup })
})

app.post('/api/admin/login', async c => {
  c.header('Cache-Control', 'no-store')
  const b = await c.req.json().catch(() => ({}))
  const username = cleanText(b.username, 80).toLowerCase()
  const password = typeof b.password === 'string' ? b.password : ''
  if (!username || !password) return c.json({ error: 'Username dan password wajib diisi.' }, 400)

  // Database or service-role configuration errors must NOT be reported as wrong passwords.
  const { data: adm, error: lookupError } = await service(c.env)
    .from('admins')
    .select('username,auth_email,auth_user_id,active')
    .eq('username_lower', username)
    .eq('active', true)
    .maybeSingle()
  if (lookupError) {
    console.error('KM11 admin login: admins lookup failed', { code: lookupError.code, message: lookupError.message })
    return c.json({ error: 'Koneksi database admin bermasalah. Periksa SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY pada Cloudflare Runtime Production.' }, 502)
  }
  if (!adm?.auth_email || !adm?.auth_user_id) return c.json({ error: 'Username atau password salah.' }, 401)

  const { data, error: authError } = await anon(c.env).auth.signInWithPassword({
    email: adm.auth_email,
    password
  })
  if (authError) {
    // Do not echo credentials, email, tokens or raw provider errors to browser.
    console.error('KM11 admin login: auth request rejected', { status: authError.status, code: authError.code, name: authError.name })
    const reason = String(authError.code || '').toLowerCase()
    const message = String(authError.message || '').toLowerCase()
    if (reason === 'email_not_confirmed' || message.includes('email not confirmed')) {
      return c.json({ error: 'Email akun admin belum dikonfirmasi di Supabase Authentication. Hubungi pengelola admin.' }, 403)
    }
    if (message.includes('invalid api key') || message.includes('jwt') || message.includes('api key') || (authError.status ?? 0) >= 500) {
      return c.json({ error: 'Konfigurasi Supabase Auth bermasalah. Periksa SUPABASE_ANON_KEY dan SUPABASE_URL pada Cloudflare Runtime Production.' }, 502)
    }
    return c.json({ error: 'Username atau password salah.' }, 401)
  }
  if (!data.session || !data.user || data.user.id !== adm.auth_user_id) {
    // Prevent a login from being granted if Auth and public.admins are mismatched.
    console.error('KM11 admin login: session missing or Auth ID differs from admin mapping')
    return c.json({ error: 'Akun admin belum terhubung dengan benar ke Supabase Auth. Hubungi pengelola admin.' }, 403)
  }
  return c.json({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    expires_in: data.session.expires_in,
    username: adm.username
  })
})
app.post('/api/admin/refresh', async c => { const b = await c.req.json().catch(() => ({})); const refresh = cleanText(b.refreshToken, 1000); if (!refresh) return c.json({ error: 'Refresh token diperlukan.' }, 400); const { data, error } = await anon(c.env).auth.refreshSession({ refresh_token: refresh }); if (error || !data.session) return c.json({ error: 'Sesi admin berakhir. Login kembali.' }, 401); return c.json({ access_token: data.session.access_token, refresh_token: data.session.refresh_token, expires_in: data.session.expires_in }) })
app.get('/api/admin/me', async c => {
  const { data, error } = await service(c.env).from('admins').select('username,display_name').eq('id', c.get('adminId')).single()
  if (error) throw error
  return c.json({ username: data.username, display_name: data.display_name || data.username })
})
app.get('/api/admin/account', async c => {
  const { data, error } = await service(c.env).from('admins').select('username,display_name,auth_email').eq('id', c.get('adminId')).single()
  if (error) throw error
  return c.json({ username: data.username, display_name: data.display_name || data.username, auth_email: data.auth_email })
})
app.put('/api/admin/account', async c => {
  const b = await c.req.json().catch(() => ({}))
  const displayName = cleanText(b.displayName, 120)
  const username = cleanText(b.username, 80)
  if (!displayName) return c.json({ error: 'Nama admin wajib diisi.' }, 400)
  if (!/^[A-Za-z0-9._-]{3,80}$/.test(username)) return c.json({ error: 'Username harus 3-80 karakter dan hanya boleh berisi huruf, angka, titik, garis bawah, atau tanda minus.' }, 400)
  const sb = service(c.env)
  const { data: conflict } = await sb.from('admins').select('id').eq('username_lower', username.toLowerCase()).neq('id', c.get('adminId')).maybeSingle()
  if (conflict) return c.json({ error: 'Username sudah digunakan admin lain.' }, 409)
  const { data, error } = await sb.from('admins').update({ username, display_name: displayName, updated_at: new Date().toISOString() }).eq('id', c.get('adminId')).select('username,display_name,auth_email').single()
  if (error) throw error
  c.set('adminUsername', data.username)
  return c.json({ username: data.username, display_name: data.display_name || data.username, auth_email: data.auth_email })
})
app.post('/api/admin/account/password', async c => {
  const b = await c.req.json().catch(() => ({}))
  const currentPassword = String(b.currentPassword || '')
  const newPassword = String(b.newPassword || '')
  if (!currentPassword) return c.json({ error: 'Password saat ini wajib diisi.' }, 400)
  if (newPassword.length < 8) return c.json({ error: 'Password baru minimal 8 karakter.' }, 400)
  if (currentPassword === newPassword) return c.json({ error: 'Password baru harus berbeda dari password saat ini.' }, 400)
  const sb = service(c.env)
  const { data: admin, error: adminErr } = await sb.from('admins').select('auth_email,auth_user_id').eq('id', c.get('adminId')).single()
  if (adminErr) throw adminErr
  if (!admin.auth_user_id || !admin.auth_email) return c.json({ error: 'Akun admin belum terhubung ke Supabase Auth.' }, 409)
  const { data: verified, error: verifyErr } = await anon(c.env).auth.signInWithPassword({ email: admin.auth_email, password: currentPassword })
  if (verifyErr || !verified.user || verified.user.id !== admin.auth_user_id) return c.json({ error: 'Password saat ini salah.' }, 403)
  const { error: updateErr } = await sb.auth.admin.updateUserById(admin.auth_user_id, { password: newPassword })
  if (updateErr) throw updateErr
  return c.json({ ok: true })
})
app.get('/api/admin/summary', async c => { const { data, error } = await service(c.env).from('orders').select('status,total'); if (error) throw error; const rows = data || []; return c.json({ total_orders: rows.length, new_orders: rows.filter((o: any) => o.status === 'new').length, verified_orders: rows.filter((o: any) => o.status === 'verified').length, shipped_orders: rows.filter((o: any) => o.status === 'shipped').length, completed_orders: rows.filter((o: any) => o.status === 'completed').length, order_value: rows.reduce((s: number, o: any) => s + Number(o.total || 0), 0) }) })
app.get('/api/admin/orders', async c => { let q = service(c.env).from('orders').select('*,order_items(*)').order('created_at', { ascending: false }); const status = cleanText(c.req.query('status'), 30); if (status) q = q.eq('status', status); const { data, error } = await q; if (error) throw error; return c.json(data || []) })
app.post('/api/admin/orders/:id/verify', async c => { const id = c.req.param('id'); if (!isUuid(id)) return c.json({ error: 'ID invalid.' }, 400); const sb = service(c.env); const { data: o } = await sb.from('orders').select('id,status,payment_proof_path').eq('id', id).maybeSingle(); if (!o) return c.json({ error: 'Order tidak ditemukan.' }, 404); if (!o.payment_proof_path) return c.json({ error: 'Bukti pembayaran belum diupload.' }, 409); if (o.status !== 'new') return c.json({ error: 'Order ini sudah diproses.' }, 409); const now = new Date().toISOString(); const { data, error } = await sb.from('orders').update({ status: 'verified', verified_at: now, verified_by: c.get('adminId'), updated_at: now }).eq('id', id).select().single(); if (error) throw error; await sb.from('order_status_history').insert({ order_id: id, status: 'verified', note: `Diverifikasi admin ${c.get('adminUsername')}` }); return c.json(data) })
app.post('/api/admin/orders/:id/tracking', async c => { const id = c.req.param('id'), b = await c.req.json(); const trackingNumber = cleanText(b.trackingNumber, 100), courier = cleanText(b.courier, 40).toLowerCase(); if (!isUuid(id) || !trackingNumber || !courier) return c.json({ error: 'Data resi tidak lengkap.' }, 400); const sb = service(c.env); const { data: o } = await sb.from('orders').select('id,status,fulfillment_type').eq('id', id).maybeSingle(); if (!o) return c.json({ error: 'Order tidak ditemukan.' }, 404); if (o.fulfillment_type !== 'ship') return c.json({ error: 'Resi hanya untuk metode kirim.' }, 409); if (o.status === 'new') return c.json({ error: 'Verifikasi pembayaran terlebih dahulu.' }, 409); const now = new Date().toISOString(); const { data, error } = await sb.from('orders').update({ tracking_number: trackingNumber, tracking_courier: courier, status: o.status === 'completed' ? 'completed' : 'shipped', shipped_at: o.status === 'completed' ? undefined : now, updated_at: now }).eq('id', id).select().single(); if (error) throw error; if (o.status !== 'completed') await sb.from('order_status_history').insert({ order_id: id, status: 'shipped', note: `Resi ${courier.toUpperCase()} ${trackingNumber}` }); return c.json(data) })
app.post('/api/admin/orders/:id/complete', async c => { const id = c.req.param('id'); const sb = service(c.env); const now = new Date().toISOString(); const { data, error } = await sb.from('orders').update({ status: 'completed', completed_at: now, updated_at: now }).eq('id', id).neq('status', 'new').select().single(); if (error) throw error; await sb.from('order_status_history').insert({ order_id: id, status: 'completed', note: `Diselesaikan admin ${c.get('adminUsername')}` }); return c.json(data) })
app.get('/api/admin/orders/:id/payment-proof-url', async c => { const { data: o } = await service(c.env).from('orders').select('payment_proof_path').eq('id', c.req.param('id')).maybeSingle(); if (!o?.payment_proof_path) return c.json({ error: 'Bukti bayar belum tersedia.' }, 404); const { data, error } = await service(c.env).storage.from('payment-proofs').createSignedUrl(o.payment_proof_path, 3600); if (error) throw error; return c.json({ url: data.signedUrl }) })

// Diagnostik aman: tanpa menampilkan token atau service-role key.
app.get('/api/admin/products/upload-check', async c => {
  const sb = service(c.env)
  const { error: productError } = await sb.from('products').select('id,color_images,color_image_paths').limit(1)
  const { data: bucket, error: bucketError } = await sb.storage.getBucket('product-images')
  const mimeTypes = bucket?.allowed_mime_types || []
  const checks = {
    product_columns: !productError,
    storage_bucket: !bucketError && !!bucket,
    storage_public: !!bucket?.public,
    storage_file_limit: !!bucket && (bucket.file_size_limit == null || Number(bucket.file_size_limit) >= 5 * 1024 * 1024),
    storage_image_mime: !!bucket && (!mimeTypes.length || ['image/png', 'image/jpeg', 'image/webp'].every(m => mimeTypes.includes(m)))
  }
  const problems: string[] = []
  if (productError) problems.push(`Kolom foto warna bermasalah: ${productError.message} (${productError.code || 'DB'})`)
  if (bucketError || !bucket) problems.push(`Bucket product-images tidak ditemukan/dapat dibaca: ${bucketError?.message || 'Belum tersedia'}`)
  if (bucket && !checks.storage_public) problems.push('Bucket product-images harus public agar foto katalog dapat dilihat pembeli.')
  if (bucket && !checks.storage_file_limit) problems.push('Batas ukuran bucket harus minimal 5 MB.')
  if (bucket && !checks.storage_image_mime) problems.push('Bucket belum mengizinkan format PNG/JPEG/WebP.')
  c.header('Cache-Control', 'no-store')
  return c.json({ ok: Object.values(checks).every(Boolean), checks, problems })
})
app.get('/api/admin/products', async c => { const { data, error } = await service(c.env).from('products').select('*').order('created_at', { ascending: false }); if (error) throw error; return c.json(data || []) })
app.post('/api/admin/products', async c => { const b = await c.req.json(); const row = productPayload(b); const { data, error } = await service(c.env).from('products').insert(row).select().single(); if (error) throw error; return c.json(data, 201) })
app.put('/api/admin/products/:id', async c => {
  const id = c.req.param('id')
  if (!isUuid(id)) return c.json({ error: 'ID produk tidak valid.' }, 400)
  const sb = service(c.env)
  const { data: current, error: readErr } = await sb.from('products').select('id,color_images,color_image_paths').eq('id', id).maybeSingle()
  if (readErr) throw readErr
  if (!current) return c.json({ error: 'Produk tidak ditemukan.' }, 404)
  const b = await c.req.json()
  const row = productPayload(b)
  const previousUrls = plainStringMap(current.color_images)
  const previousPaths = plainStringMap(current.color_image_paths)
  const nextColors = new Set(row.colors)
  const color_images = Object.fromEntries(Object.entries(previousUrls).filter(([color]) => nextColors.has(color)))
  const color_image_paths = Object.fromEntries(Object.entries(previousPaths).filter(([color]) => nextColors.has(color)))
  const { data, error } = await sb.from('products').update({ ...row, color_images, color_image_paths }).eq('id', id).select().single()
  if (error) throw error
  // Bersihkan file untuk warna yang sudah dihapus setelah data berhasil disimpan.
  const obsolete = Object.entries(previousPaths)
    .filter(([color, path]) => !nextColors.has(color) && path.startsWith(`products/${id}/colors/`))
    .map(([, path]) => path)
  if (obsolete.length) await sb.storage.from('product-images').remove(obsolete).catch(() => undefined)
  return c.json(data)
})
function plainStringMap(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return Object.fromEntries(Object.entries(value).filter(([key, v]) =>
    key.length <= 60 && typeof v === 'string' && v.length <= 2048)) as Record<string, string>
}

function productPayload(b: any) {
  const name = cleanText(b.name, 160)
  if (!name) throw new Error('Nama produk wajib diisi.')
  const price = Number(b.base_price), weight = Number(b.weight_grams)
  if (!Number.isFinite(price) || price < 0 || !Number.isFinite(weight) || weight <= 0) throw new Error('Harga/berat produk tidak valid.')
  const productType = b.product_type === 'emoney_card' ? 'emoney_card' : 'standard'
  return {
    name,
    slug: cleanText(b.slug, 180) || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
    description: cleanText(b.description, 2000) || null,
    base_price: price,
    weight_grams: Math.ceil(weight),
    colors: productType === 'emoney_card' ? [] : (Array.isArray(b.colors) ? b.colors.map((v: any) => cleanText(v, 60)).filter(Boolean).slice(0, 50) : []),
    sizes: productType === 'emoney_card' ? [] : (Array.isArray(b.sizes) ? b.sizes.map((v: any) => cleanText(v, 40)).filter(Boolean).slice(0, 50) : []),
    active: b.active !== false,
    featured: !!b.featured,
    specifications: b.specifications && typeof b.specifications === 'object' ? b.specifications : {},
    product_type: productType,
    updated_at: new Date().toISOString()
  }
}
app.post('/api/admin/products/:id/image', async c => { const id = c.req.param('id'), sb = service(c.env); const { data: p } = await sb.from('products').select('id,image_path').eq('id', id).maybeSingle(); if (!p) return c.json({ error: 'Produk tidak ditemukan.' }, 404); const body = await c.req.parseBody(), file = body.file; if (!(file instanceof File)) return c.json({ error: 'Pilih file foto.' }, 400); allowedUpload(file, 'image'); const path = randomPath(`products/${id}`, file); const { error: up } = await sb.storage.from('product-images').upload(path, file, { contentType: file.type }); if (up) throw up; const { data: url } = sb.storage.from('product-images').getPublicUrl(path); if (p.image_path) await sb.storage.from('product-images').remove([p.image_path]).catch(() => undefined); const { data, error } = await sb.from('products').update({ image_path: path, image_url: url.publicUrl, updated_at: new Date().toISOString() }).eq('id', id).select().single(); if (error) throw error; return c.json(data) })
function explainColorUploadError(error: unknown, step: 'database' | 'storage' | 'save'): { error: string; code?: string } {
  const problem = error && typeof error === 'object' ? error as { message?: unknown; error?: unknown; code?: unknown; status?: unknown } : {}
  const message = typeof problem.message === 'string' ? problem.message :
    typeof problem.error === 'string' ? problem.error :
    error instanceof Error ? error.message : 'Terjadi kesalahan yang tidak diketahui.'
  const code = typeof problem.code === 'string' ? problem.code : undefined
  const text = `${message} ${code || ''}`.toLowerCase()
  let explanation = step === 'storage' ? 'Gagal mengunggah foto ke Supabase Storage.' :
    step === 'save' ? 'Foto terunggah, tetapi gagal mengaitkannya ke produk.' :
    'Gagal membaca informasi produk dari database.'
  if (/bucket not found|not found.*bucket/.test(text)) explanation = 'Bucket product-images belum tersedia pada proyek Supabase.'
  else if (/payload too large|exceeded|too large|maximum allowed|size limit|entity too large/.test(text)) explanation = 'Ukuran foto melebihi batas Supabase Storage (maksimal 5 MB).'
  else if (/mime|media type|content.type|invalid file type/.test(text)) explanation = 'Jenis file tidak diizinkan oleh bucket. Gunakan JPEG, PNG, atau WebP.'
  else if (/row.level.security|permission denied|unauthorized|forbidden|invalid jwt|403/.test(text)) explanation = 'Supabase Storage menolak izin upload. Periksa service-role key dan kebijakan bucket.'
  else if (/column .* does not exist|schema cache|pgrst204|42703/.test(text)) explanation = 'Kolom foto warna belum sesuai. Jalankan migrasi 005 dan tunggu pembaruan schema cache Supabase.'
  return { error: `${explanation} ${message}`.trim(), ...(code ? { code } : {}) }
}
app.post('/api/admin/products/:id/color-image', async c => {
  const id = c.req.param('id')
  if (!isUuid(id)) return c.json({ error: 'ID produk tidak valid.' }, 400)
  const body = await c.req.parseBody()
  const color = cleanText(body.color, 60)
  const file = body.file
  if (!(file instanceof File)) return c.json({ error: 'Pilih file foto warna.' }, 400)
  if (!color) return c.json({ error: 'Nama warna tidak boleh kosong.' }, 400)
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size === 0 || file.size > 5 * 1024 * 1024) {
    return c.json({ error: 'Foto warna harus JPG, PNG, atau WebP dengan ukuran maksimal 5 MB.' }, 400)
  }

  const sb = service(c.env)
  const { data: p, error: getErr } = await sb.from('products').select('id,product_type,colors,color_images,color_image_paths').eq('id', id).maybeSingle()
  if (getErr) {
    console.error('[KM11 warna] gagal membaca produk:', getErr)
    return c.json(explainColorUploadError(getErr, 'database'), 500)
  }
  if (!p) return c.json({ error: 'Produk tidak ditemukan.' }, 404)
  if (p.product_type === 'emoney_card') return c.json({ error: 'Foto warna hanya untuk merchandise standar.' }, 400)
  if (!Array.isArray(p.colors) || !p.colors.includes(color)) return c.json({ error: `Warna ${color} belum disimpan pada produk.` }, 400)

  const path = randomPath(`products/${id}/colors`, file)
  const { error: uploadError } = await sb.storage.from('product-images').upload(path, file, { contentType: file.type, upsert: false })
  if (uploadError) {
    console.error(`[KM11 warna] gagal upload ${color}:`, uploadError)
    return c.json(explainColorUploadError(uploadError, 'storage'), 500)
  }
  const { data: publicData } = sb.storage.from('product-images').getPublicUrl(path)
  const oldPaths = plainStringMap(p.color_image_paths)
  const oldPath = oldPaths[color]
  const color_images = { ...plainStringMap(p.color_images), [color]: publicData.publicUrl }
  const color_image_paths = { ...oldPaths, [color]: path }
  const { data, error } = await sb.from('products').update({ color_images, color_image_paths }).eq('id', id).select().single()
  if (error) {
    console.error(`[KM11 warna] gagal menyimpan foto ${color}:`, error)
    const { error: cleanupErr } = await sb.storage.from('product-images').remove([path])
    if (cleanupErr) console.error('[KM11 warna] gagal rollback foto baru:', cleanupErr)
    return c.json(explainColorUploadError(error, 'save'), 500)
  }
  if (oldPath && oldPath !== path && oldPath.startsWith(`products/${id}/colors/`)) {
    const { error: cleanupErr } = await sb.storage.from('product-images').remove([oldPath])
    if (cleanupErr) console.error('[KM11 warna] gagal bersihkan foto lama:', cleanupErr)
  }
  return c.json(data)
})
app.delete('/api/admin/products/:id', async c => {
  const id = c.req.param('id'), sb = service(c.env)
  const { data: p } = await sb.from('products').select('image_path,color_image_paths').eq('id', id).maybeSingle()
  const { error } = await sb.from('products').delete().eq('id', id)
  if (error) throw error
  const paths = [p?.image_path, ...Object.values(plainStringMap(p?.color_image_paths))]
    .filter((path): path is string => typeof path === 'string' && path.startsWith(`products/${id}/`))
  if (paths.length) await sb.storage.from('product-images').remove(paths).catch(() => undefined)
  return c.json({ ok: true })
})

app.get('/api/admin/pickup-locations', async c => { const { data, error } = await service(c.env).from('pickup_locations').select('*,pickup_slots(*)').order('name'); if (error) throw error; return c.json((data || []).map((p: any) => ({ ...p, slots: (p.pickup_slots || []).sort((a: any, b: any) => a.starts_at.localeCompare(b.starts_at)), pickup_slots: undefined }))) })
app.post('/api/admin/pickup-locations', async c => { const b = await c.req.json(), row = pickupPayload(b); const { data, error } = await service(c.env).from('pickup_locations').insert(row).select().single(); if (error) throw error; return c.json(data, 201) })
app.put('/api/admin/pickup-locations/:id', async c => { const b = await c.req.json(), row = pickupPayload(b); const { data, error } = await service(c.env).from('pickup_locations').update(row).eq('id', c.req.param('id')).select().single(); if (error) throw error; return c.json(data) })
function pickupPayload(b: any) { const name = cleanText(b.name, 140), address = cleanText(b.address, 600); if (!name || !address) throw new Error('Nama dan alamat pickup wajib diisi.'); return { name, address, notes: cleanText(b.notes, 1000) || null, active: b.active !== false, updated_at: new Date().toISOString() } }
app.delete('/api/admin/pickup-locations/:id', async c => { const { error } = await service(c.env).from('pickup_locations').delete().eq('id', c.req.param('id')); if (error) throw error; return c.json({ ok: true }) })
app.post('/api/admin/pickup-locations/:id/slots', async c => { const b = await c.req.json(), starts = new Date(b.startsAt), ends = new Date(b.endsAt); if (!Number.isFinite(starts.getTime()) || !Number.isFinite(ends.getTime()) || ends <= starts) return c.json({ error: 'Waktu slot tidak valid.' }, 400); const cap = b.capacity == null ? null : Math.max(1, Math.floor(Number(b.capacity))); const { data, error } = await service(c.env).from('pickup_slots').insert({ location_id: c.req.param('id'), starts_at: starts.toISOString(), ends_at: ends.toISOString(), capacity: cap, active: true }).select().single(); if (error) throw error; return c.json(data, 201) })
app.delete('/api/admin/pickup-slots/:id', async c => { const { error } = await service(c.env).from('pickup_slots').delete().eq('id', c.req.param('id')); if (error) throw error; return c.json({ ok: true }) })

app.get('/api/admin/payment-methods', async c => { const { data, error } = await service(c.env).from('payment_methods').select('*').order('sort_order').order('name'); if (error) throw error; return c.json(data || []) })
app.post('/api/admin/payment-methods', async c => { const b = await c.req.json(), row = paymentPayload(b); const { data, error } = await service(c.env).from('payment_methods').insert(row).select().single(); if (error) throw error; return c.json(data, 201) })
app.put('/api/admin/payment-methods/:id', async c => { const b = await c.req.json(), row = paymentPayload(b); const { data, error } = await service(c.env).from('payment_methods').update(row).eq('id', c.req.param('id')).select().single(); if (error) throw error; return c.json(data) })
function paymentPayload(b: any) { const name = cleanText(b.name, 120), type = ['bank_transfer', 'qris', 'other'].includes(b.type) ? b.type : 'other'; if (!name) throw new Error('Nama metode pembayaran wajib diisi.'); return { name, type, account_name: cleanText(b.account_name, 120) || null, account_number: cleanText(b.account_number, 120) || null, instructions: cleanText(b.instructions, 1500) || null, active: b.active !== false, sort_order: Number.isFinite(Number(b.sort_order)) ? Number(b.sort_order) : 0, updated_at: new Date().toISOString() } }
app.post('/api/admin/payment-methods/:id/qr', async c => { const id = c.req.param('id'), sb = service(c.env); const { data: p } = await sb.from('payment_methods').select('id,qr_image_path').eq('id', id).maybeSingle(); if (!p) return c.json({ error: 'Metode tidak ditemukan.' }, 404); const body = await c.req.parseBody(), file = body.file; if (!(file instanceof File)) return c.json({ error: 'Pilih file QR.' }, 400); allowedUpload(file, 'image'); const path = randomPath(`payments/${id}`, file); const { error: up } = await sb.storage.from('payment-assets').upload(path, file, { contentType: file.type }); if (up) throw up; const { data: url } = sb.storage.from('payment-assets').getPublicUrl(path); if (p.qr_image_path) await sb.storage.from('payment-assets').remove([p.qr_image_path]).catch(() => undefined); const { data, error } = await sb.from('payment_methods').update({ qr_image_path: path, qr_image_url: url.publicUrl, updated_at: new Date().toISOString() }).eq('id', id).select().single(); if (error) throw error; return c.json(data) })
app.delete('/api/admin/payment-methods/:id', async c => { const id = c.req.param('id'), sb = service(c.env); const { data: p } = await sb.from('payment_methods').select('qr_image_path').eq('id', id).maybeSingle(); const { error } = await sb.from('payment_methods').delete().eq('id', id); if (error) throw error; if (p?.qr_image_path) await sb.storage.from('payment-assets').remove([p.qr_image_path]).catch(() => undefined); return c.json({ ok: true }) })

app.get('/api/admin/settings', async c => { return c.json(await getSettings(c.env)) })
app.put('/api/admin/settings', async c => { const b = await c.req.json(); const allowed = ['shipping_origin_id', 'shipping_origin_label', 'shipping_couriers']; const rows = allowed.map(key => ({ key, value: cleanText(b[key], 500), updated_at: new Date().toISOString() })); const { error } = await service(c.env).from('app_settings').upsert(rows, { onConflict: 'key' }); if (error) throw error; return c.json(await getSettings(c.env)) })

app.notFound(c => c.json({ error: 'API endpoint tidak ditemukan.' }, 404))
app.onError((err, c) => {
  console.error('[KM11 API error]', err)
  const detail = err && typeof err === 'object' ? err as { message?: unknown; error?: unknown; code?: unknown } : {}
  const msg = typeof detail.message === 'string' ? detail.message :
    typeof detail.error === 'string' ? detail.error :
    err instanceof Error ? err.message : 'Terjadi kesalahan pada server.'
  const code = typeof detail.code === 'string' ? detail.code : undefined
  const status = /wajib|tidak valid|harus|belum lengkap/i.test(msg) ? 400 : 500
  return c.json({ error: msg, ...(code ? { code } : {}) }, status as 400 | 500)
})

export default app
