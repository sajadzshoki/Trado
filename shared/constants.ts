export const MIN_PASSWORD_LENGTH = 8
export const MAX_PASSWORD_LENGTH = 128
export const MAX_NOTE_LENGTH = 2000
export const MAX_ENTRY_NOTE_LENGTH = 500
export const MAX_NAME_LENGTH = 80
export const MAX_TITLE_LENGTH = 80
export const MAX_ASSET_NAME_LENGTH = 64
export const MAX_SYMBOL_LENGTH = 12
export const MAX_EXTERNAL_ASSET_ID_LENGTH = 64
export const EXTERNAL_ASSET_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/
export const MAX_ICON_BYTES = 80 * 1024
export const ICON_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const

export const APP_LOCALES = ['en', 'fa'] as const
export const DISPLAY_CURRENCIES = ['USD', 'TOMAN'] as const
export const TRADE_SIDES = ['buy', 'sell'] as const

export type AppLocale = (typeof APP_LOCALES)[number]
export type DisplayCurrency = (typeof DISPLAY_CURRENCIES)[number]
export type TradeSide = (typeof TRADE_SIDES)[number]

export const LAST_RATE_KEY = 'trado:last-usd-toman-rate'
