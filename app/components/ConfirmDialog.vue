<script setup lang="ts">
const open = defineModel<boolean>('open', { required: true })

defineProps<{
  title: string
  body: string
  confirmLabel: string
  pending?: boolean
}>()

const emit = defineEmits<{ confirm: [] }>()
const { t } = useI18n()
const dialog = ref<HTMLDialogElement | null>(null)
const titleId = useId()

watch(open, async (value) => {
  await nextTick()
  const node = dialog.value
  if (!node) return
  if (value && !node.open) node.showModal()
  if (!value && node.open) node.close()
})

function onClose() {
  open.value = false
}
</script>

<template>
  <dialog ref="dialog" class="confirm-dialog" :aria-labelledby="titleId" @close="onClose">
    <h2 :id="titleId" class="text-base font-medium text-highlighted">{{ title }}</h2>
    <p class="mt-2 text-sm leading-6 text-muted">{{ body }}</p>
    <div class="mt-5 flex justify-end gap-2">
      <button type="button" class="tap px-2 text-sm text-muted" :disabled="pending" autofocus @click="open = false">
        {{ t('common.cancel') }}
      </button>
      <button type="button" class="tap px-2 text-sm text-loss" :disabled="pending" @click="emit('confirm')">
        {{ confirmLabel }}
      </button>
    </div>
  </dialog>
</template>
