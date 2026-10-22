import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, CreditCard, Minus, Plus, ShoppingCart, Sparkles, X, Search, Gift, Shirt, NotebookTabs, Package, ArrowRight, Info }  from 'lucide-react'
import { catalogApi } from './api'
import { resolveProductImage } from './colorImages'
import { useCart } from './CartContext'
import { EMONEY_BACK_URL, EMONEY_TEMPLATES, defaultEmoneyCustomization, drawEmoneyBaseTemplate, renderEmoneyDataUrl, renderEmoneyPreview } from './emoney'
import type { Product, ProductBundle, CartItem, BundleCartComponent, LaunchSettings } from './types'
import { rupiah } from './utils'
import { isClothing, sizeSurcharge, OVERSIZE_SURCHARGE_RP } from '../shared/sizePricing'
import { itemUnitDiscount, itemDiscountLabel } from '../shared/productDiscount'

function SizeChartModal({ product, onClose }: { product: Product; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const oldOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeRef.current?.focus()
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.stopPropagation(); onClose() }
      if (event.key === 'Tab') { event.preventDefault(); closeRef.current?.focus() }
    }
    document.addEventListener('keydown', keydown, true)
    return () => {
      document.body.style.overflow = oldOverflow
      document.removeEventListener('keydown', keydown, true)
      previous?.focus()
    }
  }, [onClose])

  return createPortal(<div className="modal-backdrop size-chart-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
    <div className="modal-card size-chart-modal" role="dialog" aria-modal="true" aria-label={`Panduan ukuran ${product.name}`}>
      <div className="size-chart-modal-heading"><div><span className="eyebrow">Panduan ukuran</span><h2>Size Chart — {product.name}</h2></div><button type="button" ref={closeRef} className="icon" onClick={onClose} aria-label="Tutup size chart"><X size={21}/></button></div>
      <div className="size-chart-modal-image"><img src={product.size_chart_url || ''} alt={`Tabel ukuran untuk ${product.name}`} /></div>
      <p>Sesuaikan pilihan ukuran dengan panduan pada gambar sebelum menambahkan produk ke keranjang.</p>
    </div>
  </div>, document.body)
}

function ProductSizeField({ product, value, onChange, placeholder }: { product: Product; value: string; onChange: (value: string) => void; placeholder?: string }) {
  const selectId = useId()
  const [open, setOpen] = useState(false)
  if (!product.sizes?.length) return null
  return <div className="product-size-field">
    <div className="size-field-heading"><label htmlFor={selectId}>Ukuran</label>{product.size_chart_url && <button type="button" className="size-chart-info" onClick={() => setOpen(true)} aria-label={`Lihat size chart ${product.name}`} title="Lihat panduan ukuran"><Info size={15}/><span>Info</span></button>}</div>
    <select id={selectId} value={value} onChange={e => onChange(e.target.value)}>
      {placeholder && <option value="">{placeholder}</option>}
      {product.sizes.map(v => <option key={v} value={v}>{v}</option>)}
    </select>
    {isClothing(product) && product.sizes.some(v => sizeSurcharge(product, v) > 0) && <small className="size-surcharge-hint">Ukuran XXL/2XL ke atas: +{rupiah(OVERSIZE_SURCHARGE_RP)} per produk.</small>}
    {open && !!product.size_chart_url && <SizeChartModal product={product} onClose={() => setOpen(false)}/>}
  </div>
}

