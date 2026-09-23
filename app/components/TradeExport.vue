<script setup lang="ts">
const props = defineProps<{
  asset: string
  side: string
  status: string
  from: string
  to: string
  search: string
  sort: string
}>()

const { t } = useI18n()
const { message } = useApiError()
const root = ref<HTMLElement | null>(null)
const open = ref(false)
const pending = ref<'xlsx' | 'pdf' | null>(null)
const error = ref('')

function onDocumentClick(event: MouseEvent) {
  if (!root.value?.contains(event.target as Node)) open.value = false
}

function onKey(event: KeyboardEvent) {
  if (event.key === 'Escape') open.value = false
}

onMounted(() => {
  document.addEventListener('click', onDocumentClick)
  document.addEventListener('keydown', onKey)
})

onUnmounted(() => {
  document.removeEventListener('click', onDocumentClick)
  document.removeEventListener('keydown', onKey)
})

function queryFor(format: 'xlsx' | 'pdf') {
  const query: Record<string, string> = {
    format,
    tz: String(new Date().getTimezoneOffset()),
  }
  if (props.asset) query.asset = props.asset
  if (props.side === 'buy' || props.side === 'sell') query.side = props.side
  if (props.status === 'open' || props.status === 'closed') query.status = props.status
  if (props.from) query.from = props.from
  if (props.to) query.to = props.to
  if (props.search.trim()) query.q = props.search.trim()
  if (props.sort && props.sort !== 'newest') query.sort = props.sort
  return query
}

function filenameFrom(disposition: string | null, format: 'xlsx' | 'pdf') {
  const match = disposition?.match(/filename="([^"]+)"/)
  if (match?.[1]) return match[1]
  const day = new Date().toISOString().slice(0, 10)
  return `trado-trades-${day}.${format}`
}

async function readFailure(cause: unknown) {
  if (cause && typeof cause === 'object' && 'data' in cause && cause.data instanceof Blob) {
    try {
      const parsed = JSON.parse(await cause.data.text()) as unknown
      return message({ data: parsed })
    }
    catch {
      return t('export.failed')
    }
  }
  const text = message(cause)
  return text === t('errors.generic') ? t('export.failed') : text
}

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.rel = 'noopener'
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1500)
}

async function download(format: 'xlsx' | 'pdf') {
  if (pending.value) return
  open.value = false
  pending.value = format
  error.value = ''
  try {
    const response = await $fetch.raw('/api/trades/export', {
      query: queryFor(format),
      responseType: 'blob',
    })
    const blob = response._data
    const type = response.headers.get('content-type') ?? ''
    const expected = format === 'pdf' ? 'application/pdf' : 'spreadsheetml'
    if (!(blob instanceof Blob) || blob.size === 0 || !type.includes(expected)) {
      error.value = t('export.failed')
      return
    }
    saveBlob(blob, filenameFrom(response.headers.get('content-disposition'), format))
  }
  catch (cause) {
    error.value = await readFailure(cause)
  }
  finally {
    pending.value = null
  }
}
</script>

<template>
  <div ref="root" class="relative text-start">
    <button
      type="button"
      class="tap gap-2 rounded-md border border-[var(--ui-border)] px-2.5 text-sm text-highlighted"
      :aria-expanded="open"
      aria-haspopup="menu"
      :aria-controls="'trade-export-menu'"
      :aria-busy="pending ? 'true' : 'false'"
      :disabled="pending !== null"
      @click.stop="open = !open"
    >
      <svg viewBox="0 0 24 24" class="size-4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M12 4v10" />
        <path d="m8 10 4 4 4-4" />
        <path d="M5 19h14" />
      </svg>
      <span class="max-sm:sr-only">{{ pending ? t('export.preparing') : t('export.action') }}</span>
    </button>
    <div
      v-if="open"
      id="trade-export-menu"
      role="menu"
      :aria-label="t('export.menu')"
      class="surface absolute inset-inline-end-0 z-30 mt-1 min-w-36 p-1"
    >
      <button type="button" role="menuitem" class="tap w-full rounded-md px-3 text-sm" @click="download('xlsx')">
        {{ t('export.excel') }}
      </button>
      <button type="button" role="menuitem" class="tap w-full rounded-md px-3 text-sm" @click="download('pdf')">
        {{ t('export.pdf') }}
      </button>
    </div>
    <p v-if="pending" class="mt-1 text-xs text-dimmed" role="status">{{ t('export.preparing') }}</p>
    <p v-if="error" class="mt-1 max-w-48 text-xs text-loss" role="alert">{{ error }}</p>
  </div>
</template>
