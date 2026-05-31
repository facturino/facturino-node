import type { HttpClient } from '../client.js'
import type {
  BillingCheckoutParams,
  BillingPauseParams,
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

  /**
   * Change the plan or billing cadence (pro ↔ essential, monthly ↔ annual).
   *
   * The ergonomic `cycle` field is mapped to the wire-level `annual` boolean
   * before sending; only `planId` and `annual` are accepted by the API.
   * Cancelling at period end is done through the Stripe Customer Portal
   * ({@link portal}), not this endpoint.
   */
  async updateSubscription(
    params: BillingSubscriptionUpdateParams,
  ): Promise<BillingSubscription> {
    const { cycle, annual, planId } = params
    const body: { planId?: BillingSubscriptionUpdateParams['planId']; annual?: boolean } = {}
    if (planId !== undefined) body.planId = planId
    if (cycle !== undefined) body.annual = cycle === 'annual'
    else if (annual !== undefined) body.annual = annual
    return this.client.patch<BillingSubscription>('/v1/billing/subscription', body)
  }

  /**
   * Create a Stripe Checkout session for the first paid subscription.
   * Accepts exactly `planId`, `successUrl` and `cancelUrl`.
   */
  async checkout(
    params: BillingCheckoutParams,
    options?: RequestOptions,
  ): Promise<{ url: string; sessionId: string }> {
    const body: BillingCheckoutParams = {
      planId: params.planId,
      successUrl: params.successUrl,
      cancelUrl: params.cancelUrl,
    }
    return this.client.post('/v1/billing/checkout', body, options)
  }

  /** Create a Stripe Customer Portal session for self-service changes. */
  async portal(
    params: BillingPortalParams = {},
    options?: RequestOptions,
  ): Promise<{ url: string }> {
    return this.client.post('/v1/billing/portal', params, options)
  }

  /** Pause the active subscription for 1–3 months (Pro-only). */
  async pause(
    params: BillingPauseParams,
    options?: RequestOptions,
  ): Promise<BillingSubscription> {
    return this.client.post<BillingSubscription>('/v1/billing/pause', params, options)
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
