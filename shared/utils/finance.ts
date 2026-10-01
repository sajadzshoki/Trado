import Decimal from 'decimal.js'
import type { MathEntry, TradeMath, TradeStatus } from './trade-math'
import { summarizeEntries, tradeStatus } from './trade-math'

export type GapReason = 'capital_not_set' | 'prices_missing'

export type Figure
  = | { available: true, usd: string, toman: string }
    | { available: false, reason: GapReason }

export interface MarkQuote {
  priceUsd: string
  usdTomanRate: string
}

export interface TradeValuation {
  math: TradeMath
  status: TradeStatus
  unrealized: Figure
  currentValue: Figure
}

function money(usd: Decimal, toman: Decimal): Figure {
  return { available: true, usd: usd.toFixed(8), toman: toman.toFixed(4) }
}

function missing(reason: GapReason): Figure {
  return { available: false, reason }
}

/**
 * Values one trade from its own entries.
 * Realized P/L is average cost on the overlapping quantity only.
 * Unrealized P/L is remaining quantity × current price, minus that same average cost.
 * A missing price is not treated as zero.
 */
export function valueTrade(entries: MathEntry[], quote: MarkQuote | null): TradeValuation {
  const math = summarizeEntries(entries)
  const status = tradeStatus(entries.length, math.buyQuantity, math.sellQuantity)
  const remaining = new Decimal(math.remainingQuantity)
  if (remaining.lte(0)) {
    const zero = money(new Decimal(0), new Decimal(0))
    return { math, status, unrealized: zero, currentValue: zero }
  }
  if (!quote || !math.openCostUsd) {
    const gap = missing('prices_missing')
    return { math, status, unrealized: gap, currentValue: gap }
  }
  const price = new Decimal(quote.priceUsd)
  const rate = new Decimal(quote.usdTomanRate)
  const valueUsd = remaining.mul(price)
  const valueToman = valueUsd.mul(rate)
  return {
    math,
    status,
    unrealized: money(valueUsd.minus(math.openCostUsd), valueToman.minus(math.openCostToman)),
    currentValue: money(valueUsd, valueToman),
  }
}

export function quoteUnitToman(priceUsd: string, usdTomanRate: string) {
  return new Decimal(priceUsd).mul(usdTomanRate).toFixed(4)
}

export interface PortfolioTrade {
  assetId: string
  entries: MathEntry[]
}

export interface PortfolioAsset {
  id: string
  symbol: string
  name: string
  icon: string | null
}

export interface PortfolioQuote extends MarkQuote {
  assetId: string
  source: string
  quotedAt: string
}

export interface HoldingFigures {
  assetId: string
  symbol: string
  name: string
  icon: string | null
  boughtQuantity: string
  soldQuantity: string
  currentQuantity: string
  oversold: boolean
  buyUsd: string
  sellUsd: string
  buyToman: string
  sellToman: string
  averageBuyUsd: string | null
  averageBuyToman: string | null
  realizedPnlUsd: string
  realizedPnlToman: string
  unrealized: Figure
  currentValue: Figure
  quote: PortfolioQuote | null
}

export interface Allocation {
  cashPercent: string
  assetPercent: string
}

export interface PortfolioFigures {
  realized: { usd: string, toman: string }
  bought: { usd: string, toman: string }
  sold: { usd: string, toman: string }
  unrealized: Figure
  cash: Figure
  assetValue: Figure
  portfolio: Figure
  totalPnl: Figure
  performance: { available: true, percent: string } | { available: false, reason: GapReason }
  allocation: Allocation | null
  holdings: HoldingFigures[]
  oversoldCount: number
}

function average(total: Decimal, quantity: Decimal) {
  if (quantity.lte(0)) return null
  return total.div(quantity)
}

/**
 * Portfolio figures from recorded trades, stored capital, and stored quotes.
 * Cash uses only historical amounts. A new quote rate does not rewrite entries.
 * Unrealized P/L is the sum of each trade's own result, not a blended cost across trades.
 */
