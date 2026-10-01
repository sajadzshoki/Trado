import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import ExcelJS from 'exceljs'
import * as fontkit from 'fontkit'
import mupdf from 'mupdf'
import type { TradeDetail, TradeEntryRecord } from '../shared/types/journal.ts'
import { formatUsd } from '../shared/utils/numbers.ts'
import { filterTrades } from '../shared/utils/trade-filters.ts'
import { fileURLToPath } from 'node:url'
import { glyphNames } from '../server/utils/pdf-text.ts'
import {
  exportFilename,
  handleTradeExport,
  summarizeTrades,
} from '../server/utils/trade-export.ts'

const font = readFileSync(new URL('../server/assets/fonts/Vazir-Regular.ttf', import.meta.url))
const now = new Date('2026-09-23T08:15:00.000Z')
const assetA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const assetB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'

function entry(patch: Partial<TradeEntryRecord> = {}): TradeEntryRecord {
  return {
    id: 'entry-1',
    side: 'buy',
    quantity: '2.000000000000',
    unitPriceUsd: '80.000000000000',
    totalUsd: '150.000000000000',
    usdTomanRate: '60000.00000000',
    totalToman: '9000000.0000',
    transactedAt: '2026-03-15T12:30:00.000Z',
    note: 'desk note',
    ...patch,
  }
}

function trade(patch: Partial<TradeDetail> = {}): TradeDetail {
  const entries = patch.entries ?? [entry()]
  return {
    id: 'trade-a',
    title: 'Alpha swing',
    notes: null,
    asset: { id: assetA, symbol: 'BTC', name: 'Bitcoin' },
    entryCount: entries.length,
    buyQuantity: '2.000000000000',
    sellQuantity: '0.000000000000',
    remainingQuantity: '2.000000000000',
    unmatchedSellQuantity: '0.000000000000',
    buyUsd: '150.000000000000',
    sellUsd: '0.000000000000',
    buyToman: '9000000.0000',
    sellToman: '0.0000',
    averageBuyUsd: '75.000000000000',
    averageSellUsd: null,
    averageBuyToman: '4500000.0000',
    averageSellToman: null,
    realizedPnlUsd: '999.50000000',
    realizedPnlToman: '1.0000',
    openCostUsd: '150.00000000',
    openCostToman: '9000000.0000',
    isEmpty: entries.length === 0,
    isFlat: false,
    isOversold: false,
    status: 'open',
    hasBuy: entries.some(item => item.side === 'buy'),
    hasSell: entries.some(item => item.side === 'sell'),
    markAvailable: false,
    unrealizedPnlUsd: null,
    unrealizedPnlToman: null,
    currentValueUsd: null,
    currentValueToman: null,
    totalPnlUsd: null,
    totalPnlToman: null,
    createdAt: '2026-03-01T00:00:00.000Z',
    updatedAt: '2026-03-15T12:30:00.000Z',
    lastTransactedAt: '2026-03-15T12:30:00.000Z',
    ...patch,
    entries: patch.entries ?? entries,
  }
}

async function workbookOf(buffer: Buffer) {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(buffer)
  return workbook
}

function pdfText(buffer: Buffer) {
  const doc = mupdf.Document.openDocument(buffer, 'application/pdf')
  assert.ok(doc.countPages() >= 1)
  return doc.loadPage(0).toStructuredText('preserve-whitespace').asText()
}

test('Vazir is a real TrueType font and shapes joined Persian', () => {
  assert.equal(font.subarray(0, 4).toString('hex'), '00010000')
  const face = fontkit.openSync(fileURLToPath(new URL('../server/assets/fonts/Vazir-Regular.ttf', import.meta.url)))
  const names = glyphNames(face, 'خرید', 'rtl')
  assert.deepEqual(names, ['uniFEAA', 'uniFBFE', 'uniFEAE', 'uniFEA7'])
  assert.equal(names.includes('uni062E'), false)
})

