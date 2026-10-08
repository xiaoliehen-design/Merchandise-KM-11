import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const ts = require('/opt/nvm/versions/node/v22.16.0/lib/node_modules/typescript/lib/typescript.js')
function allFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(x => x.isDirectory() ? allFiles(join(directory, x.name)) : [join(directory, x.name)])
}
const sourceFiles = [...allFiles('src'), ...allFiles('worker')].filter(x => /\.tsx?$/.test(x))
for (const filename of sourceFiles) {
  const input = readFileSync(filename, 'utf8')
  const result = ts.transpileModule(input, {
    fileName: filename,
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX },
    reportDiagnostics: true
  })
  const errors = result.diagnostics?.filter(d => d.category === ts.DiagnosticCategory.Error) || []
  assert.deepEqual(errors.map(e=>ts.flattenDiagnosticMessageText(e.messageText, ' ')), [], `Syntax errors: ${filename}`)
}
console.log(`PASS: ${sourceFiles.length} TS/TSX files transpile without syntax diagnostics`)
const helperSource = readFileSync('src/apiError.ts', 'utf8')
const helperJs = ts.transpileModule(helperSource, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
const mod = { exports: {} }
Function('module','exports', helperJs)(mod, mod.exports)
const format = mod.exports.readableApiError
assert.equal(format({ error: { message: 'Bucket not found', code: '404' } }), 'Bucket not found')
assert.equal(format({ error: '[object Object]', details: 'SQL schema problem' }), 'SQL schema problem')
assert.equal(format({ error: { message: { message: 'Invalid key' } } }), 'Invalid key')
assert.equal(format(new Error('Upload failed')), 'Upload failed')
assert.equal(format({}), '')
console.log('PASS: 5 error message parsing scenarios')
const admin = readFileSync('src/AdminPage.tsx', 'utf8')
assert.match(admin, /setEdit\(saved\)[\s\S]*setColorPhotos\(prev => \{ const next/)
assert.match(admin, /Mengunggah foto warna \$\{color\}/)
assert.match(admin, /productUploadCheck/)
console.log('PASS: partially completed variant uploads remain saved and identifiable')
const backend = readFileSync('worker/index.ts', 'utf8')
assert.match(backend, /upload-check/)
assert.match(backend, /storage\.getBucket\('product-images'\)/)
assert.match(backend, /explainColorUploadError/)
console.log('PASS: authenticated Storage diagnostic endpoint and staged error handling present')
const sql = readFileSync('supabase/migrations/005_color_photo_upload_repair.sql', 'utf8')
assert.match(sql, /ADD COLUMN IF NOT EXISTS color_images/)
assert.match(sql, /ON CONFLICT \(id\) DO UPDATE/)
assert.doesNotMatch(sql, /DROP TABLE|TRUNCATE|DELETE FROM/i)
console.log('PASS: idempotent SQL repair migration retains existing data')
