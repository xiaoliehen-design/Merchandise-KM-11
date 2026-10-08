import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, CreditCard, Minus, Plus, ShoppingCart, Sparkles, X } from 'lucide-react'
import { catalogApi } from './api'
import { useCart } from './CartContext'
import { EMONEY_BACK_URL, EMONEY_TEMPLATES, defaultEmoneyCustomization, drawEmoneyTemplate, renderEmoneyDataUrl, renderEmoneyPreview } from './emoney'
import type { Product } from './types'
import { rupiah } from './utils'

function ProductCard({ p, onOpenCustomizer }: { p: Product; onOpenCustomizer: (product: Product) => void }) {
  const { add } = useCart()
  const [qty, setQty] = useState(1)
  const [color, setColor] = useState(p.colors?.[0] || '')
  const [size, setSize] = useState(p.sizes?.[0] || '')
  const [added, setAdded] = useState(false)

  function onAdd() {
    add({ productId: p.id, name: p.name, imageUrl: p.image_url, unitPrice: p.base_price, qty, color: color || undefined, size: size || undefined, weightGrams: p.weight_grams })
    setAdded(true)
    window.setTimeout(() => setAdded(false), 1200)
  }

  const isEmoney = p.product_type === 'emoney_card'

  return <article className="product-card">
    <div className="product-image-wrap">
      {p.featured && <span className="featured"><Sparkles size={14}/> Pilihan KM11</span>}
      {isEmoney && <span className="featured alt"><CreditCard size={14}/> Custom e-money</span>}
      {p.image_url ? <img className="product-image" src={p.image_url} alt={p.name}/> : <div className="product-placeholder">KM11</div>}
    </div>
    <div className="product-body">
      <div>
        <h3>{p.name}</h3>
        <p>{p.description || 'Merchandise Kemenkeu Mengajar 11'}</p>
        {Object.keys(p.specifications || {}).length > 0 && <dl className="product-specs">{Object.entries(p.specifications).map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>}
      </div>
      <strong className="price">{rupiah(p.base_price)}</strong>
      {!isEmoney && !!p.colors?.length && <label>Warna<select value={color} onChange={e => setColor(e.target.value)}>{p.colors.map(v => <option key={v}>{v}</option>)}</select></label>}
      {!isEmoney && !!p.sizes?.length && <label>Ukuran<select value={size} onChange={e => setSize(e.target.value)}>{p.sizes.map(v => <option key={v}>{v}</option>)}</select></label>}
      <div className="qty-row"><span>Jumlah</span><div className="qty-control"><button onClick={() => setQty(Math.max(1, qty - 1))}><Minus size={16}/></button><b>{qty}</b><button onClick={() => setQty(qty + 1)}><Plus size={16}/></button></div></div>
      {isEmoney
        ? <button className="primary" onClick={() => onOpenCustomizer(p)}><CreditCard size={18}/> Atur desain kartu</button>
        : <button className="primary" onClick={onAdd}>{added ? <><Check size={18}/> Ditambahkan</> : <><ShoppingCart size={18}/> Tambah ke Keranjang</>}</button>}
    </div>
  </article>
}

function TemplateThumb({ templateId, active, onClick }: { templateId: string; active: boolean; onClick: () => void }) {
  const ref = useRef<HTMLCanvasElement | null>(null)
  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    drawEmoneyTemplate(canvas, templateId).catch(() => undefined)
  }, [templateId])
  const label = EMONEY_TEMPLATES.find(t => t.id === templateId)?.label || templateId
  return <button type="button" className={`template-thumb ${active ? 'active' : ''}`} onClick={onClick}>
    <canvas ref={ref}/>
    <span>{label}</span>
  </button>
}

