declare module 'pdfkit' {
  import { Readable } from 'node:stream'

  export default class PDFDocument extends Readable {
    constructor(options?: Record<string, unknown>)
    page: { width: number, height: number, fonts: Record<string, unknown> }
    info: Record<string, string>
    _font: {
      id: string
      ascender: number
      scale: number
      font: {
        unitsPerEm: number
        layout: (text: string, features?: unknown, script?: unknown, language?: unknown, direction?: string) => {
          glyphs: Array<{ id: number, name: string, codePoints: number[], advanceWidth: number }>
          positions: Array<{ xAdvance: number, xOffset: number, yOffset: number }>
        }
      }
      subset: { includeGlyph: (id: number) => number }
      widths: Array<number | undefined>
      unicode: Array<number[] | undefined>
      ref: () => unknown
    }
    font(name: string): this
    fontSize(size: number): this
    fillColor(color: string): this
    strokeColor(color: string): this
    lineWidth(width: number): this
    registerFont(name: string, src: Buffer | string): this
    save(): this
    restore(): this
    transform(a: number, b: number, c: number, d: number, e: number, f: number): this
    addContent(data: string): this
    rect(x: number, y: number, w: number, h: number): this
    moveTo(x: number, y: number): this
    lineTo(x: number, y: number): this
    fill(): this
    stroke(): this
    addPage(options?: Record<string, unknown>): this
    end(): void
  }
}

declare module 'fontkit' {
  export function openSync(src: Buffer | string): {
    unitsPerEm: number
    layout: (text: string, features?: unknown, script?: unknown, language?: unknown, direction?: string) => {
      glyphs: Array<{ id: number, name: string, codePoints: number[], advanceWidth: number }>
      positions: Array<{ xAdvance: number, xOffset: number, yOffset: number }>
    }
  }
}

declare module 'bidi-js' {
  interface Bidi {
    getEmbeddingLevels(text: string, direction?: 'ltr' | 'rtl'): { levels: Uint8Array }
  }
  export default function bidiFactory(): Bidi
}
