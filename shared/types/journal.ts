import type { DisplayCurrency, TradeSide } from '../constants'
import type { AmountField } from '../utils/numbers'
import type { Figure, GapReason } from '../utils/finance'
import type { TradeStatus } from '../utils/trade-math'

export interface PublicUser {
  id: string
  phone: string
  displayName: string | null
  locale: 'en' | 'fa'
  displayCurrency: DisplayCurrency
}

export interface PriceQuoteRecord {
  priceUsd: string
  usdTomanRate: string
  priceToman: string
  source: string
  quotedAt: string
}

export interface AssetRecord {
  id: string
  symbol: string
  name: string
  icon: string | null
  isActive: boolean
  tradeCount: number
  quote: PriceQuoteRecord | null
  createdAt: string
}

export interface CapitalRecord {
  amountUsd: string
  usdTomanRate: string
  amountToman: string
  recordedAt: string
}

export interface TradeEntryRecord {
  id: string
  side: TradeSide
  quantity: string
  unitPriceUsd: string
  totalUsd: string
  usdTomanRate: string
  totalToman: string
  transactedAt: string
  note: string | null
}

export interface TradeSummary {
  id: string
  title: string | null
  notes: string | null
  asset: {
    id: string
    symbol: string
    name: string
  }
  entryCount: number
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
  status: TradeStatus
  markAvailable: boolean
  unrealizedPnlUsd: string | null
  unrealizedPnlToman: string | null
  currentValueUsd: string | null
  currentValueToman: string | null
  totalPnlUsd: string | null
  totalPnlToman: string | null
  createdAt: string
  updatedAt: string
  lastTransactedAt: string | null
}

export interface TradeDetail extends TradeSummary {
  entries: TradeEntryRecord[]
}

export interface HoldingRecord {
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
  markAvailable: boolean
  unrealizedPnlUsd: string | null
  unrealizedPnlToman: string | null
  currentValueUsd: string | null
  currentValueToman: string | null
  quote: PriceQuoteRecord | null
}

export interface DashboardRecord {
  initialCapital: CapitalRecord | null
  realizedPnlUsd: string
  realizedPnlToman: string
  totalBoughtUsd: string
  totalBoughtToman: string
  totalSoldUsd: string
  totalSoldToman: string
  cash: Figure
  assetValue: Figure
  portfolio: Figure
  unrealized: Figure
  totalPnl: Figure
  performance: { available: true, percent: string } | { available: false, reason: GapReason }
  allocation: { cashPercent: string, assetPercent: string } | null
  holdings: HoldingRecord[]
  openTrades: TradeSummary[]
  recentTrades: TradeSummary[]
  tradeCount: number
  oversoldCount: number
}

export interface EntryPayload {
  side: TradeSide
  quantity?: string | null
  unitPriceUsd?: string | null
  totalUsd?: string | null
  solveFor?: AmountField
  usdTomanRate: string
  transactedAt: string
  note?: string | null
}
