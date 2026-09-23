<script setup lang="ts">
const props = withDefaults(defineProps<{
  symbol: string
  icon?: string | null
  size?: 'sm' | 'md'
}>(), {
  icon: null,
  size: 'md',
})

const safeIcon = computed(() => props.icon?.startsWith('data:image/') ? props.icon : null)
</script>

<template>
  <span
    class="asset-mark"
    :class="props.size === 'sm' ? 'size-8 text-[0.7rem]' : 'size-10 text-xs'"
    aria-hidden="true"
  >
    <img v-if="safeIcon" :src="safeIcon" alt="">
    <span v-else class="num">{{ props.symbol.slice(0, 1) }}</span>
  </span>
</template>
