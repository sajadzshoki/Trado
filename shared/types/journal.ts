import type { DisplayCurrency, TradeSide } from '../constants'

export interface PublicUser {
  id: string
  phone: string
  displayName: string | null
  locale: 'en' | 'fa'
  displayCurrency: DisplayCurrency
}

export interface AssetRecord {
  id: string
  symbol: string
  name: string
  tradeCount: number
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
  createdAt: string
  updatedAt: string
  lastTransactedAt: string | null
}

export interface TradeDetail extends TradeSummary {
  entries: TradeEntryRecord[]
}

export interface OpenPosition {
  assetId: string
  symbol: string
  name: string
  remainingQuantity: string
  openCostUsd: string
  openCostToman: string
}

export interface DashboardRecord {
  initialCapital: CapitalRecord | null
  realizedPnlUsd: string
  realizedPnlToman: string
  totalBoughtUsd: string
  totalBoughtToman: string
  totalSoldUsd: string
  totalSoldToman: string
  netCashFlowUsd: string
  netCashFlowToman: string
  openCostUsd: string
  openCostToman: string
  tradeCount: number
  oversoldCount: number
  openPositions: OpenPosition[]
  recentTrades: TradeSummary[]
  performance: {
    available: false
    reason: 'live_prices_not_tracked'
  }
}

export interface EntryPayload {
  side: TradeSide
  quantity: string
  unitPriceUsd: string
  usdTomanRate: string
  transactedAt: string
  note?: string | null
}
