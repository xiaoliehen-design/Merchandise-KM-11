import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, CreditCard, Minus, Plus, ShoppingCart, Sparkles, X } from 'lucide-react'
import { catalogApi } from './api'
import { resolveProductImage } from './colorImages'
import { useCart } from './CartContext'
import { EMONEY_BACK_URL, EMONEY_TEMPLATES, defaultEmoneyCustomization, drawEmoneyBaseTemplate, renderEmoneyDataUrl, renderEmoneyPreview } from './emoney'
import type { Product, ProductBundle, CartItem, BundleCartComponent } from './types'
import { rupiah } from './utils'

function ProductCard({ p, onOpenCustomizer }: { p: Product; onOpenCustomizer: (product: Product) => void }) {
  const { add } = useCart()
  const [qty, setQty] = useState(1)
  const [color, setColor] = useState(p.colors?.[0] || '')
  const [size, setSize] = useState(p.sizes?.[0] || '')
  const [added, setAdded] = useState(false)

  function onAdd() {
    add({ productId: p.id, name: p.name, imageUrl: selectedImageUrl, unitPrice: p.base_price, qty, color: color || undefined, size: size || undefined, weightGrams: p.weight_grams })
    setAdded(true)
    window.setTimeout(() => setAdded(false), 1200)
  }

  const isEmoney = p.product_type === 'emoney_card'
  const selectedImageUrl = isEmoney ? '/emoney/front-templates.png' : resolveProductImage(p, color)
  const productDescription = isEmoney
    ? 'Katalog kartu e-money custom. Customer dapat memilih 1 dari 4 template, upload foto, mengatur posisi foto/nama, menyetujui preview, lalu hasil PNG final akan tersimpan untuk admin cetak.'
    : (p.description || 'Merchandise Kemenkeu Mengajar 11')
  const productSpecs = isEmoney
    ? { Format: 'Custom e-money card', Preview: 'PNG final tersimpan', Template: '4 pilihan template' }
    : (p.specifications || {})

  return <article className="product-card">
    <div className="product-image-wrap">
      {p.featured && <span className="featured"><Sparkles size={14}/> Pilihan KM11</span>}
      {isEmoney && <span className="featured alt"><CreditCard size={14}/> Custom e-money</span>}
      {selectedImageUrl ? <img className="product-image" src={selectedImageUrl} alt={color && !isEmoney ? `${p.name} warna ${color}` : p.name}/> : <div className="product-placeholder"><img src="/brand/km11-logo-white.png" alt="Kemenkeu Mengajar 11"/></div>}
    </div>
    <div className="product-body">
      <div>
        <h3>{p.name}</h3>
        <p>{productDescription}</p>
        {Object.keys(productSpecs).length > 0 && <dl className="product-specs">{Object.entries(productSpecs).map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>}
      </div>
      <strong className="price">{rupiah(p.base_price)}</strong>
      {!isEmoney && !!p.colors?.length && <label>Warna<select value={color} onChange={e => { setColor(e.target.value); setAdded(false) }}>{p.colors.map(v => <option key={v}>{v}</option>)}</select></label>}
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
    drawEmoneyBaseTemplate(canvas, templateId).catch(() => undefined)
  }, [templateId])
  const label = EMONEY_TEMPLATES.find(t => t.id === templateId)?.label || templateId
  return <button type="button" className={`template-thumb ${active ? 'active' : ''}`} onClick={onClick}>
    <canvas ref={ref}/>
    <span>{label}</span>
  </button>
}

