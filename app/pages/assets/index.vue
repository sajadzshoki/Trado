<script setup lang="ts">
import { z } from 'zod'
import type { AssetRecord } from '~~/shared/types/journal'

definePageMeta({ middleware: 'authenticated' })

const { t } = useI18n()
const { message } = useApiError()

useHead({ title: () => t('assets.title') })

const { data, pending, error, refresh } = await useFetch<AssetRecord[]>('/api/assets')
const creating = ref(false)
const editingId = ref<string | null>(null)
const confirmId = ref<string | null>(null)
const formError = ref('')
const state = reactive({ symbol: '', name: '' })

const schema = computed(() => z.object({
  symbol: z.string().trim().min(1, t('validation.required')).max(12, t('validation.symbol')),
  name: z.string().trim().min(1, t('validation.required')).max(64, t('validation.too_long')),
}))

function startEdit(asset: AssetRecord) {
  editingId.value = asset.id
  state.symbol = asset.symbol
  state.name = asset.name
  formError.value = ''
}

function resetForm() {
  state.symbol = ''
  state.name = ''
  editingId.value = null
  creating.value = false
}

async function onSubmit() {
  formError.value = ''
  creating.value = true
  try {
    if (editingId.value) {
      await $fetch(`/api/assets/${editingId.value}`, { method: 'PATCH', body: state })
    }
    else {
      await $fetch('/api/assets', { method: 'POST', body: state })
    }
    resetForm()
    await refresh()
  }
  catch (cause) {
    formError.value = message(cause)
  }
  finally {
    creating.value = false
  }
}

async function remove(id: string) {
  formError.value = ''
  try {
    await $fetch(`/api/assets/${id}`, { method: 'DELETE' })
    confirmId.value = null
    await refresh()
  }
  catch (cause) {
    formError.value = message(cause)
  }
}
</script>

<template>
  <div>
    <PageHeader :title="t('assets.title')" :subtitle="t('assets.subtitle')" />

    <p v-if="pending && !data" class="text-sm text-dimmed">{{ t('common.loading') }}</p>
    <div v-else-if="error" class="space-y-3">
      <p class="text-sm text-loss">{{ message(error) }}</p>
      <button type="button" class="text-sm underline underline-offset-4" @click="refresh()">{{ t('common.retry') }}</button>
    </div>

    <template v-else>
      <EmptyState v-if="data && !data.length && !editingId" :title="t('assets.emptyTitle')" :body="t('assets.emptyBody')" />

      <div v-if="data?.length" class="mb-8">
        <article v-for="asset in data" :key="asset.id" class="border-b border-default py-4">
          <div class="flex items-start justify-between gap-4">
            <div>
              <p class="font-medium text-highlighted">{{ asset.symbol }}</p>
              <p class="mt-1 text-sm text-muted">{{ asset.name }}</p>
              <p class="mt-1 text-xs text-dimmed">{{ t('assets.tradeCount', { count: asset.tradeCount }) }}</p>
            </div>
            <div class="flex gap-3 text-xs">
              <button type="button" class="text-muted" @click="startEdit(asset)">{{ t('assets.edit') }}</button>
              <button type="button" class="text-muted" @click="confirmId = asset.id">{{ t('assets.delete') }}</button>
            </div>
          </div>
          <p v-if="confirmId === asset.id" class="mt-3 text-sm text-muted">
            {{ t('assets.deleteConfirm') }}
            <button type="button" class="ms-3 text-loss" @click="remove(asset.id)">{{ t('trades.confirmDelete') }}</button>
            <button type="button" class="ms-3" @click="confirmId = null">{{ t('trades.cancel') }}</button>
          </p>
        </article>
      </div>

      <h2 class="text-sm text-muted">{{ editingId ? t('assets.edit') : t('assets.add') }}</h2>
      <UForm :schema="schema" :state="state" class="mt-4 space-y-4" @submit="onSubmit">
        <UFormField :label="t('assets.symbol')" name="symbol" :hint="t('assets.symbolHint')" required>
          <UInput v-model="state.symbol" autocapitalize="characters" autocomplete="off" class="w-full" />
        </UFormField>
        <UFormField :label="t('assets.name')" name="name" :hint="t('assets.nameHint')" required>
          <UInput v-model="state.name" autocomplete="off" class="w-full" />
        </UFormField>
        <p v-if="formError" class="text-sm text-loss" role="alert">{{ formError }}</p>
        <div class="flex gap-3">
          <UButton type="submit" color="neutral" :loading="creating">{{ t('assets.save') }}</UButton>
          <UButton v-if="editingId" type="button" color="neutral" variant="ghost" @click="resetForm">
            {{ t('common.cancel') }}
          </UButton>
        </div>
      </UForm>
    </template>
  </div>
</template>
