<script setup lang="ts">
import type { AssetRecord, EntryPayload, TradeDetail, TradeSide } from '~~/shared/types/journal'
import { positionAfter } from '~~/shared/utils/trade-math'
import { resolveEntryAmounts } from '~~/shared/utils/numbers'

definePageMeta({ middleware: 'authenticated' })

const { t } = useI18n()
const localePath = useLocalePath()
const route = useRoute()
const format = useFormatters()
const { message } = useApiError()

const tradeId = computed(() => String(route.params.id))
const { data, pending, error, refresh } = await useFetch<TradeDetail>(() => `/api/trades/${tradeId.value}`)

useHead({ title: () => data.value ? (data.value.title || data.value.asset.symbol) : t('trades.title') })

const { data: assets } = await useFetch<AssetRecord[]>('/api/assets')

const showAdd = ref(false)
const addSide = ref<TradeSide>('buy')
const editingId = ref<string | null>(null)
const confirmDeleteTrade = ref(false)
const confirmDeleteEntry = ref<string | null>(null)
const actionPending = ref(false)
const formError = ref('')
const resetToken = ref(0)
const detailsSaved = ref(false)
const openedEmpty = ref(false)

const details = reactive({
  title: '',
  notes: '',
  assetId: '',
})

watch(data, (trade) => {
  if (!trade) return
  details.title = trade.title ?? ''
  details.notes = trade.notes ?? ''
  details.assetId = trade.asset.id
  if (!trade.entries.length && !openedEmpty.value) {
    openedEmpty.value = true
    showAdd.value = true
    addSide.value = 'buy'
  }
}, { immediate: true })

const editing = computed(() => data.value?.entries.find(entry => entry.id === editingId.value) ?? null)
const assetIcon = computed(() => assets.value?.find(asset => asset.id === data.value?.asset.id)?.icon ?? null)

const assetOptions = computed(() => {
  const rows = assets.value ?? []
  return rows
    .filter(asset => asset.isActive || asset.id === details.assetId)
    .map(asset => ({
      label: asset.isActive
        ? `${asset.symbol} · ${asset.name}`
        : `${asset.symbol} · ${asset.name} · ${t('assets.inactive')}`,
      value: asset.id,
    }))
})

function statusText(trade: TradeDetail) {
  if (trade.isOversold) return t('trades.oversold')
  if (trade.status === 'closed') return t('trades.statusClosed')
  if (trade.status === 'open') return t('trades.statusOpen')
  return t('trades.noEntries')
}

function availableLabel() {
  if (!data.value) return ''
  return t('trades.available', {
    qty: `${format.qty(data.value.remainingQuantity)} ${data.value.asset.symbol}`,
  })
}

function exceeds(entry: EntryPayload, replacingId?: string) {
  if (!data.value) return false
  const solved = resolveEntryAmounts(entry)
  if (!solved.ok) return false
  const change = replacingId
    ? { op: 'replace' as const, id: replacingId, side: entry.side, quantity: solved.value.quantity }
    : { op: 'add' as const, side: entry.side, quantity: solved.value.quantity }
  return positionAfter(data.value.entries, change).exceeded
}

async function run(work: () => Promise<unknown>) {
  formError.value = ''
  actionPending.value = true
  try {
    await work()
    await refresh()
  }
  catch (cause) {
    formError.value = message(cause)
  }
  finally {
    actionPending.value = false
  }
}

function openAdd(side: TradeSide) {
  addSide.value = side
  editingId.value = null
  showAdd.value = true
  formError.value = ''
}

function addEntry(entry: EntryPayload) {
  if (exceeds(entry)) {
    formError.value = t('validation.insufficient_quantity')
    return
  }
  return run(async () => {
    await $fetch(`/api/trades/${tradeId.value}/entries`, { method: 'POST', body: entry })
    resetToken.value += 1
    showAdd.value = true
  })
}

function saveEntry(entry: EntryPayload) {
  if (!editingId.value) return
  if (exceeds(entry, editingId.value)) {
    formError.value = t('validation.insufficient_quantity')
    return
  }
  const id = editingId.value
  return run(async () => {
    await $fetch(`/api/entries/${id}`, { method: 'PATCH', body: entry })
    editingId.value = null
  })
}

function deleteEntry(id: string) {
  return run(async () => {
    await $fetch(`/api/entries/${id}`, { method: 'DELETE' })
    confirmDeleteEntry.value = null
    if (editingId.value === id) editingId.value = null
  })
}

function saveDetails() {
  detailsSaved.value = false
  return run(async () => {
    await $fetch(`/api/trades/${tradeId.value}`, {
      method: 'PATCH',
      body: {
        title: details.title.trim() || null,
        notes: details.notes.trim() || null,
        assetId: details.assetId,
      },
    })
    detailsSaved.value = true
  })
}

async function deleteTrade() {
  actionPending.value = true
  formError.value = ''
  try {
    await $fetch(`/api/trades/${tradeId.value}`, { method: 'DELETE' })
    await navigateTo(localePath('/trades'))
  }
  catch (cause) {
    formError.value = message(cause)
    actionPending.value = false
  }
}
</script>

