/** Membagi harga paket secara deterministik ke tiap item pesanan.
 * Total selalu sama dengan harga paket (sen), bahkan jika tidak habis dibagi.
 */
export function allocateBundlePrice(price: number, count: number): number[] {
  if (!Number.isFinite(price) || price < 0 || !Number.isInteger(count) || count < 1 || count > 12) {
    throw new Error('Harga atau jumlah produk paket tidak valid.')
  }
  const totalCents = Math.round(price * 100)
  if (!Number.isSafeInteger(totalCents) || Math.abs(price * 100 - totalCents) > 0.000001) {
    throw new Error('Harga paket tidak valid.')
  }
  const base = Math.floor(totalCents / count)
  const extra = totalCents - base * count
  return Array.from({ length: count }, (_, idx) => (base + (idx < extra ? 1 : 0)) / 100)
}
