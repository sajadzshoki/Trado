import { sql } from 'drizzle-orm'
import { useDb } from '../utils/db'

export default defineEventHandler(async () => {
  try {
    await useDb().execute(sql`select 1`)
    return { ok: true, database: 'up' }
  }
  catch {
    throw createError({
      statusCode: 503,
      statusMessage: 'database_down',
      data: { code: 'database_down' },
    })
  }
})