function EmoneyCustomizerModal({ product, onClose, onConfigured }: { product: Product; onClose: () => void; onConfigured?: (item: CartItem) => void }) {
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
      const configured: CartItem = {
        productId: product.id,
        name: `${product.name} · ${form.customerName.trim()}`,
        imageUrl: previewDataUrl,
        unitPrice: product.base_price,
        qty,
        weightGrams: product.weight_grams,
        customization: { ...form, customerName: form.customerName.trim(), templateLabel: EMONEY_TEMPLATES.find(t => t.id === form.templateId)?.label || form.templateId, previewDataUrl }
      }
      if (onConfigured) onConfigured(configured)
      else add(configured)
      onClose()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const selectedTemplate = useMemo(() => EMONEY_TEMPLATES.find(t => t.id === form.templateId), [form.templateId])

  return <div className={`modal-backdrop ${onConfigured ? 'bundle-card-designer-overlay' : ''}`} onClick={onClose}>
    <div className="modal-card emoney-modal" onClick={e => e.stopPropagation()}>
      <div className="modal-head"><div><span className="eyebrow">Custom e-money</span><h2>{product.name}</h2><p>Pilih salah satu dari 4 template depan, upload foto customer, atur posisi foto dan nama, lalu setujui preview sebelum masuk ke keranjang.</p></div><button className="icon" onClick={onClose}><X size={18}/></button></div>
      {error && <div className="alert error">{error}</div>}
      <div className="emoney-grid">
        <div className="panel emoney-config">
          <h3>1. Template & identitas</h3>
          <label>Template yang dipilih
            <div className="template-grid">{EMONEY_TEMPLATES.map(t => <TemplateThumb key={t.id} templateId={t.id} active={t.id === selectedTemplate?.id} onClick={() => patch('templateId', t.id)}/>)}</div>
          </label>
          <label>Nama customer<input maxLength={28} value={form.customerName} onChange={e => patch('customerName', e.target.value)} placeholder="Contoh: Hendra"/></label>
          <label>Foto customer<input type="file" accept="image/png,image/jpeg,image/webp" onChange={e => readPhoto(e.target.files?.[0] || null)}/><small>Disarankan PNG agar lebih menyatu dengan template. JPG/WebP tetap bisa digunakan.</small></label>
          {!onConfigured && <div className="qty-row"><span>Jumlah kartu</span><div className="qty-control"><button onClick={() => setQty(Math.max(1, qty - 1))}><Minus size={16}/></button><b>{qty}</b><button onClick={() => setQty(qty + 1)}><Plus size={16}/></button></div></div>}
          <small className="muted">Tersedia 4 pilihan template depan. Desain belakang ditampilkan sebagai informasi agar customer mengetahui tampilan kartu secara utuh, tetapi sisi belakang tidak dapat diedit.</small>
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
          <div className="button-row"><button className="secondary" onClick={approvePreview} disabled={busy}>Setujui preview</button><button className="primary" onClick={addToCart} disabled={busy || !approved}><ShoppingCart size={18}/> {onConfigured ? 'Simpan desain untuk paket' : 'Tambah ke keranjang'}</button></div>
        </div>
        <div className="panel emoney-preview-panel">
          <div className="preview-head"><div><h3>4. Preview kartu</h3><p>Periksa hasil akhir sebelum checkout. Customer hanya dapat mengedit sisi depan. Desain belakang ditampilkan di bawah sebagai informasi.</p></div>{approved && <span className="status-badge verified">Preview disetujui</span>}</div>
          <div className="emoney-preview-wrap"><canvas ref={previewRef}/></div>
          <div className="emoney-back-panel">
            <div className="emoney-back-panel-head"><b>Sisi belakang kartu</b><span>Informasi saja · tidak dapat diedit</span></div>
            <div className="emoney-back-note"><img src={EMONEY_BACK_URL} alt="Desain belakang kartu e-money"/><div><p>Desain belakang ini menjadi acuan visual bagi customer agar mengetahui tampilan akhir kartu. Admin dapat menggunakannya saat proses cetak, tetapi customer tidak mengubah sisi ini dari website.</p></div></div>
          </div>
        </div>
      </div>
    </div>
  </div>
}


function BundleCard({ bundle, products, onOpen }: { bundle: ProductBundle; products: Product[]; onOpen: (bundle: ProductBundle) => void }) {
  const children = bundle.product_ids.map(id => products.find(p => p.id === id)).filter((p): p is Product => !!p)
  return <article className="product-card bundle-catalog-card">
    <div className="bundle-catalog-visual">
      <span className="featured"><Sparkles size={14}/> Paket KM11</span>
      <div className="bundle-photo-collage">{children.slice(0, 4).map(p => <img key={p.id} src={p.product_type === 'emoney_card' ? '/emoney/front-templates.png' : resolveProductImage(p,p.colors?.[0]) || '/brand/km11-logo-blue.png'} alt={p.name}/>)}</div>
    </div>
    <div className="product-body">
      <h3>{bundle.name}</h3>
      {bundle.description && <p>{bundle.description}</p>}
      <div className="bundle-includes">{children.map(p => <span key={p.id}><Check size={14}/>{p.name}</span>)}</div>
      <strong className="price">{rupiah(bundle.price)}</strong>
      <button className="primary" onClick={() => onOpen(bundle)} disabled={children.length !== bundle.product_ids.length}><ShoppingCart size={18}/> Pilih varian & tambah ke keranjang</button>
    </div>
  </article>
}

