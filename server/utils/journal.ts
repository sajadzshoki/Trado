import type { H3Event } from 'h3'
import { and, asc, desc, eq } from 'drizzle-orm'
import { MAX_NAME_LENGTH, MAX_NOTE_LENGTH, MAX_TITLE_LENGTH } from '../../shared/constants'
import { Decimal, parsePositiveDecimal, quoteEntry } from '../../shared/utils/numbers'
import { positionAfter, type PositionChange } from '../../shared/utils/trade-math'
import { assetQuotes, assets, initialCapital, tradeEntries, trades, users } from '../database/schema'
import { useDb } from './db'
import { apiError, isUniqueViolation, requireUserId, requireUuid } from './http'
import { hashUserPassword, verifyUserPassword, verifyUserPasswordOrDummy } from './password'
import { getPriceProvider, MANUAL_PROVIDER_ID, quoteWriteFromProvider } from '../services/market'
import { optionalText, parseEntry, parseExternalAssetId, parseIcon, parseTransactionDate, requireName, requirePhone, requireSymbol } from './parse'
import { presentAsset, presentCapital, presentDashboard, presentTrade, presentUser } from './present'

type PublicSessionUser = {
  id: string
  phone: string
  displayName: string | null
  locale: 'en' | 'fa'
  displayCurrency: 'USD' | 'TOMAN'
}

async function sessionFor(event: H3Event, user: typeof users.$inferSelect, loggedInAt = Date.now()) {
  const publicUser: PublicSessionUser = {
    id: user.id,
    phone: user.phone,
    displayName: user.displayName,
    locale: user.locale,
    displayCurrency: user.displayCurrency,
  }
  await setUserSession(event, {
    user: publicUser,
    loggedInAt,
  })
  return presentUser(user)
}

async function ownedAsset(userId: string, assetId: string) {
  const db = useDb()
  const asset = await db.query.assets.findFirst({
    where: and(eq(assets.id, assetId), eq(assets.userId, userId)),
  })
  if (!asset) apiError(404, 'not_found')
  return asset
}

async function ownedTrade(userId: string, tradeId: string) {
  const db = useDb()
  const trade = await db.query.trades.findFirst({
    where: and(eq(trades.id, tradeId), eq(trades.userId, userId)),
    with: {
      asset: true,
      entries: true,
    },
  })
  if (!trade || !trade.asset) apiError(404, 'not_found')
  return trade
}

async function presentOwned(userId: string, trade: Awaited<ReturnType<typeof ownedTrade>>, withEntries = true) {
  const db = useDb()
  const quote = await db.query.assetQuotes.findFirst({
    where: and(eq(assetQuotes.assetId, trade.assetId), eq(assetQuotes.userId, userId)),
  })
  return presentTrade(trade, withEntries, quote ?? null)
}

export async function registerAccount(event: H3Event, input: {
  phone: string
  password: string
  displayName?: string | null
  locale?: 'en' | 'fa'
  displayCurrency?: 'USD' | 'TOMAN'
}) {
  const phone = requirePhone(input.phone)
  const displayName = optionalText(input.displayName, MAX_NAME_LENGTH, 'displayName')
  const passwordHash = await hashUserPassword(input.password)
  const db = useDb()
  try {
    const [user] = await db.insert(users).values({
      phone,
      passwordHash,
      displayName,
      locale: input.locale ?? 'en',
      displayCurrency: input.displayCurrency ?? 'USD',
    }).returning()
    if (!user) apiError(500, 'generic')
    return sessionFor(event, user)
  }
  catch (error) {
    if (isUniqueViolation(error)) apiError(409, 'phone_taken')
    throw error
  }
}

export async function loginAccount(event: H3Event, input: { phone: string, password: string }) {
  const phone = normalizePhoneSafe(input.phone)
  const db = useDb()
  const user = phone
    ? await db.query.users.findFirst({ where: eq(users.phone, phone) })
    : null
  const valid = await verifyUserPasswordOrDummy(input.password, user?.passwordHash ?? null)
  if (!user || !valid) apiError(401, 'invalid_credentials')
  return sessionFor(event, user)
}

function normalizePhoneSafe(input: string) {
  try {
    return requirePhone(input)
  }
  catch {
    return null
  }
}

