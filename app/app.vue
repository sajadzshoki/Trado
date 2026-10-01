<script setup lang="ts">
const { t, locale } = useI18n()

useHead({
  titleTemplate: (title) => {
    const name = t('app.name')
    return title && title !== name ? `${title} · ${name}` : name
  },
  htmlAttrs: {
    class: 'dark',
    lang: computed(() => locale.value === 'fa' ? 'fa' : 'en'),
    dir: computed(() => locale.value === 'fa' ? 'rtl' : 'ltr'),
  },
  meta: [
    { name: 'description', content: () => t('app.description') },
  ],
})
</script>

<template>
  <UApp>
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
