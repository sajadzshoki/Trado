<script setup lang="ts">
import type { AssetRecord, EntryPayload, TradeDetail, TradeSide } from '~~/shared/types/journal'
import { resolveEntryAmounts } from '~~/shared/utils/numbers'

definePageMeta({ middleware: 'authenticated' })

const { t } = useI18n()
const localePath = useLocalePath()
const route = useRoute()
const format = useFormatters()
const { message } = useApiError()

useHead({ title: () => t('trades.createTitle') })

const { data: assets, pending: assetsPending, error: assetsError } = await useFetch<AssetRecord[]>('/api/assets')

const step = ref(1)
const assetId = ref(String(route.query.asset ?? ''))
const side = ref<TradeSide>('buy')
const title = ref('')
const draft = ref<EntryPayload | null>(null)
const pending = ref(false)
const formError = ref('')

const selectable = computed(() => (assets.value ?? []).filter(asset => asset.isActive))
const selected = computed(() => selectable.value.find(asset => asset.id === assetId.value) ?? null)
const review = computed(() => {
  if (!draft.value) return null
  const solved = resolveEntryAmounts(draft.value)
  return solved.ok ? solved.value : null
})

watch(selectable, (rows) => {
  if (!assets.value) return
  if (rows.some(asset => asset.id === assetId.value)) {
    if (route.query.asset && step.value === 1) step.value = 2
    return
  }
  assetId.value = ''
}, { immediate: true })

function chooseAsset(id: string) {
  assetId.value = id
  step.value = 2
}

function chooseSide(next: TradeSide) {
  if (next === 'sell') return
  side.value = next
  step.value = 3
}

function onDraft(entry: EntryPayload) {
  draft.value = { ...entry, side: side.value }
  formError.value = ''
  step.value = 4
}

async function save() {
  if (!assetId.value || !draft.value) return
  formError.value = ''
  pending.value = true
  try {
    const trade = await $fetch<TradeDetail>('/api/trades', {
      method: 'POST',
      body: {
        assetId: assetId.value,
        title: title.value.trim() || null,
        entry: draft.value,
      },
    })
    await navigateTo(localePath(`/trades/${trade.id}`))
  }
  catch (error) {
    formError.value = message(error)
  }
  finally {
    pending.value = false
  }
}
</script>

