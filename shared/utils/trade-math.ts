import Decimal from 'decimal.js'
import type { TradeSide } from '../constants'

export interface MathEntry {
  side: TradeSide
  quantity: string
  totalUsd: string
  totalToman: string
}

export type TradeStatus = 'open' | 'closed' | 'empty'

export interface PositionEntry {
  id: string
  side: TradeSide
  quantity: string
}

export type PositionChange
  = | { op: 'add', side: TradeSide, quantity: string }
    | { op: 'replace', id: string, side: TradeSide, quantity: string }
    | { op: 'remove', id: string }

/**
 * Net quantity is total buy quantity minus total sell quantity.
 * Open means some quantity remains. Closed means the net is exactly zero
 * and the trade has entries. This does not match individual lots.
 */
export function tradeStatus(entryCount: number, buyQuantity: string, sellQuantity: string): TradeStatus {
  if (entryCount === 0) return 'empty'
  const net = new Decimal(buyQuantity).minus(sellQuantity)
  if (net.gt(0)) return 'open'
  if (net.eq(0)) return 'closed'
  return 'open'
}

export function positionAfter(entries: PositionEntry[], change: PositionChange) {
  let buy = ZERO
  let sell = ZERO
  for (const entry of entries) {
    if (change.op !== 'add' && entry.id === change.id) continue
    const quantity = new Decimal(entry.quantity)
    if (entry.side === 'buy') buy = buy.plus(quantity)
    else sell = sell.plus(quantity)
  }
  if (change.op !== 'remove') {
    const quantity = new Decimal(change.quantity)
    if (change.side === 'buy') buy = buy.plus(quantity)
    else sell = sell.plus(quantity)
  }
  return {
    buy,
    sell,
    net: buy.minus(sell),
    exceeded: sell.gt(buy),
  }
}

export interface TradeMath {
  buyQuantity: string
  sellQuantity: string
  remainingQuantity: string
  unmatchedSellQuantity: string
  buyUsd: string
  sellUsd: string
  buyToman: string
  sellToman: string
  averageBuyUsd: string | null
  averageSellUsd: string | null
  averageBuyToman: string | null
  averageSellToman: string | null
  realizedPnlUsd: string
  realizedPnlToman: string
  openCostUsd: string
  openCostToman: string
  isEmpty: boolean
  isFlat: boolean
  isOversold: boolean
}

const ZERO = new Decimal(0)

function sum(entries: MathEntry[], side: TradeSide, field: 'quantity' | 'totalUsd' | 'totalToman') {
  return entries
    .filter(entry => entry.side === side)
    .reduce((total, entry) => total.plus(entry[field]), ZERO)
}

function fixed(value: Decimal, scale: number) {
  return value.toFixed(scale)
}

function average(total: Decimal, quantity: Decimal) {
  if (quantity.lte(0)) return null
  return total.div(quantity)
}

/**
 * Average-cost result inside one user-defined trade.
 * This does not match lots across trades, and it is not FIFO or LIFO.
 * Realized P/L covers only the overlapping quantity (min of buy and sell).
 */
export function summarizeEntries(entries: MathEntry[]): TradeMath {
  const buyQuantity = sum(entries, 'buy', 'quantity')
  const sellQuantity = sum(entries, 'sell', 'quantity')
  const buyUsd = sum(entries, 'buy', 'totalUsd')
  const sellUsd = sum(entries, 'sell', 'totalUsd')
  const buyToman = sum(entries, 'buy', 'totalToman')
  const sellToman = sum(entries, 'sell', 'totalToman')

  const matched = Decimal.min(buyQuantity, sellQuantity)
  const remaining = Decimal.max(buyQuantity.minus(sellQuantity), ZERO)
  const unmatchedSell = Decimal.max(sellQuantity.minus(buyQuantity), ZERO)

  const averageBuyUsd = average(buyUsd, buyQuantity)
  const averageSellUsd = average(sellUsd, sellQuantity)
  const averageBuyToman = average(buyToman, buyQuantity)
  const averageSellToman = average(sellToman, sellQuantity)

  const realizedUsd = averageBuyUsd && averageSellUsd
    ? matched.mul(averageSellUsd.minus(averageBuyUsd))
    : ZERO
  const realizedToman = averageBuyToman && averageSellToman
    ? matched.mul(averageSellToman.minus(averageBuyToman))
    : ZERO

  const openCostUsd = averageBuyUsd ? remaining.mul(averageBuyUsd) : ZERO
  const openCostToman = averageBuyToman ? remaining.mul(averageBuyToman) : ZERO

  return {
    buyQuantity: fixed(buyQuantity, 12),
    sellQuantity: fixed(sellQuantity, 12),
    remainingQuantity: fixed(remaining, 12),
    unmatchedSellQuantity: fixed(unmatchedSell, 12),
    buyUsd: fixed(buyUsd, 12),
    sellUsd: fixed(sellUsd, 12),
    buyToman: fixed(buyToman, 4),
    sellToman: fixed(sellToman, 4),
    averageBuyUsd: averageBuyUsd ? fixed(averageBuyUsd, 12) : null,
    averageSellUsd: averageSellUsd ? fixed(averageSellUsd, 12) : null,
    averageBuyToman: averageBuyToman ? fixed(averageBuyToman, 4) : null,
    averageSellToman: averageSellToman ? fixed(averageSellToman, 4) : null,
    realizedPnlUsd: fixed(realizedUsd, 8),
    realizedPnlToman: fixed(realizedToman, 4),
    openCostUsd: fixed(openCostUsd, 8),
    openCostToman: fixed(openCostToman, 4),
    isEmpty: entries.length === 0,
    isFlat: buyQuantity.gt(0) && remaining.eq(0) && unmatchedSell.eq(0),
    isOversold: unmatchedSell.gt(0),
  }
}
