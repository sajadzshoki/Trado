<script setup lang="ts">
import { z } from 'zod'
import type { CapitalRecord } from '~~/shared/types/journal'
import { MAX_NAME_LENGTH, MIN_PASSWORD_LENGTH } from '~~/shared/constants'
import { Decimal, formatRate, formatToman, formatUsd, fromDateTimeLocal, parsePositiveDecimal, quoteEntry, toDateTimeLocal, trimDecimal } from '~~/shared/utils/numbers'
import { formatPhone } from '~~/shared/utils/phone'

definePageMeta({ middleware: 'authenticated' })

const { t, locale } = useI18n()
const { user, fetch: refreshSession, clear } = useUserSession()
const localePath = useLocalePath()
const { message } = useApiError()

useHead({ title: () => t('settings.title') })

const { data: capitalData, refresh: refreshCapital } = await useFetch<{ capital: CapitalRecord | null }>('/api/capital')

const profileError = ref('')
const profileSaved = ref(false)
const profilePending = ref(false)
const profile = reactive({ displayName: user.value?.displayName ?? '' })

watch(user, (value) => {
  profile.displayName = value?.displayName ?? ''
})

const capitalError = ref('')
const capitalSaved = ref(false)
const capitalPending = ref(false)
const capital = reactive({
  amountUsd: '',
  usdTomanRate: '',
  recordedAt: toDateTimeLocal(),
})

watch(capitalData, (value) => {
  if (!value?.capital) return
  capital.amountUsd = trimDecimal(value.capital.amountUsd)
  capital.usdTomanRate = trimDecimal(value.capital.usdTomanRate)
  capital.recordedAt = toDateTimeLocal(new Date(value.capital.recordedAt))
}, { immediate: true })

const passwordError = ref('')
const passwordSaved = ref(false)
const passwordPending = ref(false)
const password = reactive({
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
})

const profileSchema = computed(() => z.object({
  displayName: z.string().trim().max(MAX_NAME_LENGTH, t('validation.too_long')),
}))

const capitalSchema = computed(() => z.object({
  amountUsd: z.string().trim().min(1, t('validation.required')),
  usdTomanRate: z.string().trim().min(1, t('validation.required')),
  recordedAt: z.string().min(1, t('validation.required')),
}))

const passwordSchema = computed(() => z.object({
  currentPassword: z.string().min(1, t('validation.required')),
  newPassword: z.string().min(MIN_PASSWORD_LENGTH, t('validation.password_min')),
  confirmPassword: z.string().min(1, t('validation.required')),
}).refine(data => data.newPassword === data.confirmPassword, {
  path: ['confirmPassword'],
  message: t('validation.password_mismatch'),
}))

const capitalPreview = computed(() => {
  const amount = parsePositiveDecimal(capital.amountUsd)
  const rate = parsePositiveDecimal(capital.usdTomanRate)
  if (!amount.ok || !rate.ok) return null
  const quoted = quoteEntry(amount.value, new Decimal(1), rate.value)
  const tag = locale.value === 'fa' ? 'fa-IR' : 'en-US'
  return {
    usd: formatUsd(quoted.totalUsd, tag),
    toman: formatToman(quoted.totalToman, tag),
    rate: formatRate(quoted.usdTomanRate, tag),
  }
})

async function saveProfile() {
  profileError.value = ''
  profileSaved.value = false
  profilePending.value = true
  try {
    await $fetch('/api/settings', {
      method: 'PATCH',
      body: { displayName: profile.displayName.trim() || null },
    })
    await refreshSession()
    profileSaved.value = true
  }
  catch (cause) {
    profileError.value = message(cause)
  }
  finally {
    profilePending.value = false
  }
}

async function saveCurrency(displayCurrency: 'USD' | 'TOMAN') {
  if (user.value?.displayCurrency === displayCurrency) return
  await $fetch('/api/settings', { method: 'PATCH', body: { displayCurrency } })
  await refreshSession()
}

async function saveCapital() {
  capitalError.value = ''
  capitalSaved.value = false
  const amount = parsePositiveDecimal(capital.amountUsd)
  const rate = parsePositiveDecimal(capital.usdTomanRate)
  if (!amount.ok) {
    capitalError.value = t(`validation.${amount.code}`)
    return
  }
  if (!rate.ok) {
    capitalError.value = t(`validation.${rate.code}`)
    return
  }
  const recordedAt = fromDateTimeLocal(capital.recordedAt)
  if (!recordedAt) {
    capitalError.value = t('validation.invalid_date')
    return
  }
  capitalPending.value = true
  try {
    await $fetch('/api/capital', {
      method: 'PUT',
      body: {
        amountUsd: capital.amountUsd,
        usdTomanRate: capital.usdTomanRate,
        recordedAt,
      },
    })
    await refreshCapital()
    capitalSaved.value = true
  }
  catch (cause) {
    capitalError.value = message(cause)
  }
  finally {
    capitalPending.value = false
  }
}

async function savePassword() {
  passwordError.value = ''
  passwordSaved.value = false
  passwordPending.value = true
  try {
    await $fetch('/api/auth/password', {
      method: 'PATCH',
      body: {
        currentPassword: password.currentPassword,
        newPassword: password.newPassword,
      },
    })
    password.currentPassword = ''
    password.newPassword = ''
    password.confirmPassword = ''
    passwordSaved.value = true
  }
  catch (cause) {
    passwordError.value = message(cause)
  }
  finally {
    passwordPending.value = false
  }
}

async function logout() {
  await $fetch('/api/auth/logout', { method: 'POST' })
  await clear()
  await navigateTo(localePath('/login'))
}
</script>

