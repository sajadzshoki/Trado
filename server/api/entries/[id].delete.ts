import { removeEntry } from '../../utils/journal'

export default defineEventHandler((event) => {
  const id = getRouterParam(event, 'id')
  return removeEntry(event, id ?? '')
})