function EmoneyCustomizerModal({ product, onClose }: { product: Product; onClose: () => void }) {
  const { add } = useCart()
  const previewRef = useRef<HTMLCanvasElement | null>(null)
  const [qty, setQty] = useState(1)
  const [form, setForm] = useState(() => defaultEmoneyCustomization())
  const [photoDataUrl, setPhotoDataUrl] = useState<string>('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [approved, setApproved] = useState(false)

  useEffect(() => {
    const canvas = previewRef.current
    if (!canvas) return
    renderEmoneyPreview({ ...form, photoDataUrl, canvas }).catch((e) => setError((e as Error).message))
  }, [form, photoDataUrl])

  function patch<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm(prev => ({ ...prev, [key]: value }))
    setApproved(false)
  }

  async function readPhoto(file?: File | null) {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      setPhotoDataUrl(String(reader.result || ''))
      setApproved(false)
    }
    reader.onerror = () => setError('Foto tidak dapat dibaca.')
    reader.readAsDataURL(file)
  }

  async function approvePreview() {
    if (!form.customerName.trim()) return setError('Nama untuk kartu e-money wajib diisi.')
    if (!photoDataUrl) return setError('Upload foto customer terlebih dahulu.')
    setBusy(true)
    setError('')
    try {
      if (previewRef.current) await renderEmoneyPreview({ ...form, photoDataUrl, canvas: previewRef.current })
      setApproved(true)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function addToCart() {
    if (!approved) return setError('Silakan setujui preview kartu terlebih dahulu.')
    setBusy(true)
    setError('')
    try {
      const previewDataUrl = await renderEmoneyDataUrl({ ...form, photoDataUrl })
      add({
        productId: product.id,
        name: `${product.name} · ${form.customerName.trim()}`,
        imageUrl: previewDataUrl,
        unitPrice: product.base_price,
        qty,
        weightGrams: product.weight_grams,
        customization: { ...form, customerName: form.customerName.trim(), templateLabel: EMONEY_TEMPLATES.find(t => t.id === form.templateId)?.label || form.templateId, previewDataUrl }
      })
      onClose()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const selectedTemplate = useMemo(() => EMONEY_TEMPLATES.find(t => t.id === form.templateId), [form.templateId])

  return <div className="modal-backdrop" onClick={onClose}>
    <div className="modal-card emoney-modal" onClick={e => e.stopPropagation()}>
      <div className="modal-head"><div><span className="eyebrow">Custom e-money</span><h2>{product.name}</h2><p>Pilih template, upload foto customer (disarankan PNG), atur posisi foto dan nama, lalu setujui preview sebelum masuk ke keranjang.</p></div><button className="icon" onClick={onClose}><X size={18}/></button></div>
      {error && <div className="alert error">{error}</div>}
      <div className="emoney-grid">
        <div className="panel emoney-config">
          <h3>1. Template & identitas</h3>
          <label>Template yang dipilih
            <div className="template-grid">{EMONEY_TEMPLATES.map(t => <TemplateThumb key={t.id} templateId={t.id} active={t.id === selectedTemplate?.id} onClick={() => patch('templateId', t.id)}/>)}</div>
          </label>
          <label>Nama customer<input maxLength={28} value={form.customerName} onChange={e => patch('customerName', e.target.value)} placeholder="Contoh: Hendra"/></label>
          <label>Foto customer<input type="file" accept="image/png,image/jpeg,image/webp" onChange={e => readPhoto(e.target.files?.[0] || null)}/><small>Disarankan PNG agar lebih menyatu dengan template. JPG/WebP tetap bisa digunakan.</small></label>
          <div className="qty-row"><span>Jumlah kartu</span><div className="qty-control"><button onClick={() => setQty(Math.max(1, qty - 1))}><Minus size={16}/></button><b>{qty}</b><button onClick={() => setQty(qty + 1)}><Plus size={16}/></button></div></div>
          <small className="muted">Template yang digunakan untuk order akan menghapus area teks "Panitia Pusat / Papua Barat" di kanan atas dan menghapus placeholder posisi. Yang tersisa hanya nama customer serta foto customer.</small>
        </div>
        <div className="panel emoney-config">
          <h3>2. Posisi nama</h3>
          <label>Posisi horizontal nama ({form.nameX}%)<input type="range" min="15" max="85" value={form.nameX} onChange={e => patch('nameX', Number(e.target.value))}/></label>
          <label>Posisi vertikal nama ({form.nameY}%)<input type="range" min="78" max="95" value={form.nameY} onChange={e => patch('nameY', Number(e.target.value))}/></label>
          <label>Ukuran tulisan ({form.nameSize}px)<input type="range" min="24" max="60" value={form.nameSize} onChange={e => patch('nameSize', Number(e.target.value))}/></label>
          <h3>3. Posisi foto</h3>
          <label>Posisi horizontal foto ({form.photoX}%)<input type="range" min="20" max="80" value={form.photoX} onChange={e => patch('photoX', Number(e.target.value))}/></label>
          <label>Posisi vertikal foto ({form.photoY}%)<input type="range" min="25" max="68" value={form.photoY} onChange={e => patch('photoY', Number(e.target.value))}/></label>
          <label>Ukuran foto ({form.photoScale}%)<input type="range" min="50" max="160" value={form.photoScale} onChange={e => patch('photoScale', Number(e.target.value))}/></label>
          <div className="button-row"><button className="secondary" onClick={approvePreview} disabled={busy}>Setujui preview</button><button className="primary" onClick={addToCart} disabled={busy || !approved}><ShoppingCart size={18}/> Tambah ke keranjang</button></div>
        </div>
        <div className="panel emoney-preview-panel">
          <div className="preview-head"><div><h3>4. Preview kartu</h3><p>Periksa hasil akhir sebelum checkout. Saat pesanan dibuat, file PNG preview ini akan disimpan dan bisa diunduh admin untuk proses cetak.</p></div>{approved && <span className="status-badge verified">Preview disetujui</span>}</div>
          <div className="emoney-preview-wrap"><canvas ref={previewRef}/></div>
          <div className="emoney-back-note"><img src={EMONEY_BACK_URL} alt="Back template e-money"/><div><b>Sisi belakang</b><p>Template belakang tetap menggunakan desain standar KM11 dan dapat dipakai admin sebagai acuan cetak balik.</p></div></div>
        </div>
      </div>
    </div>
  </div>
}

export default function StorePage() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [emoneyProduct, setEmoneyProduct] = useState<Product | null>(null)
  useEffect(() => { catalogApi.products().then(setProducts).catch(e => setError(e.message)).finally(() => setLoading(false)) }, [])

  return <>
    <section className="hero">
      <div className="hero-copy">
        <span className="eyebrow">Kemenkeu Mengajar 11</span>
        <h1>Merchandise KM11, <em>ceria, rapi, mudah dipesan.</em></h1>
        <p>Pilih produk, varian, dan jumlahnya. Tersedia juga katalog kartu e-money custom: customer dapat mengatur template, nama, dan foto sebelum checkout.</p>
        <a className="primary hero-btn" href="#katalog">Lihat Katalog</a>
      </div>
      <div className="hero-art">
        <img src="/theme/payung-biru.png" alt="Referensi desain payung KM11 biru"/>
        <img src="/theme/payung-putih.png" alt="Referensi desain payung KM11 putih"/>
      </div>
    </section>
    <section id="katalog" className="section catalog-section">
      <div className="section-heading"><div><span className="eyebrow">Katalog</span><h2>Pilih merchandise kamu</h2></div><p>Foto produk ditampilkan utuh dengan <i>object-fit: contain</i>, sehingga tidak terpotong. Untuk kartu e-money, customer bisa melakukan personalisasi langsung dari katalog.</p></div>
      {loading ? <div className="empty">Memuat produk...</div> : error ? <div className="alert error">{error}</div> : products.length ? <div className="product-grid">{products.map(p => <ProductCard p={p} key={p.id} onOpenCustomizer={setEmoneyProduct}/>)}</div> : <div className="empty">Belum ada produk aktif. Admin dapat menambahkan produk dari dashboard.</div>}
    </section>
    {emoneyProduct && <EmoneyCustomizerModal product={emoneyProduct} onClose={() => setEmoneyProduct(null)}/>} 
  </>
}
