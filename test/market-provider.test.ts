import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import {
  MANUAL_PROVIDER_ID,
  getAssetProvider,
  getPriceProvider,
  linkedPriceProvider,
  manualAssetProvider,
  manualPriceProvider,
  quoteWriteFromProvider,
  registerPriceProvider,
  unregisterPriceProvider,
  type PriceProvider,
} from '../server/services/market.ts'

const QUOTED_AT = '2026-09-23T12:00:00.000Z'

test('manual price provider records the typed price, source, and time', async () => {
  const result = await manualPriceProvider.quote({
    externalId: null,
    manual: {
      priceUsd: '120000',
      usdTomanRate: '100000',
      quotedAt: QUOTED_AT,
    },
  })
  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.equal(result.price.providerId, MANUAL_PROVIDER_ID)
  assert.equal(result.price.externalId, null)
  assert.equal(result.price.priceUsd, '120000.000000000000')
  assert.equal(result.price.usdTomanRate, '100000.00000000')
  assert.equal(result.price.quotedAt, QUOTED_AT)
})

test('a manual price can carry an optional external id without calling a catalog', async () => {
  const result = await manualPriceProvider.quote({
    externalId: 'bitcoin',
    manual: {
      priceUsd: '120000.5',
      usdTomanRate: '100000',
      quotedAt: QUOTED_AT,
    },
  })
  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.equal(result.price.externalId, 'bitcoin')
  assert.equal(result.price.priceUsd, '120000.500000000000')
})

test('manual provider does not invent a price when nothing was typed', async () => {
  const result = await manualPriceProvider.quote({ externalId: 'bitcoin', manual: null })
  assert.equal(result.ok, false)
  if (result.ok) return
  assert.equal(result.code, 'not_available')
})

test('manual provider rejects an invalid price instead of storing zero', async () => {
  const result = await manualPriceProvider.quote({
    externalId: null,
    manual: { priceUsd: '0', usdTomanRate: '100000', quotedAt: QUOTED_AT },
  })
  assert.equal(result.ok, false)
  if (result.ok) return
  assert.equal(result.code, 'positive')
  assert.equal(result.field, 'priceUsd')
})

test('manual asset provider has no market catalog', async () => {
  assert.deepEqual(await manualAssetProvider.search('bitcoin'), [])
  assert.equal(await manualAssetProvider.get('bitcoin'), null)
  assert.equal(getAssetProvider('coingecko'), null)
})

test('an unregistered price provider is not connected and is not replaced with a fake quote', () => {
  assert.equal(getPriceProvider('coingecko'), null)
  assert.equal(linkedPriceProvider(null), null)
  assert.equal(linkedPriceProvider(MANUAL_PROVIDER_ID), null)
  assert.equal(linkedPriceProvider('binance'), null)
})

test('a registered provider can supply USD only, and the stored toman rate is kept', async () => {
  const stub: PriceProvider = {
    id: 'stub-source',
    async quote(request) {
      assert.equal(request.externalId, 'bitcoin')
      return {
        ok: true,
        price: {
          providerId: 'stub-source',
          externalId: request.externalId,
          priceUsd: '120000',
          usdTomanRate: null,
          quotedAt: QUOTED_AT,
        },
      }
    },
  }
  registerPriceProvider(stub)
  try {
    const provider = linkedPriceProvider('stub-source')
    assert.ok(provider)
    const result = await provider.quote({ externalId: 'bitcoin', manual: null })
    assert.equal(result.ok, true)
    if (!result.ok) return
    const write = quoteWriteFromProvider(result.price, '100000')
    assert.ok(write)
    assert.equal(write.source, 'stub-source')
    assert.equal(write.priceUsd, '120000.000000000000')
    assert.equal(write.usdTomanRate, '100000.00000000')
    assert.equal(quoteWriteFromProvider(result.price, null), null)
  }
  finally {
    unregisterPriceProvider('stub-source')
    assert.equal(linkedPriceProvider('stub-source'), null)
  }
})

test('the manual provider cannot be replaced', () => {
  assert.throws(() => registerPriceProvider(manualPriceProvider), /cannot be replaced/)
})

test('the market module does not call an external API', () => {
  const source = readFileSync(new URL('../server/services/market.ts', import.meta.url), 'utf8')
  assert.equal(/coingecko|coinmarketcap|binance|fetch\(|axios|https?:\/\//i.test(source), false)
})
