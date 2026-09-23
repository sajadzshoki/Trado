import assert from 'node:assert/strict'
import { test } from 'node:test'
import Decimal from 'decimal.js'
import { buildPortfolio, valueTrade, type PortfolioAsset, type PortfolioQuote, type PortfolioTrade } from '../shared/utils/finance.ts'
import { resolveEntryAmounts } from '../shared/utils/numbers.ts'
import type { MathEntry } from '../shared/utils/trade-math.ts'

const RATE = '100000'

function entry(side: 'buy' | 'sell', quantity: string, price: string, rate = RATE): MathEntry {
  const total = new Decimal(quantity).mul(price)
  return {
    side,
    quantity,
    totalUsd: total.toFixed(12),
    totalToman: total.mul(rate).toFixed(4),
  }
}

function eq(actual: string, expected: string, scale = 8) {
  assert.equal(new Decimal(actual).toFixed(scale), new Decimal(expected).toFixed(scale))
}

function quote(assetId: string, priceUsd: string, rate = RATE): PortfolioQuote {
  return { assetId, priceUsd, usdTomanRate: rate, source: 'manual', quotedAt: '2026-02-01T00:00:00.000Z' }
}

test('buy calculation stores quantity times price and the rate on that entry', () => {
  const solved = resolveEntryAmounts({
    quantity: '2',
    unitPriceUsd: '100000',
    solveFor: 'totalUsd',
    usdTomanRate: RATE,
  })
  assert.equal(solved.ok, true)
  if (!solved.ok) return
  eq(solved.value.totalUsd, '200000', 12)
  eq(solved.value.totalToman, '20000000000', 4)
  const valued = valueTrade([entry('buy', '2', '100000')], null)
  eq(valued.math.buyQuantity, '2', 12)
  eq(valued.math.buyUsd, '200000', 12)
  eq(valued.math.remainingQuantity, '2', 12)
  eq(valued.math.realizedPnlUsd, '0')
  assert.equal(valued.status, 'open')
  assert.equal(valued.unrealized.available, false)
})

test('sell calculation uses the sell price and does not rewrite the buy', () => {
  const solved = resolveEntryAmounts({
    quantity: '1',
    unitPriceUsd: '110000',
    solveFor: 'totalUsd',
    usdTomanRate: RATE,
  })
  assert.equal(solved.ok, true)
  if (!solved.ok) return
  eq(solved.value.totalUsd, '110000', 12)
  eq(solved.value.totalToman, '11000000000', 4)
})

test('partial sell realizes profit only on the sold quantity', () => {
  const valued = valueTrade([
    entry('buy', '2', '100000'),
    entry('sell', '1', '110000'),
  ], quote('btc', '120000'))
  eq(valued.math.buyQuantity, '2', 12)
  eq(valued.math.sellQuantity, '1', 12)
  eq(valued.math.remainingQuantity, '1', 12)
  eq(valued.math.averageBuyUsd!, '100000', 12)
  eq(valued.math.realizedPnlUsd, '10000')
  eq(valued.math.realizedPnlToman, '1000000000', 4)
  assert.equal(valued.status, 'open')
  assert.equal(valued.unrealized.available, true)
  if (!valued.unrealized.available || !valued.currentValue.available) return
  eq(valued.currentValue.usd, '120000')
  eq(valued.unrealized.usd, '20000')
  eq(valued.unrealized.toman, '2000000000', 4)
})

test('multiple buys use average cost, not the first or last lot', () => {
  const valued = valueTrade([
    entry('buy', '1', '100000'),
    entry('buy', '1', '120000'),
    entry('sell', '1', '130000'),
  ], null)
  eq(valued.math.averageBuyUsd!, '110000', 12)
  eq(valued.math.realizedPnlUsd, '20000')
  eq(valued.math.remainingQuantity, '1', 12)
  eq(valued.math.openCostUsd, '110000')
})

test('multiple sells average the sold quantity inside the same trade', () => {
  const valued = valueTrade([
    entry('buy', '2', '100000'),
    entry('sell', '0.5', '110000'),
    entry('sell', '0.5', '120000'),
  ], null)
  eq(valued.math.sellQuantity, '1', 12)
  eq(valued.math.averageSellUsd!, '115000', 12)
  eq(valued.math.realizedPnlUsd, '15000')
  eq(valued.math.remainingQuantity, '1', 12)
  assert.equal(valued.status, 'open')
})

test('a closed trade has zero remaining and zero unrealized without a price', () => {
  const valued = valueTrade([
    entry('buy', '1', '100'),
    entry('sell', '1', '110'),
  ], null)
  assert.equal(valued.status, 'closed')
  eq(valued.math.remainingQuantity, '0', 12)
  eq(valued.math.realizedPnlUsd, '10')
  assert.equal(valued.unrealized.available, true)
  if (!valued.unrealized.available) return
  eq(valued.unrealized.usd, '0')
  eq(valued.currentValue.available ? valued.currentValue.usd : '1', '0')
})

