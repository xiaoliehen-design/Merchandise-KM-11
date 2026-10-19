/** Harga diskon khusus produk satuan. Bersama antara katalog dan Worker. */
export type ItemDiscount = {
  item_discount_enabled?: boolean | null
  item_discount_type?: 'percent' | 'fixed' | string | null
  item_discount_amount?: number | null
}

/** Dibulatkan per satuan agar katalog (qty=1) dan checkout multi-qty konsisten. */
export function itemUnitDiscount(product: ItemDiscount, unitPrice: number): number {
  if (!product.item_discount_enabled) return 0
  const price = Math.round(Number(unitPrice))
  const amount = Number(product.item_discount_amount || 0)
  if (!Number.isFinite(price) || price < 0 || !Number.isFinite(amount) || amount <= 0) return 0
  const discount = product.item_discount_type === 'fixed' ? amount : Math.round(price * amount / 100)
  return Math.min(price, Math.max(0, Math.round(discount)))
}

/** Hanya produk satuan; paket memiliki harga dan persentase promo tersendiri. */
export function itemDiscountLabel(product: ItemDiscount): string {
  if (!product.item_discount_enabled || !Number(product.item_discount_amount)) return ''
  const amount = Number(product.item_discount_amount)
  return product.item_discount_type === 'fixed'
    ? `Hemat Rp${amount.toLocaleString('id-ID')}`
    : `-${amount}% khusus`
}
