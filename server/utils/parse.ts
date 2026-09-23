import type { TradeSide } from '../../shared/constants'
import { EXTERNAL_ASSET_ID_PATTERN, ICON_MIME_TYPES, MAX_ICON_BYTES } from '../../shared/constants'
import { resolveEntryAmounts, transactionDateIssue, type AmountField } from '../../shared/utils/numbers'
import { normalizePhone } from '../../shared/utils/phone'
import { apiError } from './http'

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

export function parseExternalAssetId(value: string | null | undefined) {
  if (value == null) return null
  const trimmed = value.trim()
  if (!trimmed) return null
  if (!EXTERNAL_ASSET_ID_PATTERN.test(trimmed)) {
    apiError(422, 'validation_error', { fields: { externalAssetId: 'external_id' } })
  }
  return trimmed
}

export function requireName(input: string, field = 'name', max = 64) {
  const name = input.trim()
  if (!name) apiError(422, 'validation_error', { fields: { [field]: 'required' } })
  if (name.length > max) apiError(422, 'validation_error', { fields: { [field]: 'too_long' } })
  return name
}

export function parseTransactionDate(input: string) {
  const issue = transactionDateIssue(input)
  if (issue) apiError(422, 'validation_error', { fields: { transactedAt: issue } })
  return new Date(input)
}

function imageSignature(bytes: Buffer, mime: string) {
  if (mime === 'image/png') return bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  if (mime === 'image/jpeg') return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
  if (mime === 'image/webp') {
    return bytes.subarray(0, 4).toString('ascii') === 'RIFF' && bytes.subarray(8, 12).toString('ascii') === 'WEBP'
  }
  return false
}

export function parseIcon(value: string | null | undefined) {
  if (value == null || value.trim() === '') return null
  const match = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(value.trim())
  if (!match || !ICON_MIME_TYPES.includes(match[1] as typeof ICON_MIME_TYPES[number])) {
    apiError(422, 'validation_error', { fields: { icon: 'invalid_icon' } })
  }
  const bytes = Buffer.from(match[2], 'base64')
  if (bytes.length < 16 || bytes.length > MAX_ICON_BYTES || !imageSignature(bytes, match[1]!)) {
    apiError(422, 'validation_error', { fields: { icon: bytes.length > MAX_ICON_BYTES ? 'icon_too_large' : 'invalid_icon' } })
  }
  return `data:${match[1]};base64,${match[2]}`
}

export function parseEntry(input: {
  side: TradeSide
  quantity?: string | null
  unitPriceUsd?: string | null
  totalUsd?: string | null
  solveFor?: AmountField
  usdTomanRate: string
  transactedAt: string
  note?: string | null
}): ParsedEntry {
  const amounts = resolveEntryAmounts(input)
  if (!amounts.ok) apiError(422, 'validation_error', { fields: { [amounts.field]: amounts.code } })
  return {
    side: input.side,
    quantity: amounts.value.quantity,
    unitPriceUsd: amounts.value.unitPriceUsd,
    totalUsd: amounts.value.totalUsd,
    usdTomanRate: amounts.value.usdTomanRate,
    totalToman: amounts.value.totalToman,
    transactedAt: parseTransactionDate(input.transactedAt),
    note: optionalText(input.note, 500, 'note'),
  }
}
