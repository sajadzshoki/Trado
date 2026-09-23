<script setup lang="ts">
import type { AssetRecord, EntryPayload, TradeDetail } from '~~/shared/types/journal'

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
const editingId = ref<string | null>(null)
const confirmDeleteTrade = ref(false)
const confirmDeleteEntry = ref<string | null>(null)
const actionPending = ref(false)
const formError = ref('')
const resetToken = ref(0)
const detailsSaved = ref(false)

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
  if (!trade.entries.length) showAdd.value = true
}, { immediate: true })

const editing = computed(() => data.value?.entries.find(entry => entry.id === editingId.value) ?? null)

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

function addEntry(entry: EntryPayload) {
  return run(async () => {
    await $fetch(`/api/trades/${tradeId.value}/entries`, { method: 'POST', body: entry })
    resetToken.value += 1
    showAdd.value = false
  })
}

function saveEntry(entry: EntryPayload) {
  if (!editingId.value) return
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

function statusLabel(trade: TradeDetail) {
  if (trade.isEmpty) return t('trades.noEntries')
  if (trade.isOversold) return t('trades.oversold')
  if (trade.isFlat) return t('trades.flat')
  return t('trades.remaining', { qty: format.qty(trade.remainingQuantity) })
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
      <header class="mt-6 mb-8">
        <p class="kicker">{{ statusLabel(data) }}</p>
        <h1 class="mt-2 text-[1.7rem] font-medium tracking-tight text-highlighted">
          {{ data.title || data.asset.symbol }}
        </h1>
        <p class="mt-2 text-sm text-muted">{{ data.asset.name }} · {{ data.asset.symbol }}</p>
      </header>

      <section>
        <h2 class="text-sm text-muted">{{ t('trades.summary') }}</h2>
        <div class="mt-2">
          <div class="flex items-start justify-between gap-4 border-b border-default py-3">
            <span class="text-sm text-muted">{{ t('dashboard.realizedPnl') }}</span>
            <MoneyText :usd="data.realizedPnlUsd" :toman="data.realizedPnlToman" signed />
          </div>
          <div class="flex items-baseline justify-between gap-4 border-b border-default py-3 text-sm">
            <span class="text-muted">{{ t('trades.boughtQty') }}</span>
            <bdi class="num">{{ format.qty(data.buyQuantity) }} {{ data.asset.symbol }}</bdi>
          </div>
          <div class="flex items-baseline justify-between gap-4 border-b border-default py-3 text-sm">
            <span class="text-muted">{{ t('trades.soldQty') }}</span>
            <bdi class="num">{{ format.qty(data.sellQuantity) }} {{ data.asset.symbol }}</bdi>
          </div>
          <div class="flex items-baseline justify-between gap-4 border-b border-default py-3 text-sm">
            <span class="text-muted">{{ t('trades.remainingQty') }}</span>
            <bdi class="num">{{ format.qty(data.remainingQuantity) }} {{ data.asset.symbol }}</bdi>
          </div>
          <div v-if="data.averageBuyUsd" class="flex items-start justify-between gap-4 border-b border-default py-3">
            <span class="text-sm text-muted">{{ t('trades.avgBuy') }}</span>
            <span class="text-end">
              <bdi class="num block text-sm">{{ format.usd(data.averageBuyUsd) }}</bdi>
              <bdi v-if="data.averageBuyToman" class="num mt-1 block text-xs text-muted">{{ format.toman(data.averageBuyToman) }}</bdi>
            </span>
          </div>
          <div v-if="data.averageSellUsd" class="flex items-start justify-between gap-4 border-b border-default py-3">
            <span class="text-sm text-muted">{{ t('trades.avgSell') }}</span>
            <span class="text-end">
              <bdi class="num block text-sm">{{ format.usd(data.averageSellUsd) }}</bdi>
              <bdi v-if="data.averageSellToman" class="num mt-1 block text-xs text-muted">{{ format.toman(data.averageSellToman) }}</bdi>
            </span>
          </div>
          <div v-if="data.isOversold" class="flex items-baseline justify-between gap-4 border-b border-default py-3 text-sm">
            <span class="text-muted">{{ t('trades.unmatchedSell') }}</span>
            <bdi class="num text-loss">{{ format.qty(data.unmatchedSellQuantity) }}</bdi>
          </div>
        </div>
        <p class="mt-3 text-xs leading-5 text-dimmed">{{ t('trades.methodNote') }}</p>
      </section>

      <section class="mt-10">
        <div class="mb-2 flex items-center justify-between">
          <h2 class="text-sm text-muted">{{ t('trades.detailEntries') }}</h2>
          <button type="button" class="text-sm text-highlighted" @click="showAdd = !showAdd; editingId = null">
            {{ t('trades.addEntry') }}
          </button>
        </div>

        <div v-if="showAdd" class="mb-8 border-b border-default pb-8">
          <EntryForm
            :symbol="data.asset.symbol"
            :pending="actionPending"
            :submit-label="t('trades.saveEntry')"
            :reset-token="resetToken"
            @submit="addEntry"
          />
        </div>

        <p v-if="!data.entries.length" class="text-sm text-dimmed">{{ t('trades.noEntries') }}</p>

        <article v-for="entry in data.entries" :key="entry.id" class="border-b border-default py-4">
          <div class="flex items-start justify-between gap-4">
            <div>
              <p class="text-sm">
                <span :class="entry.side === 'buy' ? 'text-gain' : 'text-loss'">
                  {{ entry.side === 'buy' ? t('trades.buy') : t('trades.sell') }}
                </span>
                <bdi class="num ms-2">{{ format.qty(entry.quantity) }} {{ data.asset.symbol }}</bdi>
              </p>
              <p class="num mt-1 text-xs text-dimmed">{{ format.dateTime(entry.transactedAt) }}</p>
              <p v-if="entry.note" class="mt-2 text-sm text-muted">{{ entry.note }}</p>
            </div>
            <div class="text-end">
              <bdi class="num block text-sm">{{ format.usd(entry.totalUsd) }}</bdi>
              <bdi class="num mt-1 block text-xs text-muted">{{ format.toman(entry.totalToman) }}</bdi>
              <p class="num mt-1 text-xs text-dimmed">{{ format.usd(entry.unitPriceUsd) }}</p>
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
          <p v-if="confirmDeleteEntry === entry.id" class="mt-3 text-sm text-muted">
            {{ t('trades.deleteEntryConfirm') }}
            <button type="button" class="ms-3 text-loss" :disabled="actionPending" @click="deleteEntry(entry.id)">{{ t('trades.confirmDelete') }}</button>
            <button type="button" class="ms-3" @click="confirmDeleteEntry = null">{{ t('trades.cancel') }}</button>
          </p>
          <div v-if="editing && editing.id === entry.id" class="mt-4">
            <EntryForm
              :symbol="data.asset.symbol"
              :pending="actionPending"
              :submit-label="t('trades.saveEntry')"
              :initial="entry"
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
            <USelect
              v-model="details.assetId"
              :items="(assets || []).map(asset => ({ label: `${asset.symbol} · ${asset.name}`, value: asset.id }))"
              class="w-full"
            />
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
        <button type="button" class="text-sm text-loss" @click="confirmDeleteTrade = !confirmDeleteTrade">
          {{ t('trades.deleteTrade') }}
        </button>
        <div v-if="confirmDeleteTrade" class="mt-3">
          <p class="text-sm text-muted">{{ t('trades.deleteTradeConfirm') }}</p>
          <div class="mt-3 flex gap-4">
            <button type="button" class="text-sm text-loss" :disabled="actionPending" @click="deleteTrade">{{ t('trades.confirmDelete') }}</button>
            <button type="button" class="text-sm text-muted" @click="confirmDeleteTrade = false">{{ t('trades.cancel') }}</button>
          </div>
        </div>
      </section>

      <p v-if="formError" class="mt-6 text-sm text-loss" role="alert">{{ formError }}</p>
    </template>
  </div>
</template>
