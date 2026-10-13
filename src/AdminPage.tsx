import { useEffect, useMemo, useState } from 'react'
import * as XLSX from 'xlsx'
import { BarChart3, CheckCircle2, CreditCard, Download, Edit3, KeyRound, LogOut, MapPin, Package, Plus, RefreshCw, Search, Settings, ShieldCheck, Trash2, Truck, UserCog, X, Tag, ClipboardList } from 'lucide-react'
import { adminApi } from './api'
import { readableApiError } from './apiError'
import { resolveProductImage } from './colorImages'
import type { Order, PaymentMethod, PickupLocation, Product, ProductBundle, LaunchSettings, PromoCode, AuditLog } from './types'
import { dt, rupiah, slugify, statusLabel } from './utils'
import { itemVariantText, orderExportData, orderFulfillment, sortedOrderItems } from './orderAdminData'

type Tab = 'orders' | 'products' | 'pickups' | 'payments' | 'settings' | 'promotions' | 'audit' | 'account'

export default function AdminPage() {
  const [authed, setAuthed] = useState<boolean | null>(null)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const token = localStorage.getItem('km11_admin_access_token')
    if (!token) { setAuthed(false); return }
    adminApi.me().then(() => setAuthed(true)).catch(() => {
      localStorage.removeItem('km11_admin_access_token')
      localStorage.removeItem('km11_admin_refresh_token')
      setAuthed(false)
    })
  }, [])

  async function login(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError('')
    try {
      const r = await adminApi.login(username, password)
      localStorage.setItem('km11_admin_access_token', r.access_token)
      localStorage.setItem('km11_admin_refresh_token', r.refresh_token)
      setAuthed(true)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  if (authed === null) return <section className="section"><div className="empty">Memeriksa sesi admin...</div></section>
  if (!authed) return <section className="section admin-login-wrap"><form className="admin-login panel" onSubmit={login}>
    <div className="admin-lock"><ShieldCheck size={34}/></div>
    <span className="eyebrow">Admin only</span>
    <h1>Login dashboard</h1>
    {error && <div className="alert error">{error}</div>}
    <label>Username<input autoComplete="username" value={username} onChange={e => setUsername(e.target.value)}/></label>
    <label>Password<input autoComplete="current-password" type="password" value={password} onChange={e => setPassword(e.target.value)}/></label>
    <button className="primary" disabled={busy}>{busy ? 'Masuk…' : 'Login Admin'}</button>
  </form></section>
  return <AdminDashboard onLogout={() => {
    localStorage.removeItem('km11_admin_access_token')
    localStorage.removeItem('km11_admin_refresh_token')
    setAuthed(false)
  }}/>
}

function AdminDashboard({ onLogout }: { onLogout: () => void }) {
  const [tab, setTab] = useState<Tab>('orders')
  const [adminName, setAdminName] = useState('Admin')
  useEffect(() => { adminApi.me().then(v => setAdminName(v.display_name || v.username || 'Admin')).catch(() => undefined) }, [])
  return <section className="admin-shell">
    <aside className="admin-sidebar"><div className="admin-title"><span className="admin-brand-logo"><img src="/brand/merchic-logo.png" alt="Merchic"/></span><div><b>{adminName}</b><small>Merchandise</small></div></div>
      <button className={tab === 'orders' ? 'active' : ''} onClick={() => setTab('orders')}><Package/> Pesanan</button>
      <button className={tab === 'products' ? 'active' : ''} onClick={() => setTab('products')}><BarChart3/> Produk</button>
      <button className={tab === 'pickups' ? 'active' : ''} onClick={() => setTab('pickups')}><MapPin/> Pickup</button>
      <button className={tab === 'payments' ? 'active' : ''} onClick={() => setTab('payments')}><CreditCard/> Pembayaran</button>
      <button className={tab === 'settings' ? 'active' : ''} onClick={() => setTab('settings')}><Settings/> Pengaturan</button>
      <button className={tab === 'promotions' ? 'active' : ''} onClick={() => setTab('promotions')}><Tag/> Promo & diskon</button>
      <button className={tab === 'audit' ? 'active' : ''} onClick={() => setTab('audit')}><ClipboardList/> Aktivitas admin</button>
      <button className={tab === 'account' ? 'active' : ''} onClick={() => setTab('account')}><UserCog/> Akun Admin</button>
      <button className="logout" onClick={onLogout}><LogOut/> Logout</button>
    </aside>
    <div className="admin-content">
      {tab === 'orders' && <OrdersAdmin/>}
      {tab === 'products' && <ProductsAdmin/>}
      {tab === 'pickups' && <PickupsAdmin/>}
      {tab === 'payments' && <PaymentsAdmin/>}
      {tab === 'settings' && <SettingsAdmin/>}
      {tab === 'promotions' && <PromotionsAdmin/>}
      {tab === 'audit' && <AuditAdmin/>}
      {tab === 'account' && <AccountAdmin onNameChanged={setAdminName}/>}
    </div>
  </section>
}


const emptyPromo: Partial<PromoCode> = { code: '', description: '', discount_type: 'percent', amount: 10, min_order_amount: 0, starts_at: null, ends_at: null, active: true }
function toInputDate(value: string | null | undefined) {
  if (!value) return ''
  const d = new Date(value)
  return new Date(d.getTime() - d.getTimezoneOffset()*60000).toISOString().slice(0,16)
}
function PromotionsAdmin() {
  const [settings, setSettings] = useState<LaunchSettings>({ enabled:true, standard:15, bundle:20, endAt:null })
  const [codes, setCodes] = useState<PromoCode[]>([])
  const [edit, setEdit] = useState<Partial<PromoCode>>({...emptyPromo})
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [busy, setBusy] = useState(false)
  async function load() { try { const result = await adminApi.promotions(); setSettings(result.settings); setCodes(result.codes) } catch(e) { setError((e as Error).message) } }
  useEffect(()=>{void load()},[])
  async function saveLaunch() { setBusy(true);setError('');setSuccess('');try{setSettings(await adminApi.saveLaunch(settings));setSuccess('Diskon launching tersimpan. Diskon 10% di atas Rp500.000 berlaku permanen.')}catch(e){setError((e as Error).message)}finally{setBusy(false)} }
  async function saveCode() {
    setBusy(true);setError('');setSuccess('')
    try { await adminApi.savePromoCode({ ...edit, code: (edit.code||'').trim().toUpperCase(), starts_at: edit.starts_at ? new Date(edit.starts_at).toISOString() : null, ends_at: edit.ends_at ? new Date(edit.ends_at).toISOString() : null });setEdit({...emptyPromo}); await load();setSuccess('Kode promo berhasil disimpan.') } catch(e){setError((e as Error).message)}finally{setBusy(false)}
  }
  async function removeCode(code: PromoCode) { if(!confirm(`Hapus kode ${code.code}?`))return; try{await adminApi.deletePromoCode(code.id);await load()}catch(e){setError((e as Error).message)} }
  return <>
    <AdminHeader title="Promo & diskon"/>
    {error && <div className="alert error" role="alert">{error}</div>}{success && <div className="alert success">{success}</div>}
    <div className="panel merchic-admin-panel"><span className="eyebrow">Diskon otomatis</span><h2>Launching 15–20%</h2><p className="muted">Produk reguler default 15%, paket default 20%. Anda dapat mengubah keduanya antara 15–20%, mengatur batas waktu, atau menonaktifkan promo. Diskon otomatis tambahan 10% untuk subtotal sebelum diskon lebih dari Rp500.000 berlaku selamanya.</p>
      <div className="form-grid two"><label>Diskon produk biasa (%)<input type="number" min="15" max="20" step="1" value={settings.standard} onChange={e=>setSettings({...settings,standard:Number(e.target.value)})}/></label><label>Diskon paket (%)<input type="number" min="15" max="20" step="1" value={settings.bundle} onChange={e=>setSettings({...settings,bundle:Number(e.target.value)})}/></label><label>Batas akhir launching (opsional)<input type="datetime-local" value={toInputDate(settings.endAt)} onChange={e=>setSettings({...settings,endAt:e.target.value?new Date(e.target.value).toISOString():null})}/></label><label className="promo-enabled"><input type="checkbox" checked={settings.enabled} onChange={e=>setSettings({...settings,enabled:e.target.checked})}/> Aktifkan promo launching</label></div>
      <div className="button-row"><button className="primary" disabled={busy} onClick={saveLaunch}>Simpan diskon launching</button></div>
    </div>
    <div className="panel merchic-admin-panel"><span className="eyebrow">Kode promo tambahan</span><h2>{edit.id?'Edit kode promo':'Buat kode promo'}</h2><p className="muted">Kode promo tetap dapat dipakai bersamaan dengan kedua diskon otomatis selama memenuhi syarat.</p>
      <div className="form-grid two"><label>Kode promo<input maxLength={40} value={edit.code||''} onChange={e=>setEdit({...edit,code:e.target.value.toUpperCase()})} placeholder="Contoh: MERCHIC10"/></label><label>Deskripsi<input value={edit.description||''} onChange={e=>setEdit({...edit,description:e.target.value})}/></label><label>Jenis diskon<select value={edit.discount_type||'percent'} onChange={e=>setEdit({...edit,discount_type:e.target.value as 'percent'|'fixed'})}><option value="percent">Persentase (%)</option><option value="fixed">Nominal (Rp)</option></select></label><label>Nilai diskon<input type="number" min="1" step="1" value={edit.amount??10} onChange={e=>setEdit({...edit,amount:Number(e.target.value)})}/></label><label>Minimal subtotal pembelian (Rp)<input type="number" min="0" step="1" value={edit.min_order_amount??0} onChange={e=>setEdit({...edit,min_order_amount:Number(e.target.value)})}/></label><label className="promo-enabled"><input type="checkbox" checked={edit.active!==false} onChange={e=>setEdit({...edit,active:e.target.checked})}/> Kode aktif</label><label>Berlaku mulai (opsional)<input type="datetime-local" value={toInputDate(edit.starts_at)} onChange={e=>setEdit({...edit,starts_at:e.target.value||null})}/></label><label>Berlaku sampai (opsional)<input type="datetime-local" value={toInputDate(edit.ends_at)} onChange={e=>setEdit({...edit,ends_at:e.target.value||null})}/></label></div>
      <div className="button-row"><button className="primary" onClick={saveCode} disabled={busy}>Simpan kode promo</button><button className="secondary" onClick={()=>setEdit({...emptyPromo})}>Reset form</button></div>
    </div>
    <div className="panel merchic-admin-panel"><h2>Daftar kode promo</h2><div className="table-wrap"><table><thead><tr><th>Kode</th><th>Diskon</th><th>Minimal</th><th>Periode</th><th>Status</th><th>Aksi</th></tr></thead><tbody>{codes.map(code=><tr key={code.id}><td><b>{code.code}</b><small>{code.description}</small></td><td>{code.discount_type==='percent'?`${code.amount}%`:rupiah(code.amount)}</td><td>{rupiah(code.min_order_amount)}</td><td>{code.starts_at?dt(code.starts_at):'Tanpa awal'} – {code.ends_at?dt(code.ends_at):'Tanpa akhir'}</td><td>{code.active?'Aktif':'Nonaktif'}</td><td><div className="action-row"><button className="mini" onClick={()=>setEdit({...code,starts_at:toInputDate(code.starts_at),ends_at:toInputDate(code.ends_at)})}>Edit</button><button className="mini danger" onClick={()=>removeCode(code)}>Hapus</button></div></td></tr>)}</tbody></table>{!codes.length&&<p className="muted">Belum ada kode promo.</p>}</div></div>
  </>
}
function AuditAdmin() {
  const [logs,setLogs] = useState<AuditLog[]>([])
  const [q,setQ] = useState('')
  const [error,setError] = useState('')
  async function load() { try{setLogs(await adminApi.auditLogs());setError('')}catch(e){setError((e as Error).message)} }
  useEffect(()=>{void load()},[])
  const visible=logs.filter(log=>`${log.admin_username} ${log.action}`.toLowerCase().includes(q.toLowerCase()))
  return <><AdminHeader title="Aktivitas admin" actions={<button className="secondary" onClick={load}><RefreshCw size={17}/> Refresh</button>}/>
  <p className="muted">Jejak tindakan admin yang berhasil: siapa, apa yang diubah, dan kapan. Menampilkan 100 aktivitas terakhir, tanpa menyimpan password atau isi data pelanggan di log.</p>
  {error&&<div className="alert error">{error}</div>}<div className="panel merchic-admin-panel"><div className="search-box"><Search size={17}/><input placeholder="Filter admin atau aktivitas" value={q} onChange={e=>setQ(e.target.value)}/></div><div className="table-wrap"><table><thead><tr><th>Waktu</th><th>Admin</th><th>Aktivitas</th><th>Metode</th></tr></thead><tbody>{visible.map(log=><tr key={log.id}><td>{dt(log.created_at)}</td><td><b>{log.admin_username}</b></td><td><b>{log.action.split(' (')[0]}</b><small>{log.resource}</small></td><td>{log.method}</td></tr>)}</tbody></table>{!visible.length&&<p className="muted">Belum ada aktivitas yang sesuai.</p>}</div></div></>
}

function OrdersAdmin() {
  const [orders, setOrders] = useState<Order[]>([])
  const [status, setStatus] = useState('')
  const [q, setQ] = useState('')
  const [summary, setSummary] = useState<Record<string, number>>({})
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function load() {
    setBusy(true); setError('')
    try {
      const [o, s] = await Promise.all([adminApi.orders(status || undefined), adminApi.summary()])
      setOrders(o)
      setSummary(s)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => { load() }, [status]) // eslint-disable-line react-hooks/exhaustive-deps
  const filtered = useMemo(() => orders.filter(o => `${o.receipt_no} ${o.full_name} ${o.email} ${o.phone}`.toLowerCase().includes(q.toLowerCase())), [orders, q])

  async function verify(id: string) { if (!confirm('Verifikasi bukti bayar untuk order ini?')) return; try { await adminApi.verify(id); await load() } catch (e) { setError((e as Error).message) } }
  async function proof(id: string) { try { const r = await adminApi.paymentProofUrl(id); window.open(r.url, '_blank', 'noopener,noreferrer') } catch (e) { setError((e as Error).message) } }
  async function tracking(o: Order) {
    const number = prompt('Masukkan nomor resi:', o.tracking_number || '')
    if (!number) return
    const courier = prompt('Nama/kode kurir (contoh: jne, jnt, sicepat):', o.tracking_courier || o.shipping_courier || 'jne')
    if (!courier) return
    try { const saved = await adminApi.setTracking(o.id, { trackingNumber: number, courier }); await load(); if (saved.trackingRegistration && !saved.trackingRegistration.ok) setError(`Resi tersimpan, tetapi 17TRACK belum terdaftar: ${saved.trackingRegistration.message || 'Periksa TRACK17_API_KEY dan coba simpan resi kembali.'}`) } catch (e) { setError((e as Error).message) }
  }
  async function completePickup(o: Order) { if (!confirm('Tandai pesanan pickup ini selesai?')) return; try { await adminApi.complete(o.id); await load() } catch (e) { setError((e as Error).message) } }

  function exportExcel() {
    if (!filtered.length) { setError('Tidak ada pesanan sesuai filter untuk diekspor.'); return }
    try {
      const { orderRows, itemRows, summaryRows } = orderExportData(filtered)
      const wb = XLSX.utils.book_new()
      const appendSheet = (rows: Record<string, string | number>[], name: string, fallbackHeaders: string[]) => {
        const sheet = rows.length ? XLSX.utils.json_to_sheet(rows) : XLSX.utils.aoa_to_sheet([fallbackHeaders])
        const headers = rows.length ? Object.keys(rows[0]) : fallbackHeaders
        // Lebar terkontrol supaya nama produk, layanan, dan slot mudah dibaca.
        sheet['!cols'] = headers.map(header => ({ wch: Math.min(48, Math.max(13, header.length + 2, ...rows.slice(0, 100).map(row => Math.min(48, String(row[header] ?? '').split('\n')[0].length + 2)) )) }))
        XLSX.utils.book_append_sheet(wb, sheet, name)
      }
      appendSheet(orderRows, 'Orders', ['Receipt', 'MetodePemenuhan', 'RincianItem'])
      appendSheet(itemRows, 'Items', ['Receipt', 'Produk', 'Warna', 'Ukuran', 'MetodePemenuhan', 'Kurir', 'LayananKirim', 'SlotPickupWIB'])
      appendSheet(summaryRows, 'Summary', ['Metric', 'Value'])
      XLSX.writeFile(wb, `Merchic-orders-${new Date().toISOString().slice(0, 10)}.xlsx`)
    } catch (e) { setError(`Gagal membuat Excel: ${(e as Error).message}`) }
  }

  return <>
    <AdminHeader title="Pesanan" actions={<><button className="secondary" onClick={load}><RefreshCw size={17}/> Refresh</button><button className="primary" onClick={exportExcel}><Download size={17}/> Export Excel</button></>}/>
    <div className="stats-grid"><Stat label="Total" value={summary.total_orders || 0}/><Stat label="Baru" value={summary.new_orders || 0}/><Stat label="Terverifikasi" value={summary.verified_orders || 0}/><Stat label="Dikirim" value={summary.shipped_orders || 0}/><Stat label="Selesai" value={summary.completed_orders || 0}/><Stat label="Nilai order" value={rupiah(summary.order_value || 0)}/></div>
    {error && <div className="alert error">{error}</div>}
    <div className="admin-toolbar panel"><div className="search-box"><Search size={17}/><input placeholder="Cari receipt, nama, email, HP..." value={q} onChange={e => setQ(e.target.value)}/></div><select value={status} onChange={e => setStatus(e.target.value)}><option value="">Semua status</option><option value="new">Baru</option><option value="verified">Terverifikasi</option><option value="shipped">Dikirim</option><option value="completed">Selesai</option></select></div>
    <div className="table-wrap panel"><table><thead><tr><th>Receipt</th><th>Customer</th><th>Status</th><th>Item · Warna · Ukuran</th><th>Total</th><th>Metode kirim / Pickup</th><th>Dibuat</th><th>Aksi</th></tr></thead><tbody>{filtered.map(o => <tr key={o.id}><td><b>{o.receipt_no}</b></td><td>{o.full_name}<small>{o.email}<br/>{o.phone}</small></td><td><span className={`status-badge ${o.status}`}>{statusLabel[o.status]}</span></td><td><div className="admin-order-items">{sortedOrderItems(o).map(it => <div className="admin-order-item" key={it.id}><b>{it.quantity}× {it.product_name}</b>{itemVariantText(it) && <small className="admin-order-variants">{itemVariantText(it)}</small>}{(it.customization as any)?.customerName && <small>Nama custom: {(it.customization as any).customerName}</small>}{it.design_image_url && <a className="tiny-link" href={it.design_image_url} target="_blank" rel="noreferrer">Unduh desain</a>}</div>)}</div></td><td>{rupiah(o.total)}</td><td><OrderFulfillmentCell order={o}/></td><td>{dt(o.created_at)}</td><td><div className="action-row"><button className="mini" onClick={() => proof(o.id)}>Bukti</button>{o.status === 'new' && <button className="mini success" onClick={() => verify(o.id)}>Verifikasi</button>}{o.status !== 'new' && o.fulfillment_type === 'ship' && <button className="mini" onClick={() => tracking(o)}><Truck size={14}/> Resi</button>}{o.status === 'verified' && o.fulfillment_type === 'pickup' && <button className="mini success" onClick={() => completePickup(o)}><CheckCircle2 size={14}/> Selesai</button>}</div></td></tr>)}</tbody></table>{!filtered.length && <div className="empty compact">{busy ? 'Memuat…' : 'Tidak ada order.'}</div>}</div>
  </>
}

function OrderFulfillmentCell({ order }: { order: Order }) {
  const f = orderFulfillment(order)
  return <div className="admin-order-fulfillment">
    <strong>{f.method}</strong>
    {order.fulfillment_type === 'ship' ? <>
      <small>Kurir: {f.courier || 'Belum tercatat'}</small>
      <small>Layanan: {f.service || 'Belum tercatat'}</small>
      {f.destination && <small>Tujuan: {f.destination}</small>}
      {f.trackingNumber && <small>Resi: {f.trackingNumber}</small>}
    </> : <>
      <small>Lokasi: {f.pickupLocation || 'Belum tercatat'}</small>
      {f.pickupAddress && <small>Alamat: {f.pickupAddress}</small>}
      <small>Slot: {f.pickupSlot || 'Belum tercatat'}</small>
    </>}
  </div>
}

function distinctVariants(values: string[]): string[] {
  const seen = new Set<string>()
  return values.map(v => v.trim()).filter(v => {
    const key = v.toLocaleLowerCase('id-ID')
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function addVariants(values: string[], draft: string): string[] {
  // Enter / button is the primary input method; pasted comma, newlines and semicolons also work.
  return distinctVariants([...values, ...draft.split(/[,;\n]+/)])
}

function parseSpecifications(input: string): Record<string, string> {
  const result: Record<string, string> = {}
  for (const line of input.split(/\r?\n/)) {
    const index = line.indexOf('=')
    if (index < 1) continue
    const name = line.slice(0, index).trim()
    const value = line.slice(index + 1).trim()
    if (name && value) result[name] = value
  }
  return result
}

function VariantEditor({ label, values, draft, onDraftChange, onChange, placeholder }: {
  label: string
  values: string[]
  draft: string
  onDraftChange: (value: string) => void
  onChange: (values: string[]) => void
  placeholder: string
}) {
  function add() {
    if (!draft.trim()) return
    onChange(addVariants(values, draft))
    onDraftChange('')
  }
  return <div className="variant-editor">
    <div className="variant-editor-head"><strong>{label}</strong><span>{values.length} pilihan</span></div>
    <div className="variant-entry">
      <input
        type="text"
        aria-label={`Tambah ${label.toLowerCase()}`}
        placeholder={placeholder}
        value={draft}
        onChange={e => onDraftChange(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
      />
      <button type="button" className="secondary variant-add" onClick={add} disabled={!draft.trim()}><Plus size={17}/> Tambah</button>
    </div>
    <div className="variant-chips" aria-label={`${label} tersimpan`}>
      {values.length ? values.map(value => <span className="variant-chip" key={value}>
        <span>{value}</span>
        <button type="button" aria-label={`Hapus ${label.toLowerCase()} ${value}`} onClick={() => onChange(values.filter(v => v !== value))}><X size={14}/></button>
      </span>) : <span className="variant-empty">Belum ada pilihan</span>}
    </div>
  </div>
}

function ColorPhotoField({ color, currentUrl, file, onFileChange }: {
  color: string
  currentUrl?: string | null
  file?: File
  onFileChange: (file: File | null) => void
}) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  useEffect(() => {
    if (!file) { setPreviewUrl(null); return }
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [file])
  const shownUrl = previewUrl || currentUrl
  return <div className="color-photo-row">
    <div className="color-photo-preview">
      {shownUrl ? <img src={shownUrl} alt={`Foto merchandise warna ${color}`}/> : <Package size={30}/>}
    </div>
    <div className="color-photo-meta">
      <b>{color}</b>
      <small>{file ? `Foto baru: ${file.name}` : currentUrl ? 'Foto warna sudah tersimpan' : 'Belum ada foto untuk warna ini'}</small>
      <label className="color-photo-upload">
        <span>{shownUrl ? 'Ganti foto warna' : 'Pilih foto warna'}</span>
        <input type="file" accept="image/png,image/jpeg,image/webp" aria-label={`Upload foto warna ${color}`} onChange={e => onFileChange(e.target.files?.[0] || null)}/>
      </label>
      {file && <button type="button" className="color-photo-cancel" onClick={() => onFileChange(null)}>Batalkan foto baru</button>}
    </div>
  </div>
}


function BundlesAdmin({ products, showEditor, setShowEditor, newRequest }: {
  products: Product[]
  showEditor: boolean
  setShowEditor: (shown: boolean) => void
  newRequest: number
}) {
  const [bundles, setBundles] = useState<ProductBundle[]>([])
  const [form, setForm] = useState<Partial<ProductBundle>>({ name: '', description: '', price: 0, product_ids: [], active: true })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [coverFile, setCoverFile] = useState<File | null>(null)
  const [coverPreviewUrl, setCoverPreviewUrl] = useState<string | null>(null)
  useEffect(()=>{
    if (!coverFile) { setCoverPreviewUrl(null); return }
    const url=URL.createObjectURL(coverFile);setCoverPreviewUrl(url)
    return ()=>URL.revokeObjectURL(url)
  },[coverFile])
  useEffect(() => { if (newRequest > 0) { setForm({ name: '', description: '', price: 0, product_ids: [], active: true }); setCoverFile(null); setError('') } }, [newRequest])
  useEffect(() => { adminApi.bundles().then(setBundles).catch(e => setError((e as Error).message)) }, [])
  const available = products.filter(p => p.active)
  const selected = form.product_ids || []
  const selectedProducts = selected.map(id => products.find(p => p.id === id)).filter((p): p is Product => !!p)
  const regularTotal = selectedProducts.reduce((sum, p) => sum + Number(p.base_price || 0), 0)

  function openNew() {
    setForm({ name: '', description: '', price: 0, product_ids: [], active: true })
    setCoverFile(null)
    setError('')
    setShowEditor(true)
  }
  function openEdit(bundle: ProductBundle) {
    setForm({ ...bundle, product_ids: [...bundle.product_ids] })
    setCoverFile(null)
    setError('')
    setShowEditor(true)
    window.requestAnimationFrame(() => document.getElementById('km11-bundle-editor')?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }
  async function save() {
    if (saving) return
    if (!form.name?.trim()) return setError('Nama paket wajib diisi.')
    if (!selected.length) return setError('Pilih minimal satu produk untuk paket.')
    if (selected.some(id => !available.some(p => p.id === id))) return setError('Paket hanya boleh berisi produk aktif.')
    if (Number(form.price) < 0 || !Number.isFinite(Number(form.price))) return setError('Harga paket tidak valid.')
    if (coverFile && (!['image/jpeg','image/png','image/webp'].includes(coverFile.type) || coverFile.size===0 || coverFile.size>5*1024*1024)) return setError('Foto sampul harus PNG/JPG/WebP maksimal 5 MB.')
    setSaving(true); setError('')
    try {
      const saved = await adminApi.saveBundle({ ...form, name: form.name.trim(), price: Number(form.price), product_ids: selected })
      setForm(saved) // If photo upload fails, retry edits this bundle rather than creating a duplicate.
      if (coverFile) await adminApi.uploadBundleCover(saved.id, coverFile)
      setBundles(await adminApi.bundles())
      setShowEditor(false)
      setCoverFile(null)
      setForm({ name: '', description: '', price: 0, product_ids: [], active: true })
    } catch (e) { setError((e as Error).message) } finally { setSaving(false) }
  }
  async function remove(bundle: ProductBundle) {
    if (!confirm(`Hapus paket ${bundle.name}? Pesanan lama tetap tersimpan.`)) return
    try { await adminApi.deleteBundle(bundle.id); setBundles(await adminApi.bundles()) }
    catch (e) { setError((e as Error).message) }
  }
  return <section className="bundle-admin-section">
    <div className="bundle-admin-title"><div><span className="eyebrow">Paket merchandise</span><h2>Kelola paket</h2></div>{!showEditor && <button type="button" className="secondary" onClick={openNew}><Plus size={16}/> Paket baru</button>}</div>
    {error && <div className="alert error">{error}</div>}
    {showEditor && <div className="panel bundle-editor" id="km11-bundle-editor">
      <div className="bundle-editor-head"><h3>{form.id ? 'Edit paket' : 'Tambah paket baru'}</h3><button type="button" className="icon" onClick={() => setShowEditor(false)} aria-label="Tutup"><X size={18}/></button></div>
      <div className="form-grid two">
        <label>Nama paket<input value={form.name || ''} maxLength={160} onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))} placeholder="Contoh: Paket Ceria KM11"/></label>
        <label>Harga paket (Rp)<input type="number" min="0" step="1" value={form.price ?? 0} onChange={e => setForm(prev => ({ ...prev, price: Number(e.target.value) }))}/></label>
        <label className="span-2">Deskripsi paket<textarea rows={3} value={form.description || ''} onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))} placeholder="Tuliskan isi dan keunggulan paket"/></label>
      </div>
      <div className="bundle-cover-editor"><div className="bundle-cover-preview">{coverFile ? <img src={coverPreviewUrl || ''} alt="Pratinjau sampul paket"/> : form.cover_image_url ? <img src={form.cover_image_url} alt="Sampul paket saat ini"/> : <Package size={36}/>}</div><label>Foto sampul paket untuk katalog<input type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>setCoverFile(e.target.files?.[0]||null)}/><small>Admin dapat mengunggah satu foto utama JPG/PNG/WebP maksimal 5 MB. Jika kosong, katalog menggunakan kolase foto produk.</small></label></div>
      <h3>Pilih produk yang dimasukkan ke paket</h3>
      <div className="bundle-choose-grid">{available.map(p => <label key={p.id} className={`bundle-product-select ${selected.includes(p.id) ? 'chosen' : ''}`}>
        <input type="checkbox" checked={selected.includes(p.id)} onChange={e => setForm(prev => ({ ...prev, product_ids: e.target.checked ? [...selected, p.id] : selected.filter(id => id !== p.id) }))}/>
        {p.image_url && <img src={resolveProductImage(p, p.colors?.[0]) || p.image_url} alt=""/>}
        <span><b>{p.name}</b><small>{p.product_type === 'emoney_card' ? 'Desain custom saat pembelian' : `${p.colors?.length || 0} warna · ${p.sizes?.length || 0} ukuran`}</small></span>
      </label>)}</div>
      {!available.length && <p className="muted">Belum ada produk aktif. Aktifkan produk terlebih dahulu.</p>}
      <div className="bundle-editor-summary"><span>{selected.length} produk dipilih · harga satuan jika terpisah {rupiah(regularTotal)}</span><label><input type="checkbox" checked={form.active !== false} onChange={e => setForm(prev => ({ ...prev, active: e.target.checked }))}/> Tampilkan paket di katalog</label></div>
      <div className="button-row"><button type="button" className="primary" onClick={save} disabled={saving}>{saving ? 'Menyimpan...' : 'Simpan paket'}</button><button type="button" className="secondary" onClick={() => setShowEditor(false)}>Batal</button></div>
    </div>}
    {bundles.length ? <div className="bundle-admin-grid">{bundles.map(bundle => <div className="panel bundle-admin-card" key={bundle.id}>
      <div><b>{bundle.name}</b><span className={bundle.active ? 'bundle-pill' : 'bundle-pill muted'}>{bundle.active ? 'Aktif' : 'Nonaktif'}</span></div>
      {bundle.cover_image_url && <img className="bundle-admin-cover" src={bundle.cover_image_url} alt={`Foto paket ${bundle.name}`}/>}
      <p>{bundle.description || 'Paket KM11'}</p>
      <small>{bundle.product_ids.map(id => products.find(p => p.id === id)?.name || 'Produk tidak ditemukan').join(' · ')}</small>
      <strong>{rupiah(bundle.price)}</strong>
      <div className="button-row"><button type="button" className="secondary" onClick={() => openEdit(bundle)}><Edit3 size={15}/> Edit</button><button type="button" className="secondary" onClick={() => remove(bundle)}><Trash2 size={15}/> Hapus</button></div>
    </div>)}</div> : <p className="muted">Belum ada paket. Klik Tambah paket untuk menyusun produk menjadi satu penawaran.</p>}
  </section>
}

function ProductsAdmin() {
  const [items, setItems] = useState<Product[]>([])
  const [edit, setEdit] = useState<Partial<Product> | null>(null)
  const [image, setImage] = useState<File | null>(null)
  const [colorPhotos, setColorPhotos] = useState<Record<string, File>>({})
  const [colorDraft, setColorDraft] = useState('')
  const [sizeDraft, setSizeDraft] = useState('')
  const [specDraft, setSpecDraft] = useState('')
  const [search, setSearch] = useState('')
  const [showBundleEditor, setShowBundleEditor] = useState(false)
  const [newBundleRequest, setNewBundleRequest] = useState(0)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveStep, setSaveStep] = useState('')
  const [uploadCheck, setUploadCheck] = useState<{ ok: boolean; checks: Record<string, boolean>; problems: string[] } | null>(null)
  const [checkingUpload, setCheckingUpload] = useState(false)

  async function checkUpload() {
    setCheckingUpload(true)
    setError('')
    try { setUploadCheck(await adminApi.productUploadCheck()) }
    catch (e) { setUploadCheck(null); setError(`Pemeriksaan penyimpanan: ${readableApiError(e) || 'Tidak dapat diakses.'}`) }
    finally { setCheckingUpload(false) }
  }

  async function load() {
    try { setItems(await adminApi.products()) } catch (e) { setError((e as Error).message) }
  }
  useEffect(() => { load() }, [])

  function startEditing(product: Partial<Product>) {
    setEdit({ ...product, colors: [...(product.colors || [])], sizes: [...(product.sizes || [])] })
    setImage(null)
    setColorPhotos({})
    setColorDraft('')
    setSizeDraft('')
    setSpecDraft(Object.entries(product.specifications || {}).map(([k, v]) => `${k}=${v}`).join('\n'))
    setError('')
    window.requestAnimationFrame(() => document.getElementById('km11-product-editor')?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  async function save() {
    if (!edit || saving) return
    if (!edit.name?.trim()) { setError('Nama produk wajib diisi.'); return }
    setSaving(true)
    setSaveStep('Memeriksa data produk…')
    setError('')
    try {
      const colors = edit.product_type === 'emoney_card' ? [] : addVariants(edit.colors || [], colorDraft)
      const sizes = edit.product_type === 'emoney_card' ? [] : addVariants(edit.sizes || [], sizeDraft)
      const missingPhotos = colors.filter(c => !colorPhotos[c] && !edit.color_images?.[c])
      if (missingPhotos.length) {
        throw new Error(`Upload foto untuk setiap warna terlebih dahulu: ${missingPhotos.join(', ')}. Jika baru mengetik warna, tekan Tambah agar kolom fotonya muncul.`)
      }
      const invalidFile = Object.entries(colorPhotos).find(([color, file]) => colors.includes(color) &&
        (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size === 0 || file.size > 5 * 1024 * 1024))
      if (invalidFile) throw new Error(`Foto ${invalidFile[0]} harus JPG, PNG, atau WebP, maksimal 5 MB.`)

      setSaveStep('Menyimpan data produk…')
      let saved = await adminApi.upsertProduct({
        ...edit,
        name: edit.name.trim(),
        slug: edit.slug?.trim() || slugify(edit.name),
        specifications: parseSpecifications(specDraft),
        colors,
        sizes
      })
      // Setelah produk tersimpan, pertahankan ID agar percobaan ulang tidak membuat duplikat.
      setEdit(saved)
      if (image) {
        setSaveStep('Mengunggah foto utama…')
        try { saved = await adminApi.uploadProductImage(saved.id, image) }
        catch (e) { throw new Error(`Foto utama: ${readableApiError(e) || 'Upload gagal.'}`) }
        setEdit(saved)
        setImage(null)
      }
      for (const color of colors) {
        const file = colorPhotos[color]
        if (!file) continue
        setSaveStep(`Mengunggah foto warna ${color}…`)
        try { saved = await adminApi.uploadColorImage(saved.id, color, file) }
        catch (e) { throw new Error(`Foto warna ${color}: ${readableApiError(e) || 'Upload gagal.'}`) }
        // Sinkronkan data remote + hapus antrian hanya untuk foto yang berhasil.
        setEdit(saved)
        setColorPhotos(prev => { const next = { ...prev }; delete next[color]; return next })
      }
      setEdit(null)
      setImage(null)
      setColorPhotos({})
      setColorDraft('')
      setSizeDraft('')
      setSaveStep('Menyegarkan daftar produk…')
      await load()
    } catch (e) {
      setError(`${saveStep ? 'Gagal menyimpan produk. ' : ''}${readableApiError(e) || 'Kesalahan tidak diketahui. Gunakan tombol Periksa penyimpanan untuk diagnosis.'}`)
    } finally {
      setSaveStep('')
      setSaving(false)
    }
  }

  async function remove(product: Product) {
    if (!confirm(`Hapus produk ${product.name}?`)) return
    try { await adminApi.deleteProduct(product.id); await load() }
    catch (e) { setError((e as Error).message) }
  }

  const filtered = items.filter(product => `${product.name} ${product.slug} ${product.colors?.join(' ')} ${product.sizes?.join(' ')}`.toLocaleLowerCase('id-ID').includes(search.toLocaleLowerCase('id-ID')))
  return <>
    <AdminHeader title="Produk" actions={<div className="bundle-admin-actions"><button className="secondary" onClick={() => { setNewBundleRequest(n => n + 1); setShowBundleEditor(true); setEdit(null) }}><Plus size={17}/> Tambah paket</button><button className="primary" onClick={() => { setShowBundleEditor(false); startEditing({ name: '', slug: '', description: '', base_price: 0, weight_grams: 50, colors: [], sizes: [], active: true, featured: false, specifications: {}, product_type: 'standard' }) }}><Plus size={17}/> Tambah produk</button></div>}/>
    <BundlesAdmin products={items} showEditor={showBundleEditor} setShowEditor={setShowBundleEditor} newRequest={newBundleRequest}/>
    {error && <div className="alert error" role="alert">{error}</div>}
    <div className="product-upload-diagnostic">
      <button type="button" className="secondary" onClick={checkUpload} disabled={checkingUpload}>
        {checkingUpload ? 'Memeriksa…' : 'Periksa penyimpanan foto'}
      </button>
      {uploadCheck && <div className={`product-upload-check ${uploadCheck.ok ? 'is-ok' : 'is-error'}`}>
        {uploadCheck.ok ? 'Database dan bucket foto tampak siap.' : 'Ditemukan masalah konfigurasi penyimpanan:'}
        {uploadCheck.problems.length > 0 && <ul>{uploadCheck.problems.map((issue, i) => <li key={i}>{issue}</li>)}</ul>}
      </div>}
    </div>
    {edit && <div className="panel editor product-editor" id="km11-product-editor">
      <div className="product-editor-top"><div><span className="eyebrow">Manajemen produk</span><h2>{edit.id ? 'Edit produk' : 'Tambah produk'}</h2></div><button type="button" className="product-editor-close" onClick={() => setEdit(null)} aria-label="Tutup form produk"><X size={19}/></button></div>
      <div className="product-editor-section">
        <h3>Informasi produk</h3>
        <div className="form-grid two">
          <label>Nama produk<input value={edit.name || ''} onChange={e => setEdit({ ...edit, name: e.target.value })}/></label>
          <label>Slug<input value={edit.slug || ''} onChange={e => setEdit({ ...edit, slug: e.target.value })} placeholder="Otomatis jika kosong"/></label>
          <label>Jenis produk<select value={edit.product_type || 'standard'} onChange={e => setEdit({ ...edit, product_type: e.target.value as Product['product_type'] })}><option value="standard">Merchandise standar</option><option value="emoney_card">Kartu e-money custom</option></select></label>
          <label>Harga (Rp)<input type="number" min="0" value={edit.base_price ?? 0} onChange={e => setEdit({ ...edit, base_price: Number(e.target.value) })}/></label>
          <label>Berat (gram)<input type="number" min="0" value={edit.weight_grams ?? 0} onChange={e => setEdit({ ...edit, weight_grams: Number(e.target.value) })}/></label>
        </div>
      </div>
      {edit.product_type !== 'emoney_card' && <div className="product-editor-section">
        <h3>Varian produk</h3>
        <div className="variant-grid">
          <VariantEditor label="Warna" values={edit.colors || []} draft={colorDraft} onDraftChange={setColorDraft} onChange={colors => {
            setEdit(prev => prev ? { ...prev, colors } : prev)
            setColorPhotos(prev => Object.fromEntries(Object.entries(prev).filter(([color]) => colors.includes(color))))
          }} placeholder="Contoh: Biru"/>
          <VariantEditor label="Ukuran" values={edit.sizes || []} draft={sizeDraft} onDraftChange={setSizeDraft} onChange={sizes => setEdit(prev => prev ? { ...prev, sizes } : prev)} placeholder="Contoh: All Size"/>
        </div>
        <div className="color-photo-editor">
          <div className="color-photo-heading"><h3>Foto untuk setiap warna</h3><span>1 warna = 1 foto</span></div>
          <p>Tambahkan warna terlebih dahulu. Unggah foto sesuai warna sehingga gambar pada katalog dan keranjang berubah otomatis ketika pembeli memilih warna lain.</p>
          {(edit.colors || []).length > 0
            ? <div className="color-photo-list">{(edit.colors || []).map(color => <ColorPhotoField
                key={color}
                color={color}
                currentUrl={edit.color_images?.[color]}
                file={colorPhotos[color]}
                onFileChange={file => setColorPhotos(prev => {
                  const next = { ...prev }
                  if (file) next[color] = file
                  else delete next[color]
                  return next
                })}
              />)}</div>
            : <div className="color-photo-empty">Belum ada warna. Tambahkan warna di atas untuk mengunggah foto khusus setiap varian.</div>}
        </div>
      </div>}
      <div className="product-editor-section">
        <h3>Detail dan media</h3>
        <div className="form-grid two">
          <label className="span-2">Deskripsi produk<textarea rows={3} value={edit.description || ''} onChange={e => setEdit({ ...edit, description: e.target.value })}/></label>
          <label className="span-2">Spesifikasi produk<textarea rows={4} value={specDraft} onChange={e => setSpecDraft(e.target.value)} placeholder={'Bahan=Polyester\nDiameter=95 cm\nMekanisme=Auto open'}/></label>
          <label>Foto utama (cadangan)<input type="file" accept="image/png,image/jpeg,image/webp" onChange={e => setImage(e.target.files?.[0] || null)}/><small>Untuk produk dengan pilihan warna, upload foto masing-masing warna pada bagian Varian produk.</small></label>
          <div className="product-editor-flags"><label><input type="checkbox" checked={!!edit.active} onChange={e => setEdit({ ...edit, active: e.target.checked })}/> Aktif dijual</label><label><input type="checkbox" checked={!!edit.featured} onChange={e => setEdit({ ...edit, featured: e.target.checked })}/> Produk unggulan</label></div>
        </div>
      </div>
      <div className="button-row product-editor-actions"><button type="button" className="primary" disabled={saving} onClick={save}>{saving ? (saveStep || 'Menyimpan…') : 'Simpan produk'}</button><button type="button" className="secondary" disabled={saving} onClick={() => setEdit(null)}>Batal</button></div>
    </div>}
    <div className="admin-products-toolbar"><div className="search-box"><Search size={17}/><input aria-label="Cari produk" placeholder="Cari produk atau varian..." value={search} onChange={e => setSearch(e.target.value)}/></div><span className="admin-products-total">{filtered.length} dari {items.length} produk</span></div>
    {filtered.length ? <div className="admin-card-grid">{filtered.map(product => <article className="admin-product-card panel" key={product.id}>
      <div className="admin-product-img">{resolveProductImage(product, product.colors?.[0]) ? <img src={resolveProductImage(product, product.colors?.[0]) || ''} alt={product.name} loading="lazy"/> : <Package size={54}/>}</div>
      <div className="admin-product-info">
        <div className="admin-product-flags"><span className={`admin-product-status ${product.active ? 'is-active' : 'is-inactive'}`}>{product.active ? 'Aktif' : 'Nonaktif'}</span><span className="admin-product-type">{product.product_type === 'emoney_card' ? 'E-money custom' : 'Merchandise'}</span></div>
        <h3 title={product.name}>{product.name}</h3>
        <strong className="admin-product-price">{rupiah(product.base_price)}</strong>
        <div className="admin-product-weight">{product.weight_grams} gram</div>
        {product.product_type !== 'emoney_card' && <div className="admin-product-variants">
          <div><b>Warna</b><span>{product.colors?.length ? product.colors.join(', ') : '—'}{product.colors?.length ? ` · ${product.colors.filter(color => !!product.color_images?.[color]).length}/${product.colors.length} foto` : ''}</span></div>
          <div><b>Ukuran</b><span>{product.sizes?.length ? product.sizes.join(', ') : '—'}</span></div>
        </div>}
      </div>
      <div className="action-row admin-product-actions"><button type="button" className="mini" onClick={() => startEditing(product)}><Edit3 size={15}/> Edit</button><button type="button" className="mini danger" onClick={() => remove(product)}><Trash2 size={15}/> Hapus</button></div>
    </article>)}</div> : <div className="empty panel">{search ? 'Tidak ada produk yang cocok.' : 'Belum ada produk.'}</div>}
  </>
}

function PickupsAdmin() {
  const [items, setItems] = useState<PickupLocation[]>([])
  const [edit, setEdit] = useState<Partial<PickupLocation> | null>(null)
  const [error, setError] = useState('')
  const [slot, setSlot] = useState({ startsAt: '', endsAt: '', capacity: '' })
  async function load() { try { setItems(await adminApi.pickups()) } catch (e) { setError((e as Error).message) } }
  useEffect(() => { load() }, [])
  async function save() { if (!edit) return; try { await adminApi.savePickup(edit); setEdit(null); await load() } catch (e) { setError((e as Error).message) } }
  async function addSlot(id: string) { if (!slot.startsAt || !slot.endsAt) return setError('Isi waktu mulai dan selesai.'); try { await adminApi.addSlot(id, { startsAt: new Date(slot.startsAt).toISOString(), endsAt: new Date(slot.endsAt).toISOString(), capacity: slot.capacity ? Number(slot.capacity) : null }); setSlot({ startsAt: '', endsAt: '', capacity: '' }); await load() } catch (e) { setError((e as Error).message) } }
  return <><AdminHeader title="Lokasi pickup" actions={<button className="primary" onClick={() => setEdit({ name: '', address: '', notes: '', active: true })}><Plus size={17}/> Lokasi</button>}/>{error && <div className="alert error">{error}</div>}
    {edit && <div className="panel editor"><h2>{edit.id ? 'Edit lokasi' : 'Lokasi baru'}</h2><div className="form-grid two"><label>Nama lokasi<input value={edit.name || ''} onChange={e => setEdit({ ...edit, name: e.target.value })}/></label><label>Alamat<input value={edit.address || ''} onChange={e => setEdit({ ...edit, address: e.target.value })}/></label><label className="span-2">Catatan<textarea value={edit.notes || ''} onChange={e => setEdit({ ...edit, notes: e.target.value })}/></label><label><input type="checkbox" checked={!!edit.active} onChange={e => setEdit({ ...edit, active: e.target.checked })}/> Aktif</label></div><div className="button-row"><button className="primary" onClick={save}>Simpan</button><button className="secondary" onClick={() => setEdit(null)}>Batal</button></div></div>}
    <div className="stack-gap">{items.map(p => <div className="panel pickup-admin" key={p.id}><div className="list-head"><div><h3>{p.name}</h3><p>{p.address}</p><small>{p.notes}</small></div><div className="action-row"><button className="mini" onClick={() => setEdit(p)}><Edit3 size={14}/> Edit</button><button className="mini danger" onClick={async () => { if (confirm('Hapus lokasi dan slotnya?')) { await adminApi.deletePickup(p.id); load() } }}><Trash2 size={14}/></button></div></div><div className="slot-list">{(p.slots || []).map(s => <span key={s.id}>{dt(s.starts_at)} – {new Date(s.ends_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} <button onClick={async () => { await adminApi.deleteSlot(s.id); load() }}>×</button></span>)}</div><div className="slot-add"><input type="datetime-local" value={slot.startsAt} onChange={e => setSlot({ ...slot, startsAt: e.target.value })}/><input type="datetime-local" value={slot.endsAt} onChange={e => setSlot({ ...slot, endsAt: e.target.value })}/><input type="number" placeholder="Kapasitas" value={slot.capacity} onChange={e => setSlot({ ...slot, capacity: e.target.value })}/><button className="secondary" onClick={() => addSlot(p.id)}><Plus size={16}/> Slot</button></div></div>)}</div>
  </>
}

function PaymentsAdmin() {
  const [items, setItems] = useState<PaymentMethod[]>([])
  const [edit, setEdit] = useState<Partial<PaymentMethod> | null>(null)
  const [qr, setQr] = useState<File | null>(null)
  const [error, setError] = useState('')
  async function load() { try { setItems(await adminApi.payments()) } catch (e) { setError((e as Error).message) } }
  useEffect(() => { load() }, [])
  async function save() { if (!edit) return; try { const p = await adminApi.savePayment(edit); if (qr) await adminApi.uploadQr(p.id, qr); setEdit(null); setQr(null); await load() } catch (e) { setError((e as Error).message) } }
  return <><AdminHeader title="Metode pembayaran" actions={<button className="primary" onClick={() => setEdit({ name: '', type: 'bank_transfer', account_name: '', account_number: '', instructions: '', active: true })}><Plus size={17}/> Metode</button>}/>{error && <div className="alert error">{error}</div>}
    {edit && <div className="panel editor"><div className="form-grid two"><label>Nama<input value={edit.name || ''} onChange={e => setEdit({ ...edit, name: e.target.value })}/></label><label>Jenis<select value={edit.type || 'bank_transfer'} onChange={e => setEdit({ ...edit, type: e.target.value as any })}><option value="bank_transfer">Transfer bank</option><option value="qris">QRIS</option><option value="other">Lainnya</option></select></label><label>Nomor rekening / ID<input value={edit.account_number || ''} onChange={e => setEdit({ ...edit, account_number: e.target.value })}/></label><label>Nama pemilik<input value={edit.account_name || ''} onChange={e => setEdit({ ...edit, account_name: e.target.value })}/></label><label className="span-2">Instruksi<textarea value={edit.instructions || ''} onChange={e => setEdit({ ...edit, instructions: e.target.value })}/></label><label>QR image<input type="file" accept="image/png,image/jpeg,image/webp" onChange={e => setQr(e.target.files?.[0] || null)}/></label><label><input type="checkbox" checked={!!edit.active} onChange={e => setEdit({ ...edit, active: e.target.checked })}/> Aktif</label></div><div className="button-row"><button className="primary" onClick={save}>Simpan</button><button className="secondary" onClick={() => setEdit(null)}>Batal</button></div></div>}
    <div className="admin-card-grid">{items.map(p => <div className="panel payment-admin" key={p.id}>{p.qr_image_url ? <img src={p.qr_image_url} alt={p.name}/> : <CreditCard size={36}/>}<div><h3>{p.name}</h3><p>{p.account_number || p.type}</p><small>{p.active ? 'Aktif' : 'Nonaktif'}</small></div><div className="action-row"><button className="mini" onClick={() => { setEdit(p); setQr(null) }}><Edit3 size={14}/> Edit</button><button className="mini danger" onClick={async () => { if (confirm('Hapus metode pembayaran?')) { await adminApi.deletePayment(p.id); load() } }}><Trash2 size={14}/></button></div></div>)}</div>
  </>
}


function AccountAdmin({ onNameChanged }: { onNameChanged: (name: string) => void }) {
  const [displayName, setDisplayName] = useState('')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    adminApi.account().then(a => {
      setDisplayName(a.display_name || a.username)
      setUsername(a.username)
      setEmail(a.auth_email)
    }).catch(e => setError((e as Error).message))
  }, [])

  async function saveProfile() {
    setError(''); setSuccess('')
    if (!displayName.trim()) return setError('Nama admin wajib diisi.')
    if (!username.trim()) return setError('Username admin wajib diisi.')
    setBusy(true)
    try {
      const updated = await adminApi.updateAccount({ displayName: displayName.trim(), username: username.trim() })
      setDisplayName(updated.display_name)
      setUsername(updated.username)
      onNameChanged(updated.display_name || updated.username)
      setSuccess('Nama dan username admin berhasil diperbarui.')
    } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }

  async function savePassword() {
    setError(''); setSuccess('')
    if (!currentPassword) return setError('Masukkan password saat ini.')
    if (newPassword.length < 8) return setError('Password baru minimal 8 karakter.')
    if (newPassword !== confirmPassword) return setError('Konfirmasi password baru tidak sama.')
    if (currentPassword === newPassword) return setError('Password baru harus berbeda dari password saat ini.')
    setBusy(true)
    try {
      await adminApi.changePassword({ currentPassword, newPassword })
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('')
      setSuccess('Password admin berhasil diubah. Password baru berlaku untuk login berikutnya.')
    } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }

  return <>
    <AdminHeader title="Akun Admin"/>
    {error && <div className="alert error">{error}</div>}
    {success && <div className="alert success">{success}</div>}
    <div className="account-grid">
      <div className="panel editor">
        <div className="account-section-title"><UserCog size={22}/><div><h2>Profil admin</h2></div></div>
        <div className="form-grid">
          <label>Nama admin<input value={displayName} onChange={e => setDisplayName(e.target.value)} maxLength={120}/></label>
          <label>Username login<input value={username} onChange={e => setUsername(e.target.value)} maxLength={80}/><small>Digunakan saat login. Harus unik.</small></label>
          <label>Email autentikasi<input value={email} disabled/><small>Email ini dikelola di Supabase dan tidak diubah dari aplikasi.</small></label>
        </div>
        <div className="button-row"><button className="primary" onClick={saveProfile} disabled={busy}>Simpan profil</button></div>
      </div>
      <div className="panel editor">
        <div className="account-section-title"><KeyRound size={22}/><div><h2>Ubah password</h2></div></div>
        <div className="form-grid">
          <label>Password saat ini<input type="password" autoComplete="current-password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)}/></label>
          <label>Password baru<input type="password" autoComplete="new-password" value={newPassword} onChange={e => setNewPassword(e.target.value)}/><small>Minimal 8 karakter.</small></label>
          <label>Ulangi password baru<input type="password" autoComplete="new-password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}/></label>
        </div>
        <div className="button-row"><button className="primary" onClick={savePassword} disabled={busy}><KeyRound size={17}/> Ubah password</button></div>
      </div>
    </div>
  </>
}

function SettingsAdmin() {
  const [settings, setSettings] = useState<Record<string, string>>({ shipping_origin_id: '', shipping_origin_label: '', shipping_couriers: 'jne:sicepat:jnt:ninja:tiki:anteraja:pos', shipping_origin_postal_code: '', social_instagram: 'km_dkijakarta', social_whatsapp: '628113446578' })
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  useEffect(() => { adminApi.settings().then(v => setSettings(s => ({ ...s, ...v, social_instagram: v.social_instagram || 'km_dkijakarta', social_whatsapp: v.social_whatsapp || '628113446578' }))).catch(e => setError((e as Error).message)) }, [])
  async function save() { try { setSettings(await adminApi.saveSettings(settings)); setSaved(true); setTimeout(() => setSaved(false), 1500) } catch (e) { setError((e as Error).message) } }
  return <><AdminHeader title="Pengaturan"/>{error && <div className="alert error">{error}</div>}<div className="panel editor"><div className="form-grid two"><label>RajaOngkir Origin ID<input value={settings.shipping_origin_id || ''} onChange={e => setSettings({ ...settings, shipping_origin_id: e.target.value })}/><small>ID lokasi asal dari RajaOngkir.</small></label><label>Label asal<input value={settings.shipping_origin_label || ''} onChange={e => setSettings({ ...settings, shipping_origin_label: e.target.value })} placeholder="Contoh: Jakarta Utara"/></label><label>Kode pos asal AgenWebsite (5 digit)<input inputMode="numeric" maxLength={5} placeholder="Contoh: 14420" value={settings.shipping_origin_postal_code || ''} onChange={e => setSettings({ ...settings, shipping_origin_postal_code: e.target.value.replace(/\D/g, '').slice(0,5) })}/><small>Dipakai untuk ongkir fallback ketika RajaOngkir tidak tersedia.</small></label><label className="span-2">Kode kurir (pisahkan titik dua)<input value={settings.shipping_couriers || ''} onChange={e => setSettings({ ...settings, shipping_couriers: e.target.value })}/><small>Contoh: jne:sicepat:jnt:ninja:tiki:anteraja:pos</small></label></div><div className="form-grid two merchic-social-settings"><label>Username Instagram (opsional)<input value={settings.social_instagram || ''} onChange={e=>setSettings({...settings,social_instagram:e.target.value})} placeholder="km_dkijakarta"/><small>Instagram resmi: instagram.com/km_dkijakarta. Isi username tanpa @ atau URL.</small></label><label>WhatsApp customer service (opsional)<input value={settings.social_whatsapp || ''} onChange={e=>setSettings({...settings,social_whatsapp:e.target.value.replace(/\D/g,'')})} placeholder="628113446578"/><small>WhatsApp Merchic: +62 811-3446-578. Gunakan angka tanpa + dan spasi.</small></label></div><button className="primary" onClick={save}>{saved ? <><CheckCircle2 size={17}/> Tersimpan</> : <>Simpan pengaturan</>}</button></div></>
}

function AdminHeader({ title, actions }: { title: string; actions?: React.ReactNode }) {
  return <div className="admin-header"><div><span className="eyebrow">Dashboard admin</span><h1>{title}</h1></div>{actions && <div className="button-row">{actions}</div>}</div>
}
function Stat({ label, value }: { label: string; value: string | number }) { return <div className="stat panel"><span>{label}</span><b>{value}</b></div> }
