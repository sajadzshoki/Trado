<script setup lang="ts">
const props = defineProps<{
  orientation: 'vertical' | 'horizontal'
}>()

const { t } = useI18n()
const localePath = useLocalePath()
const route = useRoute()

const items = computed(() => [
  { key: 'dashboard', to: localePath('/'), icon: 'house', exact: true },
  { key: 'trades', to: localePath('/trades'), icon: 'trades' },
  { key: 'assets', to: localePath('/assets'), icon: 'layers' },
  { key: 'settings', to: localePath('/settings'), icon: 'sliders' },
])

function active(item: { to: string, exact?: boolean }) {
  if (item.exact) return route.path === item.to
  return route.path === item.to || route.path.startsWith(`${item.to}/`)
}
</script>

<template>
  <nav
    :class="props.orientation === 'horizontal' ? 'bottom-nav md:hidden' : 'flex flex-col gap-1'"
    :aria-label="t('nav.dashboard')"
  >
    <NuxtLink
      v-for="item in items"
      :key="item.key"
      :to="item.to"
      class="group"
      :class="props.orientation === 'horizontal'
        ? 'flex flex-1 flex-col items-center gap-1 px-1 py-2.5 text-[0.68rem]'
        : 'flex items-center gap-3 px-2 py-2 text-sm'"
      :aria-current="active(item) ? 'page' : undefined"
    >
      <span
        v-if="props.orientation === 'vertical'"
        class="h-4 w-px"
        :class="active(item) ? 'bg-brass-400' : 'bg-transparent'"
      />
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.6"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
        class="shrink-0"
        :class="[
          props.orientation === 'horizontal' ? 'size-[1.15rem]' : 'size-4',
          active(item) ? 'text-highlighted' : 'text-dimmed',
        ]"
      >
        <template v-if="item.icon === 'house'">
          <path d="M4 10.5 12 4l8 6.5" />
          <path d="M6.5 9.8V20h11V9.8" />
        </template>
        <template v-else-if="item.icon === 'trades'">
          <path d="M7 7h11" />
          <path d="M14 4l4 3-4 3" />
          <path d="M17 17H6" />
          <path d="M10 14l-4 3 4 3" />
        </template>
        <template v-else-if="item.icon === 'layers'">
          <path d="M12 4 4 8l8 4 8-4-8-4Z" />
          <path d="M4 12l8 4 8-4" />
          <path d="M4 16l8 4 8-4" />
        </template>
        <template v-else>
          <path d="M4 7h16" />
          <path d="M4 12h16" />
          <path d="M4 17h16" />
          <circle cx="9" cy="7" r="1.6" fill="#0e0f11" />
          <circle cx="15" cy="12" r="1.6" fill="#0e0f11" />
          <circle cx="8" cy="17" r="1.6" fill="#0e0f11" />
        </template>
      </svg>
      <span :class="active(item) ? 'text-highlighted' : 'text-dimmed'">
        {{ t(`nav.${item.key}`) }}
      </span>
      <span
        v-if="props.orientation === 'horizontal'"
        class="h-px w-3"
        :class="active(item) ? 'bg-brass-400' : 'bg-transparent'"
      />
    </NuxtLink>
  </nav>
</template>
