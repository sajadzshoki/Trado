import { tradeUpdateSchema } from '../../utils/schemas'
import { readJson } from '../../utils/http'
import { updateTrade } from '../../utils/journal'

export default defineEventHandler(async (event) => {
  const body = await readJson(event, tradeUpdateSchema)
  const id = getRouterParam(event, 'id')
  return updateTrade(event, id ?? '', body)
})
