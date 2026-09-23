import { removeTrade } from '../../utils/journal'

export default defineEventHandler((event) => {
  const id = getRouterParam(event, 'id')
  return removeTrade(event, id ?? '')
})
