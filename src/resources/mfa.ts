import type { HttpClient } from '../client.js'
import type {
  MfaSetupResponse,
  MfaVerifyParams,
  MfaVerifyResponse,
  MfaDisableParams,
  MfaDisableResponse,
  MfaBackupCodesResponse,
} from '../types.js'

/** TOTP multi-factor authentication — setup, verify, disable, and backup codes (Pro plan). */
export class Mfa {
  constructor(private readonly client: HttpClient) {}

  /** Initialize TOTP setup. Returns secret and provisioning URI. */
  async setup(): Promise<MfaSetupResponse> {
    return this.client.post<MfaSetupResponse>('/v1/auth/mfa/setup')
  }

  /** Verify a 6-digit TOTP code and enable MFA. */
  async verify(params: MfaVerifyParams): Promise<MfaVerifyResponse> {
    return this.client.post<MfaVerifyResponse>('/v1/auth/mfa/verify', params)
  }

  /** Disable MFA. Requires a valid TOTP code. */
  async disable(params: MfaDisableParams): Promise<MfaDisableResponse> {
    return this.client.del<MfaDisableResponse>('/v1/auth/mfa', params)
  }

  /** Generate new backup codes. MFA must be enabled. */
  async generateBackupCodes(): Promise<MfaBackupCodesResponse> {
    return this.client.post<MfaBackupCodesResponse>('/v1/auth/mfa/backup-codes')
  }
}
