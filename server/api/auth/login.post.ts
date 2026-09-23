import { loginSchema } from '../../utils/schemas'
import { clientAddress, readJson } from '../../utils/http'
import { loginAccount } from '../../utils/journal'
import { assertRateLimit } from '../../utils/rate-limit'
import { normalizePhone } from '../../../shared/utils/phone'

export default defineEventHandler(async (event) => {
  const body = await readJson(event, loginSchema)
  const phone = normalizePhone(body.phone) ?? 'invalid'
  assertRateLimit(`login:${clientAddress(event)}:${phone}`, 8, 15 * 60 * 1000)
  return loginAccount(event, body)
})
