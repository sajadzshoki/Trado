import { capitalSchema } from '../utils/schemas'
import { readJson } from '../utils/http'
import { saveCapital } from '../utils/journal'

export default defineEventHandler(async (event) => {
  const body = await readJson(event, capitalSchema)
  return saveCapital(event, body)
})
