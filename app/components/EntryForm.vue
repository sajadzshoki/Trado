<script setup lang="ts">
import { z } from 'zod'
import type { EntryPayload, TradeSide } from '~~/shared/types/journal'
import { LAST_RATE_KEY } from '~~/shared/constants'
import { AMOUNT_FIELDS, formatInputDecimal, formatToman, fromDateTimeLocal, parsePositiveDecimal, solveAmount, toDateTimeLocal, transactionDateIssue, trimDecimal, type AmountField } from '~~/shared/utils/numbers'

const props = defineProps<{
  symbol?: string
  pending?: boolean
  submitLabel: string
  initial?: (EntryPayload & { totalUsd?: string | null }) | null
  presetSide?: TradeSide
  resetToken?: number
  error?: string
  availableLabel?: string
}>()

const emit = defineEmits<{
  submit: [payload: EntryPayload]
}>()

const { t, locale } = useI18n()
const localError = ref('')
const derived = ref<AmountField>('totalUsd')
const recent = ref<AmountField[]>(['quantity', 'unitPriceUsd'])
let writing = false

const state = reactive({
  side: 'buy' as TradeSide,
  quantity: '',
  unitPriceUsd: '',
  totalUsd: '',
  usdTomanRate: '',
  transactedAt: toDateTimeLocal(),
  note: '',
})

function applyInitial(initial?: (EntryPayload & { totalUsd?: string | null }) | null) {
  state.side = initial?.side ?? props.presetSide ?? 'buy'
  if (!initial) return
  state.quantity = trimDecimal(initial.quantity)
  state.unitPriceUsd = trimDecimal(initial.unitPriceUsd)
  state.totalUsd = initial.totalUsd ? trimDecimal(initial.totalUsd) : ''
  state.usdTomanRate = trimDecimal(initial.usdTomanRate)
  state.transactedAt = toDateTimeLocal(new Date(initial.transactedAt))
  state.note = initial.note ?? ''
  derived.value = 'totalUsd'
  recent.value = ['quantity', 'unitPriceUsd']
  if (!state.totalUsd) writeDerived()
}

applyInitial(props.initial)

onMounted(() => {
  if (!props.initial && !state.usdTomanRate) {
    state.usdTomanRate = localStorage.getItem(LAST_RATE_KEY) ?? ''
  }
})

watch(() => props.initial, value => applyInitial(value))
watch(() => props.presetSide, (side) => {
  if (side && !props.initial) state.side = side
})

watch(() => props.resetToken, () => {
  state.quantity = ''
  state.unitPriceUsd = ''
  state.totalUsd = ''
  state.note = ''
  state.transactedAt = toDateTimeLocal()
  state.side = props.presetSide ?? state.side
  derived.value = 'totalUsd'
  recent.value = ['quantity', 'unitPriceUsd']
  localError.value = ''
})

watch(locale, () => writeDerived())

const schema = computed(() => z.object({
  quantity: z.string().optional(),
  unitPriceUsd: z.string().optional(),
  totalUsd: z.string().optional(),
  usdTomanRate: z.string().trim().min(1, t('validation.required')),
  transactedAt: z.string().min(1, t('validation.required')),
  note: z.string().max(500, t('validation.too_long')).optional(),
}))

function onAmount(field: AmountField, value: string | number) {
  const text = String(value ?? '')
  state[field] = text
  if (writing) return
  const without = recent.value.filter(item => item !== field)
  recent.value = [...without, field].slice(-2)
  derived.value = AMOUNT_FIELDS.find(item => !recent.value.includes(item)) ?? 'totalUsd'
  writeDerived()
}

