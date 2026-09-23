import type { ActivityRecord, AssetRecord, CapitalRecord, DashboardRecord, HoldingRecord, PriceQuoteRecord, PublicUser, TradeDetail, TradeEntryRecord, TradeSummary } from '../../shared/types/journal'
import { buildPortfolio, quoteUnitToman, valueTrade, type PortfolioAsset } from '../../shared/utils/finance'
import { Decimal } from '../../shared/utils/numbers'
import type { assetQuotes, assets, initialCapital, tradeEntries, trades, users } from '../database/schema'

type UserRow = typeof users.$inferSelect
type AssetRow = typeof assets.$inferSelect
type CapitalRow = typeof initialCapital.$inferSelect
type EntryRow = typeof tradeEntries.$inferSelect
type QuoteRow = typeof assetQuotes.$inferSelect
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

export function presentQuote(row: QuoteRow): PriceQuoteRecord {
  return {
    priceUsd: row.priceUsd,
    usdTomanRate: row.usdTomanRate,
    priceToman: quoteUnitToman(row.priceUsd, row.usdTomanRate),
    source: row.source,
    quotedAt: iso(row.quotedAt),
  }
}

export function presentAsset(asset: AssetRow, tradeCount: number, quote: QuoteRow | null = null): AssetRecord {
  return {
    id: asset.id,
    symbol: asset.symbol,
    name: asset.name,
    icon: asset.iconData,
    isActive: asset.isActive,
    tradeCount,
    externalAssetId: asset.externalAssetId,
    priceProvider: asset.priceProvider,
    quote: quote ? presentQuote(quote) : null,
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

function markFields(valued: ReturnType<typeof valueTrade>) {
  const unrealized = valued.unrealized
  const current = valued.currentValue
  return {
    markAvailable: unrealized.available,
    unrealizedPnlUsd: unrealized.available ? unrealized.usd : null,
    unrealizedPnlToman: unrealized.available ? unrealized.toman : null,
    currentValueUsd: current.available ? current.usd : null,
    currentValueToman: current.available ? current.toman : null,
    totalPnlUsd: unrealized.available ? new Decimal(valued.math.realizedPnlUsd).plus(unrealized.usd).toFixed(8) : null,
    totalPnlToman: unrealized.available ? new Decimal(valued.math.realizedPnlToman).plus(unrealized.toman).toFixed(4) : null,
  }
}

export function presentTrade(
  trade: TradeRow,
  withEntries: boolean,
  quote: { priceUsd: string, usdTomanRate: string } | null = null,
): TradeSummary | TradeDetail {
  const entries = [...trade.entries].sort((a, b) => {
    const delta = new Date(a.transactedAt).getTime() - new Date(b.transactedAt).getTime()
    if (delta !== 0) return delta
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  })
  const valued = valueTrade(entries.map(entry => ({
    side: entry.side,
    quantity: entry.quantity,
    totalUsd: entry.totalUsd,
    totalToman: entry.totalToman,
  })), quote)
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
    ...valued.math,
    status: valued.status,
    hasBuy: entries.some(entry => entry.side === 'buy'),
    hasSell: entries.some(entry => entry.side === 'sell'),
    ...markFields(valued),
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

function presentHolding(holding: ReturnType<typeof buildPortfolio>['holdings'][number]): HoldingRecord {
  return {
    assetId: holding.assetId,
    symbol: holding.symbol,
    name: holding.name,
    icon: holding.icon,
    boughtQuantity: holding.boughtQuantity,
    soldQuantity: holding.soldQuantity,
    currentQuantity: holding.currentQuantity,
    oversold: holding.oversold,
    buyUsd: holding.buyUsd,
    sellUsd: holding.sellUsd,
    buyToman: holding.buyToman,
    sellToman: holding.sellToman,
    averageBuyUsd: holding.averageBuyUsd,
    averageBuyToman: holding.averageBuyToman,
    realizedPnlUsd: holding.realizedPnlUsd,
    realizedPnlToman: holding.realizedPnlToman,
    markAvailable: holding.unrealized.available,
    unrealizedPnlUsd: holding.unrealized.available ? holding.unrealized.usd : null,
    unrealizedPnlToman: holding.unrealized.available ? holding.unrealized.toman : null,
    currentValueUsd: holding.currentValue.available ? holding.currentValue.usd : null,
    currentValueToman: holding.currentValue.available ? holding.currentValue.toman : null,
    totalPnlUsd: holding.unrealized.available ? new Decimal(holding.realizedPnlUsd).plus(holding.unrealized.usd).toFixed(8) : null,
    totalPnlToman: holding.unrealized.available ? new Decimal(holding.realizedPnlToman).plus(holding.unrealized.toman).toFixed(4) : null,
    quote: holding.quote
      ? {
          priceUsd: holding.quote.priceUsd,
          usdTomanRate: holding.quote.usdTomanRate,
          priceToman: quoteUnitToman(holding.quote.priceUsd, holding.quote.usdTomanRate),
          source: holding.quote.source,
          quotedAt: holding.quote.quotedAt,
        }
      : null,
  }
}

function recentActivity(trades: TradeRow[]): ActivityRecord[] {
  return trades
    .flatMap(trade => trade.entries.map(entry => ({
      id: entry.id,
      tradeId: trade.id,
      tradeTitle: trade.title,
      symbol: trade.asset.symbol,
      assetName: trade.asset.name,
      side: entry.side,
      quantity: entry.quantity,
      totalUsd: entry.totalUsd,
      totalToman: entry.totalToman,
      transactedAt: iso(entry.transactedAt),
      createdAt: entry.createdAt,
    })))
    .sort((a, b) => {
      const delta = new Date(b.transactedAt).getTime() - new Date(a.transactedAt).getTime()
      if (delta !== 0) return delta
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })
    .slice(0, 8)
    .map(({ createdAt: _createdAt, ...entry }) => entry)
}

/**
 * Dashboard figures come from recorded trades, stored capital, and stored quotes.
 * This does not call a price provider.
 */
export function presentDashboard(input: {
  capital: CapitalRow | null
  trades: TradeRow[]
  quotes: QuoteRow[]
}): DashboardRecord {
  const quotes = new Map(input.quotes.map(quote => [quote.assetId, quote]))
  const summaries = input.trades
    .slice()
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .map(trade => presentTrade(trade, false, quotes.get(trade.assetId) ?? null) as TradeSummary)

  const assets = new Map<string, PortfolioAsset>()
  for (const trade of input.trades) {
    if (assets.has(trade.assetId)) continue
    assets.set(trade.assetId, {
      id: trade.asset.id,
      symbol: trade.asset.symbol,
      name: trade.asset.name,
      icon: trade.asset.iconData,
    })
  }

  const figures = buildPortfolio({
    capital: input.capital
      ? { amountUsd: input.capital.amountUsd, amountToman: input.capital.amountToman }
      : null,
    assets: [...assets.values()],
    trades: input.trades.map(trade => ({
      assetId: trade.assetId,
      entries: trade.entries.map(entry => ({
        side: entry.side,
        quantity: entry.quantity,
        totalUsd: entry.totalUsd,
        totalToman: entry.totalToman,
      })),
    })),
    quotes: input.quotes.map(quote => ({
      assetId: quote.assetId,
      priceUsd: quote.priceUsd,
      usdTomanRate: quote.usdTomanRate,
      source: quote.source,
      quotedAt: iso(quote.quotedAt),
    })),
  })

  return {
    initialCapital: input.capital ? presentCapital(input.capital) : null,
    realizedPnlUsd: figures.realized.usd,
    realizedPnlToman: figures.realized.toman,
    totalBoughtUsd: figures.bought.usd,
    totalBoughtToman: figures.bought.toman,
    totalSoldUsd: figures.sold.usd,
    totalSoldToman: figures.sold.toman,
    cash: figures.cash,
    assetValue: figures.assetValue,
    portfolio: figures.portfolio,
    unrealized: figures.unrealized,
    totalPnl: figures.totalPnl,
    performance: figures.performance,
    allocation: figures.allocation,
    holdings: figures.holdings.map(presentHolding),
    openTrades: summaries.filter(trade => trade.status === 'open'),
    recentTrades: summaries.slice(0, 6),
    recentActivity: recentActivity(input.trades),
    tradeCount: summaries.length,
    oversoldCount: figures.oversoldCount,
  }
}
