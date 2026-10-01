import { apiError } from './http'

interface Bucket {
  count: number
  resetAt: number
}

const buckets = new Map<string, Bucket>()

export function assertRateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now()
  if (buckets.size > 2000) {
    for (const [bucketKey, bucket] of buckets) {
      if (bucket.resetAt <= now) buckets.delete(bucketKey)
    }
  }
  const existing = buckets.get(key)
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return
  }
  existing.count += 1
  if (existing.count > limit) apiError(429, 'rate_limited')
}
