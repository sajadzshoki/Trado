<script setup lang="ts">
import type { TradeSummary } from '~~/shared/types/journal'

const props = defineProps<{ trade: TradeSummary }>()
const { t } = useI18n()
const localePath = useLocalePath()
const format = useFormatters()

const status = computed(() => {
  if (props.trade.isOversold) return t('trades.oversold')
  if (props.trade.status === 'closed') return t('trades.statusClosed')
  if (props.trade.status === 'open') return t('trades.statusOpen')
  return t('trades.noEntries')
})
</script>

<template>
  <NuxtLink :to="localePath(`/trades/${trade.id}`)" class="block border-b border-default py-4">
    <div class="flex items-baseline justify-between gap-3">
      <p class="min-w-0 truncate">
        <span class="font-medium text-highlighted">{{ trade.asset.symbol }}</span>
        <span class="text-muted"> {{ trade.title || trade.asset.name }}</span>
      </p>
      <span class="shrink-0 text-xs text-dimmed">{{ status }}</span>
    </div>
    <p v-if="!trade.isEmpty" class="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-dimmed">
      <span>{{ t('trades.boughtQty') }} <bdi class="num">{{ format.qty(trade.buyQuantity) }}</bdi></span>
      <span>{{ t('trades.soldQty') }} <bdi class="num">{{ format.qty(trade.sellQuantity) }}</bdi></span>
      <span>{{ t('trades.remainingQty') }} <bdi class="num">{{ format.qty(trade.remainingQuantity) }}</bdi></span>
    </p>
    <p v-if="trade.averageBuyUsd" class="num mt-1 text-xs text-dimmed">
      {{ t('trades.avgBuy') }} {{ format.usd(trade.averageBuyUsd) }}
    </p>
    <div v-if="!trade.isEmpty" class="mt-3 flex items-start justify-between gap-4">
      <span class="pt-1 text-xs text-dimmed">
        {{ trade.totalPnlUsd != null ? t('trades.totalPnl') : t('trades.realized') }}
      </span>
      <MoneyText
        v-if="trade.totalPnlUsd != null && trade.totalPnlToman != null"
        :usd="trade.totalPnlUsd"
        :toman="trade.totalPnlToman"
        signed
        size="sm"
      />
      <MoneyText v-else :usd="trade.realizedPnlUsd" :toman="trade.realizedPnlToman" signed size="sm" />
    </div>
  </NuxtLink>
</template>
