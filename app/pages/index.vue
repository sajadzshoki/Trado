<script setup lang="ts">
import type { DashboardRecord } from '~~/shared/types/journal'
import type { GapReason } from '~~/shared/utils/finance'

definePageMeta({ middleware: 'authenticated' })

const { t } = useI18n()
const localePath = useLocalePath()
const format = useFormatters()
const { message } = useApiError()
const { user } = useUserSession()

useHead({ title: () => t('dashboard.title') })

const { data, pending, error, refresh } = await useFetch<DashboardRecord>('/api/dashboard')

const hasTrades = computed(() => (data.value?.tradeCount ?? 0) > 0)
const clock = ref<{ hour: number, iso: string } | null>(null)

onMounted(() => {
  const now = new Date()
  clock.value = { hour: now.getHours(), iso: now.toISOString() }
})

const today = computed(() => clock.value ? format.date(clock.value.iso) : '')

const greeting = computed(() => {
  const name = user.value?.displayName?.trim()
  const hour = clock.value?.hour
  if (hour == null) return name || t('dashboard.title')
  const part = hour < 12 ? 'Morning' : hour < 18 ? 'Afternoon' : 'Evening'
  return name
    ? t(`dashboard.greet${part}Name`, { name })
    : t(`dashboard.greet${part}`)
})

function gapText(reason: GapReason) {
  return reason === 'capital_not_set' ? t('dashboard.missingCapital') : t('dashboard.missingPrices')
}

function statusText(status: string, oversold: boolean) {
  if (oversold) return t('trades.oversold')
  if (status === 'closed') return t('trades.statusClosed')
  if (status === 'open') return t('trades.statusOpen')
  return t('trades.noEntries')
}

function signedQty(side: 'buy' | 'sell', quantity: string) {
  const sign = side === 'buy' ? '+' : '−'
  return `${sign}${format.qty(quantity)}`
}
</script>