<template>
  <div>
    <NuxtLink :to="localePath('/trades')" class="text-sm text-muted">{{ t('trades.back') }}</NuxtLink>

    <p v-if="pending && !data" class="mt-8 text-sm text-dimmed">{{ t('common.loading') }}</p>
    <div v-else-if="error" class="mt-8 space-y-3">
      <p class="text-sm text-loss">{{ error.statusCode === 404 ? t('trades.notFound') : message(error) }}</p>
      <button type="button" class="text-sm underline underline-offset-4" @click="refresh()">{{ t('common.retry') }}</button>
    </div>

    <template v-else-if="data">
      <header class="mt-6 mb-8 flex items-start gap-3">
        <AssetMark :symbol="data.asset.symbol" :icon="assetIcon" />
        <div class="min-w-0">
          <p class="kicker">{{ statusText(data) }}</p>
          <h1 class="mt-2 text-[1.7rem] font-medium tracking-tight text-highlighted">
            {{ data.title || data.asset.symbol }}
          </h1>
          <p class="mt-2 text-sm text-muted">{{ data.asset.name }} · {{ data.asset.symbol }}</p>
        </div>
      </header>

      <section class="story-grid" :aria-label="t('trades.summary')">
        <article class="story-card">
          <p class="text-xs text-dimmed">{{ t('trades.boughtStory') }}</p>
          <p class="num mt-2 text-lg text-highlighted">{{ format.qty(data.buyQuantity) }}</p>
          <p class="mt-1 text-xs text-muted">{{ data.asset.symbol }}</p>
          <div class="mt-3">
            <MoneyText :usd="data.buyUsd" :toman="data.buyToman" size="sm" align="start" />
          </div>
        </article>
        <article class="story-card">
          <p class="text-xs text-dimmed">{{ t('trades.soldStory') }}</p>
          <p class="num mt-2 text-lg text-highlighted">{{ format.qty(data.sellQuantity) }}</p>
          <p class="mt-1 text-xs text-muted">{{ data.asset.symbol }}</p>
          <div class="mt-3">
            <MoneyText :usd="data.sellUsd" :toman="data.sellToman" size="sm" align="start" />
          </div>
        </article>
        <article class="story-card">
          <p class="text-xs text-dimmed">{{ t('trades.remainsStory') }}</p>
          <p class="num mt-2 text-lg text-highlighted">{{ format.qty(data.remainingQuantity) }}</p>
          <p class="mt-1 text-xs text-muted">{{ data.asset.symbol }}</p>
          <div class="mt-3">
            <MoneyText
              v-if="data.currentValueUsd != null && data.currentValueToman != null"
              :usd="data.currentValueUsd"
              :toman="data.currentValueToman"
              size="sm"
              align="start"
            />
            <p v-else class="text-xs text-dimmed">{{ t('trades.priceMissing') }}</p>
          </div>
        </article>
      </section>

      <section class="mt-4 grid gap-3 sm:grid-cols-2">
        <div class="surface p-4">
          <p class="text-xs text-dimmed">{{ t('trades.realized') }}</p>
          <div class="mt-2">
            <MoneyText :usd="data.realizedPnlUsd" :toman="data.realizedPnlToman" signed size="sm" align="start" />
          </div>
        </div>
        <div class="surface p-4">
          <p class="text-xs text-dimmed">{{ data.totalPnlUsd != null ? t('trades.totalPnl') : t('trades.unrealized') }}</p>
          <div class="mt-2">
            <MoneyText
              v-if="data.totalPnlUsd != null && data.totalPnlToman != null"
              :usd="data.totalPnlUsd"
              :toman="data.totalPnlToman"
              signed
              size="sm"
              align="start"
            />
            <NuxtLink v-else :to="localePath('/assets')" class="text-sm text-muted underline underline-offset-4">
              {{ t('trades.setPrice') }}
            </NuxtLink>
          </div>
        </div>
      </section>
      <p v-if="data.averageBuyUsd" class="mt-3 text-xs text-dimmed">
        {{ t('trades.avgBuy') }}
        <bdi class="num">{{ format.usd(data.averageBuyUsd) }}</bdi>
        <bdi v-if="data.averageBuyToman" class="num"> · {{ format.toman(data.averageBuyToman) }}</bdi>
      </p>
      <p class="mt-2 text-xs leading-5 text-dimmed">{{ t('trades.methodNote') }}</p>
      <p v-if="data.isOversold" class="mt-2 text-sm text-loss">
        {{ t('trades.unmatchedSell') }}: <bdi class="num">{{ format.qty(data.unmatchedSellQuantity) }}</bdi>
      </p>

      <section class="mt-10">
        <h2 class="text-sm text-muted">{{ t('trades.timeline') }}</h2>
        <div class="mt-3 grid grid-cols-2 gap-2">
          <button type="button" class="choice" data-side="buy" :aria-pressed="showAdd && addSide === 'buy' && !editingId" @click="openAdd('buy')">
            {{ t('trades.addBuy') }}
          </button>
          <button type="button" class="choice" data-side="sell" :aria-pressed="showAdd && addSide === 'sell' && !editingId" @click="openAdd('sell')">
            {{ t('trades.addSell') }}
          </button>
        </div>

        <div v-if="showAdd && !editingId" class="mt-6 border-b border-default pb-8">
          <EntryForm
            :symbol="data.asset.symbol"
            :pending="actionPending"
            :submit-label="t('trades.saveEntry')"
            :preset-side="addSide"
            :reset-token="resetToken"
            :error="formError"
            :available-label="addSide === 'sell' ? availableLabel() : ''"
            @submit="addEntry"
          />
        </div>

        <p v-if="!data.entries.length" class="mt-4 text-sm text-dimmed">{{ t('trades.noEntries') }}</p>

        <article v-for="entry in timeline" :key="entry.id" class="timeline-item" :data-side="entry.side">
          <div class="flex items-start justify-between gap-4">
            <div>
              <p class="text-sm font-medium" :class="entry.side === 'buy' ? 'text-gain' : 'text-loss'">
                {{ entry.side === 'buy' ? t('trades.buy') : t('trades.sell') }}
              </p>
              <p class="num mt-1 text-sm">{{ format.qty(entry.quantity) }} {{ data.asset.symbol }}</p>
              <p class="num mt-1 text-xs text-dimmed">{{ t('trades.unitPriceShort') }} {{ format.usd(entry.unitPriceUsd) }}</p>
              <p class="num mt-1 text-xs text-dimmed">{{ format.dateTime(entry.transactedAt) }}</p>
              <p v-if="entry.note" class="mt-2 text-sm text-muted">{{ entry.note }}</p>
            </div>
            <div class="text-end">
              <bdi class="num block text-sm">{{ format.usd(entry.totalUsd) }}</bdi>
              <bdi class="num mt-1 block text-xs text-muted">{{ format.toman(entry.totalToman) }}</bdi>
            </div>
          </div>
          <div class="mt-3 flex gap-4 text-xs">
            <button type="button" class="text-muted" @click="editingId = editingId === entry.id ? null : entry.id; showAdd = false">
              {{ t('common.edit') }}
            </button>
            <button type="button" class="text-muted" @click="confirmDeleteEntry = entry.id">
              {{ t('trades.deleteEntry') }}
            </button>
          </div>
          <div v-if="editing && editing.id === entry.id" class="mt-4">
            <EntryForm
              :symbol="data.asset.symbol"
              :pending="actionPending"
              :submit-label="t('trades.saveEntry')"
              :initial="entry"
              :error="formError"
              @submit="saveEntry"
            />
          </div>
        </article>
      </section>

      <section class="mt-10">
        <h2 class="text-sm text-muted">{{ t('trades.editDetails') }}</h2>
        <form class="mt-4 space-y-4" @submit.prevent="saveDetails">
          <label class="block text-sm">
            <span class="mb-2 block text-muted">{{ t('trades.asset') }}</span>
            <USelect v-model="details.assetId" :items="assetOptions" class="w-full" />
          </label>
          <label class="block text-sm">
            <span class="mb-2 block text-muted">{{ t('trades.titleLabel') }}</span>
            <UInput v-model="details.title" class="w-full" />
            <span class="mt-1 block text-xs text-dimmed">{{ t('trades.titleHint') }}</span>
          </label>
          <label class="block text-sm">
            <span class="mb-2 block text-muted">{{ t('trades.notes') }}</span>
            <UTextarea v-model="details.notes" :rows="3" class="w-full" />
          </label>
          <p v-if="detailsSaved" class="text-sm text-muted">{{ t('settings.saved') }}</p>
          <UButton type="submit" color="neutral" variant="outline" :loading="actionPending">
            {{ t('trades.saveDetails') }}
          </UButton>
        </form>
      </section>

      <section class="mt-12 border-t border-default pt-6">
        <button type="button" class="text-sm text-loss" @click="confirmDeleteTrade = true">
          {{ t('trades.deleteTrade') }}
        </button>
      </section>

      <ConfirmDialog
        v-model:open="confirmDeleteTrade"
        :title="t('trades.deleteTrade')"
        :body="t('trades.deleteTradeConfirm')"
        :confirm-label="t('trades.confirmDelete')"
        :pending="actionPending"
        @confirm="deleteTrade"
      />
      <ConfirmDialog
        :open="confirmDeleteEntry != null"
        :title="t('trades.deleteEntry')"
        :body="t('trades.deleteEntryConfirm')"
        :confirm-label="t('trades.confirmDelete')"
        :pending="actionPending"
        @update:open="value => { if (!value) confirmDeleteEntry = null }"
        @confirm="confirmDeleteEntry && deleteEntry(confirmDeleteEntry)"
      />

      <p v-if="formError && !showAdd && !editingId" class="mt-6 text-sm text-loss" role="alert">{{ formError }}</p>
    </template>
  </div>
</template>
