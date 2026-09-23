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
 * Assets are entered by hand. A later provider can implement PriceProvider
 * and store its id on assets.price_provider / assets.external_asset_id.
 * Nothing in the current API calls this.
 */
export function usePriceProvider(): PriceProvider {
  return {
    id: 'none',
    async quote() {
      throw new PricesNotEnabledError()
    },
  }
}
