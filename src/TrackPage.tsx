import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CheckCircle2, CircleDot, PackageSearch, Truck } from 'lucide-react'
import { orderApi } from './api'
import { dt, rupiah, statusLabel } from './utils'

export default function TrackPage(){
  const [sp] = useSearchParams()
  const [receipt, setReceipt] = useState(sp.get('receipt') || '')
  const [data, setData] = useState<any>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  async function run(){
    if(!receipt.trim()) return
    setBusy(true); setError('')
    try{ setData(await orderApi.track(receipt.trim())) }catch(e){ setError((e as Error).message); setData(null) }finally{ setBusy(false) }
  }
  useEffect(()=>{ if(receipt) run() },[]) // eslint-disable-line react-hooks/exhaustive-deps
  const history = Array.isArray(data?.tracking?.manifest) ? data.tracking.manifest : Array.isArray(data?.tracking?.history) ? data.tracking.history : []
  return <section className="section track-page">
    <div className="section-heading"><div><span className="eyebrow">Pelacakan</span><h1>Lacak pesanan KM11</h1></div><p>Masukkan nomor receipt yang diterima setelah checkout.</p></div>
    <div className="track-search panel"><PackageSearch size={24}/><input value={receipt} onChange={e=>setReceipt(e.target.value)} onKeyDown={e=>e.key==='Enter'&&run()} placeholder="KM11-20261007-XXXXXXXX"/><button className="primary" onClick={run} disabled={busy}>{busy?'Mencari…':'Lacak'}</button></div>
    {error && <div className="alert error">{error}</div>}
    {data && <div className="track-grid">
      <div className="panel">
        <div className="status-head"><span className={`status-badge ${data.status}`}>{statusLabel[data.status] || data.status}</span><small>Dibuat {dt(data.createdAt)}</small></div>
        <h2>{data.receiptNo}</h2>
        <div className="track-meta"><span>Total <b>{rupiah(Number(data.total||0))}</b></span><span>Metode <b>{data.fulfillmentType==='pickup'?'Ambil di tempat':'Pengiriman'}</b></span></div>
        <div className="status-steps">
          {['new','verified','shipped','completed'].map((s,idx)=>{
            const order = ['new','verified','shipped','completed']; const active = order.indexOf(data.status)>=idx
            return <div className={active?'active':''} key={s}>{active?<CheckCircle2/>:<CircleDot/>}<span>{statusLabel[s]}</span></div>
          })}
        </div>
        {data.fulfillmentType==='pickup' && data.pickup && <div className="selected-box"><span><b>Tempat ambil:</b> {data.pickup.name}<br/>{data.pickup.address}{data.pickup.slot ? <><br/><b>Waktu:</b> {dt(data.pickup.slot.starts_at)}</> : null}</span></div>}
        {data.fulfillmentType==='ship' && <div className="shipping-card"><Truck/><div><b>{data.trackingNumber ? `${(data.trackingCourier||'').toUpperCase()} · ${data.trackingNumber}` : 'Belum ada nomor resi'}</b><p>{data.trackingNumber ? 'Status di bawah diambil dari RajaOngkir.' : 'Nomor resi akan tampil setelah admin memproses pengiriman.'}</p></div></div>}
      </div>
      <div className="panel">
        <h2>Riwayat pengiriman</h2>
        {history.length ? <div className="timeline">{history.map((h:any,i:number)=><div key={i}><span></span><div><b>{h.description || h.manifest_description || h.status || 'Update pengiriman'}</b><small>{h.date || h.manifest_date || ''} {h.time || h.manifest_time || ''}</small><p>{h.city_name || h.city || h.location || ''}</p></div></div>)}</div> : <div className="empty compact">Belum ada riwayat pengiriman dari kurir.</div>}
      </div>
    </div>}
  </section>
}
