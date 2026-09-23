import { entrySchema } from '../../../utils/schemas'
import { readJson } from '../../../utils/http'
import { addEntry } from '../../../utils/journal'

export default defineEventHandler(async (event) => {
  const body = await readJson(event, entrySchema)
  const id = getRouterParam(event, 'id')
  setResponseStatus(event, 201)
  return addEntry(event, id ?? '', body)
})