function ProductCard({ p, onOpenCustomizer, launch }: { p: Product; onOpenCustomizer: (product: Product) => void; launch?: LaunchSettings }) {
  const { add } = useCart()
  const [qty, setQty] = useState(1)
  const [color, setColor] = useState(p.colors?.[0] || '')
  const [size, setSize] = useState(p.sizes?.[0] || '')
  const [added, setAdded] = useState(false)

  function onAdd() {
    add({ productId: p.id, name: p.name, imageUrl: selectedImageUrl, unitPrice: p.base_price + sizeSurcharge(p, size), qty, color: color || undefined, size: size || undefined, weightGrams: p.weight_grams })
    setAdded(true)
    window.setTimeout(() => setAdded(false), 1200)
  }

  const isEmoney = p.product_type === 'emoney_card'
  const adjustedPrice = p.base_price + sizeSurcharge(p, size)
  const promoActive = !p.item_discount_enabled && !!launch?.enabled && launch.standard > 0 && (!launch.endAt || new Date(launch.endAt) > new Date())
  const specialDiscount = itemUnitDiscount(p, adjustedPrice)
  const finalDisplayedPrice = specialDiscount > 0 ? adjustedPrice - specialDiscount : promoActive ? adjustedPrice - Math.round(adjustedPrice * launch!.standard / 100) : adjustedPrice
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
      <div className="price-area">{(specialDiscount > 0 || promoActive) && <><span className="price-old">{rupiah(adjustedPrice)}</span><span className="discount-pill">{specialDiscount > 0 ? itemDiscountLabel(p) : `-${launch!.standard}%`}</span></>}<strong className="price">{rupiah(finalDisplayedPrice)}</strong></div>
      {!isEmoney && !!p.colors?.length && <label>Warna<select value={color} onChange={e => { setColor(e.target.value); setAdded(false) }}>{p.colors.map(v => <option key={v}>{v}</option>)}</select></label>}
      {!isEmoney && <ProductSizeField product={p} value={size} onChange={v => { setSize(v); setAdded(false) }}/>}
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


function BundleCard({ bundle, products, onOpen, launch }: { bundle: ProductBundle; products: Product[]; onOpen: (bundle: ProductBundle) => void; launch?: LaunchSettings }) {
  const children = bundle.product_ids.map(id => products.find(p => p.id === id)).filter((p): p is Product => !!p)
  return <article className="product-card bundle-catalog-card">
    <div className="bundle-catalog-visual">
      <span className="featured"><Sparkles size={14}/> Paket KM11</span>
      {bundle.cover_image_url ? <img className="bundle-cover-image" src={bundle.cover_image_url} alt={`Foto sampul ${bundle.name}`}/> : <div className="bundle-photo-collage">{children.slice(0, 4).map(p => <img key={p.id} src={p.product_type === 'emoney_card' ? '/emoney/front-templates.png' : resolveProductImage(p,p.colors?.[0]) || '/brand/km11-logo-blue.png'} alt={p.name}/>)}</div>}
    </div>
    <div className="product-body">
      <h3>{bundle.name}</h3>
      {bundle.description && <p>{bundle.description}</p>}
      <div className="bundle-includes">{children.map(p => <span key={p.id}><Check size={14}/>{p.name}</span>)}</div>
      <div className="price-area">{launch?.enabled && launch.bundle > 0 && (!launch.endAt || new Date(launch.endAt) > new Date()) && <><span className="price-old">{rupiah(bundle.price)}</span><span className="discount-pill">-{launch.bundle}%</span></>}<strong className="price">{rupiah(launch?.enabled && launch.bundle > 0 && (!launch.endAt || new Date(launch.endAt) > new Date()) ? bundle.price - Math.round(bundle.price * launch.bundle / 100) : bundle.price)}</strong></div>
      {children.some(p => p.sizes?.some(size => sizeSurcharge(p,size) > 0)) && <small className="size-surcharge-hint">Ukuran XXL+ dalam paket: tambahan {rupiah(OVERSIZE_SURCHARGE_RP)} per item.</small>}
      <button className="primary" onClick={() => onOpen(bundle)} disabled={children.length !== bundle.product_ids.length}><ShoppingCart size={18}/> Pilih varian & tambah ke keranjang</button>
    </div>
  </article>
}

function BundleCustomizerModal({ bundle, products, onClose, onDesign, launch }: {
  bundle: ProductBundle
  products: Product[]
  onClose: () => void
  onDesign: (product: Product, onReady: (item: CartItem) => void) => void
  launch?: LaunchSettings
}) {
  const { add } = useCart()
  const children = bundle.product_ids.map(id => products.find(p => p.id === id)).filter((p): p is Product => !!p)
  const [choices, setChoices] = useState<Record<string, BundleCartComponent>>({})
  const [error, setError] = useState('')
  const sizeExtra = children.reduce((sum, product) => sum + sizeSurcharge(product, choices[product.id]?.size), 0)
  const configuredPrice = Number(bundle.price) + sizeExtra
  const bundlePromoActive = !!launch?.enabled && launch.bundle > 0 && (!launch.endAt || new Date(launch.endAt) > new Date())
  function patch(product: Product, field: 'color' | 'size', value: string) {
    setError('')
    setChoices(prev => ({ ...prev, [product.id]: { ...prev[product.id], productId: product.id, name: product.name, imageUrl: resolveProductImage(product, field === 'color' ? value : prev[product.id]?.color || '') || null, [field]: value } }))
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
    add({ bundleId: bundle.id, productId: bundle.id, name: bundle.name, qty: 1, unitPrice: configuredPrice, imageUrl: bundle.cover_image_url || parts[0]?.imageUrl || null, weightGrams: children.reduce((n,p)=>n+Number(p.weight_grams||0),0), bundleItems: parts })
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
            {!!p.sizes?.length && <ProductSizeField product={p} value={choice?.size || ''} onChange={value => patch(p,'size',value)} placeholder="Pilih ukuran"/>}
            {!p.colors?.length && !p.sizes?.length && <span className="bundle-choice-ready"><Check size={15}/> Tidak ada varian yang perlu dipilih</span>}
          </div>}
        </div>
      </div>
    })}</div>
    <div className="bundle-modal-bottom"><div><small>Harga paket{sizeExtra > 0 ? ` (termasuk tambahan ukuran ${rupiah(sizeExtra)})` : ''}</small><strong>{rupiah(bundlePromoActive ? configuredPrice - Math.round(configuredPrice * launch!.bundle / 100) : configuredPrice)}</strong>{bundlePromoActive && <small>Harga sebelum diskon: {rupiah(configuredPrice)} · {launch!.name} −{launch!.bundle}%</small>}</div><button className="primary" type="button" onClick={addBundle}><ShoppingCart size={18}/> Tambah paket ke keranjang</button></div>
  </div></div>
}

