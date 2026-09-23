import { assetUpdateSchema } from '../../utils/schemas'
import { readJson } from '../../utils/http'
import { updateAsset } from '../../utils/journal'

export default defineEventHandler(async (event) => {
  const body = await readJson(event, assetUpdateSchema)
  const id = getRouterParam(event, 'id')
  return updateAsset(event, id ?? '', body)
})
