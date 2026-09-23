<script setup lang="ts">
import { z } from 'zod'
import { MAX_NAME_LENGTH, MIN_PASSWORD_LENGTH } from '~~/shared/constants'
import { normalizePhone } from '~~/shared/utils/phone'

definePageMeta({
  layout: 'auth',
  middleware: 'guest-only',
})

const { t, locale } = useI18n()
const localePath = useLocalePath()
const { fetch: refreshSession } = useUserSession()
const { message } = useApiError()

useHead({ title: () => t('auth.registerTitle') })

const pending = ref(false)
const formError = ref('')
const state = reactive({
  displayName: '',
  phone: '',
  password: '',
  confirmPassword: '',
})

const schema = computed(() => z.object({
  displayName: z.string().trim().max(MAX_NAME_LENGTH, t('validation.too_long')).optional(),
  phone: z.string().trim().min(1, t('validation.required')).refine(value => normalizePhone(value) !== null, t('validation.invalid_phone')),
  password: z.string().min(MIN_PASSWORD_LENGTH, t('validation.password_min')),
  confirmPassword: z.string().min(1, t('validation.required')),
}).refine(data => data.password === data.confirmPassword, {
  path: ['confirmPassword'],
  message: t('validation.password_mismatch'),
}))

async function onSubmit() {
  formError.value = ''
  pending.value = true
  try {
    await $fetch('/api/auth/register', {
      method: 'POST',
      body: {
        phone: state.phone,
        password: state.password,
        displayName: state.displayName.trim() || null,
        locale: locale.value,
        displayCurrency: 'USD',
      },
    })
    await refreshSession()
    await navigateTo(localePath('/'))
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
    <h1 class="text-2xl font-medium tracking-tight text-highlighted">{{ t('auth.registerTitle') }}</h1>

    <UForm :schema="schema" :state="state" class="mt-8 space-y-5" @submit="onSubmit">
      <UFormField :label="t('auth.displayName')" name="displayName" :hint="t('auth.displayNameHint')">
        <UInput v-model="state.displayName" autocomplete="name" class="w-full" />
      </UFormField>
      <UFormField :label="t('auth.phone')" name="phone" :hint="t('auth.phoneHint')" required>
        <UInput v-model="state.phone" type="tel" autocomplete="username" inputmode="tel" class="w-full" />
      </UFormField>
      <UFormField :label="t('auth.password')" name="password" :hint="t('auth.passwordHint')" required>
        <UInput v-model="state.password" type="password" autocomplete="new-password" class="w-full" />
      </UFormField>
      <UFormField :label="t('auth.confirmPassword')" name="confirmPassword" required>
        <UInput v-model="state.confirmPassword" type="password" autocomplete="new-password" class="w-full" />
      </UFormField>
      <p v-if="formError" class="text-sm text-loss" role="alert">{{ formError }}</p>
      <UButton type="submit" color="neutral" class="w-full justify-center" :loading="pending">
        {{ t('auth.submitRegister') }}
      </UButton>
    </UForm>

    <p class="mt-6 text-sm text-muted">
      {{ t('auth.hasAccount') }}
      <NuxtLink :to="localePath('/login')" class="text-highlighted underline underline-offset-4">
        {{ t('auth.loginLink') }}
      </NuxtLink>
    </p>
  </div>
</template>
