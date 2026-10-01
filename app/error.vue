<script setup lang="ts">
import type { NuxtError } from '#app'

const props = defineProps<{ error: NuxtError }>()
const { t } = useI18n()
const localePath = useLocalePath()

function goHome() {
  clearError({ redirect: localePath('/') })
}
</script>

<template>
  <div class="flex min-h-dvh items-center px-6">
    <div class="mx-auto w-full max-w-sm">
      <p class="kicker">{{ props.error.statusCode || 500 }}</p>
      <h1 class="mt-3 text-2xl font-medium tracking-tight">{{ t('errors.generic') }}</h1>
      <button type="button" class="mt-8 text-sm text-muted underline underline-offset-4" @click="goHome">
        {{ t('common.back') }}
      </button>
    </div>
  </div>
</template>
