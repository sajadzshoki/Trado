import { getTrade } from '../../utils/journal'

export default defineEventHandler((event) => {
  const id = getRouterParam(event, 'id')
  return getTrade(event, id ?? '')
})