test('an open trade without a price does not report unrealized as zero', () => {
  const valued = valueTrade([entry('buy', '1', '100')], null)
  assert.equal(valued.status, 'open')
  assert.equal(valued.unrealized.available, false)
  if (valued.unrealized.available) return
  assert.equal(valued.unrealized.reason, 'prices_missing')
})

test('decimal quantities do not use binary floating point', () => {
  const valued = valueTrade([
    entry('buy', '0.1', '1'),
    entry('buy', '0.1', '1'),
    entry('buy', '0.1', '1'),
  ], quote('x', '1', '1'))
  eq(valued.math.buyQuantity, '0.3', 12)
  eq(valued.math.buyUsd, '0.3', 12)
  eq(valued.math.remainingQuantity, '0.3', 12)
})

test('portfolio cash, value, and performance use stored amounts only', () => {
  const asset: PortfolioAsset = { id: 'btc', symbol: 'BTC', name: 'Bitcoin', icon: null }
  const trades: PortfolioTrade[] = [{
    assetId: 'btc',
    entries: [entry('buy', '1', '2000')],
  }]
  const figures = buildPortfolio({
    capital: { amountUsd: '10000', amountToman: '1000000000' },
    assets: [asset],
    trades,
    quotes: [quote('btc', '2500')],
  })
  assert.equal(figures.cash.available, true)
  if (!figures.cash.available || !figures.assetValue.available || !figures.portfolio.available) return
  eq(figures.cash.usd, '8000')
  eq(figures.assetValue.usd, '2500')
  eq(figures.portfolio.usd, '10500')
  eq(figures.realized.usd, '0')
  assert.equal(figures.unrealized.available, true)
  if (!figures.unrealized.available || !figures.totalPnl.available || !figures.performance.available) return
  eq(figures.unrealized.usd, '500')
  eq(figures.totalPnl.usd, '500')
  eq(figures.performance.percent, '5')
  assert.ok(figures.allocation)
  eq(figures.allocation!.cashPercent, '76.19047619', 4)
})

test('a later quote rate does not change historical buy, sell, or realized toman', () => {
  const entries = [
    entry('buy', '2', '100000', '100000'),
    entry('sell', '1', '110000', '100000'),
  ]
  const before = valueTrade(entries, null)
  const after = valueTrade(entries, quote('btc', '120000', '200000'))
  eq(before.math.buyToman, after.math.buyToman, 4)
  eq(before.math.sellToman, after.math.sellToman, 4)
  eq(before.math.realizedPnlToman, after.math.realizedPnlToman, 4)
  eq(before.math.realizedPnlUsd, '10000')
  assert.equal(after.unrealized.available, true)
  if (!after.unrealized.available) return
  eq(after.unrealized.usd, '20000')
  eq(after.unrealized.toman, '14000000000', 4)
})

test('unrealized profit is summed per trade and is not blended across trades', () => {
  const trades: PortfolioTrade[] = [
    { assetId: 'btc', entries: [entry('buy', '1', '100000'), entry('sell', '1', '100000')] },
    { assetId: 'btc', entries: [entry('buy', '1', '200000')] },
  ]
  const figures = buildPortfolio({
    capital: { amountUsd: '10000', amountToman: '1000000000' },
    assets: [{ id: 'btc', symbol: 'BTC', name: 'Bitcoin', icon: null }],
    trades,
    quotes: [quote('btc', '150000')],
  })
  assert.equal(figures.unrealized.available, true)
  if (!figures.unrealized.available) return
  eq(figures.unrealized.usd, '-50000')
  eq(figures.holdings[0]!.currentQuantity, '1', 12)
  eq(figures.holdings[0]!.averageBuyUsd!, '150000', 12)
})

test('missing prices are not filled with zero, and missing capital is not filled with zero', () => {
  const open = buildPortfolio({
    capital: { amountUsd: '10000', amountToman: '1000000000' },
    assets: [{ id: 'btc', symbol: 'BTC', name: 'Bitcoin', icon: null }],
    trades: [{ assetId: 'btc', entries: [entry('buy', '1', '1000')] }],
    quotes: [],
  })
  assert.equal(open.cash.available, true)
  assert.equal(open.assetValue.available, false)
  assert.equal(open.portfolio.available, false)
  assert.equal(open.performance.available, false)
  if (open.portfolio.available || open.performance.available) return
  assert.equal(open.portfolio.reason, 'prices_missing')
  assert.equal(open.performance.reason, 'prices_missing')
  if (!open.cash.available) return
  eq(open.cash.usd, '9000')

  const priced = buildPortfolio({
    capital: null,
    assets: [{ id: 'btc', symbol: 'BTC', name: 'Bitcoin', icon: null }],
    trades: [{ assetId: 'btc', entries: [entry('buy', '1', '1000')] }],
    quotes: [quote('btc', '1100')],
  })
  assert.equal(priced.cash.available, false)
  assert.equal(priced.portfolio.available, false)
  assert.equal(priced.assetValue.available, true)
  if (!priced.assetValue.available || priced.cash.available) return
  eq(priced.assetValue.usd, '1100')
  assert.equal(priced.cash.reason, 'capital_not_set')
})

