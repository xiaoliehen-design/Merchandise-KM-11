# Perbaikan Build Cloudflare - TS2353 (Diskon Item Individual)

## Masalah yang diperbaiki

Log deployment tanggal 19 Oktober 2026 menampilkan dua error:

```text
worker/index.ts(236,71): error TS2353: Object literal may only specify known properties, and 'itemDiscount' does not exist in type '{ unitPrice: number; lineTotal: number; surcharge: number; }'.
worker/index.ts(246,104): error TS2353: Object literal may only specify known properties, and 'itemDiscount' does not exist in type '{ unitPrice: number; lineTotal: number; surcharge: number; }'.
```

## Perbaikan

File `worker/index.ts` pada handler `POST /api/pricing/quote` diperbaiki menjadi:

```ts
const lineItems: Array<{
  unitPrice: number;
  lineTotal: number;
  surcharge: number;
  itemDiscount: number;
}> = []
```

Setiap `lineItems.push(...)` yang ada memang sudah mengirim `itemDiscount`, baik untuk produk paket (0) maupun produk biasa (diskon item yang dihitung server). Tidak ada perubahan mekanisme atau persentase diskon, rumus surcharge XXL+, atau struktur database pada patch build ini.

## Cara menerapkan

1. Ekstrak ZIP dan gunakan seluruh folder `km11-merch-store` untuk memperbarui repo GitHub proyek Cloudflare (jangan membuat folder bersarang baru).
2. Pastikan migrasi `supabase/migrations/011_individual_product_discounts.sql` dari rilis diskon individual sebelumnya **sudah** diterapkan satu kali di Supabase. Jika belum, jalankan migrasi itu sebelum membuka fitur diskon individual di produksi.
3. Commit dan push ke branch yang dipakai Cloudflare.
4. Pastikan command build Cloudflare adalah `npm run build`. Lakukan redeploy.
5. Jika masih ada kegagalan, lihat **pesan error paling awal yang baru** pada log dan pastikan Cloudflare menggunakan commit terbaru.

## Verifikasi patch

- Periksa deklarasi dan dua objek `lineItems.push` dengan TypeScript 5.8.3 `tsc --strict --noEmit`: **lulus**.
- Semua 24 file TypeScript/TSX di proyek lulus parsing sintaks.
- `npm test`: **lulus**.
- `npm run test:colors`, `test:bundles`, `test:promos`, `test:oversize`, `test:item-discounts`, `test:contacts`, `test:orders`, `test:addresses`, dan `test:shipping3`: **lulus**.
- Build proyek secara menyeluruh (`tsc -b && vite build`) **belum dapat diverifikasi di lingkungan ini** karena instalasi dependensi npm mengalami timeout. Jalankan build pada Cloudflare atau mesin dengan dependensi terpasang sebelum menganggap deploy berhasil.

Patch ini dibuat dari `Merchic_KM11_DISKON_INDIVIDUAL_2026-10-19.zip` dan seluruh aset serta migrasi sebelumnya dipertahankan.
