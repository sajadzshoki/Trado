<script setup lang="ts">
const { t } = useI18n()
</script>

<template>
  <div class="flex min-h-dvh flex-col px-5 py-8 sm:justify-center">
    <div class="mx-auto flex w-full max-w-[24rem] flex-1 flex-col sm:flex-none">
      <AppMark />
      <p class="mt-3 text-sm text-muted">{{ t('app.tagline') }}</p>
      <div class="mt-10">
        <slot />
      </div>
      <div class="mt-auto pt-10 sm:mt-10">
        <LocaleSwitch />
      </div>
    </div>
  </div>
</template>
