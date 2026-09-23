import type { AssetRecord, CapitalRecord, DashboardRecord, OpenPosition, PublicUser, TradeDetail, TradeEntryRecord, TradeSummary } from '../../shared/types/journal'
import { summarizeEntries } from '../../shared/utils/trade-math'
import type { assets, initialCapital, tradeEntries, trades, users } from '../database/schema'
import { Decimal } from '../../shared/utils/numbers'

type UserRow = typeof users.$inferSelect
type AssetRow = typeof assets.$inferSelect
type CapitalRow = typeof initialCapital.$inferSelect
type EntryRow = typeof tradeEntries.$inferSelect
type TradeRow = typeof trades.$inferSelect & {
  asset: AssetRow
  entries: EntryRow[]
}

function iso(value: Date | string) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString()
}

export function presentUser(user: UserRow): PublicUser {
  return {
    id: user.id,
    phone: user.phone,
    displayName: user.displayName,
    locale: user.locale,
    displayCurrency: user.displayCurrency,
  }
}

export function presentAsset(asset: AssetRow, tradeCount: number): AssetRecord {
  return {
    id: asset.id,
    symbol: asset.symbol,
    name: asset.name,
    tradeCount,
    createdAt: iso(asset.createdAt),
  }
}

export function presentCapital(row: CapitalRow): CapitalRecord {
  return {
    amountUsd: row.amountUsd,
    usdTomanRate: row.usdTomanRate,
    amountToman: row.amountToman,
    recordedAt: iso(row.recordedAt),
  }
}

export function presentEntry(entry: EntryRow): TradeEntryRecord {
  return {
    id: entry.id,
    side: entry.side,
    quantity: entry.quantity,
    unitPriceUsd: entry.unitPriceUsd,
    totalUsd: entry.totalUsd,
    usdTomanRate: entry.usdTomanRate,
    totalToman: entry.totalToman,
    transactedAt: iso(entry.transactedAt),
    note: entry.note,
  }
}

export function presentTrade(trade: TradeRow, withEntries: boolean): TradeSummary | TradeDetail {
  const entries = [...trade.entries].sort((a, b) => {
    const delta = new Date(a.transactedAt).getTime() - new Date(b.transactedAt).getTime()
    if (delta !== 0) return delta
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  })
  const math = summarizeEntries(entries.map(entry => ({
    side: entry.side,
    quantity: entry.quantity,
    totalUsd: entry.totalUsd,
    totalToman: entry.totalToman,
  })))
  const last = entries.at(-1)
  const summary: TradeSummary = {
    id: trade.id,
    title: trade.title,
    notes: trade.notes,
    asset: {
      id: trade.asset.id,
      symbol: trade.asset.symbol,
      name: trade.asset.name,
    },
    entryCount: entries.length,
    ...math,
    createdAt: iso(trade.createdAt),
    updatedAt: iso(trade.updatedAt),
    lastTransactedAt: last ? iso(last.transactedAt) : null,
  }
  if (!withEntries) return summary
  return {
    ...summary,
    entries: entries.map(presentEntry),
  }
}

export function presentDashboard(input: {
  capital: CapitalRow | null
  trades: TradeRow[]
}): DashboardRecord {
  const summaries = input.trades
    .slice()
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .map(trade => presentTrade(trade, false) as TradeSummary)

  const positions = new Map<string, OpenPosition & { qty: Decimal, usd: Decimal, toman: Decimal }>()
  let boughtUsd = new Decimal(0)
  let boughtToman = new Decimal(0)
  let soldUsd = new Decimal(0)
  let soldToman = new Decimal(0)
  let realizedUsd = new Decimal(0)
  let realizedToman = new Decimal(0)
  let openUsd = new Decimal(0)
  let openToman = new Decimal(0)
  let oversoldCount = 0

  for (const trade of summaries) {
    boughtUsd = boughtUsd.plus(trade.buyUsd)
    boughtToman = boughtToman.plus(trade.buyToman)
    soldUsd = soldUsd.plus(trade.sellUsd)
    soldToman = soldToman.plus(trade.sellToman)
    realizedUsd = realizedUsd.plus(trade.realizedPnlUsd)
    realizedToman = realizedToman.plus(trade.realizedPnlToman)
    openUsd = openUsd.plus(trade.openCostUsd)
    openToman = openToman.plus(trade.openCostToman)
    if (trade.isOversold) oversoldCount += 1
    if (new Decimal(trade.remainingQuantity).lte(0)) continue
    const current = positions.get(trade.asset.id) ?? {
      assetId: trade.asset.id,
      symbol: trade.asset.symbol,
      name: trade.asset.name,
      remainingQuantity: '0',
      openCostUsd: '0',
      openCostToman: '0',
      qty: new Decimal(0),
      usd: new Decimal(0),
      toman: new Decimal(0),
    }
    current.qty = current.qty.plus(trade.remainingQuantity)
    current.usd = current.usd.plus(trade.openCostUsd)
    current.toman = current.toman.plus(trade.openCostToman)
    positions.set(trade.asset.id, current)
  }

  const openPositions = [...positions.values()]
    .sort((a, b) => a.symbol.localeCompare(b.symbol))
    .map(position => ({
      assetId: position.assetId,
      symbol: position.symbol,
      name: position.name,
      remainingQuantity: position.qty.toFixed(12),
      openCostUsd: position.usd.toFixed(8),
      openCostToman: position.toman.toFixed(4),
    }))

  return {
    initialCapital: input.capital ? presentCapital(input.capital) : null,
    realizedPnlUsd: realizedUsd.toFixed(8),
    realizedPnlToman: realizedToman.toFixed(4),
    totalBoughtUsd: boughtUsd.toFixed(12),
    totalBoughtToman: boughtToman.toFixed(4),
    totalSoldUsd: soldUsd.toFixed(12),
    totalSoldToman: soldToman.toFixed(4),
    netCashFlowUsd: soldUsd.minus(boughtUsd).toFixed(8),
    netCashFlowToman: soldToman.minus(boughtToman).toFixed(4),
    openCostUsd: openUsd.toFixed(8),
    openCostToman: openToman.toFixed(4),
    tradeCount: summaries.length,
    oversoldCount,
    openPositions,
    recentTrades: summaries.slice(0, 6),
    performance: {
      available: false,
      reason: 'live_prices_not_tracked',
    },
  }
}
