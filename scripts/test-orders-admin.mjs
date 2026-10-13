import assert from 'node:assert/strict'
import fs from 'node:fs'
import { formatJakartaDateTime, itemVariantText, orderExportData, orderFulfillment, pickupSlotLabel, sortedOrderItems } from '../src/orderAdminData.ts'

const ship = {
  id: 'ship1', receipt_no: 'KM11-SHIP', status: 'new', full_name: 'Pemesan A', email: 'a@example.com', phone: '0811',
  fulfillment_type: 'ship', shipping_courier: 'jne', shipping_service: 'REG',
  shipping_destination_label: 'Senen, Jakarta Pusat', address: 'Jl. Contoh 1',
  tracking_number: null, tracking_courier: null,
  shipping_cost: 15000, subtotal: 280000, total: 252000, created_at: '2026-10-13T04:30:00Z', verified_at: null,
  order_items: [
    { id: 'item-b', checkout_line_index: 1, product_name: 'Mug KM11', variant_color: 'Biru', variant_size: null, unit_price: 45000, quantity: 2, line_total: 90000, customization: null },
    { id: 'item-a', checkout_line_index: 0, product_name: 'Kaos KM11', variant_color: 'Putih', variant_size: 'XL', unit_price: 160000, quantity: 1, line_total: 160000, customization: null },
    { id: 'item-c', checkout_line_index: 2, product_name: 'Keychain KM11', variant_color: null, variant_size: null, unit_price: 15000, quantity: 2, line_total: 30000, customization: null }
  ]
}
const pickup = {
  ...ship, id: 'pickup1', receipt_no: 'KM11-PICKUP', full_name: 'Pemesan B', status: 'verified',
  fulfillment_type: 'pickup', shipping_courier: null, shipping_service: null,
  pickup_location_name: 'Kantor KM11', pickup_location_address: 'Jakarta',
  pickup_slot_starts_at: '2026-10-14T02:00:00Z', pickup_slot_ends_at: '2026-10-14T04:00:00Z',
  order_items: [{ ...ship.order_items[1], id: 'pickup-item' }]
}

assert.deepEqual(sortedOrderItems(ship).map(x => x.product_name), ['Kaos KM11', 'Mug KM11', 'Keychain KM11'])
assert.equal(itemVariantText(ship.order_items[1]), 'Warna: Putih · Ukuran: XL')
assert.equal(itemVariantText(ship.order_items[0]), 'Warna: Biru')
assert.equal(itemVariantText(ship.order_items[2]), '')
assert.equal(orderFulfillment(ship).method, 'Kirim')
assert.equal(orderFulfillment(ship).courier, 'jne')
assert.equal(orderFulfillment(ship).service, 'REG')
assert.equal(orderFulfillment(pickup).method, 'Ambil di tempat')
assert.equal(orderFulfillment(pickup).courier, '')
assert.ok(pickupSlotLabel(pickup).includes('09.00'))
assert.ok(pickupSlotLabel(pickup).includes('11.00 WIB'))
assert.ok(formatJakartaDateTime(ship.created_at).endsWith('WIB'))
const result = orderExportData([ship, pickup])
assert.equal(result.orderRows.length, 2)
assert.equal(result.itemRows.length, 4)
assert.equal(result.summaryRows.find(x => x.Metric === 'Total Order').Value, 2)
assert.ok(result.orderRows[0].RincianItem.startsWith('1. 1× Kaos KM11 (Warna: Putih · Ukuran: XL)'))
assert.ok(result.orderRows[0].WarnaPerItem.includes('Mug KM11: Biru'))
assert.ok(result.orderRows[0].UkuranPerItem.includes('Kaos KM11: XL'))
assert.equal(result.itemRows[0].Warna, 'Putih')
assert.equal(result.itemRows[0].Ukuran, 'XL')
assert.equal(result.itemRows[1].Warna, 'Biru')
assert.equal(result.itemRows[1].Ukuran, '')
assert.equal(result.itemRows[0].Kurir, 'jne')
assert.equal(result.itemRows[0].LayananKirim, 'REG')
assert.equal(result.orderRows[1].LokasiPickup, 'Kantor KM11')
assert.equal(result.itemRows[3].LokasiPickup, 'Kantor KM11')
assert.ok(result.itemRows[3].SlotPickupWIB.includes('09.00'))
assert.equal(result.itemRows[3].Kurir, '')
assert.equal(orderFulfillment({ ...pickup, pickup_slot_starts_at: null, pickup_slot_ends_at: null }).pickupSlot, '')
assert.equal(orderExportData([]).itemRows.length, 0)

const admin = fs.readFileSync(new URL('../src/AdminPage.tsx', import.meta.url), 'utf8')
assert.ok(admin.includes('sortedOrderItems(o).map'))
assert.ok(admin.includes('itemVariantText(it)'))
assert.ok(admin.includes('<OrderFulfillmentCell order={o}/>'))
assert.ok(admin.includes('orderExportData(filtered)'))
assert.ok(admin.includes("'Orders'"))
assert.ok(admin.includes("'Items'"))
console.log('PASS: 26 checks for shipping, pickup slots WIB, variants, admin UI and Excel export')
