import ExcelJS from 'exceljs'
import PDFDocument from 'pdfkit'
import enMessages from '../../i18n/locales/en.json' with { type: 'json' }
import faMessages from '../../i18n/locales/fa.json' with { type: 'json' }
import type { TradeDetail, TradeEntryRecord } from '../../shared/types/journal'
import { filterTrades, type TradeListFilters } from '../../shared/utils/trade-filters'
import { Decimal, formatDate, formatDateTime, formatDecimal, formatQuantity, formatUsd } from '../../shared/utils/numbers'
import { drawText, wrapText, type TextAlign, type TextDirection } from './pdf-text'

export interface ExportLabels {
  appName: string
  reportTitle: string
  generated: string
  totalTrades: string
  buyVolume: string
  sellVolume: string
  realized: string
  unrealized: string
  blank: string
  sheet: string
  buy: string
  sell: string
  statusOpen: string
  statusClosed: string
  statusEmpty: string
  colTrade: string
  colAsset: string
  colSymbol: string
  colType: string
  colQuantity: string
  colUnitPrice: string
  colTotalUsd: string
  colRate: string
  colTotalToman: string
  colDate: string
  colNote: string
  colStatus: string
  pdfTrade: string
  pdfAsset: string
  pdfType: string
  pdfQuantity: string
  pdfUnitPrice: string
  pdfTotal: string
  pdfRate: string
  pdfToman: string
  pdfDate: string
}

export interface ExportSummary {
  tradeCount: number
  buyVolumeUsd: string
  sellVolumeUsd: string
  realizedPnlUsd: string
  /** Null when any included trade has no mark. Never coerced to zero. */
  unrealizedPnlUsd: string | null
}

export type ExportResult
  = | { ok: true, status: 200, headers: Record<string, string>, body: Buffer }
    | { ok: false, status: 401, body: { code: 'unauthorized' } }
    | { ok: false, status: 422, body: { code: 'validation_error', fields: Record<string, string> } }
    | { ok: false, status: 500, body: { code: 'generic' } }

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function one(value: unknown) {
  if (Array.isArray(value)) return one(value[0])
  if (typeof value === 'string') return value
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return ''
}

function sideOf(value: string) {
  const side = value.trim().toLowerCase()
  if (side === 'buy' || side === 'sell') return side
  return ''
}

export function parseExportFilters(query: Record<string, unknown>): { format: 'xlsx' | 'pdf' | '', filters: TradeListFilters } {
  const formatRaw = one(query.format).trim().toLowerCase()
  const format = formatRaw === 'xlsx' || formatRaw === 'pdf' ? formatRaw : ''
  const side = sideOf(one(query.type) || one(query.side))
  const statusRaw = one(query.status).trim().toLowerCase()
  const status = statusRaw === 'open' || statusRaw === 'closed' ? statusRaw : ''
  const from = one(query.from).trim()
  const to = one(query.to).trim()
  const sortRaw = one(query.sort).trim().toLowerCase()
  const sort = ['newest', 'oldest', 'highest', 'lowest'].includes(sortRaw) ? sortRaw : 'newest'
  const tzRaw = Number(one(query.tz))
  const tzOffsetMinutes = Number.isFinite(tzRaw) && tzRaw >= -14 * 60 && tzRaw <= 14 * 60 ? tzRaw : 0
  return {
    format,
    filters: {
      asset: one(query.asset).trim(),
      side,
      status,
      from: DATE_RE.test(from) ? from : '',
      to: DATE_RE.test(to) ? to : '',
      search: (one(query.q) || one(query.search)).trim(),
      sort,
      tzOffsetMinutes,
    },
  }
}

export function exportFilename(format: 'xlsx' | 'pdf', now: Date) {
  const pad = (n: number) => String(n).padStart(2, '0')
  const day = `${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}-${pad(now.getUTCDate())}`
  return `trado-trades-${day}.${format}`
}

function readLocale(locale: 'en' | 'fa') {
  // Imported so Nitro inlines the messages. A filesystem read misses once the
  // bundle rewrites import.meta.url and the process is not started in the repo.
  return locale === 'fa' ? faMessages : enMessages
}

