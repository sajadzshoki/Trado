<script setup lang="ts">
const props = withDefaults(defineProps<{
  usd: string
  toman: string
  signed?: boolean
  size?: 'sm' | 'md' | 'lg' | 'xl'
  lead?: 'auto' | 'usd'
  align?: 'start' | 'end'
}>(), {
  signed: false,
  size: 'md',
  lead: 'auto',
  align: 'end',
})

const { user } = useUserSession()
const format = useFormatters()

const primaryCurrency = computed(() => props.lead === 'usd' || user.value?.displayCurrency !== 'TOMAN' ? 'USD' : 'TOMAN')
const primary = computed(() => primaryCurrency.value === 'USD'
  ? format.usd(props.usd, props.signed)
  : format.toman(props.toman, props.signed))
const secondary = computed(() => primaryCurrency.value === 'USD'
  ? format.toman(props.toman, props.signed)
  : format.usd(props.usd, props.signed))
const tone = computed(() => props.signed ? format.tone(primaryCurrency.value === 'USD' ? props.usd : props.toman) : '')
const sizeClass = computed(() => {
  if (props.size === 'xl') return 'text-[1.7rem] leading-none min-[380px]:text-[2.15rem] sm:text-[2.55rem]'
  if (props.size === 'lg') return 'text-[1.65rem] leading-none'
  if (props.size === 'sm') return 'text-sm'
  return 'text-base'
})
</script>

<template>
  <span
    class="inline-flex flex-col"
    :class="[tone, props.align === 'start' ? 'items-start text-start' : 'items-end text-end']"
  >
    <bdi class="num" :class="sizeClass">{{ primary }}</bdi>
    <bdi class="num mt-1 text-xs text-muted">{{ secondary }}</bdi>
  </span>
</template>
