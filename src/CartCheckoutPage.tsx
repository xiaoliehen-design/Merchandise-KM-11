import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, MapPin, Minus, PackageCheck, Plus, QrCode, Search, Trash2, Truck } from 'lucide-react'
import { catalogApi, orderApi, shippingApi } from './api'
import { useCart } from './CartContext'
import type { PaymentMethod, PickupLocation, ShippingQuote } from './types'
import { dt, rupiah } from './utils'

type Destination = { id: string; label: string; zip_code?: string }

export default function CartCheckoutPage() {
  const cart = useCart()
  const [pickupLocations, setPickupLocations] = useState<PickupLocation[]>([])
  const [payments, setPayments] = useState<PaymentMethod[]>([])
  const [fulfillment, setFulfillment] = useState<'ship' | 'pickup'>('ship')
  const [customer, setCustomer] = useState({ fullName: '', email: '', phone: '', address: '' })
  const [destinationQuery, setDestinationQuery] = useState('')
  const [destinations, setDestinations] = useState<Destination[]>([])
  const [destination, setDestination] = useState<Destination | null>(null)
  const [quotes, setQuotes] = useState<ShippingQuote[]>([])
  const [quote, setQuote] = useState<ShippingQuote | null>(null)
  const [pickupLocationId, setPickupLocationId] = useState('')
  const [pickupSlotId, setPickupSlotId] = useState('')
  const [paymentId, setPaymentId] = useState('')
  const [proof, setProof] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [receipt, setReceipt] = useState<null | { receiptNo: string; total: number; customer: typeof customer; items: typeof cart.items; fulfillment: 'ship' | 'pickup'; destination?: string; shipping?: ShippingQuote | null; pickupName?: string; pickupTime?: string; paymentName?: string; uploadToken?: string; proofUploaded: boolean }>(null)

  useEffect(() => {
    Promise.all([catalogApi.pickups(), catalogApi.payments()]).then(([p, m]) => {
      setPickupLocations(p)
      setPayments(m)
      if (p[0]) setPickupLocationId(p[0].id)
      if (m[0]) setPaymentId(m[0].id)
    }).catch(e => setError(e.message))
  }, [])

  const weight = useMemo(() => cart.items.reduce((s, i) => s + i.weightGrams * i.qty, 0), [cart.items])
  const shippingCost = fulfillment === 'ship' ? quote?.cost || 0 : 0
  const total = cart.subtotal + shippingCost
  const selectedPickup = pickupLocations.find(p => p.id === pickupLocationId)
  const selectedPayment = payments.find(p => p.id === paymentId)

  async function searchDestinations() {
    if (destinationQuery.trim().length < 3) return setError('Ketik minimal 3 karakter untuk mencari kecamatan/kota tujuan.')
    setBusy(true); setError(''); setDestination(null); setQuote(null); setQuotes([])
    try { setDestinations(await shippingApi.destinations(destinationQuery.trim())) } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }

  async function chooseDestination(d: Destination) {
    setDestination(d); setDestinations([]); setDestinationQuery(d.label); setBusy(true); setError(''); setQuote(null)
    try { setQuotes(await shippingApi.quotes({ destinationId: d.id, weight: Math.max(1, weight) })) } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }

  function validate() {
    if (!cart.items.length) return 'Keranjang masih kosong.'
    if (!customer.fullName.trim()) return 'Nama lengkap wajib diisi.'
    if (!/^\S+@\S+\.\S+$/.test(customer.email)) return 'Email tidak valid.'
    if (customer.phone.replace(/\D/g, '').length < 9) return 'Nomor HP tidak valid.'
    if (cart.items.some(i => i.customization?.type === 'emoney_card' && !i.customization?.previewDataUrl)) return 'Ada item kartu e-money yang preview-nya belum lengkap.'
    if (fulfillment === 'ship') {
      if (!customer.address.trim()) return 'Alamat lengkap wajib diisi untuk pengiriman.'
      if (!destination) return 'Pilih tujuan pengiriman dari hasil pencarian RajaOngkir.'
      if (!quote) return 'Pilih layanan pengiriman.'
    } else {
      if (!pickupLocationId) return 'Pilih tempat pengambilan.'
      if (!pickupSlotId) return 'Pilih waktu pengambilan.'
    }
    if (!paymentId) return 'Pilih metode pembayaran.'
    if (!proof) return 'Upload bukti pembayaran terlebih dahulu.'
    return ''
  }

  async function checkout() {
    const message = validate(); if (message) return setError(message)
    setBusy(true); setError('')
    try {
      const created = await orderApi.create({
        customer,
        fulfillmentType: fulfillment,
        pickupLocationId: fulfillment === 'pickup' ? pickupLocationId : null,
        pickupSlotId: fulfillment === 'pickup' ? pickupSlotId : null,
        destinationId: fulfillment === 'ship' ? destination?.id : null,
        destinationLabel: fulfillment === 'ship' ? destination?.label : null,
        shippingQuote: fulfillment === 'ship' ? quote : null,
        paymentMethodId: paymentId,
        items: cart.items.map(i => ({ productId: i.productId, qty: i.qty, color: i.color || null, size: i.size || null, customization: i.customization || null }))
      })
      const slotLabel = selectedPickup?.slots?.find(s => s.id === pickupSlotId)?.starts_at
      const baseReceipt = { receiptNo: created.receiptNo, total: created.total, customer: { ...customer }, items: [...cart.items], fulfillment, destination: destination?.label, shipping: quote, pickupName: selectedPickup?.name, pickupTime: slotLabel, paymentName: selectedPayment?.name, uploadToken: created.uploadToken }
      try {
        if (proof) await orderApi.uploadProof(created.receiptNo, proof, created.uploadToken)
        setReceipt({ ...baseReceipt, proofUploaded: true, uploadToken: undefined })
      } catch (uploadError) {
        setReceipt({ ...baseReceipt, proofUploaded: false })
        setError(`Order sudah dibuat, tetapi upload bukti bayar gagal: ${(uploadError as Error).message}`)
      }
      cart.clear()
    } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }

  async function retryProofUpload() {
    if (!receipt || receipt.proofUploaded || !receipt.uploadToken || !proof) return
    setBusy(true); setError('')
    try {
      await orderApi.uploadProof(receipt.receiptNo, proof, receipt.uploadToken)
      setReceipt({ ...receipt, proofUploaded: true, uploadToken: undefined })
    } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }

  if (receipt) return <section className="section receipt-success">
    <div className="success-icon"><CheckCircle2 size={52}/></div>
    <span className="eyebrow">Pesanan berhasil dibuat</span>
    <h1>Terima kasih!</h1>
    <p>Simpan nomor receipt ini untuk pelacakan dan komunikasi dengan panitia.</p>
    <div className="receipt-number">{receipt.receiptNo}</div>
    <div className="receipt-detail panel">
      <div className="receipt-section"><b>Customer</b><p>{receipt.customer.fullName}<br/>{receipt.customer.email}<br/>{receipt.customer.phone}</p></div>
      <div className="receipt-section"><b>Penerimaan</b><p>{receipt.fulfillment === 'ship' ? <>Dikirim ke {receipt.destination}<br/>{receipt.customer.address}{receipt.shipping ? <><br/>{receipt.shipping.courier.toUpperCase()} · {receipt.shipping.service}</> : null}</> : <>Ambil di {receipt.pickupName}{receipt.pickupTime ? <><br/>{dt(receipt.pickupTime)}</> : null}</>}</p></div>
      <div className="receipt-section span-all"><b>Item</b>{receipt.items.map((i, idx) => <div className="receipt-item" key={idx}><span>{i.qty}× {i.name}{i.color ? ` · ${i.color}` : ''}{i.size ? ` · ${i.size}` : ''}{i.customization?.type === 'emoney_card' ? ` · Template ${i.customization.templateLabel}` : ''}</span><strong>{rupiah(i.unitPrice * i.qty)}</strong></div>)}</div>
      <div className="receipt-section"><b>Pembayaran</b><p>{receipt.paymentName || '-'}</p></div>
      <div className="receipt-total"><span>Total pembayaran</span><strong>{rupiah(receipt.total)}</strong></div>
    </div>
    {receipt.proofUploaded ? <p className="muted">Bukti pembayaran sudah terunggah. Admin akan memverifikasi pesanan Anda.</p> : <div className="panel receipt-upload-retry"><p className="muted">Order sudah dibuat tetapi bukti pembayaran belum masuk. Anda bisa mencoba lagi di bawah ini.</p><button className="secondary" onClick={retryProofUpload} disabled={busy}>Upload ulang bukti bayar</button></div>}
    <div className="button-row center"><Link className="secondary" to="/track">Lacak pesanan</Link><Link className="primary" to="/">Kembali ke katalog</Link></div>
  </section>

  return <section className="section">
    <div className="section-heading"><div><span className="eyebrow">Checkout</span><h1>Selesaikan pesananmu</h1></div></div>
    {error && <div className="alert error">{error}</div>}
    <div className="checkout-grid">
      <div className="checkout-main">
        <div className="panel">
          <h2>Keranjang belanja</h2>
          {cart.items.length ? <div className="cart-list">{cart.items.map((item, index) => <div className="cart-item" key={`${item.productId}-${index}`}>
            <div className="cart-thumb">{item.imageUrl ? <img src={item.imageUrl} alt={item.name}/> : <img src="/brand/km11-logo-white.png" alt="Kemenkeu Mengajar 11"/>}</div>
            <div className="cart-info"><b>{item.name}</b><small>{item.color || item.size ? <>{item.color || '-'}{item.size ? ` · ${item.size}` : ''}</> : 'Tanpa varian'}</small>{item.customization?.type === 'emoney_card' && <span>Nama kartu: {item.customization.customerName} · {item.customization.templateLabel}</span>}</div>
            <div className="qty-control"><button onClick={() => cart.updateQty(index, item.qty - 1)}><Minus size={16}/></button><b>{item.qty}</b><button onClick={() => cart.updateQty(index, item.qty + 1)}><Plus size={16}/></button></div>
            <button className="icon danger" onClick={() => cart.remove(index)}><Trash2 size={16}/></button>
          </div>)}</div> : <div className="empty compact"><div className="empty-bag">🛒</div><h3>Keranjang kosong</h3><p>Silakan kembali ke katalog untuk menambahkan produk.</p><Link className="primary" to="/">Kembali ke katalog</Link></div>}
        </div>

        <div className="panel">
          <h2>Data customer</h2>
          <div className="form-grid two">
            <label>Nama lengkap<input value={customer.fullName} onChange={e => setCustomer({ ...customer, fullName: e.target.value })}/></label>
            <label>Email<input type="email" value={customer.email} onChange={e => setCustomer({ ...customer, email: e.target.value })}/></label>
            <label>Nomor HP<input value={customer.phone} onChange={e => setCustomer({ ...customer, phone: e.target.value })}/></label>
            <label className="span-2">Alamat lengkap<textarea rows={3} value={customer.address} onChange={e => setCustomer({ ...customer, address: e.target.value })}/></label>
          </div>
        </div>

        <div className="panel">
          <h2>Penerimaan barang</h2>
          <div className="segmented"><button className={fulfillment === 'ship' ? 'active' : ''} onClick={() => setFulfillment('ship')}><Truck size={17}/> Kirim</button><button className={fulfillment === 'pickup' ? 'active' : ''} onClick={() => setFulfillment('pickup')}><PackageCheck size={17}/> Pickup</button></div>
          {fulfillment === 'ship' ? <div className="form-grid two">
            <label className="span-2"><span className="field-title">Cari kecamatan/kota tujuan</span><div className="search-row"><input value={destinationQuery} onChange={e => setDestinationQuery(e.target.value)} placeholder="Ketik nama kecamatan / kota tujuan"/><button className="secondary" onClick={searchDestinations} disabled={busy}><Search size={17}/> Cari</button></div></label>
            {!!destinations.length && <div className="search-results span-2">{destinations.map(d => <button key={d.id} onClick={() => chooseDestination(d)}><MapPin size={18}/><span>{d.label}<small>{d.zip_code || 'Tanpa kode pos'}</small></span></button>)}</div>}
            {destination && <div className="selected-box span-2"><MapPin size={18}/><div><b>{destination.label}</b><small>{destination.zip_code || 'Tanpa kode pos'}</small></div></div>}
            {!!quotes.length && <label className="span-2"><span className="field-title">Pilih layanan pengiriman</span><div className="quote-grid">{quotes.map(q => <button type="button" key={`${q.courier}-${q.service}`} className={quote?.courier === q.courier && quote?.service === q.service ? 'selected' : ''} onClick={() => setQuote(q)}><span><b>{q.courier.toUpperCase()} · {q.service}</b><small>{q.description || q.etd || 'Layanan pengiriman'}</small></span><strong>{rupiah(q.cost)}</strong></button>)}</div></label>}
          </div> : <div className="form-grid two">
            <label>Lokasi pickup<select value={pickupLocationId} onChange={e => { setPickupLocationId(e.target.value); setPickupSlotId('') }}>{pickupLocations.map(p => <option value={p.id} key={p.id}>{p.name}</option>)}</select></label>
            <label>Waktu pickup<select value={pickupSlotId} onChange={e => setPickupSlotId(e.target.value)}><option value="">Pilih slot</option>{selectedPickup?.slots?.map(s => <option value={s.id} key={s.id}>{dt(s.starts_at)}</option>)}</select></label>
            {selectedPickup && <div className="pickup-detail"><MapPin size={18}/><div><b>{selectedPickup.name}</b><p>{selectedPickup.address}</p>{selectedPickup.notes ? <small>{selectedPickup.notes}</small> : null}</div></div>}
          </div>}
        </div>

        <div className="panel">
          <h2>Pembayaran</h2>
          <div className="payment-grid">{payments.map(p => <button type="button" key={p.id} className={`payment-card ${paymentId === p.id ? 'selected' : ''}`} onClick={() => setPaymentId(p.id)}><div className="payment-icon"><QrCode size={18}/></div><span><b>{p.name}</b><small>{p.account_number || p.type}</small></span></button>)}</div>
          {selectedPayment && <div className="qr-box">{selectedPayment.qr_image_url ? <img src={selectedPayment.qr_image_url} alt={selectedPayment.name}/> : <div className="payment-icon"><QrCode size={26}/></div>}<div><b>{selectedPayment.name}</b><p>{selectedPayment.account_name || '-'}{selectedPayment.account_number ? <><br/>{selectedPayment.account_number}</> : null}</p>{selectedPayment.instructions ? <small>{selectedPayment.instructions}</small> : <small>Silakan lakukan pembayaran sesuai total order.</small>}</div></div>}
          <label>Upload bukti pembayaran<input type="file" accept="image/png,image/jpeg,image/webp,application/pdf" onChange={e => setProof(e.target.files?.[0] || null)}/><small>Bisa berupa PNG/JPG/WebP/PDF maksimal 5 MB.</small></label>
        </div>
      </div>

      <aside className="panel order-summary">
        <h2>Ringkasan order</h2>
        {cart.items.map((item, idx) => <div className="summary-line" key={idx}><span>{item.qty}× {item.name}</span><strong>{rupiah(item.unitPrice * item.qty)}</strong></div>)}
        <div className="summary-line"><span>Subtotal</span><strong>{rupiah(cart.subtotal)}</strong></div>
        <div className="summary-line"><span>Ongkir</span><strong>{rupiah(shippingCost)}</strong></div>
        <div className="summary-total"><span>Total</span><strong>{rupiah(total)}</strong></div>
        <button className="primary" onClick={checkout} disabled={busy || !cart.items.length}>{busy ? 'Memproses…' : 'Konfirmasi pesanan'}</button>
      </aside>
    </div>
  </section>
}
