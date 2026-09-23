import bidiFactory from 'bidi-js'
import type PDFDocument from 'pdfkit'

export type TextDirection = 'ltr' | 'rtl'
export type TextAlign = 'left' | 'right' | 'center'

interface Glyph {
  id: number
  name: string
  codePoints: number[]
  advanceWidth: number
}

interface Position {
  xAdvance: number
  xOffset: number
  yOffset: number
}

export interface OpenFont {
  unitsPerEm: number
  layout: (text: string, features?: unknown, script?: unknown, language?: unknown, direction?: string) => {
    glyphs: Glyph[]
    positions: Position[]
  }
}

interface Shaped {
  glyph: Glyph
  pos: Position
}

const bidi = bidiFactory()

function reverseContiguous<T>(items: T[], pred: (item: T) => boolean) {
  const out = items.slice()
  let index = 0
  while (index < out.length) {
    if (!pred(out[index]!)) {
      index += 1
      continue
    }
    let end = index
    while (end < out.length && pred(out[end]!)) end += 1
    out.splice(index, end - index, ...out.slice(index, end).reverse())
    index = end
  }
  return out
}

function visualRuns(text: string, direction: TextDirection) {
  const { levels } = bidi.getEmbeddingLevels(text, direction)
  const runs: Array<{ text: string, level: number }> = []
  let start = 0
  for (let index = 1; index <= text.length; index += 1) {
    if (index === text.length || levels[index] !== levels[start]) {
      runs.push({ text: text.slice(start, index), level: levels[start] ?? (direction === 'rtl' ? 1 : 0) })
      start = index
    }
  }
  const max = runs.reduce((highest, run) => Math.max(highest, run.level), 0)
  let order = runs
  for (let level = max; level >= 1; level -= 1) {
    order = reverseContiguous(order, run => run.level >= level)
  }
  return order
}

/** Shape a line. Glyphs come back in visual order, leftmost first. */
export function shapeLine(font: OpenFont, text: string, direction: TextDirection): Shaped[] {
  if (!text) return []
  const shaped: Shaped[] = []
  for (const run of visualRuns(text, direction)) {
    const runDirection = run.level % 2 === 1 ? 'rtl' : 'ltr'
    const layout = font.layout(run.text, undefined, undefined, undefined, runDirection)
    for (let index = 0; index < layout.glyphs.length; index += 1) {
      const glyph = layout.glyphs[index]
      const pos = layout.positions[index]
      if (!glyph || !pos) continue
      shaped.push({ glyph, pos })
    }
  }
  return shaped
}

export function glyphNames(font: OpenFont, text: string, direction: TextDirection) {
  return shapeLine(font, text, direction).map(item => item.glyph.name)
}

function unitWidth(item: Shaped) {
  return item.pos.xAdvance || item.glyph.advanceWidth
}

export function measureText(font: OpenFont, text: string, size: number, direction: TextDirection) {
  const scale = size / font.unitsPerEm
  return shapeLine(font, text, direction).reduce((sum, item) => sum + unitWidth(item) * scale, 0)
}

export function wrapText(font: OpenFont, text: string, size: number, maxWidth: number, direction: TextDirection) {
  const clean = text.replace(/\s+/g, ' ').trim()
  if (!clean) return ['']
  const tokens = clean.split(' ')
  const lines: string[] = []
  let current = ''
  const pushToken = (token: string) => {
    if (measureText(font, token, size, direction) <= maxWidth) {
      current = token
      return
    }
    let piece = ''
    for (const char of token) {
      const next = piece + char
      if (piece && measureText(font, next, size, direction) > maxWidth) {
        lines.push(piece)
        piece = char
      }
      else piece = next
    }
    current = piece
  }
  for (const token of tokens) {
    const next = current ? `${current} ${token}` : token
    if (!current || measureText(font, next, size, direction) <= maxWidth) current = next
    else {
      lines.push(current)
      pushToken(token)
    }
  }
  if (current) lines.push(current)
  return lines.length ? lines : ['']
}

/**
 * Draw shaped text. pdfkit flips the page so y grows downward, then draws
 * standard fonts upright with a second flip. This matches that second flip
 * so Vazir glyphs stay upright after Arabic shaping and bidi reordering.
 */
export function drawText(
  doc: PDFDocument,
  text: string,
  x: number,
  y: number,
  size: number,
  direction: TextDirection,
  width: number,
  align: TextAlign,
) {
  const font = doc._font.font
  const glyphs = shapeLine(font, text, direction)
  if (!glyphs.length) return
  const scale = size / font.unitsPerEm
  const total = glyphs.reduce((sum, item) => sum + unitWidth(item) * scale, 0)
  let cursor = x
  if (align === 'right') cursor = x + width - total
  if (align === 'center') cursor = x + (width - total) / 2

  const embedded = doc._font
  if (doc.page.fonts[embedded.id] == null) doc.page.fonts[embedded.id] = embedded.ref()
  const parts: string[] = []
  for (const item of glyphs) {
    const gid = embedded.subset.includeGlyph(item.glyph.id)
    if (embedded.widths[gid] == null) embedded.widths[gid] = item.glyph.advanceWidth * embedded.scale
    if (embedded.unicode[gid] == null) embedded.unicode[gid] = item.glyph.codePoints
    const adjust = -((unitWidth(item) - item.glyph.advanceWidth) * embedded.scale)
    parts.push(`<${gid.toString(16).padStart(4, '0')}> ${adjust.toFixed(2)}`)
  }
  const dy = embedded.ascender / 1000 * size
  doc.save()
  doc.transform(1, 0, 0, -1, 0, doc.page.height)
  const yPdf = doc.page.height - y - dy
  doc.addContent('BT')
  doc.addContent(`1 0 0 1 ${cursor.toFixed(2)} ${yPdf.toFixed(2)} Tm`)
  doc.addContent(`/${embedded.id} ${size} Tf`)
  doc.addContent(`[${parts.join(' ')}] TJ`)
  doc.addContent('ET')
  doc.restore()
}
