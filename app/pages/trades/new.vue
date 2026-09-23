<script setup lang="ts">
import type { AssetRecord, EntryPayload, TradeDetail } from '~~/shared/types/journal'

definePageMeta({ middleware: 'authenticated' })

const { t } = useI18n()
const localePath = useLocalePath()
const { message } = useApiError()

useHead({ title: () => t('trades.createTitle') })

const { data: assets, pending: assetsPending, error: assetsError } = await useFetch<AssetRecord[]>('/api/assets')
const assetId = ref('')
const pending = ref(false)
const formError = ref('')

watch(assets, (rows) => {
  if (!assetId.value && rows?.length) assetId.value = rows[0]!.id
}, { immediate: true })

const selected = computed(() => assets.value?.find(asset => asset.id === assetId.value))

async function onSubmit(entry: EntryPayload) {
  if (!assetId.value) return
  formError.value = ''
  pending.value = true
  try {
    const trade = await $fetch<TradeDetail>('/api/trades', {
      method: 'POST',
      body: { assetId: assetId.value, entry },
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

    <div v-else class="space-y-5">
      <label class="block">
        <span class="mb-2 block text-sm text-muted">{{ t('trades.asset') }}</span>
        <USelect
          v-model="assetId"
          :items="(assets || []).map(asset => ({ label: `${asset.symbol} · ${asset.name}`, value: asset.id }))"
          class="w-full"
        />
      </label>
      <p class="text-sm">
        <NuxtLink :to="localePath('/assets')" class="text-muted underline underline-offset-4">{{ t('assets.add') }}</NuxtLink>
      </p>
      <EntryForm
        :symbol="selected?.symbol"
        :pending="pending"
        :submit-label="t('trades.save')"
        @submit="onSubmit"
      />
      <p v-if="formError" class="text-sm text-loss" role="alert">{{ formError }}</p>
    </div>
  </div>
</template>