export default function StorePage() {
  const [products, setProducts] = useState<Product[]>([])
  const [bundles, setBundles] = useState<ProductBundle[]>([])
  const [selectedBundle, setSelectedBundle] = useState<ProductBundle | null>(null)
  const [bundleDesign, setBundleDesign] = useState<{ product: Product; onReady: (item: CartItem) => void } | null>(null)
  const [loading, setLoading] = useState(true)
  const [launch, setLaunch] = useState<LaunchSettings | undefined>()
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('Semua')
  const [sort, setSort] = useState('featured')
  const [error, setError] = useState('')
  const [emoneyProduct, setEmoneyProduct] = useState<Product | null>(null)
  useEffect(() => { Promise.all([catalogApi.products(),catalogApi.bundles(),catalogApi.launch()]).then(([p,b,l]) => {setProducts(p);setBundles(b);setLaunch(l)}).catch(e => setError(e.message)).finally(() => setLoading(false)) }, [])
  const matcher = (p: Product) => { const name = `${p.name} ${p.description||''}`.toLowerCase(); return category === 'Semua' || (category === 'Pakaian' && /kaos|jersey|vest|baju|kemeja|polo/.test(name)) || (category === 'Aksesori' && /keychain|sandal|payung|lanyard|gantungan|tas|tote|bag|mug/.test(name)) || (category === 'Alat tulis' && /note|book|buku|pulpen|alat tulis/.test(name)) || (category === 'Custom' && p.product_type === 'emoney_card') }
  const filteredProducts = products.filter(p => matcher(p) && `${p.name} ${p.description||''}`.toLowerCase().includes(search.toLowerCase().trim())).sort((a,b) => sort === 'cheapest' ? a.base_price - b.base_price : sort === 'expensive' ? b.base_price - a.base_price : Number(b.featured)-Number(a.featured))
  const filteredBundles = bundles.filter(p => ['Semua','Paket'].includes(category) && `${p.name} ${p.description||''}`.toLowerCase().includes(search.toLowerCase().trim())).sort((a,b) => sort === 'cheapest' ? a.price-b.price : sort === 'expensive' ? b.price-a.price : 0)
  const categories = [{name:'Semua',icon:'✦'}, {name:'Paket',icon:'🎁'}, {name:'Pakaian',icon:'👕'}, {name:'Aksesori',icon:'🛍️'}, {name:'Alat tulis',icon:'📒'}, {name:'Custom',icon:'🎨'}]


  return <>
    <section className="merchic-hero">
      <div className="hero-copy">
        <span className="eyebrow">✦ Bawa semangat KM11 ke mana saja!</span>
        <h1>Merchandise seru,<br/><em>cerita baru!</em></h1>
        <p>Jelajahi koleksi penuh warna untuk setiap momen Kemenkeu Mengajar 11. Pilih favoritmu di Merchic!</p>
        <form className="hero-search" onSubmit={e => {e.preventDefault();document.getElementById('katalog')?.scrollIntoView({behavior:'smooth'})}}>
          <Search size={20}/><input aria-label="Cari merchandise" value={search} onChange={e => setSearch(e.target.value)} placeholder="Mau cari merchandise apa?"/><button type="submit">Cari produk <ArrowRight size={17}/></button>
        </form>
        <div className="hero-offers">
          {launch?.enabled && (launch.standard > 0 || launch.bundle > 0) && (!launch.endAt || new Date(launch.endAt)>new Date()) && <div><strong>{launch.standard}% / {launch.bundle}%</strong><span>{launch.name}</span></div>}
          <div><strong>+10%</strong><span>Belanja di atas Rp500.000</span></div>
          <div><strong>🎟️</strong><span>Kode promo bisa ditumpuk</span></div>
        </div>
      </div>
      <figure className="hero-photo merchic-lifestyle"><img src="/hero/merchic-kemenkeu-shopping.webp" alt="Ilustrasi suasana pegawai Kemenkeu melihat dan memilih merchandise KM11 di stan offline" loading="eager"/><figcaption>✦ Belanja bareng, bawa cerita!</figcaption></figure>
    </section>
    <div className="merchic-category-strip">{categories.map(c => <button key={c.name} className={category===c.name?'active':''} onClick={()=>{setCategory(c.name);document.getElementById('katalog')?.scrollIntoView({behavior:'smooth'})}}><span>{c.icon}</span>{c.name==='Semua'?'Semua merch':c.name}</button>)}</div>
    <section id="katalog" className="section catalog-section merchic-catalog">
      <div className="section-heading"><div><span className="eyebrow">Jelajahi & pilih</span><h2>Temukan favoritmu! ✨</h2><p>Ada {filteredProducts.length + filteredBundles.length} merchandise yang bisa kamu jelajahi.</p></div><select className="catalog-sort" aria-label="Urutkan produk" value={sort} onChange={e=>setSort(e.target.value)}><option value="featured">Rekomendasi</option><option value="cheapest">Harga terendah</option><option value="expensive">Harga tertinggi</option></select></div>
      <div className="catalog-filters">{categories.map(c=><button key={c.name} className={category===c.name?'active':''} onClick={()=>setCategory(c.name)}>{c.name}</button>)}</div>
      {loading ? <div className="empty">Memuat produk...</div> : error ? <div className="alert error">{error}</div> : <>
        {!!filteredBundles.length && <div className="product-grid">{filteredBundles.map(bundle => <BundleCard key={bundle.id} bundle={bundle} products={products} onOpen={setSelectedBundle} launch={launch}/>)}</div>}
        {!!filteredProducts.length && <div className="product-grid">{filteredProducts.map(p=><ProductCard p={p} key={p.id} onOpenCustomizer={setEmoneyProduct} launch={launch}/>)}</div>}
        {!filteredProducts.length && !filteredBundles.length && <div className="empty">Belum ada merchandise yang sesuai dengan pencarian. Coba kategori lain.</div>}
      </>}
    </section>
    {emoneyProduct && <EmoneyCustomizerModal product={emoneyProduct} onClose={() => setEmoneyProduct(null)}/>}
    {selectedBundle && <BundleCustomizerModal key={selectedBundle.id} bundle={selectedBundle} products={products} launch={launch} onClose={() => {setSelectedBundle(null);setBundleDesign(null)}} onDesign={(product,onReady) => setBundleDesign({product,onReady})}/>}
    {bundleDesign && <EmoneyCustomizerModal key={bundleDesign.product.id} product={bundleDesign.product} onClose={() => setBundleDesign(null)} onConfigured={item => {bundleDesign.onReady(item);setBundleDesign(null)}}/>} 
  </>
}
