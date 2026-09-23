export default defineNuxtConfig({
  compatibilityDate: '2026-09-23',
  modules: ['@nuxt/ui', '@nuxtjs/i18n', 'nuxt-auth-utils'],
  css: [
    '@fontsource/ibm-plex-sans/400.css',
    '@fontsource/ibm-plex-sans/500.css',
    '@fontsource/ibm-plex-sans/600.css',
    '@fontsource/ibm-plex-mono/400.css',
    '@fontsource/ibm-plex-mono/500.css',
    '@fontsource/vazirmatn/400.css',
    '@fontsource/vazirmatn/500.css',
    '@fontsource/vazirmatn/600.css',
    '@fontsource/vazirmatn/700.css',
    '~/assets/css/main.css',
  ],
  devServer: {
    host: '0.0.0.0',
    port: 3000,
  },
  vite: {
    server: {
      allowedHosts: true,
    },
  },
  colorMode: {
    preference: 'dark',
    fallback: 'dark',
  },
  ui: {
    fonts: false,
    theme: {
      transitions: false,
    },
  },
  icon: {
    serverBundle: {
      collections: ['lucide'],
    },
    clientBundle: {
      scan: true,
      collections: ['lucide'],
    },
  },
  i18n: {
    defaultLocale: 'en',
    strategy: 'prefix_except_default',
    langDir: 'locales',
    locales: [
      { code: 'en', language: 'en-US', name: 'English', dir: 'ltr', file: 'en.json' },
      { code: 'fa', language: 'fa-IR', name: 'فارسی', dir: 'rtl', file: 'fa.json' },
    ],
    detectBrowserLanguage: {
      useCookie: true,
      cookieKey: 'trado_locale',
      redirectOn: 'root',
      alwaysRedirect: false,
      fallbackLocale: 'en',
    },
    vueI18n: './i18n.config.ts',
  },
  runtimeConfig: {
    databaseUrl: process.env.DATABASE_URL || '',
  },
  nitro: {
    routeRules: {
      '/**': {
        headers: {
          'content-security-policy': 'frame-ancestors *',
          'x-content-type-options': 'nosniff',
          'referrer-policy': 'strict-origin-when-cross-origin',
        },
      },
    },
  },
  app: {
    head: {
      title: 'Trado',
      htmlAttrs: {
        class: 'dark',
      },
      meta: [
        { name: 'theme-color', content: '#0e0f11' },
        { name: 'robots', content: 'noindex, nofollow' },
        { name: 'format-detection', content: 'telephone=no' },
      ],
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
      ],
    },
  },
  typescript: {
    strict: true,
  },
})
