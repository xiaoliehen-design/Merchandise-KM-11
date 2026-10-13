/**
 * Tampilan dan ekspor admin menggunakan satu sumber data: snapshot pada orders
 * serta variant_color/variant_size pada order_items saat checkout.
 * Jangan mengambil warna/ukuran dari katalog terbaru: varian bisa berubah setelah pembelian.
 */
import type { Order, OrderItem } from './types'

const jakartaDateTime = new Intl.DateTimeFormat('id-ID', {
  timeZone: 'Asia/Jakarta', day: '2-digit', month: 'short', year: 'numeric',
  hour: '2-digit', minute: '2-digit', hour12: false
})
const jakartaDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit'
})
const jakartaTime = new Intl.DateTimeFormat('id-ID', {
  timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', hour12: false
})

function validDate(value?: string | null): Date | null {
  if (!value) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export function formatJakartaDateTime(value?: string | null): string {
  const date = validDate(value)
  return date ? `${jakartaDateTime.format(date)} WIB` : ''
}

export function pickupSlotLabel(order: Pick<Order, 'pickup_slot_starts_at' | 'pickup_slot_ends_at'>): string {
  const start = validDate(order.pickup_slot_starts_at)
  const end = validDate(order.pickup_slot_ends_at)
  if (start && end) {
    const startText = jakartaDateTime.format(start)
    const endText = jakartaDate.format(start) === jakartaDate.format(end)
      ? jakartaTime.format(end) : jakartaDateTime.format(end)
    return `${startText} – ${endText} WIB`
  }
  if (start) return `${jakartaDateTime.format(start)} WIB`
  if (end) return `Sampai ${jakartaDateTime.format(end)} WIB`
  return ''
}

export function sortedOrderItems(order: Pick<Order, 'order_items'>): OrderItem[] {
  return [...(order.order_items || [])].sort((a, b) => {
    const posA = a.checkout_line_index ?? Number.MAX_SAFE_INTEGER
    const posB = b.checkout_line_index ?? Number.MAX_SAFE_INTEGER
    return posA - posB || (a.created_at || '').localeCompare(b.created_at || '') || a.id.localeCompare(b.id)
  })
}

export function itemVariantText(item: Pick<OrderItem, 'variant_color' | 'variant_size'>): string {
  return [item.variant_color?.trim() ? `Warna: ${item.variant_color.trim()}` : '',
    item.variant_size?.trim() ? `Ukuran: ${item.variant_size.trim()}` : ''].filter(Boolean).join(' · ')
}

export function orderFulfillment(order: Order) {
  const isShip = order.fulfillment_type === 'ship'
  return {
    method: isShip ? 'Kirim' : 'Ambil di tempat',
    courier: isShip ? (order.shipping_courier || '') : '',
    service: isShip ? (order.shipping_service || '') : '',
    destination: isShip ? (order.shipping_destination_label || '') : '',
    shippingAddress: isShip ? (order.address || '') : '',
    pickupLocation: isShip ? '' : (order.pickup_location_name || ''),
    pickupAddress: isShip ? '' : (order.pickup_location_address || ''),
    pickupSlot: isShip ? '' : pickupSlotLabel(order),
    trackingCourier: isShip ? (order.tracking_courier || '') : '',
    trackingNumber: isShip ? (order.tracking_number || '') : ''
  }
}

export function orderExportData(orders: Order[]) {
  // Kolom lama dipertahankan untuk kompatibilitas laporan yang sudah ada.
  const orderRows = orders.map(order => {
    const f = orderFulfillment(order)
    const items = sortedOrderItems(order)
    return {
      Receipt: order.receipt_no,
      Status: ({ new: 'Baru', verified: 'Terverifikasi', shipped: 'Dikirim', completed: 'Selesai' } as Record<string, string>)[order.status] || order.status,
      Nama: order.full_name,
      Email: order.email,
      HP: order.phone,
      Fulfillment: order.fulfillment_type,
      Subtotal: Number(order.subtotal || 0),
      DiskonLaunching: Number(order.launch_discount || 0),
      DiskonBelanjaBesar: Number(order.volume_discount || 0),
      KodePromo: order.promo_code || '',
      DiskonKodePromo: Number(order.promo_discount || 0),
      Ongkir: Number(order.shipping_cost || 0),
      Total: Number(order.total || 0),
      Kurir: f.courier,
      Resi: f.trackingNumber,
      Dibuat: order.created_at,
      Terverifikasi: order.verified_at || '',
      MetodePemenuhan: f.method,
      LayananKirim: f.service,
      TujuanKirim: f.destination,
      AlamatKirim: f.shippingAddress,
      KurirResi: f.trackingCourier,
      LokasiPickup: f.pickupLocation,
      AlamatPickup: f.pickupAddress,
      SlotPickupWIB: f.pickupSlot,
      // Kolom item diringkas per nomor item, tidak mencampur varian antarproduk.
      RincianItem: items.map((item, idx) => `${idx + 1}. ${item.quantity}× ${item.product_name}${itemVariantText(item) ? ` (${itemVariantText(item)})` : ''}`).join('\n'),
      WarnaPerItem: items.map((item, idx) => item.variant_color ? `${idx + 1}. ${item.product_name}: ${item.variant_color}` : '').filter(Boolean).join('\n'),
      UkuranPerItem: items.map((item, idx) => item.variant_size ? `${idx + 1}. ${item.product_name}: ${item.variant_size}` : '').filter(Boolean).join('\n'),
      DibuatWIB: formatJakartaDateTime(order.created_at)
    }
  })
  const itemRows = orders.flatMap(order => {
    const f = orderFulfillment(order)
    return sortedOrderItems(order).map((item, idx) => ({
      Receipt: order.receipt_no,
      Produk: item.product_name,
      CustomName: (item.customization as { customerName?: string } | null)?.customerName || '',
      Template: (item.customization as { templateLabel?: string } | null)?.templateLabel || '',
      Warna: item.variant_color || '',
      Ukuran: item.variant_size || '',
      Qty: Number(item.quantity || 0),
      Harga: Number(item.unit_price || 0),
      Total: Number(item.line_total || 0),
      DesignURL: item.design_image_url || '',
      NomorItem: idx + 1,
      NamaPembeli: order.full_name,
      Status: ({ new: 'Baru', verified: 'Terverifikasi', shipped: 'Dikirim', completed: 'Selesai' } as Record<string, string>)[order.status] || order.status,
      MetodePemenuhan: f.method,
      Kurir: f.courier,
      LayananKirim: f.service,
      TujuanKirim: f.destination,
      AlamatKirim: f.shippingAddress,
      LokasiPickup: f.pickupLocation,
      AlamatPickup: f.pickupAddress,
      SlotPickupWIB: f.pickupSlot,
      Resi: f.trackingNumber
    }))
  })
  const summaryRows = [
    { Metric: 'Total Order', Value: orders.length },
    { Metric: 'Revenue Terverifikasi+', Value: orders.filter(o => o.status !== 'new').reduce((s, o) => s + Number(o.total || 0), 0) },
    { Metric: 'Baru', Value: orders.filter(o => o.status === 'new').length },
    { Metric: 'Terverifikasi', Value: orders.filter(o => o.status === 'verified').length },
    { Metric: 'Dikirim', Value: orders.filter(o => o.status === 'shipped').length },
    { Metric: 'Selesai', Value: orders.filter(o => o.status === 'completed').length }
  ]
  return { orderRows, itemRows, summaryRows }
}
