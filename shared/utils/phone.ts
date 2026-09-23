const E164 = /^\+[1-9]\d{7,14}$/

export function normalizePhone(input: string): string | null {
  let raw = input.trim().replace(/[\s\-().]/g, '')
  if (!raw) return null
  if (raw.startsWith('00')) raw = `+${raw.slice(2)}`
  if (/^09\d{9}$/.test(raw)) raw = `+98${raw.slice(1)}`
  if (/^989\d{9}$/.test(raw)) raw = `+${raw}`
  if (!E164.test(raw)) return null
  return raw
}

export function formatPhone(e164: string): string {
  if (e164.startsWith('+98') && e164.length === 13) {
    const local = `0${e164.slice(3)}`
    return `${local.slice(0, 4)} ${local.slice(4, 7)} ${local.slice(7)}`
  }
  return e164
}