export async function currentAccount(event: H3Event) {
  const userId = await requireUserId(event)
  const db = useDb()
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) })
  if (!user) apiError(401, 'unauthorized')
  return sessionFor(event, user, (await getUserSession(event)).loggedInAt)
}

export async function changePassword(event: H3Event, input: { currentPassword: string, newPassword: string }) {
  const userId = await requireUserId(event)
  const db = useDb()
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) })
  if (!user) apiError(401, 'unauthorized')
  const valid = await verifyUserPassword(input.currentPassword, user.passwordHash)
  if (!valid) apiError(401, 'wrong_password')
  const passwordHash = await hashUserPassword(input.newPassword)
  await db.update(users).set({ passwordHash, updatedAt: new Date() }).where(eq(users.id, userId))
  return { ok: true as const }
}

export async function updateSettings(event: H3Event, input: {
  displayName?: string | null
  locale?: 'en' | 'fa'
  displayCurrency?: 'USD' | 'TOMAN'
}) {
  const userId = await requireUserId(event)
  const db = useDb()
  const patch: Partial<typeof users.$inferInsert> = { updatedAt: new Date() }
  if ('displayName' in input) patch.displayName = optionalText(input.displayName, MAX_NAME_LENGTH, 'displayName')
  if (input.locale) patch.locale = input.locale
  if (input.displayCurrency) patch.displayCurrency = input.displayCurrency
  const [user] = await db.update(users).set(patch).where(eq(users.id, userId)).returning()
  if (!user) apiError(404, 'not_found')
  return sessionFor(event, user, (await getUserSession(event)).loggedInAt)
}

export async function getCapital(event: H3Event) {
  const userId = await requireUserId(event)
  const db = useDb()
  const row = await db.query.initialCapital.findFirst({
    where: eq(initialCapital.userId, userId),
  })
  return { capital: row ? presentCapital(row) : null }
}

export async function saveCapital(event: H3Event, input: {
  amountUsd: string
  usdTomanRate: string
  recordedAt: string
}) {
  const userId = await requireUserId(event)
  const amount = parsePositiveDecimal(input.amountUsd)
  if (!amount.ok) apiError(422, 'validation_error', { fields: { amountUsd: amount.code } })
  const rate = parsePositiveDecimal(input.usdTomanRate)
  if (!rate.ok) apiError(422, 'validation_error', { fields: { usdTomanRate: rate.code } })
  const quoted = quoteEntry(amount.value, new Decimal(1), rate.value)
  const recordedAt = parseTransactionDate(input.recordedAt)
  const db = useDb()
  const [row] = await db.insert(initialCapital).values({
    userId,
    amountUsd: amount.value.toFixed(12),
    usdTomanRate: rate.value.toFixed(8),
    amountToman: quoted.totalToman,
    recordedAt,
  }).onConflictDoUpdate({
    target: initialCapital.userId,
    set: {
      amountUsd: amount.value.toFixed(12),
      usdTomanRate: rate.value.toFixed(8),
      amountToman: quoted.totalToman,
      recordedAt,
      updatedAt: new Date(),
    },
  }).returning()
  if (!row) apiError(500, 'generic')
  return { capital: presentCapital(row) }
}

export async function listAssets(event: H3Event) {
  const userId = await requireUserId(event)
  const db = useDb()
  const rows = await db.query.assets.findMany({
    where: eq(assets.userId, userId),
    with: { trades: { columns: { id: true } }, quote: true },
    orderBy: [asc(assets.symbol)],
  })
  return rows.map(asset => presentAsset(asset, asset.trades.length, asset.quote ?? null))
}

function rejectIfShort(entries: { id: string, side: 'buy' | 'sell', quantity: string }[], change: PositionChange) {
  if (positionAfter(entries, change).exceeded) {
    apiError(422, 'insufficient_quantity', { fields: { quantity: 'insufficient_quantity' } })
  }
}

