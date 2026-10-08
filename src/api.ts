import { readableApiError } from './apiError'
import type { CartItem, Order, PaymentMethod, PickupLocation, Product, ProductBundle, ShippingQuote } from './types'

const API = '/api'

export function getCartToken() {
  const key = 'km11_cart_token_v1'
  let token = localStorage.getItem(key)
  if (!token) {
    token = crypto.randomUUID()
    localStorage.setItem(key, token)
  }
  return token
}

function getAdminToken() {
  return localStorage.getItem('km11_admin_access_token')
}

function headers(extra: HeadersInit = {}) {
  const h = new Headers(extra)
  h.set('Accept', 'application/json')
  h.set('x-cart-token', getCartToken())
  const token = getAdminToken()
  if (token) h.set('Authorization', `Bearer ${token}`)
  return h
}

async function parse<T>(res: Response): Promise<T> {
  const contentType = res.headers.get('content-type') || ''
  const body = contentType.includes('application/json') ? await res.json() : await res.text()
  if (!res.ok) {
    const msg = readableApiError(body) || `Permintaan gagal (${res.status}).`
    const code = body && typeof body === 'object' && 'code' in body && typeof body.code === 'string'
      ? ` [${body.code}]` : ''
    throw new Error(`${msg}${code}`)
  }
  return body as T
}

