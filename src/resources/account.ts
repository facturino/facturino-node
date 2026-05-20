import type { HttpClient } from '../client.js'
import type { Account } from '../types.js'

/** Response returned when a deletion is scheduled. */
export interface AccountDeletionResponse {
  object: 'account_deletion'
  deletionScheduledAt: string
  message: string
}

/** Acknowledgement returned by `POST /v1/account/export`. */
export interface AccountExportResponse {
  object: 'account_export'
  exportId: string
  status: 'pending' | 'processing' | 'ready'
  message: string
}

/** Short-lived (5 min) signed-URL response for a prepared RGPD export. */
export interface AccountExportDownloadResponse {
  url: string
  expiresAt: string
}

/** Per-channel email-notification preferences. */
export interface AccountNotificationPreferencesUpdate {
  invoicePaid?: boolean
  invoiceOverdue?: boolean
  quoteAccepted?: boolean
  paReceived?: boolean
  productNews?: boolean
}

/**
 * Account introspection — returns the authenticated user, the active
 * company, the current plan and the scopes attached to the API key in
 * use. Every integration should expose this on a "Connected to
 * Facturino" surface so users can confirm which company and which
 * environment (`fac_test_` vs `fac_live_`) their requests target.
 *
 * Also exposes the RGPD lifecycle endpoints: schedule / cancel deletion
 * (article 17) and request / download a data export (article 20).
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
   * Schedule the authenticated account for deletion in 30 days
   * (RGPD article 17). The user receives a confirmation email and a
   * J-7 reminder. The deletion is reversible until the grace period
   * elapses — call {@link cancelDeletion} to cancel.
   *
   * Returns `409 conflict` if a deletion is already scheduled, or
   * `400 invalid_request_error` while the account still has an active
   * paid subscription.
   */
  async scheduleDeletion(): Promise<AccountDeletionResponse> {
    return this.client.post<AccountDeletionResponse>('/v1/account/schedule-deletion')
  }

  /** Cancel a pending account deletion (within the 30-day grace window). */
  async cancelDeletion(): Promise<{ object: 'account_deletion'; deletionScheduledAt: null }> {
    return this.client.post('/v1/account/cancel-deletion')
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

  /**
   * Update the per-channel email-notification preferences for the
   * authenticated user. This endpoint manages broadcast preferences
   * (which transactional emails the user wants to receive); per-event
   * channel preferences live under
   * {@link Notifications.updatePreferences} instead.
   */
  async updateNotifications(
    params: AccountNotificationPreferencesUpdate,
  ): Promise<AccountNotificationPreferencesUpdate> {
    return this.client.patch<AccountNotificationPreferencesUpdate>(
      '/v1/account/notifications',
      params,
    )
  }
}