export async function createAsset(event: H3Event, input: {
  symbol: string
  name: string
  isActive?: boolean
  icon?: string | null
  externalAssetId?: string | null
}) {
  const userId = await requireUserId(event)
  const symbol = requireSymbol(input.symbol)
  const name = requireName(input.name)
  const iconData = parseIcon(input.icon)
  const externalAssetId = parseExternalAssetId(input.externalAssetId)
  const db = useDb()
  try {
    const [asset] = await db.insert(assets).values({
      userId,
      symbol,
      name,
      iconData,
      isActive: input.isActive ?? true,
      externalAssetId,
    }).returning()
    if (!asset) apiError(500, 'generic')
    return presentAsset(asset, 0)
  }
  catch (error) {
    if (isUniqueViolation(error)) apiError(409, 'asset_exists')
    throw error
  }
}

export async function updateAsset(event: H3Event, id: string, input: {
  symbol?: string
  name?: string
  isActive?: boolean
  icon?: string | null
  externalAssetId?: string | null
}) {
  const userId = await requireUserId(event)
  const assetId = requireUuid(id)
  await ownedAsset(userId, assetId)
  const patch: Partial<typeof assets.$inferInsert> = { updatedAt: new Date() }
  if (input.symbol != null) patch.symbol = requireSymbol(input.symbol)
  if (input.name != null) patch.name = requireName(input.name)
  if (typeof input.isActive === 'boolean') patch.isActive = input.isActive
  if ('icon' in input) patch.iconData = parseIcon(input.icon)
  if ('externalAssetId' in input) patch.externalAssetId = parseExternalAssetId(input.externalAssetId)
  const db = useDb()
  try {
    const [asset] = await db.update(assets).set(patch).where(and(eq(assets.id, assetId), eq(assets.userId, userId))).returning()
    if (!asset) apiError(404, 'not_found')
    const tradeRows = await db.query.trades.findMany({
      where: eq(trades.assetId, assetId),
      columns: { id: true },
    })
    const quote = await db.query.assetQuotes.findFirst({
      where: and(eq(assetQuotes.assetId, assetId), eq(assetQuotes.userId, userId)),
    })
    return presentAsset(asset, tradeRows.length, quote ?? null)
  }
  catch (error) {
    if (isUniqueViolation(error)) apiError(409, 'asset_exists')
    throw error
  }
}

export async function removeAsset(event: H3Event, id: string) {
  const userId = await requireUserId(event)
  const assetId = requireUuid(id)
  const db = useDb()
  const asset = await db.query.assets.findFirst({
    where: and(eq(assets.id, assetId), eq(assets.userId, userId)),
    with: { trades: { columns: { id: true }, limit: 1 } },
  })
  if (!asset) apiError(404, 'not_found')
  if (asset.trades.length) apiError(409, 'asset_in_use')
  await db.delete(assets).where(and(eq(assets.id, assetId), eq(assets.userId, userId)))
  return { ok: true as const }
}

export async function listTrades(event: H3Event) {
  const userId = await requireUserId(event)
  const db = useDb()
  const rows = await db.query.trades.findMany({
    where: eq(trades.userId, userId),
    with: { asset: true, entries: true },
    orderBy: [desc(trades.updatedAt)],
  })
  const quoteRows = await db.query.assetQuotes.findMany({ where: eq(assetQuotes.userId, userId) })
  const quotes = new Map(quoteRows.map(quote => [quote.assetId, quote]))
  return rows
    .filter(row => row.asset)
    .map(row => presentTrade(row, false, quotes.get(row.assetId) ?? null))
}

export async function createTrade(event: H3Event, input: {
  assetId: string
  title?: string | null
  notes?: string | null
  entry: Parameters<typeof parseEntry>[0]
}) {
  const userId = await requireUserId(event)
  const assetId = requireUuid(input.assetId)
  const asset = await ownedAsset(userId, assetId)
  if (!asset.isActive) apiError(409, 'asset_inactive')
  const entry = parseEntry(input.entry)
  rejectIfShort([], { op: 'add', side: entry.side, quantity: entry.quantity })
  const title = optionalText(input.title, MAX_TITLE_LENGTH, 'title')
  const notes = optionalText(input.notes, MAX_NOTE_LENGTH, 'notes')
  const db = useDb()
  const created = await db.transaction(async (tx) => {
    const [trade] = await tx.insert(trades).values({
      userId,
      assetId,
      title,
      notes,
    }).returning()
    if (!trade) throw new Error('trade_insert_failed')
    await tx.insert(tradeEntries).values({
      tradeId: trade.id,
      userId,
      side: entry.side,
      quantity: entry.quantity,
      unitPriceUsd: entry.unitPriceUsd,
      totalUsd: entry.totalUsd,
      usdTomanRate: entry.usdTomanRate,
      totalToman: entry.totalToman,
      transactedAt: entry.transactedAt,
      note: entry.note,
    })
    return trade.id
  })
  const trade = await ownedTrade(userId, created)
  return presentOwned(userId, trade)
}

