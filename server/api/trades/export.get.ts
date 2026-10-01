import type { TradeDetail } from '../../../shared/types/journal'
import { readExportFont } from '../../utils/export-font'
import { apiError, requireUserId } from '../../utils/http'
import { listTradesForExport } from '../../utils/journal'
import { handleTradeExport } from '../../utils/trade-export'

export default defineEventHandler(async (event) => {
  const sessionUserId = await requireUserId(event)
  const session = await getUserSession(event)
  const locale = session.user?.locale === 'fa' ? 'fa' : 'en'
  const result = await handleTradeExport({
    sessionUserId,
    query: getQuery(event),
    locale,
    font: await readExportFont(),
    load: async (userId) => {
      if (userId !== sessionUserId) apiError(403, 'forbidden')
      return listTradesForExport(event) as Promise<TradeDetail[]>
    },
  })
  if (!result.ok) {
    apiError(result.status, result.body.code, 'fields' in result.body ? { fields: result.body.fields } : undefined)
  }
  for (const [key, value] of Object.entries(result.headers)) setHeader(event, key, value)
  return result.body
})
