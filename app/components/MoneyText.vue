<script setup lang="ts">
const props = withDefaults(defineProps<{
  usd: string
  toman: string
  signed?: boolean
  size?: 'sm' | 'md' | 'lg'
}>(), {
  signed: false,
  size: 'md',
})

const { user } = useUserSession()
const format = useFormatters()

const primaryCurrency = computed(() => user.value?.displayCurrency === 'TOMAN' ? 'TOMAN' : 'USD')
const primary = computed(() => primaryCurrency.value === 'USD'
  ? format.usd(props.usd, props.signed)
  : format.toman(props.toman, props.signed))
const secondary = computed(() => primaryCurrency.value === 'USD'
  ? format.toman(props.toman, props.signed)
  : format.usd(props.usd, props.signed))
const tone = computed(() => props.signed ? format.tone(primaryCurrency.value === 'USD' ? props.usd : props.toman) : '')
const sizeClass = computed(() => {
  if (props.size === 'lg') return 'text-[1.65rem] leading-none'
  if (props.size === 'sm') return 'text-sm'
  return 'text-base'
})
</script>

<template>
  <span class="inline-flex flex-col items-end text-end" :class="tone">
    <bdi class="num" :class="sizeClass">{{ primary }}</bdi>
    <bdi class="num mt-1 text-xs text-muted">{{ secondary }}</bdi>
  </span>
</template>