<template>
  <div>
    <PageHeader :title="t('settings.title')" />

    <section class="border-b border-default pb-8">
      <h2 class="text-sm text-muted">{{ t('settings.profile') }}</h2>
      <p class="mt-4 text-xs text-dimmed">{{ t('settings.phone') }}</p>
      <p class="num mt-1 text-sm">{{ user?.phone ? formatPhone(user.phone) : '' }}</p>
      <p class="mt-2 text-xs leading-5 text-dimmed">{{ t('settings.phoneLocked') }}</p>

      <UForm :schema="profileSchema" :state="profile" class="mt-5 space-y-4" @submit="saveProfile">
        <UFormField :label="t('settings.name')" name="displayName">
          <UInput v-model="profile.displayName" autocomplete="name" class="w-full" />
        </UFormField>
        <p v-if="profileSaved" class="text-sm text-muted">{{ t('settings.saved') }}</p>
        <p v-if="profileError" class="text-sm text-loss">{{ profileError }}</p>
        <UButton type="submit" color="neutral" variant="outline" :loading="profilePending">
          {{ t('settings.saveProfile') }}
        </UButton>
      </UForm>
    </section>

    <section class="border-b border-default py-8">
      <h2 class="text-sm text-muted">{{ t('settings.preferences') }}</h2>
      <p class="mt-4 text-sm text-muted">{{ t('settings.language') }}</p>
      <div class="mt-3">
        <LocaleSwitch />
      </div>
      <p class="mt-6 text-sm text-muted">{{ t('settings.currency') }}</p>
      <p class="mt-1 text-xs leading-5 text-dimmed">{{ t('settings.currencyHint') }}</p>
      <div class="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          class="choice"
          :aria-pressed="user?.displayCurrency !== 'TOMAN'"
          @click="saveCurrency('USD')"
        >
          {{ t('money.usd') }}
        </button>
        <button
          type="button"
          class="choice"
          :aria-pressed="user?.displayCurrency === 'TOMAN'"
          @click="saveCurrency('TOMAN')"
        >
          {{ t('money.toman') }}
        </button>
      </div>
    </section>

    <section class="border-b border-default py-8">
      <h2 class="text-sm text-muted">{{ t('settings.capital') }}</h2>
      <p class="mt-2 text-sm leading-6 text-muted">{{ t('settings.capitalHint') }}</p>
      <p v-if="!capitalData?.capital" class="mt-3 text-xs text-dimmed">{{ t('settings.noCapital') }}</p>
      <UForm :schema="capitalSchema" :state="capital" class="mt-5 space-y-4" @submit="saveCapital">
        <UFormField :label="t('settings.amountUsd')" name="amountUsd" required>
          <UInput v-model="capital.amountUsd" inputmode="decimal" autocomplete="off" class="w-full" />
        </UFormField>
        <UFormField :label="t('trades.rate')" name="usdTomanRate" :hint="t('trades.rateHint')" required>
          <UInput v-model="capital.usdTomanRate" inputmode="decimal" autocomplete="off" class="w-full" />
        </UFormField>
        <UFormField :label="t('settings.recordedOn')" name="recordedAt" required>
          <UInput v-model="capital.recordedAt" type="datetime-local" class="w-full" />
        </UFormField>
        <div v-if="capitalPreview" class="rule py-3 text-sm">
          <p class="num">{{ capitalPreview.usd }}</p>
          <p class="mt-3 text-xs text-dimmed">{{ t('settings.equivalent') }}</p>
          <p class="is-calculated num mt-1 text-muted">{{ capitalPreview.toman }}</p>
          <p class="mt-2 text-xs leading-5 text-dimmed">{{ t('settings.capitalRateNote') }}</p>
        </div>
        <p v-if="capitalSaved" class="text-sm text-muted">{{ t('settings.saved') }}</p>
        <p v-if="capitalError" class="text-sm text-loss">{{ capitalError }}</p>
        <UButton type="submit" color="neutral" variant="outline" :loading="capitalPending">
          {{ t('settings.saveCapital') }}
        </UButton>
      </UForm>
    </section>

    <section class="border-b border-default py-8">
      <h2 class="text-sm text-muted">{{ t('settings.security') }}</h2>
      <UForm :schema="passwordSchema" :state="password" class="mt-5 space-y-4" @submit="savePassword">
        <UFormField :label="t('settings.currentPassword')" name="currentPassword" required>
          <UInput v-model="password.currentPassword" type="password" autocomplete="current-password" class="w-full" />
        </UFormField>
        <UFormField :label="t('settings.newPassword')" name="newPassword" :hint="t('auth.passwordHint')" required>
          <UInput v-model="password.newPassword" type="password" autocomplete="new-password" class="w-full" />
        </UFormField>
        <UFormField :label="t('auth.confirmPassword')" name="confirmPassword" required>
          <UInput v-model="password.confirmPassword" type="password" autocomplete="new-password" class="w-full" />
        </UFormField>
        <p v-if="passwordSaved" class="text-sm text-muted">{{ t('settings.saved') }}</p>
        <p v-if="passwordError" class="text-sm text-loss">{{ passwordError }}</p>
        <UButton type="submit" color="neutral" variant="outline" :loading="passwordPending">
          {{ t('settings.savePassword') }}
        </UButton>
      </UForm>
    </section>

    <section class="pt-8">
      <h2 class="text-sm text-muted">{{ t('settings.session') }}</h2>
      <button type="button" class="mt-4 text-sm text-highlighted underline underline-offset-4" @click="logout">
        {{ t('settings.logout') }}
      </button>
    </section>
  </div>
</template>
