/** Integer rupiah calculations; discount order is launch -> lifetime tier -> code. */
export type DiscountSettings = { enabled: boolean; standard: number; bundle: number; endAt: string | null }
type Promo = { code: string; active: boolean; discount_type: string; amount: number; min_order_amount: number; starts_at: string | null; ends_at: string | null }
const roundRp = (n: number) => Math.round(n)

/** Launching discounts can be chosen freely, safely bounded to 0–100% with two decimal places. */
export function isValidLaunchPercent(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100
    && Math.abs(value * 100 - Math.round(value * 100)) < 1e-8
}
export function computeDiscounts(originalSubtotal: number, rawLaunchDiscount: number, promo: Promo | null, settings: DiscountSettings, now = new Date()) {
  if (!Number.isFinite(originalSubtotal) || originalSubtotal < 0) throw new Error('Subtotal tidak valid.')
  const launchActive = settings.enabled && (!settings.endAt || now < new Date(settings.endAt))
  const launchDiscount = launchActive ? Math.min(roundRp(originalSubtotal), roundRp(rawLaunchDiscount)) : 0
  const afterLaunch = Math.max(0, roundRp(originalSubtotal) - launchDiscount)
  const volumeEligible = originalSubtotal > 500000
  const volumeDiscount = volumeEligible ? roundRp(afterLaunch * .10) : 0
  const afterVolume = afterLaunch - volumeDiscount
  let promoDiscount = 0
  let promoCode: string | null = null
  if (promo) {
    if (!promo.active) throw new Error('Kode promo tidak aktif.')
    if (promo.starts_at && now < new Date(promo.starts_at)) throw new Error('Kode promo belum mulai berlaku.')
    if (promo.ends_at && now >= new Date(promo.ends_at)) throw new Error('Kode promo sudah kedaluwarsa.')
    if (originalSubtotal < Number(promo.min_order_amount)) throw new Error(`Kode promo memerlukan subtotal minimal Rp ${Number(promo.min_order_amount).toLocaleString('id-ID')}.`)
    const raw = promo.discount_type === 'percent' ? afterVolume * Number(promo.amount) / 100 : Number(promo.amount)
    promoDiscount = Math.min(afterVolume, roundRp(raw))
    promoCode = promo.code
  }
  return { originalSubtotal: roundRp(originalSubtotal), launchActive, launchDiscount, volumeEligible, volumeDiscount, promoCode, promoDiscount, payableSubtotal: Math.max(0, afterVolume - promoDiscount) }
}
