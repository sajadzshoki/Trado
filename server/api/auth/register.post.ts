import { registerSchema } from '../../utils/schemas'
import { clientAddress, readJson } from '../../utils/http'
import { registerAccount } from '../../utils/journal'
import { assertRateLimit } from '../../utils/rate-limit'

export default defineEventHandler(async (event) => {
  assertRateLimit(`register:${clientAddress(event)}`, 5, 60 * 60 * 1000)
  const body = await readJson(event, registerSchema)
  return registerAccount(event, body)
})
