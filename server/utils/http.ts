import type { H3Event } from 'h3'
import type { ZodType } from 'zod'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function apiError(statusCode: number, code: string, extra?: Record<string, unknown>): never {
  throw createError({
    statusCode,
    statusMessage: code,
    data: { code, ...extra },
  })
}

export async function requireUserId(event: H3Event) {
  const session = await getUserSession(event)
  if (!session.user?.id) apiError(401, 'unauthorized')
  return session.user.id
}

export function requireUuid(value: unknown) {
  if (typeof value !== 'string' || !UUID_RE.test(value)) apiError(404, 'not_found')
  return value
}

export async function readJson<T>(event: H3Event, schema: ZodType<T>): Promise<T> {
  const body = await readBody(event)
  const parsed = schema.safeParse(body ?? {})
  if (!parsed.success) {
    const fields: Record<string, string> = {}
    for (const issue of parsed.error.issues) {
      const key = issue.path.join('.') || '_'
      if (!fields[key]) fields[key] = 'invalid'
    }
    apiError(422, 'validation_error', { fields })
  }
  return parsed.data
}

export function isUniqueViolation(error: unknown, constraint?: string) {
  const seen = new Set<unknown>()
  let current: unknown = error
  while (current && typeof current === 'object' && !seen.has(current)) {
    seen.add(current)
    const record = current as { code?: string, constraint?: string, cause?: unknown }
    if (record.code === '23505' && (!constraint || record.constraint === constraint)) return true
    current = record.cause
  }
  return false
}

export function clientAddress(event: H3Event) {
  return getRequestIP(event, { xForwardedFor: true }) || 'unknown'
}