export function exportLabels(locale: 'en' | 'fa'): ExportLabels {
  const messages = readLocale(locale)
  const exp = messages.export
  const trades = messages.trades
  return {
    appName: messages.app.name,
    reportTitle: exp.reportTitle,
    generated: exp.generated,
    totalTrades: exp.totalTrades,
    buyVolume: exp.buyVolume,
    sellVolume: exp.sellVolume,
    realized: exp.realized,
    unrealized: exp.unrealized,
    blank: exp.blank,
    sheet: exp.sheet,
    buy: trades.buy,
    sell: trades.sell,
    statusOpen: trades.statusOpen,
    statusClosed: trades.statusClosed,
    statusEmpty: trades.noEntries,
    colTrade: exp.colTrade,
    colAsset: exp.colAsset,
    colSymbol: exp.colSymbol,
    colType: exp.colType,
    colQuantity: exp.colQuantity,
    colUnitPrice: exp.colUnitPrice,
    colTotalUsd: exp.colTotalUsd,
    colRate: exp.colRate,
    colTotalToman: exp.colTotalToman,
    colDate: exp.colDate,
    colNote: exp.colNote,
    colStatus: exp.colStatus,
    pdfTrade: exp.pdfTrade,
    pdfAsset: exp.pdfAsset,
    pdfType: exp.pdfType,
    pdfQuantity: exp.pdfQuantity,
    pdfUnitPrice: exp.pdfUnitPrice,
    pdfTotal: exp.pdfTotal,
    pdfRate: exp.pdfRate,
    pdfToman: exp.pdfToman,
    pdfDate: exp.pdfDate,
  }
}

function tradeName(trade: TradeDetail) {
  const title = trade.title?.trim()
  return title || trade.asset.name
}

function statusLabel(status: TradeDetail['status'], labels: ExportLabels) {
  if (status === 'closed') return labels.statusClosed
  if (status === 'empty') return labels.statusEmpty
  return labels.statusOpen
}

function sideLabel(side: '' | 'buy' | 'sell', labels: ExportLabels) {
  if (side === 'buy') return labels.buy
  if (side === 'sell') return labels.sell
  return ''
}

export interface ExportRow {
  trade: string
  asset: string
  symbol: string
  type: '' | 'buy' | 'sell'
  quantity: string | null
  unitPriceUsd: string | null
  totalUsd: string | null
  usdTomanRate: string | null
  totalToman: string | null
  date: string | null
  note: string
  status: TradeDetail['status']
}

function entrySort(a: TradeEntryRecord, b: TradeEntryRecord) {
  const delta = new Date(a.transactedAt).getTime() - new Date(b.transactedAt).getTime()
  if (delta !== 0) return delta
  return a.id.localeCompare(b.id)
}

export function exportRows(trades: TradeDetail[]): ExportRow[] {
  const rows: ExportRow[] = []
  for (const trade of trades) {
    const entries = [...trade.entries].sort(entrySort)
    if (!entries.length) {
      rows.push({
        trade: tradeName(trade),
        asset: trade.asset.name,
        symbol: trade.asset.symbol,
        type: '',
        quantity: null,
        unitPriceUsd: null,
        totalUsd: null,
        usdTomanRate: null,
        totalToman: null,
        date: null,
        note: '',
        status: trade.status,
      })
      continue
    }
    for (const entry of entries) {
      rows.push({
        trade: tradeName(trade),
        asset: trade.asset.name,
        symbol: trade.asset.symbol,
        type: entry.side,
        quantity: entry.quantity,
        unitPriceUsd: entry.unitPriceUsd,
        totalUsd: entry.totalUsd,
        usdTomanRate: entry.usdTomanRate,
        totalToman: entry.totalToman,
        date: entry.transactedAt,
        note: entry.note ?? '',
        status: trade.status,
      })
    }
  }
  return rows
}

/**
 * Volumes and P&L come from presentTrade / valueTrade fields already stored
 * on the trade. This does not multiply quantity by price and does not invent
 * a mark when one is missing.
 */
export function summarizeTrades(trades: TradeDetail[]): ExportSummary {
  let buy = new Decimal(0)
  let sell = new Decimal(0)
  let realized = new Decimal(0)
  let unrealized = new Decimal(0)
  let missingMark = false
  for (const trade of trades) {
    buy = buy.plus(trade.buyUsd)
    sell = sell.plus(trade.sellUsd)
    realized = realized.plus(trade.realizedPnlUsd)
    if (!trade.markAvailable || trade.unrealizedPnlUsd == null) missingMark = true
    else unrealized = unrealized.plus(trade.unrealizedPnlUsd)
  }
  return {
    tradeCount: trades.length,
    buyVolumeUsd: buy.toFixed(12),
    sellVolumeUsd: sell.toFixed(12),
    realizedPnlUsd: realized.toFixed(8),
    unrealizedPnlUsd: trades.length && missingMark ? null : unrealized.toFixed(8),
  }
}

function excelNumber(value: string) {
  const dec = new Decimal(value)
  if (!dec.isFinite()) return null
  const num = dec.toNumber()
  return Number.isFinite(num) ? num : null
}

