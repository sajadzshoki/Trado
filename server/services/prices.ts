export interface AssetPriceQuote {
  provider: string
  externalAssetId: string
  priceUsd: string
  quotedAt: string
}

export interface PriceProvider {
  id: string
  quote(externalAssetId: string): Promise<AssetPriceQuote>
}

export class PricesNotEnabledError extends Error {
  readonly code = 'prices_not_enabled'

  constructor() {
    super('External price providers are not enabled')
    this.name = 'PricesNotEnabledError'
  }
}

/**
 * External prices are not connected. The portfolio reads stored rows in
 * asset_quotes and never calls this. A later provider should upsert that
 * table (source = provider id) instead of being called while a page renders.
 * assets.price_provider and assets.external_asset_id remain the reserved
 * link to that provider.
 */
export function usePriceProvider(): PriceProvider {
  return {
    id: 'none',
    async quote() {
      throw new PricesNotEnabledError()
    },
  }
}
