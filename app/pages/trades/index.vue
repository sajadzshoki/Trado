<script setup lang="ts">
import type { TradeSummary } from '~~/shared/types/journal'
import { Decimal } from '~~/shared/utils/numbers'

definePageMeta({ middleware: 'authenticated' })

const { t } = useI18n()
const localePath = useLocalePath()
const route = useRoute()
const router = useRouter()
const { message } = useApiError()

useHead({ title: () => t('trades.title') })

const { data, pending, error, refresh } = await useFetch<TradeSummary[]>('/api/trades')

function one(value: unknown) {
  return Array.isArray(value) ? String(value[0] ?? '') : String(value ?? '')
}

const sides = ['all', 'buy', 'sell']
const statuses = ['all', 'open', 'closed']
const sorts = ['newest', 'oldest', 'highest', 'lowest']

const queryText = ref(one(route.query.q))
const assetId = ref(one(route.query.asset))
const side = ref(sides.includes(one(route.query.side)) ? one(route.query.side) : 'all')
const status = ref(statuses.includes(one(route.query.status)) ? one(route.query.status) : 'all')
const from = ref(one(route.query.from))
const to = ref(one(route.query.to))
const sort = ref(sorts.includes(one(route.query.sort)) ? one(route.query.sort) : 'newest')

function desiredQuery() {
  const query: Record<string, string> = {}
  if (queryText.value.trim()) query.q = queryText.value.trim()
  if (assetId.value) query.asset = assetId.value
  if (side.value !== 'all') query.side = side.value
  if (status.value !== 'all') query.status = status.value
  if (from.value) query.from = from.value
  if (to.value) query.to = to.value
  if (sort.value !== 'newest') query.sort = sort.value
  return query
}

function queryMatches(query: Record<string, string>) {
  return ['q', 'asset', 'side', 'status', 'from', 'to', 'sort'].every(key => (query[key] ?? '') === one(route.query[key]))
}

function applyRoute() {
  queryText.value = one(route.query.q)
  assetId.value = one(route.query.asset)
  const nextSide = one(route.query.side)
  const nextStatus = one(route.query.status)
  const nextSort = one(route.query.sort)
  side.value = sides.includes(nextSide) ? nextSide : 'all'
  status.value = statuses.includes(nextStatus) ? nextStatus : 'all'
  from.value = one(route.query.from)
  to.value = one(route.query.to)
  sort.value = sorts.includes(nextSort) ? nextSort : 'newest'
}

watch([queryText, assetId, side, status, from, to, sort], () => {
  const query = desiredQuery()
  if (queryMatches(query)) return
  router.replace({ query })
})

watch(() => route.query, () => {
  if (queryMatches(desiredQuery())) return
  applyRoute()
})

const assets = computed(() => {
  const seen = new Map<string, string>()
  for (const trade of data.value ?? []) seen.set(trade.asset.id, trade.asset.symbol)
  return [...seen.entries()].sort((a, b) => a[1].localeCompare(b[1]))
})

