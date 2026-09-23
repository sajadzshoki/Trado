export function safeInternalPath(value: unknown): string | null {
  if (typeof value !== 'string' || value.length === 0 || value.length > 512) return null
  if (!value.startsWith('/') || value.startsWith('//')) return null
  if (value.includes('\\') || value.includes('://') || /[\u0000-\u001F\u007F]/.test(value)) return null
  let decoded = value
  try {
    decoded = decodeURIComponent(value)
  }
  catch {
    return null
  }
  if (!decoded.startsWith('/') || decoded.startsWith('//') || decoded.includes('\\') || decoded.includes('://')) return null
  if (/[\u0000-\u001F\u007F]/.test(decoded)) return null
  return value
}