test('xlsx export is a real workbook with numbers, a date, and a frozen header', async () => {
  const result = await handleTradeExport({
    sessionUserId: 'user-a',
    query: { format: 'xlsx' },
    locale: 'en',
    font,
    now,
    load: async () => [trade()],
  })
  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.equal(result.status, 200)
  assert.equal(result.headers['content-type'], 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  assert.equal(result.headers['content-disposition'], 'attachment; filename="trado-trades-2026-09-23.xlsx"')
  assert.equal(result.body.subarray(0, 2).toString(), 'PK')
  assert.equal(result.body.subarray(0, 8).toString().includes(','), false)

  const sheet = (await workbookOf(result.body)).getWorksheet('Trades')
  assert.ok(sheet)
  assert.equal(sheet.views[0]?.state, 'frozen')
  assert.equal(sheet.views[0]?.ySplit, 1)
  assert.deepEqual(
    ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'].map(column => sheet.getCell(`${column}1`).value),
    ['Trade', 'Asset', 'Symbol', 'Type', 'Quantity', 'Unit Price USD', 'Total USD', 'USD/Toman Rate', 'Total Toman', 'Date', 'Note', 'Trade Status'],
  )
  assert.equal(sheet.getCell('A2').value, 'Alpha swing')
  assert.equal(sheet.getCell('C2').value, 'BTC')
  assert.equal(sheet.getCell('D2').value, 'Buy')
  assert.equal(sheet.getCell('E2').value, 2)
  assert.equal(sheet.getCell('F2').value, 80)
  assert.equal(sheet.getCell('G2').value, 150)
  assert.notEqual(sheet.getCell('G2').value, 160)
  assert.equal(sheet.getCell('K2').value, 'desk note')
  assert.equal(sheet.getCell('L2').value, 'Open')
  assert.ok(sheet.getCell('J2').value instanceof Date)
  assert.equal(sheet.rowCount, 2)
})

test('pdf export is a valid English report and does not recompute P&L', async () => {
  const result = await handleTradeExport({
    sessionUserId: 'user-a',
    query: { format: 'pdf' },
    locale: 'en',
    font,
    now,
    load: async () => [trade()],
  })
  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.equal(result.headers['content-type'], 'application/pdf')
  assert.equal(result.headers['content-disposition'], 'attachment; filename="trado-trades-2026-09-23.pdf"')
  assert.equal(result.body.subarray(0, 5).toString(), '%PDF-')
  const text = pdfText(result.body)
  assert.match(text, /Trading Journal Report/)
  assert.doesNotMatch(text, /tropeR lanruoJ/)
  assert.match(text, /Alpha swing/)
  assert.match(text, /Buy/)
  assert.match(text, /\+\$999\.50/)
  assert.match(text, /\$150\.00/)
  assert.doesNotMatch(text, /\$160\.00/)
  assert.match(text, /—/)
  assert.equal(summarizeTrades([trade()]).unrealizedPnlUsd, null)
  assert.equal(summarizeTrades([trade()]).realizedPnlUsd, '999.50000000')
  assert.equal(summarizeTrades([trade()]).buyVolumeUsd, '150.000000000000')
  assert.equal(formatUsd('999.50000000', 'en', true), '+$999.50')
})

test('persian pdf embeds joined text and persian digits', async () => {
  const result = await handleTradeExport({
    sessionUserId: 'user-a',
    query: { format: 'pdf' },
    locale: 'fa',
    font,
    now,
    load: async () => [trade({ title: 'بیت‌کوین', entries: [entry({ quantity: '12.500000000000' })] })],
  })
  assert.equal(result.ok, true)
  if (!result.ok) return
  const text = pdfText(result.body)
  assert.match(text, /[\u0600-\u06FF]/)
  assert.match(text, /[۰-۹]/)
  assert.doesNotMatch(text, /\uFFFD/)
  assert.match(text, /گزارش دفتر معاملات|گزارش/)
  const pixmap = mupdf.Document.openDocument(result.body, 'application/pdf').loadPage(0).toPixmap(
    mupdf.Matrix.scale(1, 1),
    mupdf.ColorSpace.DeviceRGB,
    false,
    true,
  )
  assert.ok(pixmap.asPNG().length > 1000)
})

test('empty history is a valid workbook and pdf', async () => {
  const xlsx = await handleTradeExport({
    sessionUserId: 'user-a',
    query: { format: 'xlsx' },
    locale: 'en',
    font,
    now,
    load: async () => [],
  })
  assert.equal(xlsx.ok, true)
  if (!xlsx.ok) return
  const sheet = (await workbookOf(xlsx.body)).getWorksheet('Trades')
  assert.equal(sheet?.rowCount, 1)
  assert.equal(summarizeTrades([]).tradeCount, 0)
  assert.equal(summarizeTrades([]).unrealizedPnlUsd, '0.00000000')

  const pdf = await handleTradeExport({
    sessionUserId: 'user-a',
    query: { format: 'pdf' },
    locale: 'en',
    font,
    now,
    load: async () => [],
  })
  assert.equal(pdf.ok, true)
  if (!pdf.ok) return
  const text = pdfText(pdf.body)
  assert.match(text, /Total Trades/)
  assert.match(text, /Trading Journal Report/)
})

test('filters match the trades page and ignore a client user id', async () => {
  const btc = trade()
  const eth = trade({
    id: 'trade-eth',
    title: 'Ether lot',
    asset: { id: assetB, symbol: 'ETH', name: 'Ether' },
    status: 'closed',
    hasBuy: true,
    hasSell: true,
    lastTransactedAt: '2026-01-02T00:00:00.000Z',
    realizedPnlUsd: '10.00000000',
    totalPnlUsd: '10.00000000',
    markAvailable: true,
    unrealizedPnlUsd: '0.00000000',
    entries: [entry({ id: 'eth-buy', side: 'buy' }), entry({ id: 'eth-sell', side: 'sell', transactedAt: '2026-01-02T00:00:00.000Z' })],
  })
  const late = trade({
    id: 'trade-late',
    title: 'Night',
    asset: { id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', symbol: 'SOL', name: 'Solana' },
    lastTransactedAt: '2026-09-22T21:30:00.000Z',
    hasSell: true,
    entries: [entry({ id: 'late', side: 'sell', transactedAt: '2026-09-22T21:30:00.000Z' })],
  })
  const rows = [btc, eth, late]

  assert.deepEqual(filterTrades(rows, { asset: 'BTC' }).map(item => item.id), ['trade-a'])
  assert.deepEqual(filterTrades(rows, { asset: assetB }).map(item => item.id), ['trade-eth'])
  assert.deepEqual(filterTrades(rows, { side: 'sell' }).map(item => item.id).sort(), ['trade-eth', 'trade-late'])
  assert.deepEqual(filterTrades(rows, { status: 'closed' }).map(item => item.id), ['trade-eth'])
  assert.deepEqual(filterTrades(rows, { search: 'ether' }).map(item => item.id), ['trade-eth'])
  assert.deepEqual(filterTrades(rows, { from: '2026-09-23', to: '2026-09-23', tzOffsetMinutes: -210 }).map(item => item.id), ['trade-late'])
  assert.deepEqual(filterTrades(rows, { from: '2026-09-23', tzOffsetMinutes: 0 }).map(item => item.id), [])

  const seen: string[] = []
  const result = await handleTradeExport({
    sessionUserId: 'user-a',
    query: { format: 'xlsx', asset: 'ETH', type: 'SELL', userId: 'user-b' },
    locale: 'en',
    font,
    now,
    load: async (userId) => {
      seen.push(userId)
      assert.notEqual(userId, 'user-b')
      return userId === 'user-a' ? rows : [trade({ title: 'SECRET-OTHER-USER' })]
    },
  })
  assert.deepEqual(seen, ['user-a'])
  assert.equal(result.ok, true)
  if (!result.ok) return
  const sheet = (await workbookOf(result.body)).getWorksheet('Trades')
  assert.equal(sheet?.getCell('A2').value, 'Ether lot')
  assert.equal(sheet?.getCell('A3').value, 'Ether lot')
  assert.deepEqual([sheet?.getCell('D2').value, sheet?.getCell('D3').value].sort(), ['Buy', 'Sell'])
  assert.equal(result.body.includes(Buffer.from('SECRET-OTHER-USER')), false)
})

test('unauthenticated export does not load anyone\'s trades', async () => {
  let called = false
  const result = await handleTradeExport({
    sessionUserId: null,
    query: { format: 'pdf', userId: 'user-b' },
    locale: 'en',
    font,
    now,
    load: async () => {
      called = true
      return [trade({ title: 'SECRET-OTHER-USER' })]
    },
  })
  assert.equal(called, false)
  assert.equal(result.ok, false)
  if (result.ok) return
  assert.equal(result.status, 401)
  assert.equal(result.body.code, 'unauthorized')
})

test('user A cannot export user B by passing userId', async () => {
  const seen: string[] = []
  const result = await handleTradeExport({
    sessionUserId: 'user-a',
    query: { format: 'xlsx', userId: 'user-b' },
    locale: 'en',
    font,
    now,
    load: async (userId) => {
      seen.push(userId)
      return userId === 'user-b'
        ? [trade({ title: 'SECRET-OTHER-USER' })]
        : [trade({ title: 'Alpha swing' })]
    },
  })
  assert.deepEqual(seen, ['user-a'])
  assert.equal(result.ok, true)
  if (!result.ok) return
  const sheet = (await workbookOf(result.body)).getWorksheet('Trades')
  assert.equal(sheet?.getCell('A2').value, 'Alpha swing')
  assert.equal(result.body.includes(Buffer.from('SECRET-OTHER-USER')), false)
})

test('export route is session scoped', () => {
  const route = readFileSync(new URL('../server/api/trades/export.get.ts', import.meta.url), 'utf8')
  const journal = readFileSync(new URL('../server/utils/journal.ts', import.meta.url), 'utf8')
  assert.match(route, /requireUserId/)
  assert.match(route, /listTradesForExport/)
  assert.doesNotMatch(route, /query\.userId|getQuery\([^)]*\)\.userId|\[['"]userId['"]\]/)
  assert.match(journal, /export async function listTradesForExport\(event: H3Event\)/)
  assert.match(journal, /eq\(trades\.userId, userId\)/)
  assert.equal(exportFilename('pdf', now), 'trado-trades-2026-09-23.pdf')
})

test('a marked trade keeps its calculated unrealized total', () => {
  const marked = trade({ markAvailable: true, unrealizedPnlUsd: '25.00000000' })
  const blank = trade({ id: 'blank', markAvailable: false, unrealizedPnlUsd: null })
  assert.equal(summarizeTrades([marked]).unrealizedPnlUsd, '25.00000000')
  assert.equal(summarizeTrades([marked, blank]).unrealizedPnlUsd, null)
})
