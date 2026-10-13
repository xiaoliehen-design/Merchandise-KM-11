import assert from 'node:assert/strict'
import fs from 'node:fs'
import { orderExportData, orderFulfillment, shippingAddressDetails } from '../src/orderAdminData.ts'

const common = {
  id: 'o-1', receipt_no: 'KM11-TEST', status: 'new', full_name: 'Pemesan Contoh',
  email: 'contoh@example.com', phone: '081234567890', created_at: '2026-10-13T04:30:00Z',
  fulfillment_type: 'ship', address: 'Jl. Kenanga No. 12, RT 03/RW 02\nGedung A lantai 2',
  shipping_destination_label: 'Kel. Bungur, Kec. Senen, Jakarta Pusat, DKI Jakarta',
  shipping_courier: 'jne', shipping_service: 'REG', shipping_cost: 12000,
  subtotal: 160000, total: 140000,
  order_items: [{ id: 'it1', product_name: 'Kaos KM11', quantity: 1, variant_color: 'Biru', variant_size: 'M', unit_price: 160000, line_total: 160000 }]
}
const details = shippingAddressDetails(common)
assert.equal(details.address, common.address)
assert.equal(details.destination, common.shipping_destination_label)
assert.equal(details.fullAddress, `${common.address}\nWilayah tujuan: ${common.shipping_destination_label}`)
assert.equal(details.missingDetail, false)
assert.equal(orderFulfillment(common).fullShippingAddress, details.fullAddress)
const workbook = orderExportData([common])
assert.equal(workbook.orderRows.length, 1)
assert.equal(workbook.itemRows.length, 1)
const first = workbook.orderRows[0]
const item = workbook.itemRows[0]
assert.equal(first['Alamat Lengkap Pengiriman'], details.fullAddress)
assert.equal(item['Alamat Lengkap Pengiriman'], details.fullAddress)
assert.equal(first['Alamat Detail Pembeli'], common.address)
assert.equal(item['Wilayah Tujuan'], common.shipping_destination_label)
assert.equal(first.AlamatKirim, common.address) // backward compatibility
assert.equal(first.TujuanKirim, common.shipping_destination_label)
assert.equal(item.AlamatKirim, common.address)
assert.ok(Object.keys(first).indexOf('Alamat Lengkap Pengiriman') < 10, 'Kolom alamat harus dekat identitas pelanggan')
assert.ok(Object.keys(item).indexOf('Alamat Lengkap Pengiriman') < 10, 'Kolom alamat harus dekat nomor pesanan')
assert.equal(item.Warna, 'Biru')
assert.equal(item.Ukuran, 'M')
assert.equal(item.Kurir, 'jne')
assert.equal(item.LayananKirim, 'REG')

// Address repetition should be avoided if the user already typed the full region.
const repeated = shippingAddressDetails({ ...common, address: `Jl. Kenanga No. 12, ${common.shipping_destination_label}` })
assert.equal(repeated.fullAddress, `Jl. Kenanga No. 12, ${common.shipping_destination_label}`)

// Multiline input may be CRLF; normalize without dropping addresses.
const winLines = shippingAddressDetails({ ...common, address: 'Rumah 18\r\nRT 02 RW 05' })
assert.ok(winLines.fullAddress.startsWith('Rumah 18\nRT 02 RW 05\n'))
assert.ok(!winLines.fullAddress.includes('\r'))

// Historical records without a street address MUST NOT masquerade as full address.
const missing = { ...common, address: null }
assert.equal(shippingAddressDetails(missing).missingDetail, true)
assert.match(orderExportData([missing]).orderRows[0]['Alamat Lengkap Pengiriman'], /^ALAMAT DETAIL BELUM TERCATAT\nWilayah tujuan:/)
const noRegion = { ...common, shipping_destination_label: null }
assert.equal(shippingAddressDetails(noRegion).fullAddress, common.address)
const blank = { ...common, address: '   ', shipping_destination_label: '' }
assert.equal(shippingAddressDetails(blank).fullAddress, 'ALAMAT DETAIL BELUM TERCATAT')

// Pickup does not collect a buyer's shipping address; display pickup fields, not a fabricated buyer address.
const pickup = { ...common, id: 'o-2', fulfillment_type: 'pickup', address: null, shipping_destination_label: null,
  shipping_courier: null, shipping_service: null, pickup_location_name: 'KM11 Jakarta',
  pickup_location_address: 'Kantor Pusat', pickup_slot_starts_at: '2026-10-14T02:00:00Z', pickup_slot_ends_at: '2026-10-14T04:00:00Z' }
assert.equal(shippingAddressDetails(pickup).fullAddress, '')
assert.equal(orderExportData([pickup]).orderRows[0]['Alamat Lengkap Pengiriman'], '')
assert.equal(orderExportData([pickup]).itemRows[0]['Alamat Lengkap Pengiriman'], '')
assert.equal(orderExportData([pickup]).orderRows[0].LokasiPickup, 'KM11 Jakarta')
assert.equal(orderExportData([pickup]).itemRows[0].AlamatPickup, 'Kantor Pusat')
assert.ok(orderExportData([pickup]).itemRows[0].SlotPickupWIB.includes('09.00'))

// UI and API must carry the stored address without additional SQL migrations.
const admin = fs.readFileSync(new URL('../src/AdminPage.tsx', import.meta.url), 'utf8')
const checkout = fs.readFileSync(new URL('../src/CartCheckoutPage.tsx', import.meta.url), 'utf8')
const worker = fs.readFileSync(new URL('../worker/index.ts', import.meta.url), 'utf8')
assert.ok(admin.includes('<th>Alamat lengkap pengiriman</th>'))
assert.ok(admin.includes('<OrderAddressCell order={o}/>'))
assert.ok(admin.includes('shippingAddressDetails(order)'))
assert.ok(admin.includes('o.address ||'))
assert.ok(admin.includes("'Alamat Lengkap Pengiriman'"))
assert.ok(admin.includes('sheet[\'!autofilter\']'))
assert.ok(checkout.includes('customer.address'))
assert.ok(worker.includes("address: fulfillmentType === 'ship' ? address : null"))
assert.ok(worker.includes(".select('*,order_items(*)')"))
assert.equal(orderExportData([]).orderRows.length, 0)
console.log('PASS: 38 pemeriksaan alamat pengiriman, pickup, filter, eksport Orders/Items, dan UI/API')
