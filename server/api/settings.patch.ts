import { settingsSchema } from '../utils/schemas'
import { readJson } from '../utils/http'
import { updateSettings } from '../utils/journal'

export default defineEventHandler(async (event) => {
  const body = await readJson(event, settingsSchema)
  return updateSettings(event, body)
})