<template>
  <div>
    <button v-if="step > 1" type="button" class="text-sm text-muted" @click="step -= 1">
      {{ t('trades.backStep') }}
    </button>
    <NuxtLink v-else :to="localePath('/trades')" class="text-sm text-muted">{{ t('trades.back') }}</NuxtLink>

    <p class="kicker mt-6">{{ t('trades.stepOf', { step, total: 4 }) }}</p>
    <h1 class="mt-2 text-[1.7rem] font-medium tracking-tight text-highlighted">
      {{ step === 1 ? t('trades.stepAssetTitle') : step === 2 ? t('trades.stepSideTitle') : step === 3 ? t('trades.stepValuesTitle') : t('trades.stepReviewTitle') }}
    </h1>
    <p class="mt-2 max-w-xl text-sm leading-6 text-muted">
      {{ step === 1 ? t('trades.stepAssetBody') : step === 2 ? t('trades.stepSideBody') : step === 3 ? t('trades.stepValuesBody') : t('trades.stepReviewBody') }}
    </p>

    <p v-if="assetsPending" class="mt-8 text-sm text-dimmed">{{ t('common.loading') }}</p>
    <p v-else-if="assetsError" class="mt-8 text-sm text-loss">{{ message(assetsError) }}</p>
    <EmptyState v-else-if="assets && !assets.length" class="mt-6" :title="t('trades.noAssetsTitle')" :body="t('trades.noAssetsBody')">
      <UButton :to="localePath('/assets')" color="neutral" size="sm">{{ t('dashboard.addAsset') }}</UButton>
    </EmptyState>
    <EmptyState v-else-if="!selectable.length" class="mt-6" :title="t('trades.noActiveTitle')" :body="t('trades.noActiveBody')">
      <UButton :to="localePath('/assets')" color="neutral" size="sm">{{ t('nav.assets') }}</UButton>
    </EmptyState>

    <div v-else class="mt-8">
      <div v-if="step === 1" class="grid gap-2">
        <button
          v-for="asset in selectable"
          :key="asset.id"
          type="button"
          class="pick"
          :aria-pressed="assetId === asset.id"
          @click="chooseAsset(asset.id)"
        >
          <AssetMark :symbol="asset.symbol" :icon="asset.icon" size="sm" />
          <span class="min-w-0">
            <span class="block font-medium text-highlighted">{{ asset.symbol }}</span>
            <span class="block truncate text-sm text-muted">{{ asset.name }}</span>
          </span>
        </button>
      </div>

      <div v-else-if="step === 2" class="grid gap-2">
        <button type="button" class="pick" data-side="buy" @click="chooseSide('buy')">
          <span class="text-gain">{{ t('trades.buy') }}</span>
          <span class="text-sm text-muted">{{ selected?.symbol }}</span>
        </button>
        <button type="button" class="pick" data-side="sell" disabled>
          <span>{{ t('trades.sell') }}</span>
        </button>
        <p class="text-xs leading-5 text-dimmed">{{ t('trades.firstMustBuy') }}</p>
      </div>

      <div v-else-if="step === 3 && selected">
        <p class="mb-4 text-sm text-muted">{{ t('trades.buy') }} · {{ selected.symbol }}</p>
        <EntryForm
          :key="`${side}-${draft?.transactedAt ?? 'new'}`"
          :symbol="selected.symbol"
          hide-side
          preset-side="buy"
          :initial="draft"
          :submit-label="t('trades.review')"
          :error="formError"
          @submit="onDraft"
        />
      </div>

      <div v-else-if="step === 4 && selected && review" class="space-y-5">
        <div class="surface p-4">
          <p class="text-sm text-gain">{{ t('trades.buy') }}</p>
          <p class="mt-1 font-medium text-highlighted">{{ selected.symbol }} · {{ selected.name }}</p>
          <div class="mt-4 space-y-3 text-sm">
            <div class="flex justify-between gap-4">
              <span class="text-muted">{{ t('trades.quantity') }}</span>
              <bdi class="num">{{ format.qty(review.quantity) }} {{ selected.symbol }}</bdi>
            </div>
            <div class="flex justify-between gap-4">
              <span class="text-muted">{{ t('trades.unitPrice') }}</span>
              <bdi class="num">{{ format.usd(review.unitPriceUsd) }}</bdi>
            </div>
            <div class="flex justify-between gap-4">
              <span class="text-muted">{{ t('trades.usdTotal') }}</span>
              <bdi class="num">{{ format.usd(review.totalUsd) }}</bdi>
            </div>
            <div class="is-calculated flex justify-between gap-4">
              <span class="text-muted">{{ t('trades.tomanValue') }}</span>
              <bdi class="num">{{ format.toman(review.totalToman) }}</bdi>
            </div>
            <div class="flex justify-between gap-4">
              <span class="text-muted">{{ t('trades.rate') }}</span>
              <bdi class="num">{{ format.rate(review.usdTomanRate) }}</bdi>
            </div>
            <div class="flex justify-between gap-4">
              <span class="text-muted">{{ t('trades.date') }}</span>
              <bdi class="num">{{ format.dateTime(draft?.transactedAt ?? '') }}</bdi>
            </div>
            <p v-if="draft?.note" class="text-muted">{{ draft.note }}</p>
          </div>
        </div>
        <label class="block text-sm">
          <span class="mb-2 block text-muted">{{ t('trades.titleLabel') }}</span>
          <UInput v-model="title" class="w-full" />
          <span class="mt-1 block text-xs text-dimmed">{{ t('trades.titleHint') }}</span>
        </label>
        <p v-if="formError" class="text-sm text-loss" role="alert">{{ formError }}</p>
        <UButton color="neutral" class="w-full justify-center" :loading="pending" @click="save">
          {{ t('trades.save') }}
        </UButton>
      </div>
    </div>
  </div>
</template>
