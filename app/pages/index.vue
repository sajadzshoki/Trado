<script setup lang="ts">
import type { DashboardRecord } from '~~/shared/types/journal'
import type { GapReason } from '~~/shared/utils/finance'

definePageMeta({ middleware: 'authenticated' })

const { t } = useI18n()
const localePath = useLocalePath()
const format = useFormatters()
const { message } = useApiError()

useHead({ title: () => t('dashboard.title') })

const { data, pending, error, refresh } = await useFetch<DashboardRecord>('/api/dashboard')

const hasTrades = computed(() => (data.value?.tradeCount ?? 0) > 0)

function gapText(reason: GapReason) {
  return reason === 'capital_not_set' ? t('dashboard.missingCapital') : t('dashboard.missingPrices')
}
</script>

<template>
  <div>
    <PageHeader :title="t('dashboard.title')" :subtitle="t('dashboard.subtitle')">
      <template v-if="hasTrades" #actions>
        <UButton :to="localePath('/trades/new')" color="neutral" size="sm">
          {{ t('nav.record') }}
        </UButton>
      </template>
    </PageHeader>

    <p v-if="pending && !data" class="text-sm text-dimmed" role="status">{{ t('common.loading') }}</p>
    <div v-else-if="error" class="space-y-3">
      <p class="text-sm text-loss" role="alert">{{ message(error) }}</p>
      <button type="button" class="text-sm text-muted underline underline-offset-4" @click="refresh()">
        {{ t('common.retry') }}
      </button>
    </div>

    <template v-else-if="data">
      <section class="rule py-6">
        <p class="text-sm text-muted">{{ t('dashboard.portfolioValue') }}</p>
        <div v-if="data.portfolio.available" class="mt-3">
          <MoneyText :usd="data.portfolio.usd" :toman="data.portfolio.toman" size="lg" />
        </div>
        <p v-else class="mt-3 max-w-sm text-sm leading-6 text-dimmed">{{ gapText(data.portfolio.reason) }}</p>
        <div v-if="data.performance.available" class="mt-5">
          <p class="text-xs text-dimmed">{{ t('dashboard.performance') }}</p>
          <p class="num mt-1 text-lg" :class="format.tone(data.performance.percent)">
            {{ format.percent(data.performance.percent, true) }}
          </p>
        </div>
        <div
          v-if="data.allocation && data.cash.available && data.assetValue.available"
          class="mt-6"
        >
          <div class="mix" role="img" :aria-label="t('dashboard.mixLabel')">
            <div class="mix-cash" :style="{ width: `${data.allocation.cashPercent}%` }" />
            <div class="mix-hold" :style="{ width: `${data.allocation.assetPercent}%` }" />
          </div>
          <div class="mt-3 flex items-start justify-between gap-4 text-xs text-dimmed">
            <span>{{ t('dashboard.mixCash') }}</span>
            <span>{{ t('dashboard.mixHoldings') }}</span>
          </div>
        </div>
      </section>

      <section class="mt-2">
        <div class="flex items-start justify-between gap-4 border-b border-default py-4">
          <div>
            <p class="text-sm text-muted">{{ t('dashboard.initialCapital') }}</p>
            <p v-if="data.initialCapital" class="mt-1 text-xs text-dimmed">
              {{ t('dashboard.recordedOn', { date: format.date(data.initialCapital.recordedAt) }) }}
              · {{ format.rate(data.initialCapital.usdTomanRate) }}
            </p>
          </div>
          <MoneyText
            v-if="data.initialCapital"
            :usd="data.initialCapital.amountUsd"
            :toman="data.initialCapital.amountToman"
          />
          <NuxtLink v-else :to="localePath('/settings')" class="text-sm text-highlighted underline underline-offset-4">
            {{ t('dashboard.setCapital') }}
          </NuxtLink>
        </div>

        <div class="flex items-start justify-between gap-4 border-b border-default py-4">
          <p class="pt-1 text-sm text-muted">{{ t('dashboard.currentCash') }}</p>
          <MoneyText v-if="data.cash.available" :usd="data.cash.usd" :toman="data.cash.toman" signed />
          <p v-else class="max-w-[14rem] text-end text-sm text-dimmed">{{ gapText(data.cash.reason) }}</p>
        </div>
        <div class="flex items-start justify-between gap-4 border-b border-default py-4">
          <p class="pt-1 text-sm text-muted">{{ t('dashboard.assetValue') }}</p>
          <MoneyText v-if="data.assetValue.available" :usd="data.assetValue.usd" :toman="data.assetValue.toman" />
          <p v-else class="max-w-[14rem] text-end text-sm text-dimmed">{{ gapText(data.assetValue.reason) }}</p>
        </div>
        <div class="flex items-start justify-between gap-4 border-b border-default py-4">
          <p class="pt-1 text-sm text-muted">{{ t('dashboard.realizedPnl') }}</p>
          <MoneyText :usd="data.realizedPnlUsd" :toman="data.realizedPnlToman" signed />
        </div>
        <div class="flex items-start justify-between gap-4 border-b border-default py-4">
          <p class="pt-1 text-sm text-muted">{{ t('dashboard.unrealizedPnl') }}</p>
          <MoneyText v-if="data.unrealized.available" :usd="data.unrealized.usd" :toman="data.unrealized.toman" signed />
          <p v-else class="max-w-[14rem] text-end text-sm text-dimmed">{{ gapText(data.unrealized.reason) }}</p>
        </div>
        <div class="flex items-start justify-between gap-4 border-b border-default py-4">
          <p class="pt-1 text-sm text-muted">{{ t('dashboard.totalPnl') }}</p>
          <MoneyText v-if="data.totalPnl.available" :usd="data.totalPnl.usd" :toman="data.totalPnl.toman" signed />
          <p v-else class="max-w-[14rem] text-end text-sm text-dimmed">{{ gapText(data.totalPnl.reason) }}</p>
        </div>

        <div class="flex items-start justify-between gap-4 border-b border-default py-4">
          <p class="pt-1 text-sm text-muted">{{ t('dashboard.bought') }}</p>
          <MoneyText :usd="data.totalBoughtUsd" :toman="data.totalBoughtToman" size="sm" />
        </div>
        <div class="flex items-start justify-between gap-4 border-b border-default py-4">
          <p class="pt-1 text-sm text-muted">{{ t('dashboard.sold') }}</p>
          <MoneyText :usd="data.totalSoldUsd" :toman="data.totalSoldToman" size="sm" />
        </div>
        <p class="mt-3 text-xs leading-5 text-dimmed">{{ t('dashboard.cashHint') }}</p>
        <p class="mt-1 text-xs leading-5 text-dimmed">{{ t('dashboard.unrealizedHint') }}</p>
        <p class="mt-1 text-xs leading-5 text-dimmed">{{ t('dashboard.performanceHint') }}</p>
      </section>

      <EmptyState v-if="!hasTrades" :title="t('dashboard.emptyTitle')" :body="t('dashboard.emptyBody')">
        <div class="flex flex-wrap gap-3">
          <UButton :to="localePath('/assets')" color="neutral" variant="outline" size="sm">
            {{ t('dashboard.addAsset') }}
          </UButton>
          <UButton :to="localePath('/trades/new')" color="neutral" size="sm">
            {{ t('dashboard.recordTrade') }}
          </UButton>
        </div>
      </EmptyState>

      <template v-else>
        <section class="mt-10">
          <h2 class="text-sm text-muted">{{ t('dashboard.holdings') }}</h2>
          <article v-for="holding in data.holdings" :key="holding.assetId" class="border-b border-default py-4">
            <div class="flex items-start gap-3">
              <AssetMark :symbol="holding.symbol" :icon="holding.icon" />
              <div class="min-w-0">
                <p class="font-medium text-highlighted">{{ holding.symbol }}</p>
                <p class="mt-1 text-xs text-dimmed">{{ holding.name }}</p>
              </div>
            </div>
            <p class="num mt-3 text-xs text-dimmed">
              {{ t('trades.boughtQty') }} {{ format.qty(holding.boughtQuantity) }}
              · {{ t('trades.soldQty') }} {{ format.qty(holding.soldQuantity) }}
              · {{ t('dashboard.currentQty') }} {{ format.qty(holding.currentQuantity) }}
            </p>
            <p v-if="holding.oversold" class="mt-2 text-xs text-loss">{{ t('trades.oversold') }}</p>
            <div class="mt-3 space-y-3">
              <div class="flex items-start justify-between gap-4">
                <span class="pt-1 text-xs text-dimmed">{{ t('trades.totalBuy') }}</span>
                <MoneyText :usd="holding.buyUsd" :toman="holding.buyToman" size="sm" />
              </div>
              <div class="flex items-start justify-between gap-4">
                <span class="pt-1 text-xs text-dimmed">{{ t('trades.totalSell') }}</span>
                <MoneyText :usd="holding.sellUsd" :toman="holding.sellToman" size="sm" />
              </div>
              <div v-if="holding.averageBuyUsd" class="flex items-start justify-between gap-4 text-sm">
                <span class="text-xs text-dimmed">{{ t('trades.avgBuy') }}</span>
                <span class="text-end">
                  <bdi class="num block text-sm">{{ format.usd(holding.averageBuyUsd) }}</bdi>
                  <bdi v-if="holding.averageBuyToman" class="num mt-1 block text-xs text-muted">{{ format.toman(holding.averageBuyToman) }}</bdi>
                </span>
              </div>
              <div class="flex items-start justify-between gap-4">
                <span class="pt-1 text-xs text-dimmed">{{ t('trades.realized') }}</span>
                <MoneyText :usd="holding.realizedPnlUsd" :toman="holding.realizedPnlToman" signed size="sm" />
              </div>
              <div class="flex items-start justify-between gap-4">
                <span class="pt-1 text-xs text-dimmed">{{ t('trades.unrealized') }}</span>
                <MoneyText
                  v-if="holding.markAvailable && holding.unrealizedPnlUsd != null && holding.unrealizedPnlToman != null"
                  :usd="holding.unrealizedPnlUsd"
                  :toman="holding.unrealizedPnlToman"
                  signed
                  size="sm"
                />
                <span v-else class="text-xs text-dimmed">{{ t('trades.priceMissing') }}</span>
              </div>
              <div class="flex items-start justify-between gap-4">
                <span class="pt-1 text-xs text-dimmed">{{ t('dashboard.assetValue') }}</span>
                <MoneyText
                  v-if="holding.markAvailable && holding.currentValueUsd != null && holding.currentValueToman != null"
                  :usd="holding.currentValueUsd"
                  :toman="holding.currentValueToman"
                  size="sm"
                />
                <span v-else class="text-xs text-dimmed">{{ t('trades.priceMissing') }}</span>
              </div>
            </div>
            <p v-if="holding.quote" class="mt-3 text-xs text-dimmed">
              {{ t('assets.priceManual') }}
              · {{ format.usd(holding.quote.priceUsd) }}
              · {{ t('assets.quotedOn', { date: format.dateTime(holding.quote.quotedAt) }) }}
            </p>
            <NuxtLink
              v-else-if="!holding.markAvailable"
              :to="localePath('/assets')"
              class="mt-3 inline-block text-xs text-muted underline underline-offset-4"
            >
              {{ t('dashboard.setPrice') }}
            </NuxtLink>
          </article>
        </section>

        <section class="mt-10">
          <h2 class="text-sm text-muted">{{ t('dashboard.openTrades') }}</h2>
          <p v-if="!data.openTrades.length" class="mt-3 text-sm text-dimmed">{{ t('dashboard.noOpenTrades') }}</p>
          <TradeRow v-for="trade in data.openTrades" :key="trade.id" :trade="trade" />
        </section>

        <p v-if="data.oversoldCount" class="mt-6 text-sm leading-6 text-muted">
          {{ t('dashboard.oversoldNote', { count: data.oversoldCount }) }}
        </p>

        <section class="mt-10">
          <div class="mb-2 flex items-baseline justify-between">
            <h2 class="text-sm text-muted">{{ t('dashboard.recentTrades') }}</h2>
            <NuxtLink :to="localePath('/trades')" class="text-xs text-dimmed underline underline-offset-4">
              {{ t('nav.trades') }}
            </NuxtLink>
          </div>
          <TradeRow v-for="trade in data.recentTrades" :key="trade.id" :trade="trade" />
        </section>
      </template>
    </template>
  </div>
</template>
