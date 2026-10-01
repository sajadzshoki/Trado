<script setup lang="ts">
import { z } from 'zod'
import type { AssetRecord } from '~~/shared/types/journal'
import { EXTERNAL_ASSET_ID_PATTERN, ICON_MIME_TYPES, MAX_ICON_BYTES } from '~~/shared/constants'
import { quoteUnitToman } from '~~/shared/utils/finance'
import { fromDateTimeLocal, parsePositiveDecimal, toDateTimeLocal, trimDecimal } from '~~/shared/utils/numbers'

definePageMeta({ middleware: 'authenticated' })

const { t } = useI18n()
const format = useFormatters()
const { message } = useApiError()

useHead({ title: () => t('assets.title') })

const { data, pending, error, refresh } = await useFetch<AssetRecord[]>('/api/assets')
const creating = ref(false)
const editingId = ref<string | null>(null)
const confirmId = ref<string | null>(null)
const confirmClearId = ref<string | null>(null)
const deletePending = ref(false)
const formSaved = ref(false)
const formError = ref('')
const quotingId = ref<string | null>(null)
const quotePending = ref(false)
const quoteError = ref('')
const quoteState = reactive({
  priceUsd: '',
  usdTomanRate: '',
  quotedAt: toDateTimeLocal(),
})
const state = reactive({
  symbol: '',
  name: '',
  isActive: true,
  icon: null as string | null,
  externalAssetId: '',
})

const schema = computed(() => z.object({
  symbol: z.string().trim().min(1, t('validation.required')).max(12, t('validation.symbol')),
  name: z.string().trim().min(1, t('validation.required')).max(64, t('validation.too_long')),
}))

function focusForm() {
  nextTick(() => document.getElementById('asset-form')?.scrollIntoView({ block: 'start' }))
}

function startCreate() {
  resetForm()
  formSaved.value = false
  formError.value = ''
  focusForm()
}

function startEdit(asset: AssetRecord) {
  editingId.value = asset.id
  state.symbol = asset.symbol
  state.name = asset.name
  state.isActive = asset.isActive
  state.icon = asset.icon
  state.externalAssetId = asset.externalAssetId ?? ''
  formSaved.value = false
  formError.value = ''
  focusForm()
}

function resetForm() {
  state.symbol = ''
  state.name = ''
  state.isActive = true
  state.icon = null
  state.externalAssetId = ''
  editingId.value = null
  creating.value = false
}

function onIcon(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  if (!ICON_MIME_TYPES.includes(file.type as typeof ICON_MIME_TYPES[number])) {
    formError.value = t('validation.invalid_icon')
    return
  }
  if (file.size > MAX_ICON_BYTES) {
    formError.value = t('validation.icon_too_large')
    return
  }
  const reader = new FileReader()
  reader.onload = () => {
    const result = typeof reader.result === 'string' ? reader.result : ''
    if (!result.startsWith('data:image/')) {
      formError.value = t('validation.invalid_icon')
      return
    }
    state.icon = result
    formError.value = ''
  }
  reader.readAsDataURL(file)
}

async function onSubmit() {
  formError.value = ''
  const externalAssetId = state.externalAssetId.trim()
  if (externalAssetId && !EXTERNAL_ASSET_ID_PATTERN.test(externalAssetId)) {
    formError.value = t('validation.external_id')
    return
  }
  creating.value = true
  try {
    const body = {
      symbol: state.symbol,
      name: state.name,
      isActive: state.isActive,
      icon: state.icon,
      externalAssetId: externalAssetId || null,
    }
    if (editingId.value) {
      await $fetch(`/api/assets/${editingId.value}`, { method: 'PATCH', body })
    }
    else {
      await $fetch('/api/assets', { method: 'POST', body })
    }
    resetForm()
    formSaved.value = true
    await refresh()
  }
  catch (cause) {
    formError.value = message(cause)
  }
  finally {
    creating.value = false
  }
}

async function toggle(asset: AssetRecord) {
  formError.value = ''
  try {
    await $fetch(`/api/assets/${asset.id}`, { method: 'PATCH', body: { isActive: !asset.isActive } })
    await refresh()
  }
  catch (cause) {
    formError.value = message(cause)
  }
}

const quotePreview = computed(() => {
  const price = parsePositiveDecimal(quoteState.priceUsd)
  const rate = parsePositiveDecimal(quoteState.usdTomanRate)
  if (!price.ok || !rate.ok) return null
  return quoteUnitToman(price.value.toString(), rate.value.toString())
})

function sourceLabel(source: string) {
  if (source === 'manual') return t('assets.sourceManual')
  return source
}

function startQuote(asset: AssetRecord) {
  quotingId.value = quotingId.value === asset.id ? null : asset.id
  quoteError.value = ''
  quoteState.priceUsd = asset.quote ? trimDecimal(asset.quote.priceUsd) : ''
  quoteState.usdTomanRate = asset.quote ? trimDecimal(asset.quote.usdTomanRate) : ''
  quoteState.quotedAt = toDateTimeLocal(asset.quote ? new Date(asset.quote.quotedAt) : new Date())
}

