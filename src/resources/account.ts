import type { HttpClient } from '../client.js'
import type { Account } from '../types.js'

/**
 * Result of `POST /v1/account/export`. The export is prepared synchronously and
 * is ready to download immediately via {@link Account.downloadExport}.
 */
export interface AccountExportResponse {
  object: 'export'
  id: string
  /** ISO 8601 expiry of the prepared export. */
  expires_at: string
}

/** Short-lived (5 min) signed-URL response for a prepared RGPD export. */
export interface AccountExportDownloadResponse {
  object: 'export_url'
  url: string
  /** ISO 8601 expiry of the signed URL (5 minutes). */
  expires_at: string
}

/**
 * Account introspection — returns the authenticated user, the active
 * company, the current plan and the scopes attached to the API key in
 * use. Every integration should expose this on a "Connected to
 * Facturino" surface so users can confirm which company and which
 * environment (`fac_test_` vs `fac_live_`) their requests target.
 *
 * Also exposes the RGPD data-export endpoints (article 20): request a
 * full export and download it once prepared.
 */
export class AccountResource {
  constructor(private readonly client: HttpClient) {}

  /**
   * Return the account context (user, company, plan, livemode, scopes)
   * associated with the API key used by this client. Equivalent to
   * Stripe's `accounts.retrieve('me')` — no path parameter, the key
   * implicitly identifies "self".
   */
  async retrieve(): Promise<Account> {
    return this.client.get<Account>('/v1/account')
  }

  /**
   * Request a full export of the account's data (RGPD article 20).
   * Returns immediately with an `exportId`; the file is prepared
   * asynchronously and the user receives an in-app notification when
   * ready. Use {@link downloadExport} with the returned id to fetch
   * the actual signed-URL.
   */
  async requestExport(): Promise<AccountExportResponse> {
    return this.client.post<AccountExportResponse>('/v1/account/export')
  }

  /**
   * Return a short-lived (5 minutes) signed URL to download a
   * previously-prepared RGPD export. The export metadata is keyed
   * under the authenticated user — cross-user access is impossible.
   */
  async downloadExport(exportId: string): Promise<AccountExportDownloadResponse> {
    return this.client.get<AccountExportDownloadResponse>(
      `/v1/account/exports/${exportId}/download`,
    )
  }
}
