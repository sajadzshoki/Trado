export const MIN_PASSWORD_LENGTH = 8
export const MAX_PASSWORD_LENGTH = 128
export const MAX_NOTE_LENGTH = 2000
export const MAX_ENTRY_NOTE_LENGTH = 500
export const MAX_NAME_LENGTH = 80
export const MAX_TITLE_LENGTH = 80
export const MAX_ASSET_NAME_LENGTH = 64
export const MAX_SYMBOL_LENGTH = 12

export const APP_LOCALES = ['en', 'fa'] as const
export const DISPLAY_CURRENCIES = ['USD', 'TOMAN'] as const
export const TRADE_SIDES = ['buy', 'sell'] as const

export type AppLocale = (typeof APP_LOCALES)[number]
export type DisplayCurrency = (typeof DISPLAY_CURRENCIES)[number]
export type TradeSide = (typeof TRADE_SIDES)[number]

export const LAST_RATE_KEY = 'trado:last-usd-toman-rate'