async function saveQuote(id: string) {
  quoteError.value = ''
  const price = parsePositiveDecimal(quoteState.priceUsd)
  const rate = parsePositiveDecimal(quoteState.usdTomanRate)
  if (!price.ok) {
    quoteError.value = t(`validation.${price.code}`)
    return
  }
  if (!rate.ok) {
    quoteError.value = t(`validation.${rate.code}`)
    return
  }
  const quotedAt = fromDateTimeLocal(quoteState.quotedAt)
  if (!quotedAt) {
    quoteError.value = t('validation.invalid_date')
    return
  }
  quotePending.value = true
  try {
    await $fetch(`/api/assets/${id}/quote`, {
      method: 'PUT',
      body: {
        priceUsd: quoteState.priceUsd,
        usdTomanRate: quoteState.usdTomanRate,
        quotedAt,
      },
    })
    quotingId.value = null
    await refresh()
  }
  catch (cause) {
    quoteError.value = message(cause)
  }
  finally {
    quotePending.value = false
  }
}

async function clearQuote(id: string) {
  quoteError.value = ''
  quotePending.value = true
  try {
    await $fetch(`/api/assets/${id}/quote`, { method: 'DELETE' })
    quotingId.value = null
    confirmClearId.value = null
    await refresh()
  }
  catch (cause) {
    quoteError.value = message(cause)
  }
  finally {
    quotePending.value = false
  }
}

async function remove(id: string) {
  formError.value = ''
  deletePending.value = true
  try {
    await $fetch(`/api/assets/${id}`, { method: 'DELETE' })
    confirmId.value = null
    await refresh()
  }
  catch (cause) {
    formError.value = message(cause)
  }
  finally {
    deletePending.value = false
  }
}
</script>

