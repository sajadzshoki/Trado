import Decimal from 'decimal.js'

const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹'
const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩'

Decimal.set({
  precision: 40,
  rounding: Decimal.ROUND_HALF_UP,
})

export { Decimal }

export function normalizeNumericInput(value: string): string {
  let out = value.trim()
  for (let i = 0; i < 10; i += 1) {
    out = out.replaceAll(PERSIAN_DIGITS[i]!, String(i)).replaceAll(ARABIC_DIGITS[i]!, String(i))
  }
  out = out.replace(/[,\s٬،]/g, '').replace(/٫/g, '.')
  if (out.startsWith('+')) out = out.slice(1)
  return out
}

export type DecimalParseResult
  = | { ok: true, value: Decimal }
    | { ok: false, code: 'invalid_number' | 'positive' | 'too_large' }

export function parsePositiveDecimal(input: string): DecimalParseResult {
  const normalized = normalizeNumericInput(input)
  if (!/^\d+(\.\d+)?$/.test(normalized)) return { ok: false, code: 'invalid_number' }
  const value = new Decimal(normalized)
  if (!value.isFinite()) return { ok: false, code: 'invalid_number' }
  if (value.lte(0)) return { ok: false, code: 'positive' }
  if (value.gte('1e26')) return { ok: false, code: 'too_large' }
  return { ok: true, value }
}

export function quoteEntry(quantity: Decimal, unitPriceUsd: Decimal, usdTomanRate: Decimal) {
  const totalUsd = quantity.mul(unitPriceUsd)
  const totalToman = totalUsd.mul(usdTomanRate)
  return {
    quantity: quantity.toFixed(12),
    unitPriceUsd: unitPriceUsd.toFixed(12),
    totalUsd: totalUsd.toFixed(12),
    usdTomanRate: usdTomanRate.toFixed(8),
    totalToman: totalToman.toFixed(4),
  }
}

function localizeDigits(value: string, locale: string) {
  if (!locale.startsWith('fa')) return value
  return value.replace(/\d/g, digit => PERSIAN_DIGITS[Number(digit)] ?? digit)
}

function groupInteger(intPart: string, locale: string) {
  const separator = locale.startsWith('fa') ? '٬' : ','
  return localizeDigits(intPart.replace(/\B(?=(\d{3})+(?!\d))/g, separator), locale)
}

export function trimDecimal(value: string) {
  const fixed = new Decimal(value).toFixed(12)
  if (!fixed.includes('.')) return fixed
  return fixed.replace(/0+$/, '').replace(/\.$/, '')
}

export function formatDecimal(
  value: string | number | Decimal,
  locale: string,
  maximumFractionDigits: number,
  minimumFractionDigits = 0,
) {
  const dec = value instanceof Decimal ? value : new Decimal(value)
  if (!dec.isFinite()) return '—'
  const negative = dec.isNeg()
  const rounded = dec.abs().toDecimalPlaces(maximumFractionDigits, Decimal.ROUND_HALF_UP)
  const fixed = rounded.toFixed(maximumFractionDigits)
  const [intPart = '0', fraction = ''] = fixed.split('.')
  const trimmed = fraction.replace(/0+$/, '')
  const kept = trimmed.length < minimumFractionDigits
    ? fraction.slice(0, minimumFractionDigits)
    : trimmed
  const grouped = groupInteger(intPart, locale)
  const decimalSeparator = locale.startsWith('fa') ? '٫' : '.'
  const body = kept ? `${grouped}${decimalSeparator}${localizeDigits(kept, locale)}` : grouped
  return negative ? `−${body}` : body
}

export function formatUsd(value: string, locale: string, signed = false) {
  const dec = new Decimal(value)
  const abs = dec.abs()
  const digits = abs.gte(1) ? 2 : 8
  const minimum = abs.gte(1) ? 2 : 0
  const body = formatDecimal(abs, locale, digits, minimum)
  const sign = signed ? signPrefix(dec) : ''
  if (locale.startsWith('fa')) return `${sign}${body} دلار`
  return `${sign}$${body}`
}

export function formatToman(value: string, locale: string, signed = false) {
  const dec = new Decimal(value)
  const abs = dec.abs()
  const whole = abs.mod(1).eq(0)
  const digits = whole || abs.gte(100) ? 0 : 2
  const body = formatDecimal(abs, locale, digits, 0)
  const sign = signed ? signPrefix(dec) : ''
  const label = locale.startsWith('fa') ? 'تومان' : 'Toman'
  return `${sign}${body} ${label}`
}

export function formatQuantity(value: string, locale: string) {
  return formatDecimal(value, locale, 8, 0)
}

export function formatRate(value: string, locale: string) {
  const body = formatDecimal(value, locale, 4, 0)
  const label = locale.startsWith('fa') ? 'تومان' : 'Toman'
  return `${body} ${label}`
}

export function signOf(value: string) {
  const dec = new Decimal(value)
  if (dec.gt(0)) return 1
  if (dec.lt(0)) return -1
  return 0
}

function signPrefix(dec: Decimal) {
  if (dec.gt(0)) return '+'
  if (dec.lt(0)) return '−'
  return ''
}

export function formatDateTime(value: string, locale: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat(locale.startsWith('fa') ? 'fa-IR' : 'en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

export function formatDate(value: string, locale: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat(locale.startsWith('fa') ? 'fa-IR' : 'en-US', {
    dateStyle: 'medium',
  }).format(date)
}

export function toDateTimeLocal(date = new Date()) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function fromDateTimeLocal(value: string) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString()
}