function BundleCustomizerModal({ bundle, products, onClose, onDesign }: {
  bundle: ProductBundle
  products: Product[]
  onClose: () => void
  onDesign: (product: Product, onReady: (item: CartItem) => void) => void
}) {
  const { add } = useCart()
  const children = bundle.product_ids.map(id => products.find(p => p.id === id)).filter((p): p is Product => !!p)
  const [choices, setChoices] = useState<Record<string, BundleCartComponent>>({})
  const [error, setError] = useState('')
  function patch(product: Product, field: 'color' | 'size', value: string) {
    setError('')
    setChoices(prev => ({ ...prev, [product.id]: { productId: product.id, name: product.name, ...prev[product.id], imageUrl: resolveProductImage(product, field === 'color' ? value : prev[product.id]?.color || '') || null, [field]: value } }))
  }
  function saveDesign(product: Product, configured: CartItem) {
    setError('')
    setChoices(prev => ({ ...prev, [product.id]: { productId: product.id, name: product.name, imageUrl: configured.imageUrl, customization: configured.customization } }))
  }
  function addBundle() {
    if (children.length !== bundle.product_ids.length) return setError('Ada produk dalam paket yang tidak tersedia.')
    const parts: BundleCartComponent[] = []
    for (const product of children) {
      const selected = choices[product.id]
      if (product.product_type === 'emoney_card' && !selected?.customization?.previewDataUrl) return setError(`Desain kartu ${product.name} harus diselesaikan dahulu.`)
      if (product.colors?.length && (!selected?.color || !product.colors.includes(selected.color))) return setError(`Pilih warna untuk ${product.name}.`)
      if (product.sizes?.length && (!selected?.size || !product.sizes.includes(selected.size))) return setError(`Pilih ukuran untuk ${product.name}.`)
      parts.push({ productId: product.id, name: product.name, imageUrl: product.product_type === 'emoney_card' ? selected?.imageUrl || null : resolveProductImage(product,selected?.color) || null, color: selected?.color, size: selected?.size, customization: selected?.customization || null })
    }
    add({ bundleId: bundle.id, productId: bundle.id, name: bundle.name, qty: 1, unitPrice: Number(bundle.price), imageUrl: parts[0]?.imageUrl || null, weightGrams: children.reduce((n,p)=>n+Number(p.weight_grams||0),0), bundleItems: parts })
    onClose()
  }
  return <div className="modal-backdrop" onClick={onClose}><div className="modal-card bundle-modal" onClick={e => e.stopPropagation()}>
    <div className="modal-head"><div><span className="eyebrow">Paket merchandise KM11</span><h2>{bundle.name}</h2><p>{bundle.description || 'Lengkapi pilihan setiap produk sebelum memasukkan paket ke keranjang.'}</p></div><button className="icon" onClick={onClose} aria-label="Tutup paket"><X size={18}/></button></div>
    {error && <div className="alert error" role="alert">{error}</div>}
    <div className="bundle-config-list">{children.map((p, idx) => {
      const choice = choices[p.id]
      const isCard = p.product_type === 'emoney_card'
      return <div className="bundle-config-product" key={p.id}>
        <div className="bundle-config-image"><img src={choice?.imageUrl || (isCard ? '/emoney/front-templates.png' : resolveProductImage(p,p.colors?.[0]) || '/brand/km11-logo-blue.png')} alt={p.name}/></div>
        <div className="bundle-config-content"><span className="eyebrow">Produk {idx+1} dari {children.length}</span><h3>{p.name}</h3>
          {isCard ? <><p>Atur template, nama, foto, dan setujui desain kartu terlebih dahulu.</p><button type="button" className="secondary" onClick={() => onDesign(p, item => saveDesign(p,item))}>{choice?.customization ? 'Ubah desain kartu' : 'Desain kartu sekarang'}</button>{choice?.customization && <span className="bundle-choice-ready"><Check size={15}/> Desain tersimpan: {choice.customization.customerName}</span>}</> : <div className="bundle-config-variants">
            {!!p.colors?.length && <label>Warna<select value={choice?.color || ''} onChange={e => patch(p,'color',e.target.value)}><option value="">Pilih warna</option>{p.colors.map(value => <option key={value} value={value}>{value}</option>)}</select></label>}
            {!!p.sizes?.length && <label>Ukuran<select value={choice?.size || ''} onChange={e => patch(p,'size',e.target.value)}><option value="">Pilih ukuran</option>{p.sizes.map(value => <option key={value} value={value}>{value}</option>)}</select></label>}
            {!p.colors?.length && !p.sizes?.length && <span className="bundle-choice-ready"><Check size={15}/> Tidak ada varian yang perlu dipilih</span>}
          </div>}
        </div>
      </div>
    })}</div>
    <div className="bundle-modal-bottom"><div><small>Harga paket</small><strong>{rupiah(bundle.price)}</strong></div><button className="primary" type="button" onClick={addBundle}><ShoppingCart size={18}/> Tambah paket ke keranjang</button></div>
  </div></div>
}

