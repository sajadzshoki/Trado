<script setup lang="ts">
const localePath = useLocalePath()
const { user } = useUserSession()
const phone = computed(() => user.value?.phone ? formatPhone(user.value.phone) : '')
</script>

<template>
  <div class="min-h-dvh md:grid md:grid-cols-[15.5rem_minmax(0,1fr)]">
    <aside class="hidden border-e border-default md:flex md:min-h-dvh md:flex-col md:justify-between md:px-5 md:py-6">
      <div>
        <NuxtLink :to="localePath('/')" class="inline-flex">
          <AppMark />
        </NuxtLink>
        <AppNav orientation="vertical" class="mt-10" />
      </div>
      <div class="space-y-4">
        <LocaleSwitch />
        <p class="truncate text-xs text-dimmed">{{ user?.displayName || phone }}</p>
      </div>
    </aside>

    <div class="flex min-h-dvh flex-col">
      <header class="flex items-center justify-between border-b border-default px-4 py-3 md:hidden">
        <NuxtLink :to="localePath('/')">
          <AppMark />
        </NuxtLink>
        <LocaleSwitch />
      </header>
      <main class="app-main mx-auto w-full max-w-3xl flex-1 px-4 py-6 md:px-10 md:py-10">
        <slot />
      </main>
    </div>
    <AppNav orientation="horizontal" />
  </div>
</template>
