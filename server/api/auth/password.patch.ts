import { passwordSchema } from '../../utils/schemas'
import { clientAddress, readJson, requireUserId } from '../../utils/http'
import { changePassword } from '../../utils/journal'
import { assertRateLimit } from '../../utils/rate-limit'

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  assertRateLimit(`password:${userId}:${clientAddress(event)}`, 5, 15 * 60 * 1000)
  const body = await readJson(event, passwordSchema)
  return changePassword(event, body)
})
