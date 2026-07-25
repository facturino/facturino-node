import type { HttpClient } from '../client.js'
import type { Account } from '../types.js'

/**
 * Result of `POST /v1/account/export` (202 Accepted). The export runs
 * asynchronously — poll `exports.getExportStatus(id)` until the job exposes
 * `download_url`.
 */
export interface AccountExportResponse {
  object: 'job'
  /** Job id (`job_…`) — poll it via `exports.getExportStatus`. */
  id: string
  type: 'rgpd_export'
  status: string
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
   * Returns 202 with a job id; the file is prepared asynchronously.
   * Poll `exports.getExportStatus(id)` until the job carries a
   * `download_url` (the user also receives an in-app notification).
   */
  async requestExport(): Promise<AccountExportResponse> {
    return this.client.post<AccountExportResponse>('/v1/account/export')
  }

  /**
   * Return a short-lived (5 minutes) signed URL for a prepared RGPD
   * export. Takes the `rgpdexp_…` export id delivered by the
   * `export_ready` notification — NOT the `job_…` id returned by
   * {@link requestExport} (poll that one via `exports.getExportStatus`).
   * The export metadata is keyed under the authenticated user —
   * cross-user access is impossible.
   */
  async downloadExport(exportId: string): Promise<AccountExportDownloadResponse> {
    return this.client.get<AccountExportDownloadResponse>(
      `/v1/account/exports/${exportId}/download`,
    )
  }
}
