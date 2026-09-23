<script setup lang="ts">
import { z } from 'zod'
import type { EntryPayload, TradeSide } from '~~/shared/types/journal'
import { LAST_RATE_KEY } from '~~/shared/constants'
import { fromDateTimeLocal, formatQuantity, formatRate, formatToman, formatUsd, parsePositiveDecimal, quoteEntry, toDateTimeLocal, trimDecimal } from '~~/shared/utils/numbers'

const props = defineProps<{
  symbol?: string
  pending?: boolean
  submitLabel: string
  initial?: EntryPayload | null
  resetToken?: number
}>()

const emit = defineEmits<{
  submit: [payload: EntryPayload]
}>()

const { t, locale } = useI18n()
const localError = ref('')

const state = reactive({
  side: 'buy' as TradeSide,
  quantity: '',
  unitPriceUsd: '',
  usdTomanRate: '',
  transactedAt: toDateTimeLocal(),
  note: '',
})

function applyInitial(initial?: EntryPayload | null) {
  if (!initial) return
  state.side = initial.side
  state.quantity = trimDecimal(initial.quantity)
  state.unitPriceUsd = trimDecimal(initial.unitPriceUsd)
  state.usdTomanRate = trimDecimal(initial.usdTomanRate)
  state.transactedAt = toDateTimeLocal(new Date(initial.transactedAt))
  state.note = initial.note ?? ''
}

applyInitial(props.initial)

onMounted(() => {
  if (!props.initial && !state.usdTomanRate) {
    state.usdTomanRate = localStorage.getItem(LAST_RATE_KEY) ?? ''
  }
})

watch(() => props.initial, value => applyInitial(value))

watch(() => props.resetToken, () => {
  state.quantity = ''
  state.unitPriceUsd = ''
  state.note = ''
  state.transactedAt = toDateTimeLocal()
  localError.value = ''
})

const schema = computed(() => z.object({
  quantity: z.string().trim().min(1, t('validation.required')),
  unitPriceUsd: z.string().trim().min(1, t('validation.required')),
  usdTomanRate: z.string().trim().min(1, t('validation.required')),
  transactedAt: z.string().min(1, t('validation.required')),
  note: z.string().max(500, t('validation.too_long')).optional(),
}))

const preview = computed(() => {
  const quantity = parsePositiveDecimal(state.quantity)
  const price = parsePositiveDecimal(state.unitPriceUsd)
  const rate = parsePositiveDecimal(state.usdTomanRate)
  if (!quantity.ok || !price.ok || !rate.ok) return null
  const quoted = quoteEntry(quantity.value, price.value, rate.value)
  const tag = locale.value === 'fa' ? 'fa-IR' : 'en-US'
  return {
    quantity: formatQuantity(quoted.quantity, tag),
    unit: formatUsd(quoted.unitPriceUsd, tag),
    totalUsd: formatUsd(quoted.totalUsd, tag),
    rate: formatRate(quoted.usdTomanRate, tag),
    totalToman: formatToman(quoted.totalToman, tag),
  }
})

function onSubmit() {
  localError.value = ''
  const fields = [
    parsePositiveDecimal(state.quantity),
    parsePositiveDecimal(state.unitPriceUsd),
    parsePositiveDecimal(state.usdTomanRate),
  ]
  const invalid = fields.find(field => !field.ok)
  if (invalid && !invalid.ok) {
    localError.value = t(`validation.${invalid.code}`)
    return
  }
  const transactedAt = fromDateTimeLocal(state.transactedAt)
  if (!transactedAt) {
    localError.value = t('validation.invalid_date')
    return
  }
  localStorage.setItem(LAST_RATE_KEY, state.usdTomanRate.trim())
  emit('submit', {
    side: state.side,
    quantity: state.quantity,
    unitPriceUsd: state.unitPriceUsd,
    usdTomanRate: state.usdTomanRate,
    transactedAt,
    note: state.note.trim() || null,
  })
}
</script>

<template>
  <UForm :schema="schema" :state="state" class="space-y-5" @submit="onSubmit">
    <fieldset>
      <legend class="mb-2 text-sm text-muted">{{ t('trades.side') }}</legend>
      <div class="grid grid-cols-2 gap-2" role="group" :aria-label="t('trades.side')">
        <button type="button" class="choice" data-side="buy" :aria-pressed="state.side === 'buy'" @click="state.side = 'buy'">
          {{ t('trades.buy') }}
        </button>
        <button type="button" class="choice" data-side="sell" :aria-pressed="state.side === 'sell'" @click="state.side = 'sell'">
          {{ t('trades.sell') }}
        </button>
      </div>
    </fieldset>

    <UFormField :label="t('trades.quantity')" name="quantity" required>
      <UInput v-model="state.quantity" inputmode="decimal" autocomplete="off" class="w-full" />
    </UFormField>

    <UFormField :label="t('trades.unitPrice')" name="unitPriceUsd" required>
      <UInput v-model="state.unitPriceUsd" inputmode="decimal" autocomplete="off" class="w-full" />
    </UFormField>

    <UFormField :label="t('trades.rate')" name="usdTomanRate" :hint="t('trades.rateHint')" required>
      <UInput v-model="state.usdTomanRate" inputmode="decimal" autocomplete="off" class="w-full" />
    </UFormField>

    <UFormField :label="t('trades.date')" name="transactedAt" required>
      <UInput v-model="state.transactedAt" type="datetime-local" class="w-full" />
    </UFormField>

    <UFormField :label="t('trades.note')" name="note" :hint="t('common.optional')">
      <UTextarea v-model="state.note" :rows="2" class="w-full" />
    </UFormField>

    <div v-if="preview" class="rule py-4" aria-live="polite">
      <p class="kicker mb-3">{{ t('trades.preview') }}</p>
      <p class="num text-sm leading-6 text-highlighted">
        {{ preview.quantity }} {{ symbol || '' }} {{ t('money.times') }} {{ preview.unit }} {{ t('money.equals') }} {{ preview.totalUsd }}
      </p>
      <p class="num mt-1 text-sm leading-6 text-muted">
        {{ t('trades.rate') }}: {{ preview.rate }}
      </p>
      <p class="num mt-1 text-sm leading-6 text-muted">
        {{ t('trades.tomanValue') }}: {{ preview.totalToman }}
      </p>
    </div>

    <p v-if="localError" class="text-sm text-loss" role="alert">{{ localError }}</p>

    <UButton type="submit" color="neutral" class="w-full justify-center" :loading="pending">
      {{ submitLabel }}
    </UButton>
  </UForm>
</template>
