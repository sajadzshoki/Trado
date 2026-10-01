import { entrySchema } from '../../utils/schemas'
import { readJson } from '../../utils/http'
import { updateEntry } from '../../utils/journal'

export default defineEventHandler(async (event) => {
  const body = await readJson(event, entrySchema)
  const id = getRouterParam(event, 'id')
  return updateEntry(event, id ?? '', body)
})
