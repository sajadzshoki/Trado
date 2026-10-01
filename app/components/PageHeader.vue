<script setup lang="ts">
defineProps<{
  title: string
  subtitle?: string
  kicker?: string
}>()
</script>

<template>
  <header class="mb-8 flex items-end justify-between gap-4">
    <div class="min-w-0">
      <p v-if="kicker" class="kicker mb-2">{{ kicker }}</p>
      <h1 class="text-[1.65rem] font-medium leading-none tracking-tight text-highlighted">{{ title }}</h1>
      <p v-if="subtitle" class="mt-3 max-w-xl text-sm leading-6 text-muted">{{ subtitle }}</p>
    </div>
    <div v-if="$slots.actions" class="shrink-0">
      <slot name="actions" />
    </div>
  </header>
</template>
