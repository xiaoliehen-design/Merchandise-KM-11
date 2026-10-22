/** Shared validation for configurable launch discounts (percent, max. 2 decimals). */
export function isValidLaunchPercent(value: unknown): value is number {
  return typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= 0 && value <= 100 &&
    Math.abs(value * 100 - Math.round(value * 100)) < 1e-8
}
