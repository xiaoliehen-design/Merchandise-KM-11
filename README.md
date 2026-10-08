# KM 11 Merchandise Store

Full-stack order application for **Kemenkeu Mengajar 11 merchandise**. The visual system follows the supplied blue/white umbrella references and keeps product imagery fully visible (`object-fit: contain`).

## Stack

- **Frontend:** React + TypeScript + Vite
- **Edge backend:** Cloudflare Worker (`/api/*`) + Cloudflare static assets for the SPA
- **Database/Auth/Storage:** Supabase PostgreSQL, Auth, and Storage
- **Shipping:** RajaOngkir / Komerce Shipping Cost API v2
- **Excel export:** SheetJS (`xlsx`) in the admin browser

The project uses Cloudflare's current full-stack Vite/Workers pattern: static SPA assets and the Worker API are deployed together. No Supabase service-role key or RajaOngkir API key is exposed to the browser.

## Implemented features

### Customer

1. Product catalog with quantity, optional color, optional size, image, and price.
2. Anonymous persistent cart. It is saved in `localStorage` and also synced to Supabase using a random browser cart token plus a hashed IP audit value. This is safer than using raw IP as the cart identity and still survives tab/browser closing on the same device.
3. Checkout fields: name, email, phone, full address, shipping or pickup.
4. RajaOngkir destination search and real-time shipping quotes. The Worker recalculates the chosen quote at order creation, so a customer cannot alter shipping cost from DevTools.
5. Pickup location and pickup slot selection, both controlled by admin.
6. Payment method selection, QR display, payment-proof upload, and generated receipt number.
7. Public tracking by receipt. Once an AWB exists, the Worker requests RajaOngkir tracking data. If RajaOngkir returns `delivered: true`, the order is automatically changed to `completed`.

### Admin

1. Username/password login only; no public registration page.
2. Supabase Auth stores the password; the `admins` table stores the username-to-auth-user mapping.
3. Add/edit products, including **price, specifications JSON, colors, sizes, weight, active/featured status, and image**.
4. Hard-delete products. Historical order lines remain because `order_items.product_id` uses `ON DELETE SET NULL` and stores product-name/price snapshots.
5. Order list with status filtering/search, payment-proof preview, verification button, AWB/courier entry, and manual completion for pickup orders.
6. Status flow: `new` → `verified` → `shipped` → `completed`; shipped orders can auto-complete from RajaOngkir tracking.
7. Excel export with `Orders`, `Items`, and `Summary` worksheets.
8. Pickup-location CRUD and pickup-slot CRUD.
9. Payment-method CRUD, including QR upload.
10. RajaOngkir origin ID and allowed courier list in admin settings.

## 1. Create the Supabase database

Create a Supabase project, then run:

```sql
-- paste/run the content of:
supabase/migrations/001_init.sql
```

The migration creates tables, indexes, a transactional order RPC, RLS lockdown, and these Storage buckets:

- `product-images` — public
- `payment-assets` — public
- `payment-proofs` — private

Public/authenticated database access is revoked intentionally. Browser traffic goes through the Worker; the Worker uses the Supabase service-role secret server-side.

## 2. Create the first admin

After installing dependencies locally, set environment variables and run the included helper:

```bash
export SUPABASE_URL="https://YOUR_PROJECT.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="YOUR_SERVICE_ROLE_KEY"
export ADMIN_USERNAME="admin"
export ADMIN_PASSWORD="change-this-password"
export ADMIN_DISPLAY_NAME="Admin KM11"        # optional; defaults to username
export ADMIN_EMAIL="admin-km11@example.com"   # optional but recommended
npm run create-admin
```

The script creates/updates a Supabase Auth user and synchronizes the `admins` table. Passwords are never stored in the `admins` table.

After login, open **Akun Admin** to change the displayed admin name, username login, or password. Changing the password requires the current password; the new password is written directly to Supabase Auth and is never stored in application tables.

## 3. Local environment

Copy:

```bash
cp .dev.vars.example .dev.vars
```

Fill:

```text
SUPABASE_URL=...
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
RAJAONGKIR_API_KEY=...
CART_SECRET=use-a-long-random-secret
RAJAONGKIR_MOCK=true
```

Use `RAJAONGKIR_MOCK=true` for UI development before you have a live Shipping Cost API key. Set it to `false` for production.

## 4. RajaOngkir configuration

This app is coded against the current RajaOngkir/Komerce Shipping Cost API v2 base URL:

```text
https://rajaongkir.komerce.id/api/v1
```

The Worker uses:

- `GET /destination/domestic-destination?search=...`
- `POST /calculate/domestic-cost`
- `POST /track/waybill?awb=...&courier=...`

The key is sent in the server-side `key` header. Do **not** place it in Vite/browser variables.

After login, open **Admin → Pengaturan**, then set:

- `RajaOngkir Origin ID`
- `Label asal`
- allowed courier codes, e.g. `jne:sicepat:jnt:ninja:tiki:anteraja:pos`

You can obtain the origin ID from the same destination-search endpoint.

## 5. Run locally

```bash
npm install
npm run dev
```

Open the Vite URL shown in the terminal.

## 6. Deploy to Cloudflare Workers

Authenticate Wrangler once:

```bash
npx wrangler login
```

Create Worker secrets:

```bash
npx wrangler secret put SUPABASE_URL
npx wrangler secret put SUPABASE_ANON_KEY
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
npx wrangler secret put RAJAONGKIR_API_KEY
npx wrangler secret put CART_SECRET
```

For production, change `RAJAONGKIR_MOCK` to `false` in `wrangler.jsonc`, then:

```bash
npm run deploy
```

The same deployment serves the React application and sends `/api/*` to `worker/index.ts`.

## Production checklist

- Change the seeded demo umbrella products' prices/specifications and activate only the products actually sold.
- Create at least one active payment method.
- Create pickup locations and future pickup slots if pickup is offered.
- Set the RajaOngkir origin ID.
- Confirm live RajaOngkir key/quota and supported courier codes.
- Use a strong, unique `CART_SECRET` and admin password.
- Keep the Supabase service-role key only in Cloudflare Worker secrets.
- Test one shipping checkout, one pickup checkout, one verification, one AWB, and one tracking lookup before opening orders publicly.

## Notes about the supplied umbrella files

The two images are included under:

```text
public/theme/payung-biru.png
public/theme/payung-putih.png
```

They are used in the landing hero and as inactive demo product references. They are not uploaded automatically to Supabase, because the admin product uploader is intended to be the source of truth for final product photographs.

## Troubleshooting: `Server belum dikonfigurasi: SUPABASE_URL`

Read **`CLOUDFLARE_FIX_GUIDE.md`** for a step-by-step diagnosis. The repository now contains `keep_vars: true` to avoid overwriting dashboard-managed Worker variables during a Wrangler deploy.

After deploying the new version, open `https://YOUR_LIVE_DOMAIN/api/health` in a browser. Confirm `revision` is `km11-config-check-2026-10-08-v1`, `configured` is `true`, and `missing_bindings` is empty. This endpoint exposes only the **names** of missing environment variables, never their values.

## Pembaruan gambar landing page — 8 Oktober 2026

- Hero merchandise lama yang berupa kolase beberapa gambar terpisah digantikan dengan foto showcase KM11 yang diberikan pengguna.
- Gambar berada di `public/hero/km11-merchandise-showcase.png` (salinan PNG asli, tanpa perubahan) dan `.webp` (versi yang lebih ringan untuk browser modern).
- Tampilan hero memiliki rasio 4:3 dan `object-fit: contain`, sehingga gambar tidak terpotong pada desktop maupun ponsel.
- Komponen katalog, keranjang, admin, Worker, dan konfigurasi Supabase tidak berubah.
- Deploy ulang versi ini melalui GitHub/Cloudflare dan hard refresh jika website masih menampilkan hero lama.