function fill(argb: string): ExcelJS.Fill {
  return { type: 'pattern', pattern: 'solid', fgColor: { argb } }
}

export async function buildXlsx(input: {
  rows: ExportRow[]
  labels: ExportLabels
  now: Date
}) {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Trado'
  workbook.created = input.now
  workbook.modified = input.now
  const sheet = workbook.addWorksheet(input.labels.sheet.slice(0, 31) || 'Trades', {
    views: [{ state: 'frozen', ySplit: 1, activeCell: 'A2' }],
  })
  sheet.columns = [
    { header: input.labels.colTrade, key: 'trade', width: 28 },
    { header: input.labels.colAsset, key: 'asset', width: 22 },
    { header: input.labels.colSymbol, key: 'symbol', width: 12 },
    { header: input.labels.colType, key: 'type', width: 12 },
    { header: input.labels.colQuantity, key: 'quantity', width: 16 },
    { header: input.labels.colUnitPrice, key: 'unitPriceUsd', width: 18 },
    { header: input.labels.colTotalUsd, key: 'totalUsd', width: 16 },
    { header: input.labels.colRate, key: 'usdTomanRate', width: 18 },
    { header: input.labels.colTotalToman, key: 'totalToman', width: 18 },
    { header: input.labels.colDate, key: 'date', width: 20 },
    { header: input.labels.colNote, key: 'note', width: 32 },
    { header: input.labels.colStatus, key: 'status', width: 16 },
  ]
  for (const row of input.rows) {
    const added = sheet.addRow({
      trade: row.trade,
      asset: row.asset,
      symbol: row.symbol,
      type: sideLabel(row.type, input.labels),
      quantity: row.quantity == null ? null : excelNumber(row.quantity),
      unitPriceUsd: row.unitPriceUsd == null ? null : excelNumber(row.unitPriceUsd),
      totalUsd: row.totalUsd == null ? null : excelNumber(row.totalUsd),
      usdTomanRate: row.usdTomanRate == null ? null : excelNumber(row.usdTomanRate),
      totalToman: row.totalToman == null ? null : excelNumber(row.totalToman),
      date: row.date ? new Date(row.date) : null,
      note: row.note,
      status: statusLabel(row.status, input.labels),
    })
    added.getCell('quantity').numFmt = '0.########'
    added.getCell('unitPriceUsd').numFmt = '#,##0.00########'
    added.getCell('totalUsd').numFmt = '#,##0.00'
    added.getCell('usdTomanRate').numFmt = '#,##0.0000'
    added.getCell('totalToman').numFmt = '#,##0.00'
    added.getCell('date').numFmt = 'yyyy-mm-dd hh:mm'
    added.getCell('note').alignment = { wrapText: true, vertical: 'top' }
    added.getCell('trade').alignment = { wrapText: true, vertical: 'top' }
  }
  const header = sheet.getRow(1)
  header.font = { bold: true, size: 11 }
  header.height = 22
  header.eachCell((cell) => {
    cell.fill = fill('FFF3F1EC')
    cell.alignment = { vertical: 'middle' }
    cell.border = { bottom: { style: 'thin', color: { argb: 'FFB08D55' } } }
  })
  sheet.autoFilter = { from: 'A1', to: 'L1' }
  const raw = await workbook.xlsx.writeBuffer()
  return Buffer.from(raw)
}

function moneyDigits(value: string, locale: string) {
  const dec = new Decimal(value)
  const abs = dec.abs()
  const digits = abs.gte(1) ? 2 : 8
  const minimum = abs.gte(1) ? 2 : 0
  return formatDecimal(dec, locale, digits, minimum)
}

function tomanDigits(value: string, locale: string) {
  const dec = new Decimal(value)
  const abs = dec.abs()
  const digits = abs.mod(1).eq(0) || abs.gte(100) ? 0 : 2
  return formatDecimal(dec, locale, digits, 0)
}

function rateDigits(value: string, locale: string) {
  return formatDecimal(value, locale, 4, 0)
}

function displayInstant(iso: string, tzOffsetMinutes: number) {
  return new Date(new Date(iso).getTime() - tzOffsetMinutes * 60_000).toISOString()
}

function pdfBuffer(doc: PDFDocument) {
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = []
    doc.on('data', (chunk: Buffer) => chunks.push(chunk))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)
    doc.end()
  })
}

const INK = '#1c1b19'
const MUTED = '#5e5a54'
const RULE = '#e4e0d8'
const HEADER = '#f3f1ec'
const BRASS = '#b08d55'
const TABLE_SIZE = 8

