<script setup lang="ts">
import type { AssetRecord, EntryPayload, TradeDetail } from '~~/shared/types/journal'
import { positionAfter } from '~~/shared/utils/trade-math'
import { resolveEntryAmounts } from '~~/shared/utils/numbers'

definePageMeta({ middleware: 'authenticated' })

const { t } = useI18n()
const localePath = useLocalePath()
const { message } = useApiError()

useHead({ title: () => t('trades.createTitle') })

const { data: assets, pending: assetsPending, error: assetsError } = await useFetch<AssetRecord[]>('/api/assets')
const assetId = ref('')
const title = ref('')
const pending = ref(false)
const formError = ref('')

const selectable = computed(() => (assets.value ?? []).filter(asset => asset.isActive))

watch(selectable, (rows) => {
  if (!rows.some(asset => asset.id === assetId.value)) assetId.value = rows[0]?.id ?? ''
}, { immediate: true })

const selected = computed(() => selectable.value.find(asset => asset.id === assetId.value))

async function onSubmit(entry: EntryPayload) {
  if (!assetId.value) return
  formError.value = ''
  const solved = resolveEntryAmounts(entry)
  if (solved.ok && positionAfter([], { op: 'add', side: entry.side, quantity: solved.value.quantity }).exceeded) {
    formError.value = t('validation.insufficient_quantity')
    return
  }
  pending.value = true
  try {
    const trade = await $fetch<TradeDetail>('/api/trades', {
      method: 'POST',
      body: {
        assetId: assetId.value,
        title: title.value.trim() || null,
        entry,
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
    <NuxtLink :to="localePath('/trades')" class="text-sm text-muted">{{ t('trades.back') }}</NuxtLink>
    <PageHeader class="mt-6" :title="t('trades.createTitle')" :subtitle="t('trades.createSubtitle')" />

    <p v-if="assetsPending" class="text-sm text-dimmed">{{ t('common.loading') }}</p>
    <p v-else-if="assetsError" class="text-sm text-loss">{{ message(assetsError) }}</p>
    <EmptyState v-else-if="assets && !assets.length" :title="t('trades.noAssetsTitle')" :body="t('trades.noAssetsBody')">
      <UButton :to="localePath('/assets')" color="neutral" size="sm">{{ t('dashboard.addAsset') }}</UButton>
    </EmptyState>
    <EmptyState v-else-if="!selectable.length" :title="t('trades.noActiveTitle')" :body="t('trades.noActiveBody')">
      <UButton :to="localePath('/assets')" color="neutral" size="sm">{{ t('nav.assets') }}</UButton>
    </EmptyState>

    <div v-else class="space-y-5">
      <label class="block">
        <span class="mb-2 block text-sm text-muted">{{ t('trades.asset') }}</span>
        <span class="flex items-center gap-3">
          <AssetMark :symbol="selected?.symbol || '·'" :icon="selected?.icon" size="sm" />
          <USelect
            v-model="assetId"
            :items="selectable.map(asset => ({ label: `${asset.symbol} · ${asset.name}`, value: asset.id }))"
            class="min-w-0 flex-1"
          />
        </span>
      </label>
      <label class="block">
        <span class="mb-2 block text-sm text-muted">{{ t('trades.titleLabel') }}</span>
        <UInput v-model="title" class="w-full" />
        <span class="mt-1 block text-xs text-dimmed">{{ t('trades.titleHint') }}</span>
      </label>
      <p class="text-sm">
        <NuxtLink :to="localePath('/assets')" class="text-muted underline underline-offset-4">{{ t('assets.add') }}</NuxtLink>
      </p>
      <EntryForm
        :symbol="selected?.symbol"
        :pending="pending"
        :submit-label="t('trades.save')"
        :error="formError"
        :available-label="t('trades.available', { qty: '0' })"
        @submit="onSubmit"
      />
    </div>
  </div>
</template>
