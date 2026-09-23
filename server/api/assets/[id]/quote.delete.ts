import { clearQuote } from '../../../utils/journal'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  return clearQuote(event, id ?? '')
})