interface PdfColumn {
  label: string
  weight: number
  align: 'start' | 'end'
  value: (row: ExportRow) => string
}

function columnAlign(direction: TextDirection, align: 'start' | 'end'): TextAlign {
  if (direction === 'rtl') return align === 'start' ? 'right' : 'left'
  return align === 'start' ? 'left' : 'right'
}

export async function buildPdf(input: {
  rows: ExportRow[]
  summary: ExportSummary
  labels: ExportLabels
  locale: 'en' | 'fa'
  font: Buffer
  now: Date
  tzOffsetMinutes: number
}) {
  const direction: TextDirection = input.locale === 'fa' ? 'rtl' : 'ltr'
  const locale = input.locale === 'fa' ? 'fa' : 'en'
  const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 0, compress: true })
  doc.info.Title = input.labels.reportTitle
  doc.info.Author = 'Trado'
  doc.info.Creator = 'Trado'
  doc.registerFont('vazir', input.font)
  doc.font('vazir')
  const margin = 28
  const pageWidth = doc.page.width
  const pageHeight = doc.page.height
  const usable = pageWidth - margin * 2
  const lineAlign: TextAlign = direction === 'rtl' ? 'right' : 'left'
  let y = margin

  const paint = (text: string, x: number, top: number, size: number, width: number, align: TextAlign, color = INK) => {
    doc.fillColor(color)
    drawText(doc, text, x, top, size, direction, width, align)
  }
  const block = (text: string, x: number, top: number, size: number, width: number, align: TextAlign, color = INK) => {
    const lines = wrapText(doc._font.font, text, size, width, direction)
    const step = size * 1.35
    lines.forEach((line, index) => paint(line, x, top + index * step, size, width, align, color))
    return lines.length * step
  }

  const generated = input.labels.generated.replace('{date}', formatDateTime(displayInstant(input.now.toISOString(), input.tzOffsetMinutes), locale, 'UTC'))
  y += block(input.labels.appName, margin, y, 18, usable, lineAlign)
  y += 2
  y += block(input.labels.reportTitle, margin, y, 12, usable, lineAlign, MUTED)
  y += block(generated, margin, y, 9, usable, lineAlign, MUTED)
  y += 6
  doc.save()
  doc.strokeColor(BRASS).lineWidth(0.7).moveTo(margin, y).lineTo(margin + usable, y).stroke()
  doc.restore()
  y += 12

  const summaryItems = [
    [input.labels.totalTrades, formatDecimal(input.summary.tradeCount, locale, 0)],
    [input.labels.buyVolume, formatUsd(input.summary.buyVolumeUsd, locale)],
    [input.labels.sellVolume, formatUsd(input.summary.sellVolumeUsd, locale)],
    [input.labels.realized, formatUsd(input.summary.realizedPnlUsd, locale, true)],
    [input.labels.unrealized, input.summary.unrealizedPnlUsd == null ? input.labels.blank : formatUsd(input.summary.unrealizedPnlUsd, locale, true)],
  ]
  const summaryVisual = direction === 'rtl' ? summaryItems.slice().reverse() : summaryItems
  const summaryWidth = usable / summaryVisual.length
  const summaryTop = y
  summaryVisual.forEach((item, index) => {
    const x = margin + index * summaryWidth
    block(item[0] ?? '', x, summaryTop, 8, summaryWidth - 8, lineAlign, MUTED)
    block(item[1] ?? '', x, summaryTop + 12, 10, summaryWidth - 8, lineAlign)
  })
  y = summaryTop + 36

  const numberAlign = direction === 'rtl' ? 'start' as const : 'end' as const
  const columns: PdfColumn[] = [
    { label: input.labels.pdfTrade, weight: 1.3, align: 'start', value: row => row.trade },
    { label: input.labels.pdfAsset, weight: 1.05, align: 'start', value: row => row.asset },
    { label: input.labels.pdfType, weight: 0.7, align: 'start', value: row => sideLabel(row.type, input.labels) },
    { label: input.labels.pdfQuantity, weight: 0.85, align: numberAlign, value: row => row.quantity == null ? '' : formatQuantity(row.quantity, locale) },
    { label: input.labels.pdfUnitPrice, weight: 0.95, align: numberAlign, value: row => row.unitPriceUsd == null ? '' : moneyDigits(row.unitPriceUsd, locale) },
    { label: input.labels.pdfTotal, weight: 0.95, align: numberAlign, value: row => row.totalUsd == null ? '' : moneyDigits(row.totalUsd, locale) },
    { label: input.labels.pdfRate, weight: 0.9, align: numberAlign, value: row => row.usdTomanRate == null ? '' : rateDigits(row.usdTomanRate, locale) },
    { label: input.labels.pdfToman, weight: 1.15, align: numberAlign, value: row => row.totalToman == null ? '' : tomanDigits(row.totalToman, locale) },
    {
      label: input.labels.pdfDate,
      weight: 1.45,
      align: 'start',
      value: row => row.date ? formatDate(displayInstant(row.date, input.tzOffsetMinutes), locale, 'UTC') : '',
    },
  ]
  const visualColumns = direction === 'rtl' ? columns.slice().reverse() : columns
  const weightSum = visualColumns.reduce((sum, column) => sum + column.weight, 0)
  const widths = visualColumns.map(column => usable * column.weight / weightSum)

  const drawHeader = (top: number) => {
    doc.save()
    doc.rect(margin, top, usable, 20).fill(HEADER)
    doc.restore()
    let x = margin
    visualColumns.forEach((column, index) => {
      const width = widths[index] ?? 0
      paint(column.label, x + 6, top + 5, TABLE_SIZE, Math.max(8, width - 12), columnAlign(direction, 'start'), MUTED)
      x += width
    })
    return top + 20
  }

  const rowHeight = (row: ExportRow) => {
    let lines = 1
    visualColumns.forEach((column, index) => {
      const width = (widths[index] ?? 0) - 12
      const count = wrapText(doc._font.font, column.value(row), TABLE_SIZE, Math.max(8, width), direction).length
      lines = Math.max(lines, Math.min(count, 4))
    })
    return lines * TABLE_SIZE * 1.35 + 8
  }

  const drawRow = (row: ExportRow, top: number, height: number, zebra: boolean) => {
    if (zebra) {
      doc.save()
      doc.rect(margin, top, usable, height).fill('#faf9f6')
      doc.restore()
    }
    let x = margin
    visualColumns.forEach((column, index) => {
      const width = widths[index] ?? 0
      const inner = Math.max(8, width - 12)
      const lines = wrapText(doc._font.font, column.value(row), TABLE_SIZE, inner, direction).slice(0, 4)
      const align = columnAlign(direction, column.align)
      lines.forEach((line, lineIndex) => {
        paint(line, x + 6, top + 4 + lineIndex * TABLE_SIZE * 1.35, TABLE_SIZE, inner, align)
      })
      x += width
    })
    doc.save()
    doc.strokeColor(RULE).lineWidth(0.4).moveTo(margin, top + height).lineTo(margin + usable, top + height).stroke()
    doc.restore()
  }

  const newPage = () => {
    doc.addPage({ size: 'A4', layout: 'landscape', margin: 0 })
    y = margin
    y = drawHeader(y)
  }

  if (y + 20 > pageHeight - margin) newPage()
  else y = drawHeader(y)

  input.rows.forEach((row, index) => {
    const height = rowHeight(row)
    if (y + height > pageHeight - margin) newPage()
    drawRow(row, y, height, index % 2 === 1)
    y += height
  })

  return pdfBuffer(doc)
}

