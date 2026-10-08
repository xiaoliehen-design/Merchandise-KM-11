import { useEffect, useMemo, useState } from 'react'
import * as XLSX from 'xlsx'
import { BarChart3, CheckCircle2, CreditCard, Download, Edit3, KeyRound, LogOut, MapPin, Package, Plus, RefreshCw, Search, Settings, ShieldCheck, Trash2, Truck, UserCog, X } from 'lucide-react'
import { adminApi } from './api'
import type { Order, PaymentMethod, PickupLocation, Product } from './types'
import { dt, rupiah, slugify, statusLabel } from './utils'

type Tab = 'orders' | 'products' | 'pickups' | 'payments' | 'settings' | 'account'

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
    <aside className="admin-sidebar"><div className="admin-title"><span className="admin-brand-logo"><img src="/brand/km11-logo-white.png" alt="Kemenkeu Mengajar 11"/></span><div><b>{adminName}</b><small>Merchandise</small></div></div>
      <button className={tab === 'orders' ? 'active' : ''} onClick={() => setTab('orders')}><Package/> Pesanan</button>
      <button className={tab === 'products' ? 'active' : ''} onClick={() => setTab('products')}><BarChart3/> Produk</button>
      <button className={tab === 'pickups' ? 'active' : ''} onClick={() => setTab('pickups')}><MapPin/> Pickup</button>
      <button className={tab === 'payments' ? 'active' : ''} onClick={() => setTab('payments')}><CreditCard/> Pembayaran</button>
      <button className={tab === 'settings' ? 'active' : ''} onClick={() => setTab('settings')}><Settings/> Pengaturan</button>
      <button className={tab === 'account' ? 'active' : ''} onClick={() => setTab('account')}><UserCog/> Akun Admin</button>
      <button className="logout" onClick={onLogout}><LogOut/> Logout</button>
    </aside>
    <div className="admin-content">
      {tab === 'orders' && <OrdersAdmin/>}
      {tab === 'products' && <ProductsAdmin/>}
      {tab === 'pickups' && <PickupsAdmin/>}
      {tab === 'payments' && <PaymentsAdmin/>}
      {tab === 'settings' && <SettingsAdmin/>}
      {tab === 'account' && <AccountAdmin onNameChanged={setAdminName}/>}
    </div>
  </section>
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
    const courier = prompt('Kode kurir RajaOngkir (contoh: jne, jnt, sicepat):', o.tracking_courier || o.shipping_courier || 'jne')
    if (!courier) return
    try { await adminApi.setTracking(o.id, { trackingNumber: number, courier }); await load() } catch (e) { setError((e as Error).message) }
  }
  async function completePickup(o: Order) { if (!confirm('Tandai pesanan pickup ini selesai?')) return; try { await adminApi.complete(o.id); await load() } catch (e) { setError((e as Error).message) } }

  function exportExcel() {
    const rows = filtered.map(o => ({
      Receipt: o.receipt_no,
      Status: statusLabel[o.status],
      Nama: o.full_name,
      Email: o.email,
      HP: o.phone,
      Fulfillment: o.fulfillment_type,
      Subtotal: o.subtotal,
      Ongkir: o.shipping_cost,
      Total: o.total,
      Kurir: o.tracking_courier || o.shipping_courier || '',
      Resi: o.tracking_number || '',
      Dibuat: o.created_at,
      Terverifikasi: o.verified_at || ''
    }))
    const itemRows = filtered.flatMap(o => (o.order_items || []).map(i => ({
      Receipt: o.receipt_no,
      Produk: i.product_name,
      CustomName: (i.customization as any)?.customerName || '',
      Template: (i.customization as any)?.templateLabel || '',
      Warna: i.variant_color || '',
      Ukuran: i.variant_size || '',
      Qty: i.quantity,
      Harga: i.unit_price,
      Total: i.line_total,
      DesignURL: i.design_image_url || ''
    })))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Orders')
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(itemRows), 'Items')
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([
      { Metric: 'Total Order', Value: filtered.length },
      { Metric: 'Revenue Terverifikasi+', Value: filtered.filter(o => o.status !== 'new').reduce((s, o) => s + o.total, 0) },
      { Metric: 'Baru', Value: filtered.filter(o => o.status === 'new').length },
      { Metric: 'Terverifikasi', Value: filtered.filter(o => o.status === 'verified').length },
      { Metric: 'Dikirim', Value: filtered.filter(o => o.status === 'shipped').length },
      { Metric: 'Selesai', Value: filtered.filter(o => o.status === 'completed').length }
    ]), 'Summary')
    XLSX.writeFile(wb, `KM11-orders-${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  return <>
    <AdminHeader title="Pesanan" actions={<><button className="secondary" onClick={load}><RefreshCw size={17}/> Refresh</button><button className="primary" onClick={exportExcel}><Download size={17}/> Export Excel</button></>}/>
    <div className="stats-grid"><Stat label="Total" value={summary.total_orders || 0}/><Stat label="Baru" value={summary.new_orders || 0}/><Stat label="Terverifikasi" value={summary.verified_orders || 0}/><Stat label="Dikirim" value={summary.shipped_orders || 0}/><Stat label="Selesai" value={summary.completed_orders || 0}/><Stat label="Nilai order" value={rupiah(summary.order_value || 0)}/></div>
    {error && <div className="alert error">{error}</div>}
    <div className="admin-toolbar panel"><div className="search-box"><Search size={17}/><input placeholder="Cari receipt, nama, email, HP..." value={q} onChange={e => setQ(e.target.value)}/></div><select value={status} onChange={e => setStatus(e.target.value)}><option value="">Semua status</option><option value="new">Baru</option><option value="verified">Terverifikasi</option><option value="shipped">Dikirim</option><option value="completed">Selesai</option></select></div>
    <div className="table-wrap panel"><table><thead><tr><th>Receipt</th><th>Customer</th><th>Status</th><th>Item</th><th>Total</th><th>Pemenuhan</th><th>Dibuat</th><th>Aksi</th></tr></thead><tbody>{filtered.map(o => <tr key={o.id}><td><b>{o.receipt_no}</b></td><td>{o.full_name}<small>{o.email}<br/>{o.phone}</small></td><td><span className={`status-badge ${o.status}`}>{statusLabel[o.status]}</span></td><td>{(o.order_items || []).map((it, idx) => <small key={idx}><b>{it.quantity}× {it.product_name}</b>{(it.customization as any)?.customerName ? <> · {(it.customization as any).customerName}</> : null}{it.design_image_url ? <><br/><a className="tiny-link" href={it.design_image_url} target="_blank" rel="noreferrer">Unduh desain</a></> : null}</small>)}</td><td>{rupiah(o.total)}</td><td>{o.fulfillment_type === 'ship' ? <>Kirim<small>{o.tracking_number || '-'}</small></> : 'Pickup'}</td><td>{dt(o.created_at)}</td><td><div className="action-row"><button className="mini" onClick={() => proof(o.id)}>Bukti</button>{o.status === 'new' && <button className="mini success" onClick={() => verify(o.id)}>Verifikasi</button>}{o.status !== 'new' && o.fulfillment_type === 'ship' && <button className="mini" onClick={() => tracking(o)}><Truck size={14}/> Resi</button>}{o.status === 'verified' && o.fulfillment_type === 'pickup' && <button className="mini success" onClick={() => completePickup(o)}><CheckCircle2 size={14}/> Selesai</button>}</div></td></tr>)}</tbody></table>{!filtered.length && <div className="empty compact">{busy ? 'Memuat…' : 'Tidak ada order.'}</div>}</div>
  </>
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

function ProductsAdmin() {
  const [items, setItems] = useState<Product[]>([])
  const [edit, setEdit] = useState<Partial<Product> | null>(null)
  const [image, setImage] = useState<File | null>(null)
  const [colorDraft, setColorDraft] = useState('')
  const [sizeDraft, setSizeDraft] = useState('')
  const [specDraft, setSpecDraft] = useState('')
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function load() {
    try { setItems(await adminApi.products()) } catch (e) { setError((e as Error).message) }
  }
  useEffect(() => { load() }, [])

  function startEditing(product: Partial<Product>) {
    setEdit({ ...product, colors: [...(product.colors || [])], sizes: [...(product.sizes || [])] })
    setImage(null)
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
    setError('')
    try {
      const saved = await adminApi.upsertProduct({
        ...edit,
        name: edit.name.trim(),
        slug: edit.slug?.trim() || slugify(edit.name),
        specifications: parseSpecifications(specDraft),
        colors: edit.product_type === 'emoney_card' ? [] : addVariants(edit.colors || [], colorDraft),
        sizes: edit.product_type === 'emoney_card' ? [] : addVariants(edit.sizes || [], sizeDraft)
      })
      if (image) await adminApi.uploadProductImage(saved.id, image)
      setEdit(null)
      setImage(null)
      setColorDraft('')
      setSizeDraft('')
      await load()
    } catch (e) { setError((e as Error).message) }
    finally { setSaving(false) }
  }

  async function remove(product: Product) {
    if (!confirm(`Hapus produk ${product.name}?`)) return
    try { await adminApi.deleteProduct(product.id); await load() }
    catch (e) { setError((e as Error).message) }
  }

  const filtered = items.filter(product => `${product.name} ${product.slug} ${product.colors?.join(' ')} ${product.sizes?.join(' ')}`.toLocaleLowerCase('id-ID').includes(search.toLocaleLowerCase('id-ID')))
  return <>
    <AdminHeader title="Produk" actions={<button className="primary" onClick={() => startEditing({ name: '', slug: '', description: '', base_price: 0, weight_grams: 50, colors: [], sizes: [], active: true, featured: false, specifications: {}, product_type: 'standard' })}><Plus size={17}/> Tambah produk</button>}/>
    {error && <div className="alert error">{error}</div>}
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
          <VariantEditor label="Warna" values={edit.colors || []} draft={colorDraft} onDraftChange={setColorDraft} onChange={colors => setEdit(prev => prev ? { ...prev, colors } : prev)} placeholder="Contoh: Biru"/>
          <VariantEditor label="Ukuran" values={edit.sizes || []} draft={sizeDraft} onDraftChange={setSizeDraft} onChange={sizes => setEdit(prev => prev ? { ...prev, sizes } : prev)} placeholder="Contoh: All Size"/>
        </div>
      </div>}
      <div className="product-editor-section">
        <h3>Detail dan media</h3>
        <div className="form-grid two">
          <label className="span-2">Deskripsi produk<textarea rows={3} value={edit.description || ''} onChange={e => setEdit({ ...edit, description: e.target.value })}/></label>
          <label className="span-2">Spesifikasi produk<textarea rows={4} value={specDraft} onChange={e => setSpecDraft(e.target.value)} placeholder={'Bahan=Polyester\nDiameter=95 cm\nMekanisme=Auto open'}/></label>
          <label>Foto produk<input type="file" accept="image/png,image/jpeg,image/webp" onChange={e => setImage(e.target.files?.[0] || null)}/></label>
          <div className="product-editor-flags"><label><input type="checkbox" checked={!!edit.active} onChange={e => setEdit({ ...edit, active: e.target.checked })}/> Aktif dijual</label><label><input type="checkbox" checked={!!edit.featured} onChange={e => setEdit({ ...edit, featured: e.target.checked })}/> Produk unggulan</label></div>
        </div>
      </div>
      <div className="button-row product-editor-actions"><button type="button" className="primary" disabled={saving} onClick={save}>{saving ? 'Menyimpan…' : 'Simpan produk'}</button><button type="button" className="secondary" disabled={saving} onClick={() => setEdit(null)}>Batal</button></div>
    </div>}
    <div className="admin-products-toolbar"><div className="search-box"><Search size={17}/><input aria-label="Cari produk" placeholder="Cari produk atau varian..." value={search} onChange={e => setSearch(e.target.value)}/></div><span className="admin-products-total">{filtered.length} dari {items.length} produk</span></div>
    {filtered.length ? <div className="admin-card-grid">{filtered.map(product => <article className="admin-product-card panel" key={product.id}>
      <div className="admin-product-img">{product.image_url ? <img src={product.image_url} alt={product.name} loading="lazy"/> : <Package size={54}/>}</div>
      <div className="admin-product-info">
        <div className="admin-product-flags"><span className={`admin-product-status ${product.active ? 'is-active' : 'is-inactive'}`}>{product.active ? 'Aktif' : 'Nonaktif'}</span><span className="admin-product-type">{product.product_type === 'emoney_card' ? 'E-money custom' : 'Merchandise'}</span></div>
        <h3 title={product.name}>{product.name}</h3>
        <strong className="admin-product-price">{rupiah(product.base_price)}</strong>
        <div className="admin-product-weight">{product.weight_grams} gram</div>
        {product.product_type !== 'emoney_card' && <div className="admin-product-variants">
          <div><b>Warna</b><span>{product.colors?.length ? product.colors.join(', ') : '—'}</span></div>
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
  const [settings, setSettings] = useState<Record<string, string>>({ shipping_origin_id: '', shipping_origin_label: '', shipping_couriers: 'jne:sicepat:jnt:ninja:tiki:anteraja:pos' })
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  useEffect(() => { adminApi.settings().then(v => setSettings(s => ({ ...s, ...v }))).catch(e => setError((e as Error).message)) }, [])
  async function save() { try { setSettings(await adminApi.saveSettings(settings)); setSaved(true); setTimeout(() => setSaved(false), 1500) } catch (e) { setError((e as Error).message) } }
  return <><AdminHeader title="Pengaturan"/>{error && <div className="alert error">{error}</div>}<div className="panel editor"><div className="form-grid two"><label>RajaOngkir Origin ID<input value={settings.shipping_origin_id || ''} onChange={e => setSettings({ ...settings, shipping_origin_id: e.target.value })}/><small>ID lokasi asal dari RajaOngkir.</small></label><label>Label asal<input value={settings.shipping_origin_label || ''} onChange={e => setSettings({ ...settings, shipping_origin_label: e.target.value })} placeholder="Contoh: Jakarta Utara"/></label><label className="span-2">Kode kurir (pisahkan titik dua)<input value={settings.shipping_couriers || ''} onChange={e => setSettings({ ...settings, shipping_couriers: e.target.value })}/><small>Contoh: jne:sicepat:jnt:ninja:tiki:anteraja:pos</small></label></div><button className="primary" onClick={save}>{saved ? <><CheckCircle2 size={17}/> Tersimpan</> : <>Simpan pengaturan</>}</button></div></>
}

function AdminHeader({ title, actions }: { title: string; actions?: React.ReactNode }) {
  return <div className="admin-header"><div><span className="eyebrow">Dashboard admin</span><h1>{title}</h1></div>{actions && <div className="button-row">{actions}</div>}</div>
}
function Stat({ label, value }: { label: string; value: string | number }) { return <div className="stat panel"><span>{label}</span><b>{value}</b></div> }
