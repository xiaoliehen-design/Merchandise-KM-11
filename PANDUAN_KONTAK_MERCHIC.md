# Update kontak Merchic KM11

Nomor WhatsApp resmi: **+62 811-3446-578**. URL: https://wa.me/628113446578

Instagram resmi: **@km_dkijakarta**. URL: https://www.instagram.com/km_dkijakarta/

## Instalasi

1. Backup perubahan Anda, kemudian unggah seluruh source dari ZIP terbaru ke GitHub/Cloudflare seperti biasa. Konfigurasi dan data produk/transaksi yang sudah ada tetap dipertahankan.
2. Di Supabase SQL Editor, jalankan **supabase/migrations/008_merchic_official_contacts.sql**, sesudah migrasi 007 jika belum. Migrasi kecil ini idempotent dan hanya memperbarui dua pengaturan kontak; **tidak mengubah transaksi atau produk**. Jika kedua kontak sudah dikonfigurasi secara berbeda, migrasi akan menggantinya dengan detail resmi terbaru.
3. Deploy. Buka website dan cek menu **Instagram**, menu **WhatsApp**, kontak pada footer, dan tombol mengambang **Chat WhatsApp**. Pastikan tautan Instagram menuju `instagram.com/km_dkijakarta/` dan tombol WhatsApp menuju `wa.me/628113446578`.
4. Kontak juga dapat diubah melalui **Admin → Pengaturan**; masukkan `km_dkijakarta` dan `628113446578` (format angka saja). Jika kedua pengaturan belum tersimpan, backend dan frontend menyediakan fallback ke kedua kontak ini sehingga tetap tampil.

Tidak diperlukan variabel/secrets Cloudflare tambahan.
