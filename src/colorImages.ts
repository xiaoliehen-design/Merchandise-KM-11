import type { Product } from './types'

/** Foto pilihan warna diprioritaskan; foto utama dipakai untuk produk lama/tanpa warna. */
export function resolveProductImage(product: Pick<Product, 'image_url' | 'color_images'>, color?: string | null): string | null {
  return (color ? product.color_images?.[color] : null) || product.image_url || null
}