function writeDerived() {
  const target = derived.value
  const sources = AMOUNT_FIELDS.filter(item => item !== target)
  const left = parsePositiveDecimal(state[sources[0]!])
  const right = parsePositiveDecimal(state[sources[1]!])
  if (!left.ok || !right.ok) {
    if (state[target]) {
      writing = true
      state[target] = ''
      writing = false
    }
    return
  }
  const next = formatInputDecimal(solveAmount(sources[0]!, left.value, sources[1]!, right.value), locale.value)
  if (state[target] === next) return
  writing = true
  state[target] = next
  writing = false
}

const tomanPreview = computed(() => {
  const total = parsePositiveDecimal(state.totalUsd)
  const rate = parsePositiveDecimal(state.usdTomanRate)
  if (!total.ok || !rate.ok) return null
  return formatToman(total.value.mul(rate.value).toFixed(4), locale.value === 'fa' ? 'fa-IR' : 'en-US')
})

function fieldLabel(field: AmountField) {
  if (field === 'quantity') return t('trades.quantity')
  if (field === 'unitPriceUsd') return t('trades.unitPrice')
  return t('trades.total')
}

function onSubmit() {
  localError.value = ''
  writeDerived()
  const filled = AMOUNT_FIELDS.filter(field => parsePositiveDecimal(state[field]).ok)
  if (filled.length < 2) {
    localError.value = t('validation.need_two')
    return
  }
  const rate = parsePositiveDecimal(state.usdTomanRate)
  if (!rate.ok) {
    localError.value = t(`validation.${rate.code}`)
    return
  }
  const dateIssue = transactionDateIssue(fromDateTimeLocal(state.transactedAt) ?? '')
  if (dateIssue) {
    localError.value = t(`validation.${dateIssue}`)
    return
  }
  if (state.note.trim().length > 500) {
    localError.value = t('validation.too_long')
    return
  }
  localStorage.setItem(LAST_RATE_KEY, state.usdTomanRate.trim())
  emit('submit', {
    side: state.side,
    quantity: state.quantity,
    unitPriceUsd: state.unitPriceUsd,
    totalUsd: state.totalUsd,
    solveFor: derived.value,
    usdTomanRate: state.usdTomanRate,
    transactedAt: fromDateTimeLocal(state.transactedAt)!,
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
      <p v-if="state.side === 'sell' && availableLabel" class="mt-2 text-xs text-dimmed">
        {{ availableLabel }}
      </p>
    </fieldset>

    <p class="text-xs leading-5 text-dimmed">{{ t('trades.solveHint') }}</p>

    <div v-for="field in AMOUNT_FIELDS" :key="field" :class="{ 'is-calculated': derived === field }">
      <UFormField :label="fieldLabel(field)" :name="field" :hint="derived === field ? t('trades.calculated') : undefined">
        <UInput
          :model-value="state[field]"
          inputmode="decimal"
          autocomplete="off"
          class="w-full"
          @update:model-value="onAmount(field, $event)"
        />
      </UFormField>
    </div>

    <UFormField :label="t('trades.rate')" name="usdTomanRate" :hint="t('trades.rateHint')" required>
      <UInput v-model="state.usdTomanRate" inputmode="decimal" autocomplete="off" class="w-full" />
    </UFormField>

    <div v-if="tomanPreview" class="is-calculated py-1" aria-live="polite">
      <p class="text-xs text-dimmed">{{ t('trades.tomanValue') }} · {{ t('trades.calculated') }}</p>
      <p class="num mt-1 text-sm text-muted">{{ tomanPreview }}</p>
    </div>

    <UFormField :label="t('trades.date')" name="transactedAt" required>
      <UInput v-model="state.transactedAt" type="datetime-local" class="w-full" />
    </UFormField>

    <UFormField :label="t('trades.note')" name="note" :hint="t('common.optional')">
      <UTextarea v-model="state.note" :rows="2" class="w-full" />
    </UFormField>

    <p v-if="localError || error" class="text-sm text-loss" role="alert">{{ localError || error }}</p>

    <UButton type="submit" color="neutral" class="w-full justify-center" :loading="pending">
      {{ submitLabel }}
    </UButton>
  </UForm>
</template>
