<script setup lang="ts">
const { locale, setLocale } = useI18n()
const { loggedIn, fetch: refreshSession } = useUserSession()
const pending = ref(false)

async function choose(code: 'en' | 'fa') {
  if (code === locale.value || pending.value) return
  pending.value = true
  try {
    await setLocale(code)
    if (loggedIn.value) {
      await $fetch('/api/settings', { method: 'PATCH', body: { locale: code } })
      await refreshSession()
    }
  }
  finally {
    pending.value = false
  }
}
</script>

<template>
  <div class="flex items-center gap-3 text-xs" role="group" :aria-label="$t('common.language')">
    <button
      type="button"
      class="tracking-wide"
      :class="locale === 'en' ? 'text-highlighted' : 'text-dimmed'"
      :aria-pressed="locale === 'en'"
      @click="choose('en')"
    >
      EN
    </button>
    <span class="text-dimmed" aria-hidden="true">/</span>
    <button
      type="button"
      :class="locale === 'fa' ? 'text-highlighted' : 'text-dimmed'"
      :aria-pressed="locale === 'fa'"
      @click="choose('fa')"
    >
      فا
    </button>
  </div>
</template>