async function rawRequest(path: string, init: RequestInit, retry = true): Promise<Response> {
  const res = await fetch(`${API}${path}`, init)
  if (res.status === 401 && retry && path.startsWith('/admin/') && path !== '/admin/login' && path !== '/admin/refresh') {
    const refreshToken = localStorage.getItem('km11_admin_refresh_token')
    if (refreshToken) {
      const rr = await fetch(`${API}/admin/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken })
      })
      if (rr.ok) {
        const next = await rr.json() as { access_token: string; refresh_token: string }
        localStorage.setItem('km11_admin_access_token', next.access_token)
        localStorage.setItem('km11_admin_refresh_token', next.refresh_token)
        const nextHeaders = new Headers(init.headers || {})
        nextHeaders.set('Authorization', `Bearer ${next.access_token}`)
        return rawRequest(path, { ...init, headers: nextHeaders }, false)
      }
    }
  }
  return res
}

export async function apiGet<T>(path: string): Promise<T> {
  return parse<T>(await rawRequest(path, { headers: headers() }))
}

export async function apiJson<T>(path: string, method: string, body?: unknown): Promise<T> {
  return parse<T>(await rawRequest(path, {
    method,
    headers: headers({ 'Content-Type': 'application/json' }),
    body: body === undefined ? undefined : JSON.stringify(body)
  }))
}

export async function apiForm<T>(path: string, form: FormData): Promise<T> {
  return parse<T>(await rawRequest(path, { method: 'POST', headers: headers(), body: form }))
}

export const catalogApi = {
  products: () => apiGet<Product[]>('/products'),
  bundles: () => apiGet<ProductBundle[]>('/bundles'),
  pickups: () => apiGet<PickupLocation[]>('/pickup-locations'),
  payments: () => apiGet<PaymentMethod[]>('/payment-methods')
}

export const cartApi = {
  get: () => apiGet<{ items: CartItem[] }>('/cart'),
  save: (items: CartItem[]) => apiJson<{ ok: true }>('/cart', 'PUT', { items })
}

export const shippingApi = {
  destinations: (q: string) => apiGet<Array<{ id: string; label: string; zip_code?: string }>>(`/shipping/destinations?q=${encodeURIComponent(q)}`),
  quotes: (payload: { destinationId: string; weight: number }) => apiJson<ShippingQuote[]>('/shipping/quotes', 'POST', payload)
}

export const orderApi = {
  create: (payload: unknown) => apiJson<{ orderId: string; receiptNo: string; total: number; uploadToken: string }>('/orders', 'POST', payload),
  uploadProof: async (receiptNo: string, file: File, uploadToken: string) => {
    const f = new FormData()
    f.append('file', file)
    return parse<{ ok: true }>(await rawRequest(`/orders/${encodeURIComponent(receiptNo)}/payment-proof`, { method: 'POST', headers: headers({ 'x-payment-upload-token': uploadToken }), body: f }))
  },
  track: (receiptNo: string) => apiGet<Record<string, unknown>>(`/track/${encodeURIComponent(receiptNo)}`)
}

export const adminApi = {
  login: (username: string, password: string) => apiJson<{ access_token: string; refresh_token: string; expires_in: number; username: string }>('/admin/login', 'POST', { username, password }),
  me: () => apiGet<{ username: string; display_name: string }>('/admin/me'),
  account: () => apiGet<{ username: string; display_name: string; auth_email: string }>('/admin/account'),
  updateAccount: (payload: { displayName: string; username?: string }) => apiJson<{ username: string; display_name: string; auth_email: string }>('/admin/account', 'PUT', payload),
  changePassword: (payload: { currentPassword: string; newPassword: string }) => apiJson<{ ok: true }>('/admin/account/password', 'POST', payload),
  summary: () => apiGet<Record<string, number>>('/admin/summary'),
  orders: (status?: string) => apiGet<Order[]>(`/admin/orders${status ? `?status=${encodeURIComponent(status)}` : ''}`),
  verify: (id: string) => apiJson<Order>(`/admin/orders/${id}/verify`, 'POST', {}),
  setTracking: (id: string, payload: { trackingNumber: string; courier: string }) => apiJson<Order>(`/admin/orders/${id}/tracking`, 'POST', payload),
  complete: (id: string) => apiJson<Order>(`/admin/orders/${id}/complete`, 'POST', {}),
  paymentProofUrl: (id: string) => apiGet<{ url: string }>(`/admin/orders/${id}/payment-proof-url`),
  products: () => apiGet<Product[]>('/admin/products'),
  bundles: () => apiGet<ProductBundle[]>('/admin/bundles'),
  saveBundle: (payload: Partial<ProductBundle> & { id?: string }) => apiJson<ProductBundle>(payload.id ? `/admin/bundles/${payload.id}` : '/admin/bundles', payload.id ? 'PUT' : 'POST', payload),
  deleteBundle: (id: string) => apiJson<{ ok: true }>(`/admin/bundles/${id}`, 'DELETE'),
  productUploadCheck: () => apiGet<{ ok: boolean; checks: Record<string, boolean>; problems: string[] }>('/admin/products/upload-check'),
  upsertProduct: (payload: Partial<Product> & { id?: string }) => apiJson<Product>(payload.id ? `/admin/products/${payload.id}` : '/admin/products', payload.id ? 'PUT' : 'POST', payload),
  uploadProductImage: (id: string, file: File) => { const f = new FormData(); f.append('file', file); return apiForm<Product>(`/admin/products/${id}/image`, f) },
  uploadColorImage: (id: string, color: string, file: File) => { const f = new FormData(); f.append('color', color); f.append('file', file); return apiForm<Product>(`/admin/products/${id}/color-image`, f) },
  deleteProduct: (id: string) => apiJson<{ ok: true }>(`/admin/products/${id}`, 'DELETE'),
  pickups: () => apiGet<PickupLocation[]>('/admin/pickup-locations'),
  savePickup: (payload: Partial<PickupLocation> & { id?: string }) => apiJson<PickupLocation>(payload.id ? `/admin/pickup-locations/${payload.id}` : '/admin/pickup-locations', payload.id ? 'PUT' : 'POST', payload),
  deletePickup: (id: string) => apiJson<{ ok: true }>(`/admin/pickup-locations/${id}`, 'DELETE'),
  addSlot: (locationId: string, payload: { startsAt: string; endsAt: string; capacity?: number | null }) => apiJson(`/admin/pickup-locations/${locationId}/slots`, 'POST', payload),
  deleteSlot: (id: string) => apiJson<{ ok: true }>(`/admin/pickup-slots/${id}`, 'DELETE'),
  payments: () => apiGet<PaymentMethod[]>('/admin/payment-methods'),
  savePayment: (payload: Partial<PaymentMethod> & { id?: string }) => apiJson<PaymentMethod>(payload.id ? `/admin/payment-methods/${payload.id}` : '/admin/payment-methods', payload.id ? 'PUT' : 'POST', payload),
  uploadQr: (id: string, file: File) => { const f = new FormData(); f.append('file', file); return apiForm<PaymentMethod>(`/admin/payment-methods/${id}/qr`, f) },
  deletePayment: (id: string) => apiJson<{ ok: true }>(`/admin/payment-methods/${id}`, 'DELETE'),
  settings: () => apiGet<Record<string, string>>('/admin/settings'),
  saveSettings: (payload: Record<string, string>) => apiJson<Record<string, string>>('/admin/settings', 'PUT', payload)
}
