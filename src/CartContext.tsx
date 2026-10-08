import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { cartApi } from './api'
import type { CartItem } from './types'

type CartCtx = {
  items: CartItem[]
  count: number
  subtotal: number
  add: (item: CartItem) => void
  updateQty: (index: number, qty: number) => void
  remove: (index: number) => void
  clear: () => void
}

const Ctx = createContext<CartCtx | null>(null)
const KEY = 'km11_cart_items_v1'

function same(a: CartItem, b: CartItem) {
  const customA = a.customization ? JSON.stringify(a.customization) : ''
  const customB = b.customization ? JSON.stringify(b.customization) : ''
  if (a.bundleId || b.bundleId) return false // Paket custom dibuat per konfigurasi; jangan menggabungkan desain berbeda.
  return a.productId === b.productId && (a.color || '') === (b.color || '') && (a.size || '') === (b.size || '') && customA === customB
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(() => {
    try { return JSON.parse(localStorage.getItem(KEY) || '[]') } catch { return [] }
  })
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    cartApi.get().then((server) => {
      if (server.items?.length && !items.length) setItems(server.items)
    }).catch(() => undefined).finally(() => setHydrated(true))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(items))
    if (hydrated) {
      const t = window.setTimeout(() => cartApi.save(items).catch(() => undefined), 250)
      return () => window.clearTimeout(t)
    }
  }, [items, hydrated])

  const value = useMemo<CartCtx>(() => ({
    items,
    count: items.reduce((s, i) => s + i.qty, 0),
    subtotal: items.reduce((s, i) => s + i.qty * i.unitPrice, 0),
    add: (item) => setItems((prev) => {
      const idx = prev.findIndex((p) => same(p, item))
      if (idx < 0) return [...prev, item]
      return prev.map((p, i) => i === idx ? { ...p, qty: p.qty + item.qty } : p)
    }),
    updateQty: (index, qty) => setItems((prev) => qty <= 0 ? prev.filter((_, i) => i !== index) : prev.map((p, i) => i === index ? { ...p, qty } : p)),
    remove: (index) => setItems((prev) => prev.filter((_, i) => i !== index)),
    clear: () => setItems([])
  }), [items])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useCart() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useCart must be inside CartProvider')
  return ctx
}