export function buildPortfolio(input: {
  capital: { amountUsd: string, amountToman: string } | null
  assets: PortfolioAsset[]
  trades: PortfolioTrade[]
  quotes: PortfolioQuote[]
}): PortfolioFigures {
  const quotes = new Map(input.quotes.map(quote => [quote.assetId, quote]))
  const assets = new Map(input.assets.map(asset => [asset.id, asset]))
  const grouped = new Map<string, PortfolioTrade[]>()
  for (const trade of input.trades) {
    const rows = grouped.get(trade.assetId) ?? []
    rows.push(trade)
    grouped.set(trade.assetId, rows)
  }

  let realizedUsd = new Decimal(0)
  let realizedToman = new Decimal(0)
  let boughtUsd = new Decimal(0)
  let boughtToman = new Decimal(0)
  let soldUsd = new Decimal(0)
  let soldToman = new Decimal(0)
  let unrealizedUsd = new Decimal(0)
  let unrealizedToman = new Decimal(0)
  let assetUsd = new Decimal(0)
  let assetToman = new Decimal(0)
  let missingPrice = false
  let oversoldCount = 0

  const holdings: HoldingFigures[] = []
  for (const [assetId, trades] of grouped) {
    const asset = assets.get(assetId)
    const quote = quotes.get(assetId) ?? null
    let buyQty = new Decimal(0)
    let sellQty = new Decimal(0)
    let buyUsd = new Decimal(0)
    let sellUsd = new Decimal(0)
    let buyToman = new Decimal(0)
    let sellToman = new Decimal(0)
    let realizedAssetUsd = new Decimal(0)
    let realizedAssetToman = new Decimal(0)
    let unrealizedAssetUsd = new Decimal(0)
    let unrealizedAssetToman = new Decimal(0)
    let valueUsd = new Decimal(0)
    let valueToman = new Decimal(0)
    let holdingGap = false
    let oversold = false

    for (const trade of trades) {
      const valued = valueTrade(trade.entries, quote)
      const math = valued.math
      buyQty = buyQty.plus(math.buyQuantity)
      sellQty = sellQty.plus(math.sellQuantity)
      buyUsd = buyUsd.plus(math.buyUsd)
      sellUsd = sellUsd.plus(math.sellUsd)
      buyToman = buyToman.plus(math.buyToman)
      sellToman = sellToman.plus(math.sellToman)
      realizedAssetUsd = realizedAssetUsd.plus(math.realizedPnlUsd)
      realizedAssetToman = realizedAssetToman.plus(math.realizedPnlToman)
      if (math.isOversold) {
        oversold = true
        oversoldCount += 1
      }
      if (!valued.unrealized.available) {
        holdingGap = true
        missingPrice = true
        continue
      }
      unrealizedAssetUsd = unrealizedAssetUsd.plus(valued.unrealized.usd)
      unrealizedAssetToman = unrealizedAssetToman.plus(valued.unrealized.toman)
      if (valued.currentValue.available) {
        valueUsd = valueUsd.plus(valued.currentValue.usd)
        valueToman = valueToman.plus(valued.currentValue.toman)
      }
    }

    realizedUsd = realizedUsd.plus(realizedAssetUsd)
    realizedToman = realizedToman.plus(realizedAssetToman)
    boughtUsd = boughtUsd.plus(buyUsd)
    boughtToman = boughtToman.plus(buyToman)
    soldUsd = soldUsd.plus(sellUsd)
    soldToman = soldToman.plus(sellToman)
    if (!holdingGap) {
      unrealizedUsd = unrealizedUsd.plus(unrealizedAssetUsd)
      unrealizedToman = unrealizedToman.plus(unrealizedAssetToman)
      assetUsd = assetUsd.plus(valueUsd)
      assetToman = assetToman.plus(valueToman)
    }

    const avgUsd = average(buyUsd, buyQty)
    const avgToman = average(buyToman, buyQty)
    holdings.push({
      assetId,
      symbol: asset?.symbol ?? '',
      name: asset?.name ?? '',
      icon: asset?.icon ?? null,
      boughtQuantity: buyQty.toFixed(12),
      soldQuantity: sellQty.toFixed(12),
      currentQuantity: buyQty.minus(sellQty).toFixed(12),
      oversold,
      buyUsd: buyUsd.toFixed(12),
      sellUsd: sellUsd.toFixed(12),
      buyToman: buyToman.toFixed(4),
      sellToman: sellToman.toFixed(4),
      averageBuyUsd: avgUsd ? avgUsd.toFixed(12) : null,
      averageBuyToman: avgToman ? avgToman.toFixed(4) : null,
      realizedPnlUsd: realizedAssetUsd.toFixed(8),
      realizedPnlToman: realizedAssetToman.toFixed(4),
      unrealized: holdingGap ? missing('prices_missing') : money(unrealizedAssetUsd, unrealizedAssetToman),
      currentValue: holdingGap ? missing('prices_missing') : money(valueUsd, valueToman),
      quote,
    })
  }

  holdings.sort((a, b) => a.symbol.localeCompare(b.symbol))

  const unrealized = missingPrice ? missing('prices_missing') : money(unrealizedUsd, unrealizedToman)
  const assetValue = missingPrice ? missing('prices_missing') : money(assetUsd, assetToman)
  const cash = input.capital
    ? money(
        new Decimal(input.capital.amountUsd).plus(soldUsd).minus(boughtUsd),
        new Decimal(input.capital.amountToman).plus(soldToman).minus(boughtToman),
      )
    : missing('capital_not_set')
  const portfolio = !cash.available
    ? missing('capital_not_set')
    : !assetValue.available
        ? missing('prices_missing')
        : money(new Decimal(cash.usd).plus(assetValue.usd), new Decimal(cash.toman).plus(assetValue.toman))
  const totalPnl = unrealized.available
    ? money(realizedUsd.plus(unrealized.usd), realizedToman.plus(unrealized.toman))
    : missing('prices_missing')
  const performance = portfolio.available && input.capital
    ? {
        available: true as const,
        percent: new Decimal(portfolio.usd).minus(input.capital.amountUsd).div(input.capital.amountUsd).mul(100).toFixed(8),
      }
    : { available: false as const, reason: !input.capital ? 'capital_not_set' as const : 'prices_missing' as const }

  let allocation: Allocation | null = null
  if (portfolio.available && cash.available && assetValue.available) {
    const total = new Decimal(portfolio.usd)
    const cashDec = new Decimal(cash.usd)
    const assetDec = new Decimal(assetValue.usd)
    if (total.gt(0) && cashDec.gte(0) && assetDec.gte(0)) {
      const cashPercent = cashDec.div(total).mul(100)
      allocation = {
        cashPercent: cashPercent.toFixed(4),
        assetPercent: new Decimal(100).minus(cashPercent).toFixed(4),
      }
    }
  }

  return {
    realized: { usd: realizedUsd.toFixed(8), toman: realizedToman.toFixed(4) },
    bought: { usd: boughtUsd.toFixed(12), toman: boughtToman.toFixed(4) },
    sold: { usd: soldUsd.toFixed(12), toman: soldToman.toFixed(4) },
    unrealized,
    cash,
    assetValue,
    portfolio,
    totalPnl,
    performance,
    allocation,
    holdings,
    oversoldCount,
  }
}
