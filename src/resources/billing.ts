import type { HttpClient } from '../client.js'
import type {
  BillingSubscription,
  PaginatedResponse,
  PlatformInvoice,
} from '../types.js'

/** Encode a flat object as a `?k=v&…` query string (skips undefined/null). */
function buildQuery(params: Record<string, unknown>): string {
  const entries: [string, string][] = []
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue
    entries.push([k, String(v)])
  }
  if (entries.length === 0) return ''
  return `?${new URLSearchParams(entries).toString()}`
}

/**
 * Billing — read-only access to the current subscription and the
 * Facturino → user platform-invoice history.
 *
 * Plan changes, checkout and the Stripe Customer Portal are handled
 * through the Facturino dashboard, not the API.
 */
export class Billing {
  constructor(private readonly client: HttpClient) {}

  /** Current subscription (plan, status, period). */
  async retrieveSubscription(): Promise<BillingSubscription> {
    return this.client.get<BillingSubscription>('/v1/billing/subscription')
  }

  /** Paginated list of platform invoices (Facturino → user) for the current account. */
  async listInvoices(params?: {
    limit?: number
    starting_after?: string
  }): Promise<PaginatedResponse<PlatformInvoice>> {
    const qs = params ? buildQuery(params) : ''
    return this.client.get<PaginatedResponse<PlatformInvoice>>(`/v1/billing/invoices${qs}`)
  }

  /**
   * Short-lived signed URL for a platform-invoice PDF. The URL expires
   * within minutes — fetch it just-in-time when the user clicks
   * "Download", do not store it.
   */
  async getInvoicePdf(invoiceId: string): Promise<{ object: 'file_url'; url: string; expires_in: number }> {
    return this.client.get(`/v1/billing/invoices/${invoiceId}/pdf`)
  }
}