export async function getTrade(event: H3Event, id: string) {
  const userId = await requireUserId(event)
  const trade = await ownedTrade(userId, requireUuid(id))
  return presentOwned(userId, trade)
}

export async function updateTrade(event: H3Event, id: string, input: {
  assetId?: string
  title?: string | null
  notes?: string | null
}) {
  const userId = await requireUserId(event)
  const tradeId = requireUuid(id)
  const existing = await ownedTrade(userId, tradeId)
  const patch: Partial<typeof trades.$inferInsert> = { updatedAt: new Date() }
  if (input.assetId) {
    const assetId = requireUuid(input.assetId)
    const asset = await ownedAsset(userId, assetId)
    if (assetId !== existing.assetId && !asset.isActive) apiError(409, 'asset_inactive')
    patch.assetId = assetId
  }
  if ('title' in input) patch.title = optionalText(input.title, MAX_TITLE_LENGTH, 'title')
  if ('notes' in input) patch.notes = optionalText(input.notes, MAX_NOTE_LENGTH, 'notes')
  const db = useDb()
  await db.update(trades).set(patch).where(and(eq(trades.id, tradeId), eq(trades.userId, userId)))
  const trade = await ownedTrade(userId, tradeId)
  return presentOwned(userId, trade)
}

export async function removeTrade(event: H3Event, id: string) {
  const userId = await requireUserId(event)
  const tradeId = requireUuid(id)
  await ownedTrade(userId, tradeId)
  const db = useDb()
  await db.delete(trades).where(and(eq(trades.id, tradeId), eq(trades.userId, userId)))
  return { ok: true as const }
}

export async function addEntry(event: H3Event, tradeIdParam: string, input: Parameters<typeof parseEntry>[0]) {
  const userId = await requireUserId(event)
  const tradeId = requireUuid(tradeIdParam)
  const existing = await ownedTrade(userId, tradeId)
  const entry = parseEntry(input)
  rejectIfShort(existing.entries, { op: 'add', side: entry.side, quantity: entry.quantity })
  const db = useDb()
  await db.transaction(async (tx) => {
    await tx.insert(tradeEntries).values({
      tradeId,
      userId,
      side: entry.side,
      quantity: entry.quantity,
      unitPriceUsd: entry.unitPriceUsd,
      totalUsd: entry.totalUsd,
      usdTomanRate: entry.usdTomanRate,
      totalToman: entry.totalToman,
      transactedAt: entry.transactedAt,
      note: entry.note,
    })
    await tx.update(trades).set({ updatedAt: new Date() }).where(eq(trades.id, tradeId))
  })
  const trade = await ownedTrade(userId, tradeId)
  return presentOwned(userId, trade)
}

export async function updateEntry(event: H3Event, id: string, input: Parameters<typeof parseEntry>[0]) {
  const userId = await requireUserId(event)
  const entryId = requireUuid(id)
  const db = useDb()
  const existing = await db.query.tradeEntries.findFirst({
    where: and(eq(tradeEntries.id, entryId), eq(tradeEntries.userId, userId)),
  })
  if (!existing) apiError(404, 'not_found')
  const entry = parseEntry(input)
  const current = await ownedTrade(userId, existing.tradeId)
  rejectIfShort(current.entries, { op: 'replace', id: entryId, side: entry.side, quantity: entry.quantity })
  await db.transaction(async (tx) => {
    await tx.update(tradeEntries).set({
      side: entry.side,
      quantity: entry.quantity,
      unitPriceUsd: entry.unitPriceUsd,
      totalUsd: entry.totalUsd,
      usdTomanRate: entry.usdTomanRate,
      totalToman: entry.totalToman,
      transactedAt: entry.transactedAt,
      note: entry.note,
      updatedAt: new Date(),
    }).where(and(eq(tradeEntries.id, entryId), eq(tradeEntries.userId, userId)))
    await tx.update(trades).set({ updatedAt: new Date() }).where(eq(trades.id, existing.tradeId))
  })
  const trade = await ownedTrade(userId, existing.tradeId)
  return presentOwned(userId, trade)
}

