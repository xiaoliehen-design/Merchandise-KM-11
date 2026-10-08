/** 17TRACK V2.4; never send token or recipient personal data to browsers. */
export type TrackingEnv = { TRACK17_API_KEY?: string }
const base = 'https://api.17track.net/track/v2.4'
export type TrackingEvent = { time: string | null; description: string; location: string; status: string }
export type TrackingResult = { provider:'17TRACK'; status:string; statusDetail:string; lastUpdate:string|null; latestEvent:string|null; events:TrackingEvent[]; trackingAvailable:boolean; message?:string; providerName?:string; estimatedDelivery?:string|null }
function label(x: unknown) { return typeof x === 'string' ? x.trim().slice(0,600) : '' }
async function call(env:TrackingEnv,path:'register'|'gettrackinfo',number:string,fetchFn:typeof fetch=fetch) {
  if (!env.TRACK17_API_KEY) throw new Error('17TRACK belum dikonfigurasi.')
  const res=await fetchFn(`${base}/${path}`,{method:'POST',headers:{'17token':env.TRACK17_API_KEY,'Content-Type':'application/json'},body:JSON.stringify([{number}]),signal:AbortSignal.timeout(9000)})
  const json:any=await res.json().catch(()=>null)
  if (!res.ok || !json || json.code !== 0) throw new Error(`17TRACK tidak tersedia (${res.status})`)
  return json.data || {}
}
export async function register17(env:TrackingEnv,number:string,fetchFn:typeof fetch=fetch) {
  if (!env.TRACK17_API_KEY) return {ok:false,message:'TRACK17_API_KEY belum dikonfigurasi'}
  try {
    const data=await call(env,'register',number,fetchFn)
    const rejected=data.rejected?.[0]
    return { ok:Array.isArray(data.accepted)&&data.accepted.length>0, message:rejected?.error?.message || (data.accepted?.length ? 'Terdaftar' : 'Registrasi belum dikonfirmasi') }
  } catch (e) { return { ok:false,message:(e as Error).message } }
}
export function normalize17(data:any):TrackingResult {
  const item=(Array.isArray(data?.accepted)?data.accepted:[])[0]
  if(!item?.track_info) return {provider:'17TRACK',status:'Belum tersedia',statusDetail:'',lastUpdate:null,latestEvent:null,events:[],trackingAvailable:false,message:label(data?.rejected?.[0]?.error?.message)||'Nomor resi belum terdaftar atau kurir belum mengirimkan pembaruan.'}
  const info=item.track_info
  const providers=Array.isArray(info.tracking?.providers)?info.tracking.providers:[]
  const events:TrackingEvent[]=providers.flatMap((p:any)=> (Array.isArray(p.events)?p.events:[]).map((event:any)=>({
    time:label(event.time_iso || event.time_utc) || null,
    description:label(event.description_translation?.description || event.description) || 'Pembaruan dari kurir',
    location:label(event.location || event.address?.city || ''),
    status:label(event.stage || event.sub_status)
  })))
  events.sort((a,b)=>(Date.parse(b.time||'')||0)-(Date.parse(a.time||'')||0))
  const unique=events.filter((e,i)=>events.findIndex(x=>x.time===e.time&&x.description===e.description&&x.location===e.location)===i)
  return {provider:'17TRACK',status:label(info.latest_status?.status)||'Belum tersedia',statusDetail:label(info.latest_status?.sub_status_descr||info.latest_status?.sub_status),lastUpdate:label(info.latest_event?.time_iso||info.latest_event?.time_utc)||unique[0]?.time||null,latestEvent:label(info.latest_event?.description),events:unique,trackingAvailable:true,providerName:label(providers[0]?.provider?.name),estimatedDelivery:label(info.time_metrics?.estimated_delivery_date?.from)||null}
}
// Best-effort per-isolate cache reduces repeated public refreshes; set Cloudflare WAF rate rules for production.
const recent = new Map<string, { until:number; result:TrackingResult }>()
export async function get17(env:TrackingEnv,number:string,fetchFn:typeof fetch=fetch):Promise<TrackingResult> {
  if(!env.TRACK17_API_KEY) return {provider:'17TRACK',status:'Belum tersedia',statusDetail:'',lastUpdate:null,latestEvent:null,events:[],trackingAvailable:false,message:'Tracking API belum dikonfigurasi oleh admin.'}
  const cached = recent.get(number)
  if (cached && cached.until > Date.now()) return cached.result
  try {
    const result = normalize17(await call(env,'gettrackinfo',number,fetchFn))
    if (recent.size >= 300) recent.clear()
    recent.set(number, { until:Date.now()+120000, result })
    return result
  } catch { return {provider:'17TRACK',status:'Tidak tersedia',statusDetail:'',lastUpdate:null,latestEvent:null,events:[],trackingAvailable:false,message:'Layanan pelacakan sedang tidak dapat diakses. Status pesanan KM11 tetap tersedia.'} }
}
