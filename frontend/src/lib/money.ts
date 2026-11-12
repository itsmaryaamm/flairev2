import type { Locale } from './prefs'
import { PAYPAL_ONLY } from './flags'

/** Flaire stores money in SAR halalas. The PayPal-only build shows US dollars at PayPal's fixed sandbox rate. */
const SAR_PER_USD = 3.75
const usdOf = (halalas: number | null | undefined) => (halalas ?? 0) / 100 / SAR_PER_USD
const usd = (v: number, o: Intl.NumberFormatOptions = {}) => new Intl.NumberFormat('en-US', o).format(v)

/** The locale money is rendered in. Set by the i18n provider; defaults to English before it mounts. */
let currentLocale: Locale = 'en'

export function setMoneyLocale(locale: Locale) {
  currentLocale = locale
}

export function moneyLocale(): Locale {
  return currentLocale
}

const AR_SUFFIX = 'ر.س'

function arabicNumber(value: number, opts: Intl.NumberFormatOptions): string {
  // ar-SA with Western (latn) digits, currency parts stripped so the riyal mark can sit after the number.
  const parts = new Intl.NumberFormat('ar-SA', { style: 'currency', currency: 'SAR', numberingSystem: 'latn', ...opts }).formatToParts(value)
  return parts
    .filter((p) => p.type !== 'currency' && p.type !== 'literal')
    .map((p) => (p.type === 'compact' ? ` ${p.value}` : p.value))
    .join('')
    .trim()
}

/** Formats integer halalas as "SAR 1,234.50" (en) or "1,234.50 ر.س" (ar). */
export function sar(halalas: number | null | undefined, opts?: { compact?: boolean }): string {
  if (PAYPAL_ONLY) {
    const v = usdOf(halalas)
    if (!!opts?.compact && Math.abs(v) >= 10_000) return `$${usd(v, { notation: 'compact', maximumFractionDigits: 1 })}`
    return `${v < 0 ? '-' : ''}$${usd(Math.abs(v), { minimumFractionDigits: Math.abs(v % 1) < 0.005 ? 0 : 2, maximumFractionDigits: 2 })}`
  }
  const value = (halalas ?? 0) / 100
  const compact = !!opts?.compact && Math.abs(value) >= 10_000
  if (currentLocale === 'ar') {
    const n = compact
      ? arabicNumber(value, { notation: 'compact', maximumFractionDigits: 1 })
      : arabicNumber(value, { minimumFractionDigits: Math.abs(value % 1) < 0.005 ? 0 : 2, maximumFractionDigits: 2 })
    return `${n} ${AR_SUFFIX}`
  }
  if (compact) {
    return `SAR ${new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(value)}`
  }
  const whole = Math.abs(value % 1) < 0.005
  return `SAR ${new Intl.NumberFormat('en-US', {
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(value)}`
}

/** Formats an amount in another currency's minor units, e.g. 8000 USD cents as "USD 80.00". Western digits in both languages. */
export function money(minor: number | null | undefined, currency: string | null | undefined): string {
  const code = (currency || 'SAR').toUpperCase()
  if (code === 'SAR') return sar(minor)
  const n = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format((minor ?? 0) / 100)
  return `${code} ${n}`
}

/** Formats halalas as a plain number string without the currency, e.g. "1,234.50". Western digits in both languages. */
export function sarNumber(halalas: number | null | undefined): string {
  if (PAYPAL_ONLY) return usd(usdOf(halalas), { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format((halalas ?? 0) / 100)
}

/** Converts a SAR string typed by a user ("1,234.5", "SAR 500", "500 ر.س") into integer halalas. */
export function toHalalas(sarString: string | number): number {
  const rate = PAYPAL_ONLY ? SAR_PER_USD : 1 // in the PayPal-only build people type dollars
  if (typeof sarString === 'number') return Math.round(sarString * rate * 100)
  const cleaned = sarString.replace(/sar|usd|\$/gi, '').replace(AR_SUFFIX, '').replace(/[,\s]/g, '').trim()
  if (cleaned === '') return 0
  const n = Number(cleaned)
  if (!Number.isFinite(n)) return NaN
  return Math.round(n * rate * 100)
}

/** Converts halalas into a plain decimal string for input default values, e.g. 150000 -> "1500". */
export function fromHalalas(halalas: number | null | undefined): string {
  const v = PAYPAL_ONLY ? usdOf(halalas) : (halalas ?? 0) / 100
  return Number.isInteger(v) ? String(v) : v.toFixed(2)
}

export function pct(part: number, whole: number): number {
  if (!whole) return 0
  return Math.min(100, Math.max(0, Math.round((part / whole) * 100)))
}
