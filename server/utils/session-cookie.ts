import type { H3Event } from 'h3'
import { getRequestHeader, getRequestURL } from 'h3'

/** Secure session cookies only for real HTTPS (or X-Forwarded-Proto: https). */
export function sessionCookieOpts(event: H3Event) {
  const forwarded = getRequestHeader(event, 'x-forwarded-proto')?.split(',')[0]?.trim()
  const isHttps = forwarded === 'https' || getRequestURL(event).protocol === 'https:'
  return {
    cookie: {
      sameSite: 'lax' as const,
      secure: isHttps,
    },
  }
}