<template>
  <div>
    <PageHeader :title="t('assets.title')" :subtitle="t('assets.subtitle')">
      <template #actions>
        <button type="button" class="tap text-sm text-highlighted" @click="startCreate">
          {{ t('assets.add') }}
        </button>
      </template>
    </PageHeader>

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
            <div class="flex min-w-0 items-start gap-3">
              <AssetMark :symbol="asset.symbol" :icon="asset.icon" />
              <div class="min-w-0">
                <p class="font-medium text-highlighted">{{ asset.symbol }}</p>
                <p class="mt-1 text-sm text-muted">{{ asset.name }}</p>
                <p class="mt-1 flex flex-wrap gap-x-2 text-xs text-dimmed">
                  <span>{{ asset.isActive ? t('assets.active') : t('assets.inactive') }}</span>
                  <span>{{ t('assets.tradeCount', { count: asset.tradeCount }) }}</span>
                </p>
                <p class="mt-1 text-xs text-dimmed">{{ t('assets.created', { date: format.date(asset.createdAt) }) }}</p>
                <p v-if="asset.externalAssetId" class="mt-1 text-xs text-dimmed">
                  {{ t('assets.externalIdValue', { id: asset.externalAssetId }) }}
                </p>
                <p v-if="asset.priceProvider" class="mt-1 text-xs text-dimmed">
                  {{ t('assets.linkedProvider', { id: asset.priceProvider }) }}
                </p>
              </div>
            </div>
          </div>
          <div class="mt-2 flex flex-wrap gap-1">
            <button type="button" class="tap text-sm text-muted" @click="startEdit(asset)">{{ t('assets.edit') }}</button>
            <button type="button" class="tap text-sm text-muted" @click="toggle(asset)">
              {{ asset.isActive ? t('assets.markInactive') : t('assets.markActive') }}
            </button>
            <button type="button" class="tap text-sm text-muted" @click="confirmId = asset.id">{{ t('assets.delete') }}</button>
          </div>
          <div class="mt-4">
            <p class="text-xs text-dimmed">{{ t('assets.currentPrice') }}</p>
            <template v-if="asset.quote">
              <p class="num mt-1 text-sm">{{ format.usd(asset.quote.priceUsd) }}</p>
              <p class="is-calculated num mt-1 text-xs text-muted">{{ format.toman(asset.quote.priceToman) }}</p>
              <p class="mt-1 text-xs text-dimmed">{{ t('assets.sourceLine', { source: sourceLabel(asset.quote.source) }) }}</p>
              <p class="mt-1 text-xs text-dimmed">{{ t('assets.updated', { date: format.date(asset.quote.quotedAt) }) }}</p>
            </template>
            <p v-else class="mt-1 text-xs text-dimmed">{{ t('assets.noPrice') }}</p>
            <button type="button" class="tap text-sm text-muted" @click="startQuote(asset)">
              {{ asset.quote ? t('common.edit') : t('assets.savePrice') }}
            </button>
          </div>
          <form v-if="quotingId === asset.id" class="mt-4 space-y-3" @submit.prevent="saveQuote(asset.id)">
            <p class="text-xs leading-5 text-dimmed">{{ t('assets.priceHint') }}</p>
            <label class="block text-sm">
              <span class="mb-2 block text-muted">{{ t('trades.unitPrice') }}</span>
              <UInput v-model="quoteState.priceUsd" inputmode="decimal" autocomplete="off" class="w-full" />
            </label>
            <label class="block text-sm">
              <span class="mb-2 block text-muted">{{ t('trades.rate') }}</span>
              <UInput v-model="quoteState.usdTomanRate" inputmode="decimal" autocomplete="off" class="w-full" />
              <span class="mt-1 block text-xs leading-5 text-dimmed">{{ t('assets.priceRateNote') }}</span>
            </label>
            <label class="block text-sm">
              <span class="mb-2 block text-muted">{{ t('trades.date') }}</span>
              <UInput v-model="quoteState.quotedAt" type="datetime-local" class="w-full" />
            </label>
            <p v-if="quotePreview" class="is-calculated text-sm">
              <span class="text-xs text-dimmed">{{ t('trades.calculated') }}</span>
              <bdi class="num mt-1 block text-muted">{{ format.toman(quotePreview) }}</bdi>
            </p>
            <p v-if="quoteError" class="text-sm text-loss" role="alert">{{ quoteError }}</p>
            <div class="flex flex-wrap gap-3">
              <UButton type="submit" color="neutral" size="sm" :loading="quotePending">{{ t('assets.savePrice') }}</UButton>
              <button v-if="asset.quote" type="button" class="tap text-sm text-muted" :disabled="quotePending" @click="confirmClearId = asset.id">
                {{ t('assets.clearPrice') }}
              </button>
            </div>
          </form>
        </article>
      </div>

      <h2 id="asset-form" class="scroll-mt-24 text-sm text-muted">{{ editingId ? t('assets.edit') : t('assets.add') }}</h2>
      <p v-if="formSaved" class="mt-3 text-sm text-muted" role="status">{{ t('common.saved') }}</p>
      <UForm :schema="schema" :state="state" class="mt-4 space-y-4" @submit="onSubmit">
        <div class="flex items-center gap-3">
          <AssetMark :symbol="state.symbol || '·'" :icon="state.icon" />
          <div class="flex flex-wrap items-center gap-3 text-sm">
            <label class="cursor-pointer text-muted underline underline-offset-4">
              {{ t('assets.chooseIcon') }}
              <input type="file" accept="image/png,image/jpeg,image/webp" class="sr-only" @change="onIcon">
            </label>
            <button v-if="state.icon" type="button" class="text-dimmed" @click="state.icon = null">
              {{ t('assets.removeIcon') }}
            </button>
          </div>
        </div>
        <p class="text-xs text-dimmed">{{ t('assets.iconHint') }}</p>

        <UFormField :label="t('assets.symbol')" name="symbol" :hint="t('assets.symbolHint')" required>
          <UInput v-model="state.symbol" autocapitalize="characters" autocomplete="off" class="w-full" />
        </UFormField>
        <UFormField :label="t('assets.name')" name="name" :hint="t('assets.nameHint')" required>
          <UInput v-model="state.name" autocomplete="off" class="w-full" />
        </UFormField>
        <UFormField :label="t('assets.externalId')" name="externalAssetId" :hint="t('assets.externalIdHint')">
          <UInput v-model="state.externalAssetId" autocomplete="off" class="w-full" />
        </UFormField>

        <div>
          <p class="mb-2 text-sm text-muted">{{ t('assets.status') }}</p>
          <div class="grid grid-cols-2 gap-2">
            <button type="button" class="choice" :aria-pressed="state.isActive" @click="state.isActive = true">
              {{ t('assets.active') }}
            </button>
            <button type="button" class="choice" :aria-pressed="!state.isActive" @click="state.isActive = false">
              {{ t('assets.inactive') }}
            </button>
          </div>
          <p class="mt-2 text-xs text-dimmed">{{ t('assets.activeHint') }}</p>
        </div>

        <p v-if="formError" class="text-sm text-loss" role="alert">{{ formError }}</p>
        <div class="flex gap-3">
          <UButton type="submit" color="neutral" :loading="creating">{{ t('assets.save') }}</UButton>
          <UButton v-if="editingId" type="button" color="neutral" variant="ghost" @click="resetForm">
            {{ t('common.cancel') }}
          </UButton>
        </div>
      </UForm>
    </template>

    <ConfirmDialog
      :open="confirmId != null"
      :title="t('assets.delete')"
      :body="t('assets.deleteConfirm')"
      :confirm-label="t('trades.confirmDelete')"
      :pending="deletePending"
      @update:open="value => { if (!value) confirmId = null }"
      @confirm="confirmId && remove(confirmId)"
    />
    <ConfirmDialog
      :open="confirmClearId != null"
      :title="t('assets.clearPrice')"
      :body="t('assets.clearConfirm')"
      :confirm-label="t('assets.clearPrice')"
      :pending="quotePending"
      @update:open="value => { if (!value) confirmClearId = null }"
      @confirm="confirmClearId && clearQuote(confirmClearId)"
    />
  </div>
</template>
