export type OtpPurpose = 'login' | 'register' | 'password_reset'

export interface OtpChallengeRequest {
  phone: string
  purpose: OtpPurpose
}

export interface OtpProvider {
  issue(request: OtpChallengeRequest): Promise<{ challengeId: string }>
  verify(request: OtpChallengeRequest & { code: string }): Promise<{ phone: string }>
}

export class OtpNotEnabledError extends Error {
  readonly code = 'otp_not_enabled'

  constructor() {
    super('OTP authentication is not enabled')
    this.name = 'OtpNotEnabledError'
  }
}

/**
 * Password authentication is the only active method.
 * A future SMS provider can implement OtpProvider and write to otp_challenges.
 */
export function useOtpProvider(): OtpProvider {
  return {
    async issue() {
      throw new OtpNotEnabledError()
    },
    async verify() {
      throw new OtpNotEnabledError()
    },
  }
}
