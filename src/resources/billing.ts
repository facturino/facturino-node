import type { HttpClient } from '../client.js'
import type {
  BillingCheckoutParams,
  BillingPortalParams,
  BillingSubscription,
  BillingSubscriptionUpdateParams,
  PaginatedResponse,
  PlatformInvoice,
  RequestOptions,
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
 * Billing — subscription, Stripe Checkout / Customer Portal, and the
 * Facturino → user platform-invoice history.
 *
 * The active subscription is exposed by {@link retrieveSubscription};
 * upgrades / cancellations happen through {@link updateSubscription} or
 * through a Stripe Customer-Portal session created with {@link portal}.
 * {@link checkout} bootstraps the first paid subscription on a free
 * account.
 */
export class Billing {
  constructor(private readonly client: HttpClient) {}

  /** Current subscription (plan, status, period). */
  async retrieveSubscription(): Promise<BillingSubscription> {
    return this.client.get<BillingSubscription>('/v1/billing/subscription')
  }

  /** Change the plan or cycle (pro ↔ essential, monthly ↔ annual). */
  async updateSubscription(
    params: BillingSubscriptionUpdateParams,
  ): Promise<BillingSubscription> {
    return this.client.patch<BillingSubscription>('/v1/billing/subscription', params)
  }

  /** Create a Stripe Checkout session for the first paid subscription. */
  async checkout(
    params: BillingCheckoutParams,
    options?: RequestOptions,
  ): Promise<{ url: string; sessionId: string }> {
    return this.client.post('/v1/billing/checkout', params, options)
  }

  /** Create a Stripe Customer Portal session for self-service changes. */
  async portal(
    params: BillingPortalParams = {},
    options?: RequestOptions,
  ): Promise<{ url: string }> {
    return this.client.post('/v1/billing/portal', params, options)
  }

  /** Pause the active subscription (Pro-only). */
  async pause(options?: RequestOptions): Promise<BillingSubscription> {
    return this.client.post<BillingSubscription>('/v1/billing/pause', undefined, options)
  }

  /** Resume a paused subscription. */
  async resume(options?: RequestOptions): Promise<BillingSubscription> {
    return this.client.post<BillingSubscription>('/v1/billing/resume', undefined, options)
  }

  /** Paginated list of platform invoices (Facturino → user) for the current account. */
  async listInvoices(params?: {
    limit?: number
    starting_after?: string
    ending_before?: string
  }): Promise<PaginatedResponse<PlatformInvoice>> {
    const qs = params ? buildQuery(params) : ''
    return this.client.get<PaginatedResponse<PlatformInvoice>>(`/v1/billing/invoices${qs}`)
  }

  /**
   * Short-lived signed URL for a platform-invoice PDF. The URL expires
   * within minutes — fetch it just-in-time when the user clicks
   * "Download", do not store it.
   */
  async getInvoicePdf(invoiceId: string): Promise<{ url: string; expires_at: string }> {
    return this.client.get(`/v1/billing/invoices/${invoiceId}/pdf`)
  }
}
