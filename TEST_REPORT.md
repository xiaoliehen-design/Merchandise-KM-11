# KM11 Merchandise Store — Validation Report

Generated: 2026-10-07

## Checks completed in this workspace

- Project structure/self-test: **PASS** (`node scripts/self-test.mjs`).
- `package.json` JSON parse: **PASS**.
- TypeScript/TSX syntax transpilation for all files under `src/` and `worker/`: **PASS** (12 files).
- Supplied blue and white KM11 umbrella assets are present under `public/theme/`.
- Admin product editor includes editable **price, specifications, colors, sizes, weight, description, active/featured state, and product image**.
- Server-side order creation recalculates current product prices and selected RajaOngkir quote rather than trusting totals sent by the browser.
- Payment-proof upload is guarded by a one-time server-hashed upload token.
- Service-role and RajaOngkir secrets are server-side Worker variables/secrets, not browser variables.

## External integration validation still required

A dependency install/full Vite build could not be completed in this execution environment because access to the npm registry timed out. Live end-to-end verification also requires the owner's real Supabase project and RajaOngkir API credentials.

Before public launch, run:

```bash
npm install
npm run test
npm run build
npm run dev
```

Then test at least one real shipping checkout, one pickup checkout, payment-proof verification, AWB entry, RajaOngkir tracking, and Excel export using production-equivalent Supabase/RajaOngkir configuration.

## Admin account update

Added an **Akun Admin** section with:
- editable admin display name;
- editable login username with uniqueness validation;
- password change requiring verification of the current password;
- minimum 8-character new password and confirmation in the UI;
- password written only to Supabase Auth, never stored in public application tables;
- `002_admin_account.sql` migration for existing installations.

Validation performed after the update:
- all 13 TypeScript/TSX source files parsed successfully with the TypeScript compiler parser;
- `scripts/self-test.mjs` passed.
