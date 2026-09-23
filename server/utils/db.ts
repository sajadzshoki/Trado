import { drizzle } from 'drizzle-orm/node-postgres'
import pg from 'pg'
import * as schema from '../database/schema'

const globalForDb = globalThis as unknown as { tradoPool?: pg.Pool }

export function useDb() {
  const config = useRuntimeConfig()
  const connectionString = config.databaseUrl || process.env.DATABASE_URL
  if (!connectionString) {
    throw createError({
      statusCode: 500,
      statusMessage: 'database_not_configured',
      data: { code: 'database_down' },
    })
  }
  if (!globalForDb.tradoPool) {
    globalForDb.tradoPool = new pg.Pool({
      connectionString,
      max: 10,
    })
  }
  return drizzle(globalForDb.tradoPool, { schema })
}

export type Database = ReturnType<typeof useDb>
