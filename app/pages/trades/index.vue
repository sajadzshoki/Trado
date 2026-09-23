<script setup lang="ts">
import type { TradeSummary } from '~~/shared/types/journal'

definePageMeta({ middleware: 'authenticated' })

const { t } = useI18n()
const localePath = useLocalePath()
const format = useFormatters()
const { message } = useApiError()

useHead({ title: () => t('trades.title') })

const { data, pending, error, refresh } = await useFetch<TradeSummary[]>('/api/trades')
</script>

<template>
  <div>
    <PageHeader :title="t('trades.title')" :subtitle="t('trades.subtitle')">
      <template #actions>
        <UButton :to="localePath('/trades/new')" color="neutral" size="sm">
          {{ t('trades.new') }}
        </UButton>
      </template>
    </PageHeader>

    <p v-if="pending && !data" class="text-sm text-dimmed" role="status">{{ t('common.loading') }}</p>
    <div v-else-if="error" class="space-y-3">
      <p class="text-sm text-loss" role="alert">{{ message(error) }}</p>
      <button type="button" class="text-sm underline underline-offset-4" @click="refresh()">{{ t('common.retry') }}</button>
    </div>
    <EmptyState v-else-if="data && !data.length" :title="t('trades.emptyTitle')" :body="t('trades.emptyBody')">
      <UButton :to="localePath('/trades/new')" color="neutral" size="sm">{{ t('trades.new') }}</UButton>
    </EmptyState>
    <div v-else-if="data">
      <NuxtLink
        v-for="trade in data"
        :key="trade.id"
        :to="localePath(`/trades/${trade.id}`)"
        class="row-link"
      >
        <div class="min-w-0">
          <div class="flex items-baseline gap-2">
            <span class="font-medium text-highlighted">{{ trade.asset.symbol }}</span>
            <span class="truncate text-sm text-muted">{{ trade.title || trade.asset.name }}</span>
          </div>
          <p class="mt-1 text-xs text-dimmed">
            {{ t('trades.entryCount', { count: trade.entryCount }) }}
            ·
            <template v-if="trade.isEmpty">{{ t('trades.noEntries') }}</template>
            <template v-else-if="trade.isOversold">{{ t('trades.oversold') }}</template>
            <template v-else-if="trade.isFlat">{{ t('trades.flat') }}</template>
            <template v-else>{{ t('trades.remaining', { qty: format.qty(trade.remainingQuantity) }) }}</template>
          </p>
          <p v-if="trade.lastTransactedAt" class="num mt-1 text-xs text-dimmed">
            {{ format.dateTime(trade.lastTransactedAt) }}
          </p>
        </div>
        <MoneyText
          v-if="!trade.isEmpty"
          :usd="trade.realizedPnlUsd"
          :toman="trade.realizedPnlToman"
          signed
          size="sm"
        />
      </NuxtLink>
    </div>
  </div>
</template>
