import { tradeCreateSchema } from '../../utils/schemas'
import { readJson } from '../../utils/http'
import { createTrade } from '../../utils/journal'

export default defineEventHandler(async (event) => {
  const body = await readJson(event, tradeCreateSchema)
  setResponseStatus(event, 201)
  return createTrade(event, body)
})
