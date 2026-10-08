import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'

const compiled = ts.transpileModule(fs.readFileSync('src/colorImages.ts', 'utf8'), {
  fileName: 'src/colorImages.ts',
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText
const mod = { exports: {} }
new Function('module', 'exports', compiled)(mod, mod.exports)
const { resolveProductImage } = mod.exports
const product = {
  image_url: 'main.jpg',
  color_images: { Biru: 'biru.jpg', Putih: 'putih.jpg' }
}
assert.equal(resolveProductImage(product, 'Biru'), 'biru.jpg')
assert.equal(resolveProductImage(product, 'Putih'), 'putih.jpg')
assert.equal(resolveProductImage(product, 'Merah'), 'main.jpg')
assert.equal(resolveProductImage(product), 'main.jpg')
assert.equal(resolveProductImage({ image_url: null, color_images: {} }, 'Biru'), null)

const worker = fs.readFileSync('worker/index.ts','utf8')
assert(worker.includes("'/api/admin/products/:id/color-image'"))
assert(worker.includes(".storage.from('product-images').upload(path, file"))
assert(worker.includes('color_image_paths'))
const editor = fs.readFileSync('src/AdminPage.tsx','utf8')
assert(editor.includes('Foto untuk setiap warna'))
assert(editor.includes('adminApi.uploadColorImage'))
const store = fs.readFileSync('src/StorePage.tsx','utf8')
assert(store.includes('imageUrl: selectedImageUrl'))
assert(store.includes('resolveProductImage(p, isEmoney ? null : color)'))
const migration=fs.readFileSync('supabase/migrations/003_product_color_images.sql','utf8')
assert(migration.includes('ADD COLUMN IF NOT EXISTS color_images'))
console.log('Color image test OK: 5 image cases; admin uploads, Supabase migration, checkout image wiring.')
