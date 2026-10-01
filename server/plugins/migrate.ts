import { existsSync } from 'node:fs'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { useDb } from '../utils/db'

export default defineNitroPlugin(async () => {
  if (process.env.NUXT_AUTO_MIGRATE !== 'true') return
  const folder = 'server/database/migrations'
  if (!existsSync(folder)) return
  await migrate(useDb(), { migrationsFolder: folder })
})
