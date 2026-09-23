import type { TradeSide } from '../../shared/constants'
import { parsePositiveDecimal, quoteEntry } from '../../shared/utils/numbers'
import { normalizePhone } from '../../shared/utils/phone'
import { apiError } from './http'

const MIN_DATE = new Date('2000-01-01T00:00:00.000Z')
const FUTURE_SKEW_MS = 15 * 60 * 1000

export interface ParsedEntry {
  side: TradeSide
  quantity: string
  unitPriceUsd: string
  totalUsd: string
  usdTomanRate: string
  totalToman: string
  transactedAt: Date
  note: string | null
}

export function requirePhone(input: string) {
  const phone = normalizePhone(input)
  if (!phone) apiError(422, 'validation_error', { fields: { phone: 'invalid_phone' } })
  return phone
}

export function optionalText(value: string | null | undefined, max: number, field: string) {
  if (value == null) return null
  const trimmed = value.trim()
  if (!trimmed) return null
  if (trimmed.length > max) apiError(422, 'validation_error', { fields: { [field]: 'too_long' } })
  return trimmed
}

export function requireSymbol(input: string) {
  const symbol = input.trim().toUpperCase()
  if (!/^[A-Z0-9]{1,12}$/.test(symbol)) {
    apiError(422, 'validation_error', { fields: { symbol: 'symbol' } })
  }
  return symbol
}

export function requireName(input: string, field = 'name', max = 64) {
  const name = input.trim()
  if (!name) apiError(422, 'validation_error', { fields: { [field]: 'required' } })
  if (name.length > max) apiError(422, 'validation_error', { fields: { [field]: 'too_long' } })
  return name
}

function requireMoney(input: string, field: string) {
  const parsed = parsePositiveDecimal(input)
  if (!parsed.ok) apiError(422, 'validation_error', { fields: { [field]: parsed.code } })
  return parsed.value
}

export function parseTransactionDate(input: string) {
  const date = new Date(input)
  if (Number.isNaN(date.getTime())) {
    apiError(422, 'validation_error', { fields: { transactedAt: 'invalid_date' } })
  }
  if (date < MIN_DATE) apiError(422, 'validation_error', { fields: { transactedAt: 'date_past' } })
  if (date.getTime() > Date.now() + FUTURE_SKEW_MS) {
    apiError(422, 'validation_error', { fields: { transactedAt: 'date_future' } })
  }
  return date
}

export function parseEntry(input: {
  side: TradeSide
  quantity: string
  unitPriceUsd: string
  usdTomanRate: string
  transactedAt: string
  note?: string | null
}): ParsedEntry {
  const quantity = requireMoney(input.quantity, 'quantity')
  const unitPriceUsd = requireMoney(input.unitPriceUsd, 'unitPriceUsd')
  const usdTomanRate = requireMoney(input.usdTomanRate, 'usdTomanRate')
  const quoted = quoteEntry(quantity, unitPriceUsd, usdTomanRate)
  return {
    side: input.side,
    ...quoted,
    transactedAt: parseTransactionDate(input.transactedAt),
    note: optionalText(input.note, 500, 'note'),
  }
}
