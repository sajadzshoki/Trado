import { randomBytes, scrypt, scryptSync, timingSafeEqual } from 'node:crypto'
import { MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH } from '../../shared/constants'

const KEYLEN = 64
const PARAMS = { N: 16384, r: 8, p: 1 } as const
const DUMMY_SALT = 'trado-dummy-salt'
const DUMMY_HASH = scryptSync('trado-dummy-password', DUMMY_SALT, KEYLEN, PARAMS)

export function hashUserPassword(password: string): Promise<string> {
  if (password.length < MIN_PASSWORD_LENGTH || password.length > MAX_PASSWORD_LENGTH) {
    return Promise.reject(new Error('password_length'))
  }
  const salt = randomBytes(16).toString('hex')
  return new Promise((resolve, reject) => {
    scrypt(password, salt, KEYLEN, PARAMS, (error, derived) => {
      if (error) reject(error)
      else resolve(`scrypt$${salt}$${derived.toString('hex')}`)
    })
  })
}

export function verifyUserPassword(password: string, stored: string): Promise<boolean> {
  const [algo, salt, hash] = stored.split('$')
  if (algo !== 'scrypt' || !salt || !hash) return Promise.resolve(false)
  return new Promise((resolve, reject) => {
    scrypt(password, salt, KEYLEN, PARAMS, (error, derived) => {
      if (error) {
        reject(error)
        return
      }
      const expected = Buffer.from(hash, 'hex')
      if (expected.length !== derived.length) {
        resolve(false)
        return
      }
      resolve(timingSafeEqual(expected, derived))
    })
  })
}

export async function verifyUserPasswordOrDummy(password: string, stored: string | null) {
  if (!stored) {
    const derived = scryptSync(password, DUMMY_SALT, KEYLEN, PARAMS)
    timingSafeEqual(derived, DUMMY_HASH)
    return false
  }
  return verifyUserPassword(password, stored)
}
