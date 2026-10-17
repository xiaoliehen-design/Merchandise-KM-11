/** Tambahan harga untuk setiap pakaian berukuran XXL/2XL dan di atasnya.
 * Digunakan bersama oleh katalog React dan Cloudflare Worker. Selalu hitung
 * ulang di server dari produk dan ukuran yang tersimpan di Supabase.
 */
export const OVERSIZE_SURCHARGE_RP = 15000

type ClothingProduct = {
  name: string
  sizes?: readonly string[] | null
  product_type?: string | null
}

export function isOversize(size: string | null | undefined): boolean {
  const normalized = String(size || '').trim().toUpperCase().replace(/[\s_-]/g, '')
  return /^(?:X{2,}L|(?:[2-9]|[1-9]\d+)XL)$/.test(normalized)
}

export function isClothing(product: ClothingProduct): boolean {
  if (product.product_type === 'emoney_card') return false
  if (/\b(kaos|jersey|vest|baju|kemeja|polo|hoodie|jaket|jacket|sweater|sweatshirt|t-shirt|tshirt|shirt|blouse|celana|pants|dress|seragam|rompi|uniform)\b/i.test(product.name)) return true
  // Item dengan pilihan ukuran baju XXL/2XL+ diklasifikasikan sebagai pakaian
  // meski nama produknya unik (mis. 'Merchic Official 2026').
  return (product.sizes || []).some(size => isOversize(size))
}

export function sizeSurcharge(product: ClothingProduct, size: string | null | undefined): number {
  if (!size || !product.sizes?.includes(size)) return 0
  return isClothing(product) && isOversize(size) ? OVERSIZE_SURCHARGE_RP : 0
}