export async function removeEntry(event: H3Event, id: string) {
  const userId = await requireUserId(event)
  const entryId = requireUuid(id)
  const db = useDb()
  const existing = await db.query.tradeEntries.findFirst({
    where: and(eq(tradeEntries.id, entryId), eq(tradeEntries.userId, userId)),
  })
  if (!existing) apiError(404, 'not_found')
  const current = await ownedTrade(userId, existing.tradeId)
  rejectIfShort(current.entries, { op: 'remove', id: entryId })
  await db.transaction(async (tx) => {
    await tx.delete(tradeEntries).where(and(eq(tradeEntries.id, entryId), eq(tradeEntries.userId, userId)))
    await tx.update(trades).set({ updatedAt: new Date() }).where(eq(trades.id, existing.tradeId))
  })
  return presentOwned(userId, await ownedTrade(userId, existing.tradeId))
}

export async function getDashboard(event: H3Event) {
  const userId = await requireUserId(event)
  const db = useDb()
  const [capital, tradeRows, quoteRows] = await Promise.all([
    db.query.initialCapital.findFirst({ where: eq(initialCapital.userId, userId) }),
    db.query.trades.findMany({
      where: eq(trades.userId, userId),
      with: { asset: true, entries: true },
    }),
    db.query.assetQuotes.findMany({ where: eq(assetQuotes.userId, userId) }),
  ])
  return presentDashboard({
    capital: capital ?? null,
    trades: tradeRows.filter(row => row.asset),
    quotes: quoteRows,
  })
}

async function assetWithQuote(userId: string, assetId: string) {
  const db = useDb()
  const asset = await ownedAsset(userId, assetId)
  const [tradeRows, quote] = await Promise.all([
    db.query.trades.findMany({ where: eq(trades.assetId, assetId), columns: { id: true } }),
    db.query.assetQuotes.findFirst({
      where: and(eq(assetQuotes.assetId, assetId), eq(assetQuotes.userId, userId)),
    }),
  ])
  return presentAsset(asset, tradeRows.length, quote ?? null)
}

export async function saveQuote(event: H3Event, id: string, input: {
  priceUsd: string
  usdTomanRate: string
  quotedAt: string
}) {
  const userId = await requireUserId(event)
  const assetId = requireUuid(id)
  const asset = await ownedAsset(userId, assetId)
  const provider = getPriceProvider(MANUAL_PROVIDER_ID)
  if (!provider) apiError(500, 'generic')
  const priced = await provider.quote({
    externalId: asset.externalAssetId,
    manual: {
      priceUsd: input.priceUsd,
      usdTomanRate: input.usdTomanRate,
      quotedAt: input.quotedAt,
    },
  })
  if (!priced.ok) apiError(422, 'validation_error', { fields: { [priced.field ?? 'priceUsd']: priced.code } })
  const write = quoteWriteFromProvider(priced.price, null)
  if (!write) apiError(422, 'validation_error', { fields: { priceUsd: 'invalid_number' } })
  const db = useDb()
  await db.insert(assetQuotes).values({
    userId,
    assetId,
    priceUsd: write.priceUsd,
    usdTomanRate: write.usdTomanRate,
    source: write.source,
    quotedAt: write.quotedAt,
  }).onConflictDoUpdate({
    target: assetQuotes.assetId,
    set: {
      userId,
      priceUsd: write.priceUsd,
      usdTomanRate: write.usdTomanRate,
      source: write.source,
      quotedAt: write.quotedAt,
      updatedAt: new Date(),
    },
  })
  return assetWithQuote(userId, assetId)
}

export async function clearQuote(event: H3Event, id: string) {
  const userId = await requireUserId(event)
  const assetId = requireUuid(id)
  await ownedAsset(userId, assetId)
  const db = useDb()
  await db.delete(assetQuotes).where(and(eq(assetQuotes.assetId, assetId), eq(assetQuotes.userId, userId)))
  return assetWithQuote(userId, assetId)
}
