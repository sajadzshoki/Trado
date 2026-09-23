import type { TradeSummary } from '../types/journal'
import { Decimal } from './numbers'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export interface TradeListFilters {
  asset?: string
  side?: string
  status?: string
  from?: string
  to?: string
  search?: string
  sort?: string
  /** Minutes returned by `Date.getTimezoneOffset()` in the viewer's timezone. */
  tzOffsetMinutes?: number
}

export function calendarDay(iso: string, tzOffsetMinutes = 0) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const shifted = new Date(date.getTime() - tzOffsetMinutes * 60_000)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}`
}

function assetMatches(trade: TradeSummary, asset: string) {
  if (UUID_RE.test(asset)) return trade.asset.id === asset
  return trade.asset.symbol.toLowerCase() === asset.toLowerCase()
}

function when(trade: TradeSummary) {
  return new Date(trade.lastTransactedAt ?? trade.updatedAt).getTime()
}

function pnl(trade: TradeSummary) {
  return new Decimal(trade.totalPnlUsd ?? trade.realizedPnlUsd)
}

/**
 * Same rules as the Trades page. A side filter keeps trades that contain that
 * side; it does not drop the trade's other entries. Dates use the viewer's
 * calendar day, not the server's.
 */
export function filterTrades<T extends TradeSummary>(trades: T[], filters: TradeListFilters): T[] {
  const asset = filters.asset?.trim() ?? ''
  const side = (filters.side ?? '').trim().toLowerCase()
  const status = (filters.status ?? '').trim().toLowerCase()
  const from = filters.from?.trim() ?? ''
  const to = filters.to?.trim() ?? ''
  const needle = (filters.search ?? '').trim().toLowerCase()
  const sort = (filters.sort ?? 'newest').trim().toLowerCase()
  const tz = Number.isFinite(filters.tzOffsetMinutes) ? Number(filters.tzOffsetMinutes) : 0

  const rows = trades.filter((trade) => {
    if (asset && !assetMatches(trade, asset)) return false
    if (side === 'buy' && !trade.hasBuy) return false
    if (side === 'sell' && !trade.hasSell) return false
    if (status === 'open' && trade.status !== 'open') return false
    if (status === 'closed' && trade.status !== 'closed') return false
    const day = trade.lastTransactedAt ? calendarDay(trade.lastTransactedAt, tz) : ''
    if ((from || to) && !day) return false
    if (from && day < from) return false
    if (to && day > to) return false
    if (!needle) return true
    const title = (trade.title ?? '').toLowerCase()
    return trade.asset.symbol.toLowerCase().includes(needle) || title.includes(needle)
  })

  const copy = rows.slice()
  if (sort === 'oldest') copy.sort((a, b) => when(a) - when(b))
  else if (sort === 'highest') copy.sort((a, b) => pnl(b).comparedTo(pnl(a)))
  else if (sort === 'lowest') copy.sort((a, b) => pnl(a).comparedTo(pnl(b)))
  else copy.sort((a, b) => when(b) - when(a))
  return copy
}
