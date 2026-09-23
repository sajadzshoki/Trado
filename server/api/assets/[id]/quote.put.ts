import { quoteSchema } from '../../../utils/schemas'
import { readJson } from '../../../utils/http'
import { saveQuote } from '../../../utils/journal'

export default defineEventHandler(async (event) => {
  const body = await readJson(event, quoteSchema)
  const id = getRouterParam(event, 'id')
  return saveQuote(event, id ?? '', body)
})
