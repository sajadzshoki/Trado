<script setup lang="ts">
import type { TradeSummary } from '~~/shared/types/journal'

definePageMeta({ middleware: 'authenticated' })

const { t } = useI18n()
const localePath = useLocalePath()
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
      <TradeRow v-for="trade in data" :key="trade.id" :trade="trade" />
    </div>
  </div>
</template>
