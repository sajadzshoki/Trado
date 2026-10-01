<script setup lang="ts">
defineProps<{
  title: string
  body: string
}>()
</script>

<template>
  <div class="rule py-8">
    <h2 class="text-lg font-medium text-highlighted">{{ title }}</h2>
    <p class="mt-2 max-w-md text-sm leading-6 text-muted">{{ body }}</p>
    <div v-if="$slots.default" class="mt-5">
      <slot />
    </div>
  </div>
</template>
