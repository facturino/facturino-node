import type { HttpClient } from '../client.js'
import type {
  Notification,
  NotificationPreferences,
  NotificationPreferencesUpdate,
  PaginatedResponse,
} from '../types.js'

/** Encode a flat object as a `?k=v&…` query string (skips undefined/null). */
function buildQuery(params: Record<string, unknown>): string {
  const entries: [string, string][] = []
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue
    entries.push([k, String(v)])
  }
  return entries.length === 0 ? '' : `?${new URLSearchParams(entries).toString()}`
}

/**
 * Notifications — in-app notification feed and per-event preferences.
 *
 * The in-app feed is scoped to the authenticated user (not the company)
 * and mirrors what the dashboard "bell" icon displays.
 *
 * Per-event preferences (email / push / in-app per notification type)
 * are stored at the user level under `/v1/notification-preferences`
 * and override the channel-matrix defaults documented on the API
 * reference.
 */
export class Notifications {
  constructor(private readonly client: HttpClient) {}

  /** Paginated list of notifications for the authenticated user. */
  async list(params?: {
    limit?: number
    starting_after?: string
    ending_before?: string
    /** Filter on read state — `true` for unread only, omit for both. */
    unread?: boolean
  }): Promise<PaginatedResponse<Notification>> {
    const qs = params ? buildQuery(params) : ''
    return this.client.get<PaginatedResponse<Notification>>(`/v1/notifications${qs}`)
  }

  /** Mark a single notification as read. */
  async markRead(id: string): Promise<Notification> {
    return this.client.patch<Notification>(`/v1/notifications/${id}`, { read: true })
  }

  /** Mark every unread notification as read. */
  async markAllRead(): Promise<{ object: 'notification_batch'; updated: number }> {
    return this.client.patch('/v1/notifications/mark-all-read', {})
  }

  /** Retrieve the per-event notification preferences for the authenticated user. */
  async retrievePreferences(): Promise<NotificationPreferences> {
    return this.client.get<NotificationPreferences>('/v1/notification-preferences')
  }

  /**
   * Update per-event notification preferences. The body merges with the
   * existing preferences map; pass `{ preferences: { invoice_paid: {
   * email: false, inApp: true, push: true } } }` to override a single
   * event.
   */
  async updatePreferences(
    params: NotificationPreferencesUpdate,
  ): Promise<NotificationPreferences> {
    return this.client.patch<NotificationPreferences>(
      '/v1/notification-preferences',
      params,
    )
  }
}
