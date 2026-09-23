import { parsePositiveDecimal, transactionDateIssue } from '../../shared/utils/numbers'

/**
 * Local id for prices the user types. This is not a market API.
 * A later provider registers under its own id and must not replace this one.
 */
export const MANUAL_PROVIDER_ID = 'manual'

/**
 * One item from an external market catalog.
 * This is not a user's personal asset. The journal keeps those in `assets`.
 */
export interface MarketAsset {
  providerId: string
  externalId: string
  symbol: string
  name: string
}

/**
 * A price a provider is willing to record.
 * `usdTomanRate` is optional because a market API may only know USD.
 * The stored quote still needs a rate; the caller keeps the existing one.
 */
export interface ProviderPrice {
  providerId: string
  externalId: string | null
  priceUsd: string
  usdTomanRate: string | null
  quotedAt: string
}

export interface PriceRequest {
  /** Catalog id, if the user asset has one. Manual prices do not need it. */
  externalId: string | null
  /** Present only when the user typed a price. Remote providers ignore this. */
  manual: {
    priceUsd: string
    usdTomanRate: string
    quotedAt: string
  } | null
}

export type PriceFailureCode =
  | 'not_available'
  | 'provider_not_connected'
  | 'invalid_number'
  | 'positive'
  | 'too_large'
  | 'invalid_date'
  | 'date_future'
  | 'date_past'

export type PriceResult =
  | { ok: true, price: ProviderPrice }
  | { ok: false, code: PriceFailureCode, field?: string }

/**
 * Catalog lookup. A future provider would search its own market list.
 * The user's asset list is not this catalog.
 */
export interface AssetProvider {
  readonly id: string
  search(query: string): Promise<MarketAsset[]>
  get(externalId: string): Promise<MarketAsset | null>
}

/**
 * Current-price lookup. A future provider would use `externalId`.
 * The portfolio engine must not call this while a page renders.
 * Callers persist the result into `asset_quotes`.
 */
export interface PriceProvider {
  readonly id: string
  quote(request: PriceRequest): Promise<PriceResult>
}

export class ManualAssetProvider implements AssetProvider {
  readonly id = MANUAL_PROVIDER_ID

  async search(_query: string): Promise<MarketAsset[]> {
    return []
  }

  async get(_externalId: string): Promise<MarketAsset | null> {
    return null
  }
}

export class ManualPriceProvider implements PriceProvider {
  readonly id = MANUAL_PROVIDER_ID

  async quote(request: PriceRequest): Promise<PriceResult> {
    if (!request.manual) return { ok: false, code: 'not_available' }
    const price = parsePositiveDecimal(request.manual.priceUsd)
    if (!price.ok) return { ok: false, code: price.code, field: 'priceUsd' }
    const rate = parsePositiveDecimal(request.manual.usdTomanRate)
    if (!rate.ok) return { ok: false, code: rate.code, field: 'usdTomanRate' }
    const dateIssue = transactionDateIssue(request.manual.quotedAt)
    if (dateIssue) return { ok: false, code: dateIssue, field: 'quotedAt' }
    return {
      ok: true,
      price: {
        providerId: this.id,
        externalId: request.externalId,
        priceUsd: price.value.toFixed(12),
        usdTomanRate: rate.value.toFixed(8),
        quotedAt: new Date(request.manual.quotedAt).toISOString(),
      },
    }
  }
}

export const manualAssetProvider = new ManualAssetProvider()
export const manualPriceProvider = new ManualPriceProvider()

const assetProviders = new Map<string, AssetProvider>([
  [manualAssetProvider.id, manualAssetProvider],
])

const priceProviders = new Map<string, PriceProvider>([
  [manualPriceProvider.id, manualPriceProvider],
])

function rejectManualReplacement(id: string) {
  if (id === MANUAL_PROVIDER_ID) {
    throw new Error('The manual provider cannot be replaced')
  }
}

/** Register a future catalog provider. Does not call it. */
export function registerAssetProvider(provider: AssetProvider) {
  rejectManualReplacement(provider.id)
  assetProviders.set(provider.id, provider)
}

/** Register a future price provider. Does not call it. */
export function registerPriceProvider(provider: PriceProvider) {
  rejectManualReplacement(provider.id)
  priceProviders.set(provider.id, provider)
}

export function unregisterAssetProvider(id: string) {
  if (id === MANUAL_PROVIDER_ID) return
  assetProviders.delete(id)
}

export function unregisterPriceProvider(id: string) {
  if (id === MANUAL_PROVIDER_ID) return
  priceProviders.delete(id)
}

export function getAssetProvider(id: string | null | undefined): AssetProvider | null {
  if (!id) return manualAssetProvider
  return assetProviders.get(id) ?? null
}

export function getPriceProvider(id: string | null | undefined): PriceProvider | null {
  if (!id) return manualPriceProvider
  return priceProviders.get(id) ?? null
}

/**
 * The provider a user asset is linked to, if one is registered.
 * Null means there is nothing to call. Do not treat that as a price of zero.
 */
export function linkedPriceProvider(providerId: string | null | undefined): PriceProvider | null {
  if (!providerId || providerId === MANUAL_PROVIDER_ID) return null
  return priceProviders.get(providerId) ?? null
}

export interface QuoteWrite {
  priceUsd: string
  usdTomanRate: string
  source: string
  quotedAt: Date
}

/**
 * Turn a provider result into the row `asset_quotes` stores.
 * A USD-only provider keeps the rate already stored for that asset.
 * Returns null instead of inventing a rate or a zero price.
 */
export function quoteWriteFromProvider(price: ProviderPrice, existingRate: string | null): QuoteWrite | null {
  const amount = parsePositiveDecimal(price.priceUsd)
  const rate = parsePositiveDecimal(price.usdTomanRate ?? existingRate ?? '')
  const quotedAt = new Date(price.quotedAt)
  if (!amount.ok || !rate.ok || Number.isNaN(quotedAt.getTime())) return null
  return {
    priceUsd: amount.value.toFixed(12),
    usdTomanRate: rate.value.toFixed(8),
    source: price.providerId,
    quotedAt,
  }
}