export async function handleTradeExport(input: {
  sessionUserId: string | null | undefined
  query: Record<string, unknown>
  locale: 'en' | 'fa'
  font: Buffer | null
  now?: Date
  load: (userId: string) => Promise<TradeDetail[]>
}): Promise<ExportResult> {
  if (!input.sessionUserId) return { ok: false, status: 401, body: { code: 'unauthorized' } }
  const parsed = parseExportFilters(input.query)
  if (!parsed.format) return { ok: false, status: 422, body: { code: 'validation_error', fields: { format: 'invalid' } } }
  const trades = filterTrades(await input.load(input.sessionUserId), parsed.filters)
  const rows = exportRows(trades)
  const summary = summarizeTrades(trades)
  const labels = exportLabels(input.locale)
  const now = input.now ?? new Date()
  const filename = exportFilename(parsed.format, now)
  if (parsed.format === 'xlsx') {
    const body = await buildXlsx({ rows, labels, now })
    return {
      ok: true,
      status: 200,
      headers: {
        'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'content-disposition': `attachment; filename="${filename}"`,
        'cache-control': 'private, no-store',
      },
      body,
    }
  }
  if (!input.font?.length) return { ok: false, status: 500, body: { code: 'generic' } }
  const body = await buildPdf({
    rows,
    summary,
    labels,
    locale: input.locale,
    font: input.font,
    now,
    tzOffsetMinutes: parsed.filters.tzOffsetMinutes ?? 0,
  })
  return {
    ok: true,
    status: 200,
    headers: {
      'content-type': 'application/pdf',
      'content-disposition': `attachment; filename="${filename}"`,
      'cache-control': 'private, no-store',
    },
    body,
  }
}
