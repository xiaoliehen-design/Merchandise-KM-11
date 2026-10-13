import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from '/opt/nvm/versions/node/v22.16.0/lib/node_modules/typescript/lib/typescript.js'

const files = ['src/StorePage.tsx', 'src/AdminPage.tsx', 'src/api.ts', 'src/types.ts', 'worker/index.ts']
for (const filename of files) {
  const source = readFileSync(filename, 'utf8')
  const parsed = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true, filename.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  assert.deepEqual(parsed.parseDiagnostics.map(e => ts.flattenDiagnosticMessageText(e.messageText, ' ')), [], `${filename} syntax invalid`)
  const compiled = ts.transpileModule(source, { fileName: filename, reportDiagnostics: true,
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX } })
  assert.deepEqual((compiled.diagnostics || []).filter(e => e.category === ts.DiagnosticCategory.Error).map(e => e.messageText), [], `${filename} compilation invalid`)
}
const source = filename => readFileSync(filename, 'utf8')
const store = source('src/StorePage.tsx')
assert.match(store, /function ProductSizeField/)
assert.match(store, /function SizeChartModal/)
assert.match(store, /aria-modal="true"/)
assert.match(store, /size-chart-info/)
assert.match(store, /<ProductSizeField product=\{p\} value=\{size\}/)
assert.match(store, /<ProductSizeField product=\{p\} value=\{choice\?\.size/)
assert.match(store, /product\.size_chart_url &&/)
const admin = source('src/AdminPage.tsx')
assert.match(admin, /uploadSizeChart\(saved\.id, sizeChartFile\)/)
assert.match(admin, /remove_size_chart: removeSizeChart \|\| sizes\.length === 0/)
assert.match(admin, /URL\.revokeObjectURL/)
assert.match(admin, /Size chart produk/)
const worker = source('worker/index.ts')
assert.match(worker, /app\.post\('\/api\/admin\/products\/:id\/size-chart'/)
assert.match(worker, /\.eq\('id', id\)\.select\(\)\.single\(\)/)
assert.match(worker, /clearSizeChart = row\.sizes\.length === 0 \|\| b\.remove_size_chart === true/)
assert.match(worker, /'image\/jpeg', 'image\/png', 'image\/webp'/)
assert.match(worker, /size_chart_columns: !sizeChartError/)
assert.match(worker, /p\?\.size_chart_path/)
const sql = source('supabase/migrations/009_product_size_chart.sql')
assert.match(sql, /ADD COLUMN IF NOT EXISTS size_chart_url/)
assert.match(sql, /ADD COLUMN IF NOT EXISTS size_chart_path/)
assert.doesNotMatch(sql, /\b(drop|truncate|delete from)\b/i)
console.log('PASS: 5 changed TypeScript source files parse and transpile successfully')
console.log('PASS: customer standalone and bundle size chart UX, admin lifecycle and Worker API contracts')
console.log('PASS: idempotent, non-destructive size chart migration and diagnostic check')
