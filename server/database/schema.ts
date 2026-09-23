import { relations, sql } from 'drizzle-orm'
import { boolean, check, index, integer, numeric, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'

export const displayCurrencyEnum = pgEnum('display_currency', ['USD', 'TOMAN'])
export const localeEnum = pgEnum('app_locale', ['en', 'fa'])
export const tradeSideEnum = pgEnum('trade_side', ['buy', 'sell'])
export const otpPurposeEnum = pgEnum('otp_purpose', ['login', 'register', 'password_reset'])

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  phone: text('phone').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  displayName: text('display_name'),
  locale: localeEnum('locale').notNull().default('en'),
  displayCurrency: displayCurrencyEnum('display_currency').notNull().default('USD'),
  phoneVerifiedAt: timestamp('phone_verified_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
})

/**
 * Reserved for a future OTP flow. No route writes to this table yet.
 */
export const otpChallenges = pgTable('otp_challenges', {
  id: uuid('id').primaryKey().defaultRandom(),
  phone: text('phone').notNull(),
  purpose: otpPurposeEnum('purpose').notNull(),
  codeHash: text('code_hash').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  consumedAt: timestamp('consumed_at', { withTimezone: true }),
  attemptCount: integer('attempt_count').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, table => [
  index('otp_challenges_phone_purpose_idx').on(table.phone, table.purpose),
])

/**
 * priceProvider and externalAssetId are reserved for a later quote source.
 * No current route writes them. See server/services/prices.ts.
 */
export const assets = pgTable('assets', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  symbol: text('symbol').notNull(),
  name: text('name').notNull(),
  iconData: text('icon_data'),
  isActive: boolean('is_active').notNull().default(true),
  priceProvider: text('price_provider'),
  externalAssetId: text('external_asset_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, table => [
  uniqueIndex('assets_user_symbol_unique').on(table.userId, table.symbol),
  index('assets_user_idx').on(table.userId),
])

export const trades = pgTable('trades', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  assetId: uuid('asset_id').notNull().references(() => assets.id, { onDelete: 'restrict' }),
  title: text('title'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, table => [
  index('trades_user_idx').on(table.userId, table.updatedAt),
  index('trades_asset_idx').on(table.assetId),
])

export const tradeEntries = pgTable('trade_entries', {
  id: uuid('id').primaryKey().defaultRandom(),
  tradeId: uuid('trade_id').notNull().references(() => trades.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  side: tradeSideEnum('side').notNull(),
  quantity: numeric('quantity', { precision: 38, scale: 12 }).notNull(),
  unitPriceUsd: numeric('unit_price_usd', { precision: 38, scale: 12 }).notNull(),
  totalUsd: numeric('total_usd', { precision: 38, scale: 12 }).notNull(),
  usdTomanRate: numeric('usd_toman_rate', { precision: 38, scale: 8 }).notNull(),
  totalToman: numeric('total_toman', { precision: 38, scale: 4 }).notNull(),
  transactedAt: timestamp('transacted_at', { withTimezone: true }).notNull(),
  note: text('note'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, table => [
  index('trade_entries_trade_idx').on(table.tradeId, table.transactedAt),
  index('trade_entries_user_idx').on(table.userId),
  check('trade_entries_quantity_positive', sql`${table.quantity} > 0`),
  check('trade_entries_price_positive', sql`${table.unitPriceUsd} > 0`),
  check('trade_entries_rate_positive', sql`${table.usdTomanRate} > 0`),
  check('trade_entries_totals_positive', sql`${table.totalUsd} > 0 AND ${table.totalToman} > 0`),
])

export const initialCapital = pgTable('initial_capital', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }).unique(),
  amountUsd: numeric('amount_usd', { precision: 38, scale: 12 }).notNull(),
  usdTomanRate: numeric('usd_toman_rate', { precision: 38, scale: 8 }).notNull(),
  amountToman: numeric('amount_toman', { precision: 38, scale: 4 }).notNull(),
  recordedAt: timestamp('recorded_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, table => [
  check('initial_capital_amount_positive', sql`${table.amountUsd} > 0`),
  check('initial_capital_rate_positive', sql`${table.usdTomanRate} > 0`),
])

export const usersRelations = relations(users, ({ many, one }) => ({
  assets: many(assets),
  trades: many(trades),
  entries: many(tradeEntries),
  initialCapital: one(initialCapital, {
    fields: [users.id],
    references: [initialCapital.userId],
  }),
}))

export const assetsRelations = relations(assets, ({ one, many }) => ({
  user: one(users, { fields: [assets.userId], references: [users.id] }),
  trades: many(trades),
}))

export const tradesRelations = relations(trades, ({ one, many }) => ({
  user: one(users, { fields: [trades.userId], references: [users.id] }),
  asset: one(assets, { fields: [trades.assetId], references: [assets.id] }),
  entries: many(tradeEntries),
}))

export const tradeEntriesRelations = relations(tradeEntries, ({ one }) => ({
  trade: one(trades, { fields: [tradeEntries.tradeId], references: [trades.id] }),
  user: one(users, { fields: [tradeEntries.userId], references: [users.id] }),
}))

export const initialCapitalRelations = relations(initialCapital, ({ one }) => ({
  user: one(users, { fields: [initialCapital.userId], references: [users.id] }),
}))