function dayKey(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function when(trade: TradeSummary) {
  return new Date(trade.lastTransactedAt ?? trade.updatedAt).getTime()
}

function pnl(trade: TradeSummary) {
  return new Decimal(trade.totalPnlUsd ?? trade.realizedPnlUsd)
}

const filtered = computed(() => {
  const needle = queryText.value.trim().toLowerCase()
  const rows = (data.value ?? []).filter((trade) => {
    if (assetId.value && trade.asset.id !== assetId.value) return false
    if (side.value === 'buy' && !trade.hasBuy) return false
    if (side.value === 'sell' && !trade.hasSell) return false
    if (status.value === 'open' && trade.status !== 'open') return false
    if (status.value === 'closed' && trade.status !== 'closed') return false
    const day = trade.lastTransactedAt ? dayKey(trade.lastTransactedAt) : ''
    if ((from.value || to.value) && !day) return false
    if (from.value && day < from.value) return false
    if (to.value && day > to.value) return false
    if (!needle) return true
    const title = (trade.title ?? '').toLowerCase()
    return trade.asset.symbol.toLowerCase().includes(needle) || title.includes(needle)
  })
  const copy = rows.slice()
  if (sort.value === 'oldest') copy.sort((a, b) => when(a) - when(b))
  else if (sort.value === 'highest') copy.sort((a, b) => pnl(b).comparedTo(pnl(a)))
  else if (sort.value === 'lowest') copy.sort((a, b) => pnl(a).comparedTo(pnl(b)))
  else copy.sort((a, b) => when(b) - when(a))
  return copy
})

const filtersActive = computed(() => Boolean(
  queryText.value.trim() || assetId.value || side.value !== 'all' || status.value !== 'all' || from.value || to.value || sort.value !== 'newest',
))

function clearFilters() {
  queryText.value = ''
  assetId.value = ''
  side.value = 'all'
  status.value = 'all'
  from.value = ''
  to.value = ''
  sort.value = 'newest'
}
</script>

<template>
  <div>
    <PageHeader :title="t('trades.title')" :subtitle="t('trades.subtitle')" />

    <p v-if="pending && !data" class="text-sm text-dimmed" role="status">{{ t('common.loading') }}</p>
    <div v-else-if="error" class="space-y-3">
      <p class="text-sm text-loss" role="alert">{{ message(error) }}</p>
      <button type="button" class="text-sm underline underline-offset-4" @click="refresh()">{{ t('common.retry') }}</button>
    </div>
    <EmptyState v-else-if="data && !data.length" :title="t('dashboard.emptyTitle')" :body="t('dashboard.emptyBody')">
      <UButton :to="localePath('/trades/new')" color="neutral" size="sm">{{ t('dashboard.recordTrade') }}</UButton>
    </EmptyState>

    <template v-else-if="data">
      <form class="grid gap-3 sm:grid-cols-2" @submit.prevent>
        <label class="block text-sm sm:col-span-2">
          <span class="mb-2 block text-muted">{{ t('trades.search') }}</span>
          <UInput id="trade-search" v-model="queryText" type="search" :placeholder="t('trades.searchPlaceholder')" class="w-full" />
        </label>
        <label class="block text-sm">
          <span class="mb-2 block text-muted">{{ t('trades.asset') }}</span>
          <USelect
            v-model="assetId"
            :items="[{ label: t('trades.allAssets'), value: '' }, ...assets.map(([id, symbol]) => ({ label: symbol, value: id }))]"
            class="w-full"
          />
        </label>
        <label class="block text-sm">
          <span class="mb-2 block text-muted">{{ t('trades.sort') }}</span>
          <USelect
            v-model="sort"
            :items="[
              { label: t('trades.sortNewest'), value: 'newest' },
              { label: t('trades.sortOldest'), value: 'oldest' },
              { label: t('trades.sortHighest'), value: 'highest' },
              { label: t('trades.sortLowest'), value: 'lowest' },
            ]"
            class="w-full"
          />
        </label>
        <fieldset>
          <legend class="mb-2 text-sm text-muted">{{ t('trades.side') }}</legend>
          <div class="grid grid-cols-3 gap-2" role="group">
            <button v-for="item in ['all', 'buy', 'sell']" :key="item" type="button" class="choice" :aria-pressed="side === item" @click="side = item">
              {{ item === 'all' ? t('trades.allSides') : item === 'buy' ? t('trades.buy') : t('trades.sell') }}
            </button>
          </div>
        </fieldset>
        <fieldset>
          <legend class="mb-2 text-sm text-muted">{{ t('trades.status') }}</legend>
          <div class="grid grid-cols-3 gap-2" role="group">
            <button v-for="item in ['all', 'open', 'closed']" :key="item" type="button" class="choice" :aria-pressed="status === item" @click="status = item">
              {{ item === 'all' ? t('trades.allStatuses') : item === 'open' ? t('trades.statusOpen') : t('trades.statusClosed') }}
            </button>
          </div>
        </fieldset>
        <label class="block text-sm">
          <span class="mb-2 block text-muted">{{ t('trades.dateFrom') }}</span>
          <UInput v-model="from" type="date" class="w-full" />
        </label>
        <label class="block text-sm">
          <span class="mb-2 block text-muted">{{ t('trades.dateTo') }}</span>
          <UInput v-model="to" type="date" class="w-full" />
        </label>
      </form>
      <div class="mt-3 flex items-center justify-between gap-3">
        <p class="text-xs text-dimmed" aria-live="polite">{{ t('trades.resultCount', { count: filtered.length }) }}</p>
        <button v-if="filtersActive" type="button" class="text-xs text-muted underline underline-offset-4" @click="clearFilters">
          {{ t('trades.clearFilters') }}
        </button>
      </div>
      <p class="mt-2 text-xs leading-5 text-dimmed">{{ t('trades.sortHint') }}</p>

      <EmptyState v-if="!filtered.length" :title="t('trades.noMatches')" :body="t('trades.noMatchesBody')">
        <UButton color="neutral" variant="outline" size="sm" @click="clearFilters">{{ t('trades.clearFilters') }}</UButton>
      </EmptyState>
      <div v-else class="mt-2">
        <TradeRow v-for="trade in filtered" :key="trade.id" :trade="trade" />
      </div>
    </template>
  </div>
</template>
