import { sessionCookieOpts } from '../../utils/session-cookie'

export default defineEventHandler(async (event) => {
  await clearUserSession(event, sessionCookieOpts(event))
  return { ok: true }
})