<template>
  <div class="rise">
    <header class="mb-6 flex items-start justify-between gap-4">
      <div class="min-w-0">
        <h1 class="truncate text-xl font-medium tracking-tight text-highlighted sm:text-2xl">{{ greeting }}</h1>
        <p class="num mt-1 text-xs text-dimmed">{{ today }}</p>
      </div>
      <NuxtLink
        :to="localePath('/settings')"
        class="inline-flex size-10 shrink-0 items-center justify-center rounded-full border border-default text-sm text-muted"
        :aria-label="t('nav.settings')"
      >
        <span aria-hidden="true">{{ (user?.displayName || user?.phone || '·').slice(0, 1) }}</span>
      </NuxtLink>
    </header>

    <p v-if="pending && !data" class="text-sm text-dimmed" role="status">{{ t('common.loading') }}</p>
    <div v-else-if="error" class="space-y-3">
      <p class="text-sm text-loss" role="alert">{{ message(error) }}</p>
      <button type="button" class="text-sm text-muted underline underline-offset-4" @click="refresh()">
        {{ t('common.retry') }}
      </button>
    </div>

    <template v-else-if="data">
      <section class="portfolio-card" :aria-label="t('dashboard.portfolioValue')">
        <p class="text-sm text-muted">{{ t('dashboard.portfolioValue') }}</p>
        <div v-if="data.portfolio.available" class="mt-3">
          <MoneyText :usd="data.portfolio.usd" :toman="data.portfolio.toman" size="xl" lead="usd" align="start" />
        </div>
        <p v-else class="mt-3 max-w-sm text-sm leading-6 text-dimmed">{{ gapText(data.portfolio.reason) }}</p>

        <div class="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-3">
          <div>
            <p class="text-xs text-dimmed">{{ t('dashboard.realizedPnl') }}</p>
            <div class="mt-2">
              <MoneyText :usd="data.realizedPnlUsd" :toman="data.realizedPnlToman" signed size="sm" lead="usd" align="start" />
            </div>
          </div>
          <div>
            <p class="text-xs text-dimmed">{{ t('dashboard.unrealizedPnl') }}</p>
            <div class="mt-2">
              <MoneyText
                v-if="data.unrealized.available"
                :usd="data.unrealized.usd"
                :toman="data.unrealized.toman"
                signed
                size="sm"
                lead="usd"
                align="start"
              />
              <p v-else class="text-sm leading-5 text-dimmed">{{ gapText(data.unrealized.reason) }}</p>
            </div>
          </div>
          <div>
            <p class="text-xs text-dimmed">{{ t('dashboard.performance') }}</p>
            <p v-if="data.performance.available" class="num mt-2 text-sm" :class="format.tone(data.performance.percent)">
              {{ format.percent(data.performance.percent, true) }}
            </p>
            <p v-else class="mt-2 text-sm leading-5 text-dimmed">{{ gapText(data.performance.reason) }}</p>
          </div>
        </div>
      </section>

      <details class="mt-4 rounded-xl border border-default px-4 py-3">
        <summary class="cursor-pointer text-sm text-muted">{{ t('dashboard.breakdown') }}</summary>
        <div class="mt-3 space-y-3">
          <div class="flex items-start justify-between gap-4">
            <span class="pt-1 text-xs text-dimmed">{{ t('dashboard.initialCapital') }}</span>
            <MoneyText
              v-if="data.initialCapital"
              :usd="data.initialCapital.amountUsd"
              :toman="data.initialCapital.amountToman"
              size="sm"
              lead="usd"
            />
            <NuxtLink v-else :to="localePath('/settings')" class="text-sm text-highlighted underline underline-offset-4">
              {{ t('dashboard.setCapital') }}
            </NuxtLink>
          </div>
          <div class="flex items-start justify-between gap-4">
            <span class="pt-1 text-xs text-dimmed">{{ t('dashboard.currentCash') }}</span>
            <MoneyText v-if="data.cash.available" :usd="data.cash.usd" :toman="data.cash.toman" signed size="sm" lead="usd" />
            <p v-else class="max-w-[12rem] text-end text-xs text-dimmed">{{ gapText(data.cash.reason) }}</p>
          </div>
          <div class="flex items-start justify-between gap-4">
            <span class="pt-1 text-xs text-dimmed">{{ t('dashboard.assetValue') }}</span>
            <MoneyText v-if="data.assetValue.available" :usd="data.assetValue.usd" :toman="data.assetValue.toman" size="sm" lead="usd" />
            <p v-else class="max-w-[12rem] text-end text-xs text-dimmed">{{ gapText(data.assetValue.reason) }}</p>
          </div>
        </div>
        <p class="mt-3 text-xs leading-5 text-dimmed">{{ t('dashboard.cashHint') }}</p>
      </details>

      <EmptyState v-if="!hasTrades" :title="t('dashboard.emptyTitle')" :body="t('dashboard.emptyBody')">
        <div class="flex flex-wrap gap-3">
          <UButton :to="localePath('/trades/new')" color="neutral" size="sm">{{ t('dashboard.recordTrade') }}</UButton>
          <UButton :to="localePath('/assets')" color="neutral" variant="outline" size="sm">{{ t('dashboard.addAsset') }}</UButton>
        </div>
      </EmptyState>

      <div v-else class="mt-8 grid gap-8 lg:grid-cols-2">
        <section>
          <h2 class="text-sm text-muted">{{ t('dashboard.assetOverview') }}</h2>
          <p v-if="!data.holdings.length" class="mt-3 text-sm text-dimmed">{{ t('dashboard.noHoldings') }}</p>
          <NuxtLink
            v-for="holding in data.holdings"
            :key="holding.assetId"
            :to="localePath({ path: '/trades', query: { asset: holding.assetId } })"
            class="row-link"
          >
            <span class="flex min-w-0 items-center gap-3">
              <AssetMark :symbol="holding.symbol" :icon="holding.icon" size="sm" />
              <span class="min-w-0">
                <span class="block font-medium text-highlighted">{{ holding.symbol }}</span>
                <span class="num mt-1 block text-xs text-dimmed">{{ format.qty(holding.currentQuantity) }} {{ holding.symbol }}</span>
              </span>
            </span>
            <span class="text-end">
              <MoneyText
                v-if="holding.currentValueUsd != null && holding.currentValueToman != null"
                :usd="holding.currentValueUsd"
                :toman="holding.currentValueToman"
                size="sm"
                lead="usd"
              />
              <span v-else class="block text-xs text-dimmed">{{ t('trades.priceMissing') }}</span>
              <span v-if="holding.totalPnlUsd != null && holding.totalPnlToman != null" class="mt-2 block">
                <MoneyText :usd="holding.totalPnlUsd" :toman="holding.totalPnlToman" signed size="sm" lead="usd" />
              </span>
            </span>
          </NuxtLink>
        </section>

        <section>
          <h2 class="text-sm text-muted">{{ t('dashboard.openTrades') }}</h2>
          <p v-if="!data.openTrades.length" class="mt-3 text-sm text-dimmed">{{ t('dashboard.noOpenTrades') }}</p>
          <NuxtLink
            v-for="trade in data.openTrades"
            :key="trade.id"
            :to="localePath(`/trades/${trade.id}`)"
            class="row-link"
          >
            <span class="min-w-0">
              <span class="block font-medium text-highlighted">{{ trade.asset.symbol }}</span>
              <span class="mt-1 block truncate text-sm text-muted">{{ trade.title || trade.asset.name }}</span>
              <span class="num mt-1 block text-xs text-dimmed">
                {{ t('trades.remainingQty') }} {{ format.qty(trade.remainingQuantity) }}
              </span>
            </span>
            <span class="text-end">
              <MoneyText
                v-if="trade.totalPnlUsd != null && trade.totalPnlToman != null"
                :usd="trade.totalPnlUsd"
                :toman="trade.totalPnlToman"
                signed
                size="sm"
                lead="usd"
              />
              <template v-else>
                <MoneyText :usd="trade.realizedPnlUsd" :toman="trade.realizedPnlToman" signed size="sm" lead="usd" />
                <span class="mt-1 block text-xs text-dimmed">{{ t('trades.realized') }}</span>
              </template>
              <span class="mt-1 block text-xs text-dimmed">{{ statusText(trade.status, trade.isOversold) }}</span>
            </span>
          </NuxtLink>
        </section>
      </div>

      <section v-if="hasTrades" class="mt-10">
        <div class="mb-1 flex items-baseline justify-between">
          <h2 class="text-sm text-muted">{{ t('dashboard.activity') }}</h2>
          <NuxtLink :to="localePath('/trades')" class="text-xs text-dimmed underline underline-offset-4">
            {{ t('dashboard.viewAll') }}
          </NuxtLink>
        </div>
        <p v-if="!data.recentActivity.length" class="mt-3 text-sm text-dimmed">{{ t('dashboard.noActivity') }}</p>
        <NuxtLink
          v-for="entry in data.recentActivity"
          :key="entry.id"
          :to="localePath(`/trades/${entry.tradeId}`)"
          class="row-link"
        >
          <span class="min-w-0">
            <span class="text-xs font-medium" :class="entry.side === 'buy' ? 'text-gain' : 'text-loss'">
              {{ entry.side === 'buy' ? t('trades.buy') : t('trades.sell') }}
            </span>
            <span class="mt-1 block font-medium text-highlighted">{{ entry.symbol }}</span>
            <span v-if="entry.tradeTitle" class="mt-1 block truncate text-sm text-muted">{{ entry.tradeTitle }}</span>
            <span class="num mt-1 block text-sm">{{ signedQty(entry.side, entry.quantity) }} {{ entry.symbol }}</span>
            <span class="num mt-1 block text-xs text-dimmed">{{ format.dateTime(entry.transactedAt) }}</span>
          </span>
          <MoneyText :usd="entry.totalUsd" :toman="entry.totalToman" size="sm" lead="usd" />
        </NuxtLink>
      </section>
    </template>
  </div>
</template>