test('with no open quantity, portfolio value is cash and does not require a price', () => {
  const figures = buildPortfolio({
    capital: { amountUsd: '10000', amountToman: '1000000000' },
    assets: [{ id: 'btc', symbol: 'BTC', name: 'Bitcoin', icon: null }],
    trades: [{ assetId: 'btc', entries: [entry('buy', '1', '100'), entry('sell', '1', '110')] }],
    quotes: [],
  })
  assert.equal(figures.portfolio.available, true)
  assert.equal(figures.performance.available, true)
  if (!figures.cash.available || !figures.portfolio.available || !figures.performance.available) return
  eq(figures.cash.usd, '10010')
  eq(figures.assetValue.available ? figures.assetValue.usd : '1', '0')
  eq(figures.portfolio.usd, '10010')
  eq(figures.realized.usd, '10')
  eq(figures.performance.percent, '0.1')
})

test('negative cash is shown and is not clamped, and the mix bar is omitted', () => {
  const figures = buildPortfolio({
    capital: { amountUsd: '100', amountToman: '10000000' },
    assets: [{ id: 'btc', symbol: 'BTC', name: 'Bitcoin', icon: null }],
    trades: [{ assetId: 'btc', entries: [entry('buy', '1', '500')] }],
    quotes: [quote('btc', '200')],
  })
  assert.equal(figures.cash.available, true)
  assert.equal(figures.portfolio.available, true)
  if (!figures.cash.available || !figures.portfolio.available || !figures.performance.available) return
  eq(figures.cash.usd, '-400')
  eq(figures.portfolio.usd, '-200')
  eq(figures.performance.percent, '-300')
  assert.equal(figures.allocation, null)
})

test('asset totals add each trade and do not blend cost across trades', () => {
  const figures = buildPortfolio({
    capital: null,
    assets: [{ id: 'btc', symbol: 'BTC', name: 'Bitcoin', icon: null }],
    trades: [
      { assetId: 'btc', entries: [entry('buy', '2', '100'), entry('sell', '1', '150')] },
      { assetId: 'btc', entries: [entry('buy', '1', '300'), entry('sell', '1', '150')] },
    ],
    quotes: [quote('btc', '180')],
  })
  const holding = figures.holdings[0]!
  eq(holding.boughtQuantity, '3', 12)
  eq(holding.soldQuantity, '2', 12)
  eq(holding.currentQuantity, '1', 12)
  eq(holding.buyUsd, '500', 12)
  eq(holding.sellUsd, '300', 12)
  eq(holding.averageBuyUsd!, '166.666666666667', 12)
  eq(holding.realizedPnlUsd, '-100')
  assert.equal(holding.currentValue.available, true)
  if (!holding.currentValue.available || !figures.unrealized.available) return
  eq(holding.currentValue.usd, '180')
  eq(figures.unrealized.usd, '80')
  eq(figures.realized.usd, '-100')
})

test('a later quote rate changes only the current toman value', () => {
  const input = {
    capital: { amountUsd: '10000', amountToman: '1000000000' },
    assets: [{ id: 'btc', symbol: 'BTC', name: 'Bitcoin', icon: null }],
    trades: [{ assetId: 'btc', entries: [entry('buy', '1', '1000', '100000')] }],
  }
  const first = buildPortfolio({ ...input, quotes: [quote('btc', '1100', '100000')] })
  const later = buildPortfolio({ ...input, quotes: [quote('btc', '1100', '200000')] })
  assert.equal(first.cash.available && later.cash.available && first.assetValue.available && later.assetValue.available, true)
  if (!first.cash.available || !later.cash.available || !first.assetValue.available || !later.assetValue.available) return
  eq(first.cash.toman, later.cash.toman, 4)
  eq(first.bought.toman, later.bought.toman, 4)
  eq(first.realized.toman, later.realized.toman, 4)
  eq(first.assetValue.usd, later.assetValue.usd)
  eq(first.assetValue.toman, '110000000', 4)
  eq(later.assetValue.toman, '220000000', 4)
})

test('capital alone is a complete portfolio with zero performance', () => {
  const figures = buildPortfolio({
    capital: { amountUsd: '10000', amountToman: '1000000000' },
    assets: [],
    trades: [],
    quotes: [],
  })
  assert.equal(figures.portfolio.available, true)
  assert.equal(figures.performance.available, true)
  if (!figures.portfolio.available || !figures.performance.available) return
  eq(figures.portfolio.usd, '10000')
  eq(figures.performance.percent, '0')
  eq(figures.cash.available ? figures.cash.toman : '1', '1000000000', 4)
})
