import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CheckCircle2, CircleDot, PackageSearch, Truck } from 'lucide-react'
import { orderApi } from './api'
import { dt, statusLabel } from './utils'

type TrackingEvent = { time: string | null; description: string; location: string; status: string }
type Result = {
  receiptNo: string; status: string; fulfillmentType: 'ship'|'pickup'; createdAt: string
  trackingNumber: string|null; trackingCourier: string|null; shippingCourier: string|null; shippingService: string|null
  tracking: { provider:'17TRACK'; status:string; statusDetail:string; lastUpdate:string|null; latestEvent:string|null; trackingAvailable:boolean; events:TrackingEvent[]; providerName?:string; message?:string; estimatedDelivery?:string|null } | null
  pickup: {name?:string;address?:string;slot?:{starts_at?:string}}|null
}
const logisticsLabel:Record<string,string> = {
  NotFound:'Belum ditemukan', InfoReceived:'Informasi diterima kurir', InTransit:'Dalam perjalanan',
  Expired:'Pengiriman melewati estimasi',AvailableForPickup:'Siap diambil',OutForDelivery:'Sedang diantar',
  DeliveryFailure:'Pengiriman terkendala',Delivered:'Sudah diterima',Exception:'Perlu perhatian'
}
function readableDate(value?:string|null) { if (!value) return 'Waktu belum tersedia'; const date=new Date(value); return Number.isNaN(date.getTime()) ? value : dt(value) }

export default function TrackPage(){
  const [sp] = useSearchParams()
  const [keyword, setKeyword] = useState(sp.get('receipt') || sp.get('resi') || '')
  const [data, setData] = useState<Result|null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  async function run(query = keyword){
    if (!query.trim()) return setError('Masukkan nomor invoice atau resi.')
    setBusy(true); setError('')
    try { setData(await orderApi.track(query.trim()) as Result) }
    catch (e) { setError((e as Error).message); setData(null) }
    finally { setBusy(false) }
  }
  useEffect(() => { const initial=sp.get('receipt') || sp.get('resi'); if (initial) void run(initial) }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const events = data?.tracking?.events || []
  const finalStatus = data?.tracking?.trackingAvailable && data.tracking.status === 'Delivered'
    ? 'Sudah diterima'
    : data?.tracking?.trackingAvailable ? (logisticsLabel[data.tracking.status] || data.tracking.status)
    : data ? statusLabel[data.status] || data.status : ''
  return <section className="section track-page">
    <div className="section-heading"><div><span className="eyebrow">Pelacakan</span><h1>Lacak pesanan KM11</h1></div><p>Masukkan nomor invoice yang diterima setelah checkout atau nomor resi dari admin.</p></div>
    <div className="track-search panel"><PackageSearch size={24}/><input aria-label="Nomor invoice atau nomor resi" value={keyword} onChange={e=>setKeyword(e.target.value)} onKeyDown={e=>e.key==='Enter'&&void run()} placeholder="Nomor invoice / nomor resi"/><button className="primary" onClick={()=>void run()} disabled={busy}>{busy?'Mencari…':'Lacak'}</button></div>
    {error && <div className="alert error" role="alert">{error}</div>}
    {data && <div className="track-grid">
      <div className="panel">
        <div className="status-head"><span className={`status-badge ${data.status}`}>{statusLabel[data.status] || data.status}</span><small>Dibuat {readableDate(data.createdAt)}</small></div>
        <h2>{data.receiptNo}</h2>
        <div className="track-meta"><span>Nomor invoice <b>{data.receiptNo}</b></span><span>Nomor resi <b>{data.trackingNumber || 'Belum tersedia'}</b></span><span>Metode <b>{data.fulfillmentType==='pickup'?'Ambil di tempat':'Pengiriman'}</b></span><span>Status terakhir <b>{finalStatus}</b></span></div>
        <div className="status-steps">{['new','verified','shipped','completed'].map((s,idx)=>{
          const stages=['new','verified','shipped','completed']; const active=stages.indexOf(data.status)>=idx
          return <div className={active?'active':''} key={s}>{active?<CheckCircle2/>:<CircleDot/>}<span>{statusLabel[s]}</span></div>
        })}</div>
        {data.fulfillmentType==='pickup' && data.pickup && <div className="selected-box"><span><b>Tempat ambil:</b> {data.pickup.name}<br/>{data.pickup.address}{data.pickup.slot?.starts_at ? <><br/><b>Waktu:</b> {readableDate(data.pickup.slot.starts_at)}</> : null}</span></div>}
        {data.fulfillmentType==='ship' && <div className="shipping-card"><Truck/><div><b>{data.trackingNumber ? `${(data.trackingCourier || data.shippingCourier || '').toUpperCase()} · ${data.trackingNumber}` : 'Nomor resi belum diinput admin'}</b><p>{data.trackingNumber ? 'Tracking oleh 17TRACK. Status perjalanan dapat berbeda dengan status administrasi pesanan.' : 'Nomor resi akan tampil setelah admin memproses pengiriman.'}</p></div></div>}
      </div>
      <div className="panel">
        <h2>Riwayat pengiriman</h2>
        {data.tracking && <div className="tracking-status-panel"><b>Status kurir: {data.tracking.trackingAvailable ? (logisticsLabel[data.tracking.status] || data.tracking.status) : 'Belum tersedia'}</b>{data.tracking.statusDetail && <p>{data.tracking.statusDetail}</p>}{data.tracking.latestEvent && <p>{data.tracking.latestEvent}</p>}{data.tracking.lastUpdate && <small>Pembaruan terakhir: {readableDate(data.tracking.lastUpdate)}</small>}{data.tracking.estimatedDelivery && <small>Perkiraan tiba: {readableDate(data.tracking.estimatedDelivery)}</small>}{data.tracking.message && <p>{data.tracking.message}</p>}</div>}
        {events.length ? <div className="timeline">{events.map((item,index)=><div key={`${item.time}-${item.description}-${index}`}><span></span><div><b>{item.description}</b><small>{readableDate(item.time)}</small>{item.location && <p>{item.location}</p>}</div></div>)}</div> : <div className="empty compact">{data.trackingNumber ? 'Kurir belum mengirimkan riwayat perjalanan, atau layanan tracking belum aktif.' : 'Riwayat pengiriman akan muncul setelah resi tersedia.'}</div>}
      </div>
    </div>}
  </section>
}
