export function useFormatters() {
  const { locale } = useI18n()
  const tag = computed(() => locale.value === 'fa' ? 'fa-IR' : 'en-US')

  return {
    tag,
    usd: (value: string, signed = false) => formatUsd(value, tag.value, signed),
    toman: (value: string, signed = false) => formatToman(value, tag.value, signed),
    qty: (value: string) => formatQuantity(value, tag.value),
    rate: (value: string) => formatRate(value, tag.value),
    dateTime: (value: string) => formatDateTime(value, tag.value),
    date: (value: string) => formatDate(value, tag.value),
    tone: (value: string) => {
      const sign = signOf(value)
      if (sign > 0) return 'text-gain'
      if (sign < 0) return 'text-loss'
      return 'text-muted'
    },
  }
}
