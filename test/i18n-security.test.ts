import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { formatToman, formatUsd, parsePositiveDecimal } from '../shared/utils/numbers.ts'
import { safeInternalPath } from '../shared/utils/paths.ts'

test('persian digits and separators are accepted as decimal input', () => {
  const parsed = parsePositiveDecimal('۱۲۰٬۰۰۰٫۵')
  assert.equal(parsed.ok, true)
  if (!parsed.ok) return
  assert.equal(parsed.value.toFixed(1), '120000.5')
})

test('english and persian money labels stay locale-specific', () => {
  assert.equal(formatUsd('120000', 'en-US'), '$120,000.00')
  assert.equal(formatUsd('120000', 'fa-IR'), '۱۲۰٬۰۰۰٫۰۰ دلار')
  assert.equal(formatToman('12000000000', 'fa-IR'), '۱۲٬۰۰۰٬۰۰۰٬۰۰۰ تومان')
  assert.equal(formatToman('12000000000', 'en-US'), '12,000,000,000 Toman')
})

test('login redirects stay inside the app', () => {
  assert.equal(safeInternalPath('/trades/abc'), '/trades/abc')
  assert.equal(safeInternalPath('/fa/trades'), '/fa/trades')
  assert.equal(safeInternalPath('//evil.example'), null)
  assert.equal(safeInternalPath('https://evil.example'), null)
  assert.equal(safeInternalPath('/\\evil.example'), null)
  assert.equal(safeInternalPath('/%2F%2Fevil.example'), null)
  assert.equal(safeInternalPath('/trades\nset-cookie'), null)
})

test('locale files have the same keys', () => {
  const en = JSON.parse(readFileSync(new URL('../i18n/locales/en.json', import.meta.url), 'utf8'))
  const fa = JSON.parse(readFileSync(new URL('../i18n/locales/fa.json', import.meta.url), 'utf8'))
  function keys(value: unknown, prefix = ''): string[] {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return [prefix]
    return Object.entries(value).flatMap(([key, child]) => keys(child, prefix ? `${prefix}.${key}` : key))
  }
  assert.deepEqual(keys(en).sort(), keys(fa).sort())
})
