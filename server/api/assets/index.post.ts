import { assetSchema } from '../../utils/schemas'
import { readJson } from '../../utils/http'
import { createAsset } from '../../utils/journal'

export default defineEventHandler(async (event) => {
  const body = await readJson(event, assetSchema)
  return createAsset(event, body)
})
