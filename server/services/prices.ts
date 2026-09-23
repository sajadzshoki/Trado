/**
 * Public entry for price providers.
 * The only implementation is the manual provider in `server/services/market.ts`.
 * Portfolio pages read `asset_quotes`. They do not call a provider.
 */
export {
  MANUAL_PROVIDER_ID,
  getPriceProvider,
  linkedPriceProvider,
  manualPriceProvider,
  quoteWriteFromProvider,
  registerPriceProvider,
  unregisterPriceProvider,
} from './market'

export type { PriceProvider, PriceRequest, PriceResult, ProviderPrice, QuoteWrite } from './market'
