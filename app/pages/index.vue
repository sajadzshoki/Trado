<script setup lang="ts">
import type { DashboardRecord } from '~~/shared/types/journal'

definePageMeta({ middleware: 'authenticated' })

const { t } = useI18n()
const localePath = useLocalePath()
const format = useFormatters()
const { message } = useApiError()

useHead({ title: () => t('dashboard.title') })

const { data, pending, error, refresh } = await useFetch<DashboardRecord>('/api/dashboard')

const hasTrades = computed(() => (data.value?.tradeCount ?? 0) > 0)
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
      <section class="rule py-5">
        <p class="text-sm text-muted">{{ t('dashboard.initialCapital') }}</p>
        <div v-if="data.initialCapital" class="mt-3">
          <MoneyText
            :usd="data.initialCapital.amountUsd"
            :toman="data.initialCapital.amountToman"
            size="lg"
          />
          <p class="mt-3 text-xs text-dimmed">
            {{ t('dashboard.recordedOn', { date: format.date(data.initialCapital.recordedAt) }) }}
          </p>
        </div>
        <div v-else class="mt-3">
          <p class="text-sm text-dimmed">{{ t('settings.noCapital') }}</p>
          <NuxtLink :to="localePath('/settings')" class="mt-3 inline-block text-sm text-highlighted underline underline-offset-4">
            {{ t('dashboard.setCapital') }}
          </NuxtLink>
        </div>
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
        <section class="mt-2">
          <div v-for="row in [
            { label: t('dashboard.realizedPnl'), usd: data.realizedPnlUsd, toman: data.realizedPnlToman, signed: true },
            { label: t('dashboard.bought'), usd: data.totalBoughtUsd, toman: data.totalBoughtToman, signed: false },
            { label: t('dashboard.sold'), usd: data.totalSoldUsd, toman: data.totalSoldToman, signed: false },
            { label: t('dashboard.netCashFlow'), usd: data.netCashFlowUsd, toman: data.netCashFlowToman, signed: true },
            { label: t('dashboard.openCost'), usd: data.openCostUsd, toman: data.openCostToman, signed: false },
          ]" :key="row.label" class="flex items-start justify-between gap-4 border-b border-default py-4">
            <dt class="pt-1 text-sm text-muted">{{ row.label }}</dt>
            <MoneyText :usd="row.usd" :toman="row.toman" :signed="row.signed" />
          </div>
          <p class="mt-3 text-xs leading-5 text-dimmed">{{ t('dashboard.realizedHint') }}</p>
          <p class="mt-1 text-xs leading-5 text-dimmed">{{ t('dashboard.netCashHint') }}</p>
        </section>

        <section class="mt-10">
          <h2 class="text-sm text-muted">{{ t('dashboard.openPositions') }}</h2>
          <p v-if="!data.openPositions.length" class="mt-3 text-sm text-dimmed">{{ t('dashboard.noOpenPositions') }}</p>
          <div v-for="position in data.openPositions" :key="position.assetId" class="flex items-start justify-between gap-4 border-b border-default py-4">
            <div>
              <p class="font-medium text-highlighted">{{ position.symbol }}</p>
              <p class="mt-1 text-xs text-dimmed">{{ position.name }}</p>
              <p class="num mt-1 text-xs text-muted">{{ t('dashboard.remaining', { qty: format.qty(position.remainingQuantity) }) }}</p>
            </div>
            <MoneyText :usd="position.openCostUsd" :toman="position.openCostToman" size="sm" />
          </div>
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
          <NuxtLink
            v-for="trade in data.recentTrades"
            :key="trade.id"
            :to="localePath(`/trades/${trade.id}`)"
            class="row-link"
          >
            <div class="min-w-0">
              <p class="font-medium">{{ trade.asset.symbol }}</p>
              <p class="mt-1 truncate text-xs text-dimmed">
                {{ trade.title || trade.asset.name }}
                ·
                {{ trade.isOversold ? t('trades.oversold') : trade.isFlat ? t('trades.flat') : t('trades.remaining', { qty: format.qty(trade.remainingQuantity) }) }}
              </p>
            </div>
            <MoneyText :usd="trade.realizedPnlUsd" :toman="trade.realizedPnlToman" signed size="sm" />
          </NuxtLink>
        </section>

        <p v-if="!data.performance.available" class="mt-10 text-xs leading-5 text-dimmed">
          {{ t('dashboard.performancePending') }}
        </p>
      </template>
    </template>
  </div>
</template>
