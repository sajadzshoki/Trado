<script setup lang="ts">
import { z } from 'zod'
import { safeInternalPath } from '~~/shared/utils/paths'
import { normalizePhone } from '~~/shared/utils/phone'

definePageMeta({
  layout: 'auth',
  middleware: 'guest-only',
})

const { t } = useI18n()
const localePath = useLocalePath()
const route = useRoute()
const { fetch: refreshSession } = useUserSession()
const { message } = useApiError()

useHead({ title: () => t('auth.loginTitle') })

const pending = ref(false)
const formError = ref('')
const state = reactive({
  phone: '',
  password: '',
})

const schema = computed(() => z.object({
  phone: z.string().trim().min(1, t('validation.required')).refine(value => normalizePhone(value) !== null, t('validation.invalid_phone')),
  password: z.string().min(1, t('validation.required')),
}))

async function onSubmit() {
  formError.value = ''
  pending.value = true
  try {
    await $fetch('/api/auth/login', {
      method: 'POST',
      body: state,
    })
    await refreshSession()
    if (user.value?.locale && user.value.locale !== locale.value) {
      await setLocale(user.value.locale)
    }
    const redirect = safeInternalPath(route.query.redirect)
    await navigateTo(redirect || localePath('/'))
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
    <h1 class="text-2xl font-medium tracking-tight text-highlighted">{{ t('auth.loginTitle') }}</h1>
    <p class="mt-3 text-sm leading-6 text-muted">{{ t('auth.otpLater') }}</p>

    <UForm :schema="schema" :state="state" class="mt-8 space-y-5" @submit="onSubmit">
      <UFormField :label="t('auth.phone')" name="phone" :hint="t('auth.phoneHint')" required>
        <UInput v-model="state.phone" type="tel" autocomplete="username" inputmode="tel" class="w-full" />
      </UFormField>
      <UFormField :label="t('auth.password')" name="password" required>
        <UInput v-model="state.password" type="password" autocomplete="current-password" class="w-full" />
      </UFormField>
      <p v-if="formError" class="text-sm text-loss" role="alert">{{ formError }}</p>
      <UButton type="submit" color="neutral" class="w-full justify-center" :loading="pending">
        {{ t('auth.submitLogin') }}
      </UButton>
    </UForm>

    <p class="mt-6 text-sm text-muted">
      {{ t('auth.noAccount') }}
      <NuxtLink :to="localePath('/register')" class="text-highlighted underline underline-offset-4">
        {{ t('auth.createOne') }}
      </NuxtLink>
    </p>
  </div>
</template>
