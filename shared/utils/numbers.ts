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

export const AMOUNT_FIELDS = ['quantity', 'unitPriceUsd', 'totalUsd'] as const
export type AmountField = (typeof AMOUNT_FIELDS)[number]

const MIN_TRANSACTION_MS = Date.parse('2000-01-01T00:00:00.000Z')
const FUTURE_SKEW_MS = 15 * 60 * 1000

export function transactionDateIssue(input: string, now = Date.now()) {
  const date = new Date(input)
  if (Number.isNaN(date.getTime())) return 'invalid_date' as const
  if (date.getTime() < MIN_TRANSACTION_MS) return 'date_past' as const
  if (date.getTime() > now + FUTURE_SKEW_MS) return 'date_future' as const
  return null
}

/** The missing leg of quantity × unit price = total. Decimal, never binary float. */
export function solveAmount(left: AmountField, leftValue: Decimal, right: AmountField, rightValue: Decimal) {
  const known: Partial<Record<AmountField, Decimal>> = {
    [left]: leftValue,
    [right]: rightValue,
  }
  if (!known.totalUsd) return known.quantity!.mul(known.unitPriceUsd!)
  if (!known.unitPriceUsd) return known.totalUsd.div(known.quantity!)
  return known.totalUsd.div(known.unitPriceUsd!)
}

export function formatInputDecimal(value: Decimal, locale = 'en') {
  const trimmed = trimDecimal(value.toFixed(12))
  return locale.startsWith('fa') ? localizeDigits(trimmed, 'fa') : trimmed
}

export interface ResolvedAmounts {
  quantity: string
  unitPriceUsd: string
  totalUsd: string
  usdTomanRate: string
  totalToman: string
  solved: AmountField
}

/**
 * Two source fields are trusted. The third is computed here and any client
 * value for that field is ignored. Omitting solveFor keeps the older
 * quantity × unit price → total behavior.
 */
export function resolveEntryAmounts(input: {
  quantity?: string | null
  unitPriceUsd?: string | null
  totalUsd?: string | null
  solveFor?: AmountField
  usdTomanRate: string
}): { ok: true, value: ResolvedAmounts } | { ok: false, field: string, code: 'invalid_number' | 'positive' | 'too_large' } {
  const solved = input.solveFor ?? 'totalUsd'
  const raw: Record<AmountField, string> = {
    quantity: input.quantity?.trim() ?? '',
    unitPriceUsd: input.unitPriceUsd?.trim() ?? '',
    totalUsd: input.totalUsd?.trim() ?? '',
  }
  const parsedAll = {
    quantity: parsePositiveDecimal(raw.quantity),
    unitPriceUsd: parsePositiveDecimal(raw.unitPriceUsd),
    totalUsd: parsePositiveDecimal(raw.totalUsd),
  }
  if (parsedAll.quantity.ok && parsedAll.unitPriceUsd.ok && parsedAll.totalUsd.ok) {
    const quantity = parsedAll.quantity.value
    const unitPriceUsd = parsedAll.unitPriceUsd.value
    const totalUsd = parsedAll.totalUsd.value
    const matches = quantity.mul(unitPriceUsd).toFixed(12) === totalUsd.toFixed(12)
      || totalUsd.div(quantity).toFixed(12) === unitPriceUsd.toFixed(12)
      || totalUsd.div(unitPriceUsd).toFixed(12) === quantity.toFixed(12)
    if (matches) {
      const rate = parsePositiveDecimal(input.usdTomanRate)
      if (!rate.ok) return { ok: false, field: 'usdTomanRate', code: rate.code }
      const stored = {
        quantity: quantity.toFixed(12),
        unitPriceUsd: unitPriceUsd.toFixed(12),
        totalUsd: totalUsd.toFixed(12),
        usdTomanRate: rate.value.toFixed(8),
        totalToman: totalUsd.mul(rate.value).toFixed(4),
      }
      if (new Decimal(stored.totalToman).lte(0)) return { ok: false, field: 'usdTomanRate', code: 'positive' }
      return { ok: true, value: { ...stored, solved } }
    }
  }
  const known: Partial<Record<AmountField, Decimal>> = {}
  for (const field of AMOUNT_FIELDS) {
    if (field === solved) continue
    const parsed = parsePositiveDecimal(raw[field])
    if (!parsed.ok) return { ok: false, field, code: parsed.code }
    known[field] = parsed.value
  }
  const sources = AMOUNT_FIELDS.filter(field => field !== solved)
  const computed = solveAmount(sources[0]!, known[sources[0]!]!, sources[1]!, known[sources[1]!]!)
  if (!computed.isFinite() || computed.lte(0)) return { ok: false, field: solved, code: 'positive' }
  if (computed.gte('1e26')) return { ok: false, field: solved, code: 'too_large' }

  const quantity = solved === 'quantity' ? computed : known.quantity!
  const unitPriceUsd = solved === 'unitPriceUsd' ? computed : known.unitPriceUsd!
  const totalUsd = solved === 'totalUsd' ? computed : known.totalUsd!
  const rate = parsePositiveDecimal(input.usdTomanRate)
  if (!rate.ok) return { ok: false, field: 'usdTomanRate', code: rate.code }

  const totalToman = totalUsd.mul(rate.value)
  const stored = {
    quantity: quantity.toFixed(12),
    unitPriceUsd: unitPriceUsd.toFixed(12),
    totalUsd: totalUsd.toFixed(12),
    usdTomanRate: rate.value.toFixed(8),
    totalToman: totalToman.toFixed(4),
  }
  if (new Decimal(stored.quantity).lte(0) || new Decimal(stored.unitPriceUsd).lte(0) || new Decimal(stored.totalUsd).lte(0) || new Decimal(stored.totalToman).lte(0)) {
    return { ok: false, field: solved, code: 'positive' }
  }
  return { ok: true, value: { ...stored, solved } }
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
