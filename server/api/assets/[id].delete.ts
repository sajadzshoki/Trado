import { removeAsset } from '../../utils/journal'

export default defineEventHandler((event) => {
  const id = getRouterParam(event, 'id')
  return removeAsset(event, id ?? '')
})