export default function StorePage() {
  const [products, setProducts] = useState<Product[]>([])
  const [bundles, setBundles] = useState<ProductBundle[]>([])
  const [selectedBundle, setSelectedBundle] = useState<ProductBundle | null>(null)
  const [bundleDesign, setBundleDesign] = useState<{ product: Product; onReady: (item: CartItem) => void } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [emoneyProduct, setEmoneyProduct] = useState<Product | null>(null)
  useEffect(() => { Promise.all([catalogApi.products(),catalogApi.bundles()]).then(([p,b]) => {setProducts(p);setBundles(b)}).catch(e => setError(e.message)).finally(() => setLoading(false)) }, [])

  return <>
    <section className="hero">
      <div className="hero-copy">
        <span className="eyebrow">Kemenkeu Mengajar 11</span>
        <h1>Merchandise KM11, <em>ceria, rapi, mudah dipesan.</em></h1>
        <a className="primary hero-btn" href="#katalog">Lihat Katalog</a>
      </div>
      <figure className="hero-photo">
        <picture>
          <source srcSet="/hero/km11-merchandise-showcase.webp" type="image/webp" />
          <img
            src="/hero/km11-merchandise-showcase.png"
            alt="Merchandise Kemenkeu Mengajar 11: notebook, mug, sandal selop, dan gantungan kunci dengan desain KM11"
            width={1448}
            height={1086}
            loading="eager"
            decoding="async"
            fetchPriority="high"
          />
        </picture>
      </figure>
    </section>
    <section id="katalog" className="section catalog-section">
      <div className="section-heading"><div><span className="eyebrow">Katalog</span><h2>Pilih merchandise kamu</h2></div></div>
      {loading ? <div className="empty">Memuat produk...</div> : error ? <div className="alert error">{error}</div> : <>
        {!!bundles.length && <section className="bundle-catalog-section"><div className="bundle-catalog-heading"><span className="eyebrow">Paket KM11</span><h3>Paket merchandise</h3></div><div className="product-grid">{bundles.map(bundle => <BundleCard key={bundle.id} bundle={bundle} products={products} onOpen={setSelectedBundle}/>)}</div></section>}
        {!!products.length ? <div className="product-grid">{products.map(p => <ProductCard p={p} key={p.id} onOpenCustomizer={setEmoneyProduct}/>)}</div> : !bundles.length && <div className="empty">Belum ada produk aktif. Admin dapat menambahkan produk dari dashboard.</div>}
      </>}
    </section>
    {emoneyProduct && <EmoneyCustomizerModal product={emoneyProduct} onClose={() => setEmoneyProduct(null)}/>}
    {selectedBundle && <BundleCustomizerModal key={selectedBundle.id} bundle={selectedBundle} products={products} onClose={() => {setSelectedBundle(null);setBundleDesign(null)}} onDesign={(product,onReady) => setBundleDesign({product,onReady})}/>}
    {bundleDesign && <EmoneyCustomizerModal key={bundleDesign.product.id} product={bundleDesign.product} onClose={() => setBundleDesign(null)} onConfigured={item => {bundleDesign.onReady(item);setBundleDesign(null)}}/>} 
  </>
}
