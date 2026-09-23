import { z } from 'zod'
import { MAX_ENTRY_NOTE_LENGTH, MAX_NAME_LENGTH, MAX_NOTE_LENGTH, MAX_PASSWORD_LENGTH, MAX_TITLE_LENGTH, MIN_PASSWORD_LENGTH } from '../../shared/constants'

export const registerSchema = z.object({
  phone: z.string().trim().min(1).max(32),
  password: z.string().min(MIN_PASSWORD_LENGTH).max(MAX_PASSWORD_LENGTH),
  displayName: z.string().trim().max(MAX_NAME_LENGTH).optional().nullable(),
  locale: z.enum(['en', 'fa']).optional(),
  displayCurrency: z.enum(['USD', 'TOMAN']).optional(),
})

export const loginSchema = z.object({
  phone: z.string().trim().min(1).max(32),
  password: z.string().min(1).max(MAX_PASSWORD_LENGTH),
})

export const passwordSchema = z.object({
  currentPassword: z.string().min(1).max(MAX_PASSWORD_LENGTH),
  newPassword: z.string().min(MIN_PASSWORD_LENGTH).max(MAX_PASSWORD_LENGTH),
})

export const settingsSchema = z.object({
  displayName: z.string().trim().max(MAX_NAME_LENGTH).nullable().optional(),
  locale: z.enum(['en', 'fa']).optional(),
  displayCurrency: z.enum(['USD', 'TOMAN']).optional(),
})

export const assetSchema = z.object({
  symbol: z.string().trim().min(1).max(12),
  name: z.string().trim().min(1).max(64),
})

export const entrySchema = z.object({
  side: z.enum(['buy', 'sell']),
  quantity: z.string().trim().min(1).max(64),
  unitPriceUsd: z.string().trim().min(1).max(64),
  usdTomanRate: z.string().trim().min(1).max(64),
  transactedAt: z.string().trim().min(1).max(40),
  note: z.string().trim().max(MAX_ENTRY_NOTE_LENGTH).optional().nullable(),
})

export const tradeCreateSchema = z.object({
  assetId: z.string().uuid(),
  title: z.string().trim().max(MAX_TITLE_LENGTH).optional().nullable(),
  notes: z.string().trim().max(MAX_NOTE_LENGTH).optional().nullable(),
  entry: entrySchema,
})

export const tradeUpdateSchema = z.object({
  assetId: z.string().uuid().optional(),
  title: z.string().trim().max(MAX_TITLE_LENGTH).nullable().optional(),
  notes: z.string().trim().max(MAX_NOTE_LENGTH).nullable().optional(),
})

export const capitalSchema = z.object({
  amountUsd: z.string().trim().min(1).max(64),
  usdTomanRate: z.string().trim().min(1).max(64),
  recordedAt: z.string().trim().min(1).max(40),
})
