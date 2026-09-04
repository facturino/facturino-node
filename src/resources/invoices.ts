import type { HttpClient } from '../client.js'
import { AutoPaginatingList } from '../pagination.js'
import { Payments } from './payments.js'
import type {
  Invoice,
  InvoiceCreateParams,
  InvoiceBindTaxDecisionParams,
  InvoiceFinalizeParams,
  InvoiceUpdateParams,
  InvoiceListParams,
  InvoiceRetrieveParams,
  InvoiceStatusResponse,
  InvoiceVerifyResponse,
  DocumentUrlResponse,
  JobResponse,
  PaymentLinkResponse,
  PaymentLinkCreateParams,
  PaymentTokenResponse,
  PaginatedResponse,
  LifecycleEntry,
  IncomingInvoiceCreateParams,
  ReceivedInvoice,
  RequestOptions,
} from '../types.js'

/** Manages invoice lifecycle — creation, finalization, sending, and document retrieval. */
export class Invoices {
  readonly payments: Payments

  constructor(private readonly client: HttpClient) {
    this.payments = new Payments(client)
  }

  /**
   * Create an invoice — ALWAYS backed by a FINAL tax decision (`taxDecisionId`
   * + `decisionLines`), whatever its fiscal source. The decided VAT, amounts
   * and mentions are copied verbatim and frozen; `deposits` and `schedule` are
   * settled server-side against the decided amount, inside the creation
   * transaction. The types enforce this at compile time; the checks below turn
   * the same misuse into an immediate local error instead of a round trip.
   */
  async create(params: InvoiceCreateParams, options?: RequestOptions): Promise<Invoice> {
    const runtime = params as unknown as { taxDecisionId?: unknown; decisionLines?: unknown; lines?: unknown }
    if (typeof runtime.taxDecisionId !== 'string' || runtime.taxDecisionId.length === 0) {
      throw new Error(
        `'taxDecisionId' is required: every invoice is backed by a FINAL tax decision `
          + `(facturino or integration source). Create one with taxDecisions.create() first.`,
      )
    }
    if (!Array.isArray(runtime.decisionLines) || runtime.decisionLines.length === 0) {
      throw new Error(`'decisionLines' is required: one presentation line per decision line, matched by 'taxLineRef'.`)
    }
    if ('lines' in runtime && runtime.lines !== undefined) {
      throw new Error(
        `'lines' is not part of the invoice contract: the VAT of an invoice comes from its `
          + `tax decision. Send 'decisionLines' (presentation only).`,
      )
    }
    return this.client.post<Invoice>('/v1/invoices', params, options)
  }

  list(params?: InvoiceListParams): AutoPaginatingList<Invoice> {
    return new AutoPaginatingList<Invoice>(this.client, '/v1/invoices', params)
  }

  /**
   * Retrieve an invoice. Pass `expand` to inline related objects in the
   * response under `invoice.expanded` — `customer`, `items.product`, and
   * `credit_notes`. With `credit_notes`, the response also carries
   * `expanded.net_balance` (TTC minus credited amounts, in integer cents).
   */
  async get(id: string, params?: InvoiceRetrieveParams): Promise<Invoice> {
    const expand = params?.expand
    const query = expand && expand.length ? `?expand=${expand.map(encodeURIComponent).join(',')}` : ''
    return this.client.get<Invoice>(`/v1/invoices/${id}${query}`)
  }

  async update(id: string, params: InvoiceUpdateParams): Promise<Invoice> {
    return this.client.patch<Invoice>(`/v1/invoices/${id}`, params)
  }

  /** Soft-delete (draft only). */
  async del(id: string): Promise<void> {
    await this.client.del<void>(`/v1/invoices/${id}`)
  }

  /**
   * Bind a FINAL tax decision to a commercial draft that already exists —
   * typically the one `quotes.convert()` produced.
   *
   * This closes the quote cycle on ONE document:
   *
   * ```ts
   * const { invoiceId } = await facturino.quotes.convert(quoteId)
   * const decision = await facturino.taxDecisions.create({ ... }, { idempotencyKey })
   * await facturino.invoices.bindTaxDecision(invoiceId, {
   *   taxDecisionId: decision.id,
   *   decisionLines: [{ taxLineRef: 'l1', unit: 'unit' }],
   * })
   * await facturino.invoices.finalize(invoiceId)
   * ```
   *
   * The invoice stays a DRAFT: binding freezes the VAT, `finalize()` issues it.
   * Idempotent on the decision — replaying the same call returns the same
   * invoice. Binding a different decision to a bound invoice, or the same
   * decision to a second invoice, is a conflict.
   */
  async bindTaxDecision(
    id: string,
    params: InvoiceBindTaxDecisionParams,
    options?: RequestOptions,
  ): Promise<Invoice> {
    const runtime = params as unknown as { taxDecisionId?: unknown; decisionLines?: unknown }
    if (typeof runtime.taxDecisionId !== 'string' || runtime.taxDecisionId.length === 0) {
      throw new Error(
        `'taxDecisionId' is required: a draft is fiscalised by binding a FINAL tax decision to it.`,
      )
    }
    if (!Array.isArray(runtime.decisionLines) || runtime.decisionLines.length === 0) {
      throw new Error(`'decisionLines' is required: one presentation line per decision line, matched by 'taxLineRef'.`)
    }
    return this.client.post<Invoice>(`/v1/invoices/${id}/bind-tax-decision`, params, options)
  }

  /**
   * Assign number and lock. Irreversible.
   *
   * Pass `{ payment }` when the invoice was already collected before issuance:
   * numbering and collection are applied in the SAME transaction, so the
   * original PDF and Factur-X are rendered on a settled invoice and say so.
   * `payment` is the very object `payments.create()` takes.
   *
   * ```ts
   * await facturino.invoices.finalize(invoiceId, {
   *   payment: { amount: 120000, method: 'card', paidAt: new Date().toISOString() },
   * })
   * ```
   *
   * All or nothing: a collection beyond the amount due is refused (422
   * `payment_exceeds_amount_due`) and the invoice stays a draft — no number is
   * burned. Without a body, the behaviour is unchanged.
   */
  async finalize(id: string, options?: RequestOptions): Promise<Invoice>
  async finalize(
    id: string,
    params: InvoiceFinalizeParams,
    options?: RequestOptions,
  ): Promise<Invoice>
  async finalize(
    id: string,
    paramsOrOptions?: InvoiceFinalizeParams | RequestOptions,
    maybeOptions?: RequestOptions,
  ): Promise<Invoice> {
    // `finalize(id, { idempotencyKey })` has always meant "options", and still
    // does: only an object carrying `payment` is a body. Adding a parameter in
    // front of the options would have silently sent request options as a
    // request body for every existing caller.
    const isBody = paramsOrOptions !== undefined && 'payment' in paramsOrOptions
    const params = isBody ? (paramsOrOptions as InvoiceFinalizeParams) : undefined
    const options = isBody ? maybeOptions : (paramsOrOptions as RequestOptions | undefined)
    return this.client.post<Invoice>(`/v1/invoices/${id}/finalize`, params, options)
  }

  /** Submit to PA. Returns 202 (async). */
  async send(id: string, options?: RequestOptions): Promise<{ id: string; object: 'invoice'; status: string }> {
    return this.client.post(`/v1/invoices/${id}/send`, undefined, options)
  }

  /**
   * Send a finalized invoice by email with PDF (and optionally XML) attached.
   * Returns `{status: 'sent'}` on success or `{status: 'pending'}` if the PDF
   * is still being generated (caller should poll the returned `jobId`).
   */
  async email(
    id: string,
    params?: {
      recipientEmail?: string
      customMessage?: string
      includeXml?: boolean
      customSubject?: string
    },
    options?: RequestOptions,
  ): Promise<
    | { status: 'sent'; invoiceId: string; recipient: string; sentAt: string }
    | { status: 'pending'; invoiceId: string; jobId: string; pollUrl: string; reason: string }
  > {
    return this.client.post(`/v1/invoices/${id}/email`, params, options)
  }

  /**
   * Cancel a DRAFT invoice (status `draft` only). This soft-deletes the
   * draft and returns `{ id, object: 'invoice', deleted: true }`. Finalized
   * invoices are immutable under French law (CGI art. 289) — use
   * `creditNotes.create()` to refund or correct a finalized invoice.
   *
   * @throws {FacturinoError} when called on a non-draft invoice (API returns 400)
   */
  async cancel(id: string, options?: RequestOptions): Promise<{ id: string; object: 'invoice'; deleted: true }> {
    return this.client.post(`/v1/invoices/${id}/cancel`, undefined, options)
  }

  async remind(id: string, options?: RequestOptions): Promise<{ id: string; object: 'invoice'; reminder_sent: boolean }> {
    return this.client.post(`/v1/invoices/${id}/remind`, undefined, options)
  }

  /** Clone as new draft. */
  async clone(id: string, options?: RequestOptions): Promise<Invoice> {
    return this.client.post<Invoice>(`/v1/invoices/${id}/clone`, undefined, options)
  }

  /** Signed download URL, or async job if generation needed. */
  async getPdf(id: string, template?: string): Promise<DocumentUrlResponse | JobResponse> {
    const query = template ? `?template=${encodeURIComponent(template)}` : ''
    return this.client.get(`/v1/invoices/${id}/pdf${query}`)
  }

  /** Factur-X PDF/A-3 with embedded XML. URL or async job. */
  async getFacturx(id: string, template?: string): Promise<DocumentUrlResponse | JobResponse> {
    const query = template ? `?template=${encodeURIComponent(template)}` : ''
    return this.client.get(`/v1/invoices/${id}/facturx${query}`)
  }

  /** Raw CII or UBL XML. */
  async getXml(id: string, format?: 'cii' | 'ubl'): Promise<string> {
    const query = format ? `?format=${format}` : ''
    return this.client.get<string>(`/v1/invoices/${id}/xml${query}`)
  }

  async getStatus(id: string): Promise<InvoiceStatusResponse> {
    return this.client.get<InvoiceStatusResponse>(`/v1/invoices/${id}/status`)
  }

  /** Verify archive hash chain integrity. */
  async verify(id: string): Promise<InvoiceVerifyResponse> {
    return this.client.get<InvoiceVerifyResponse>(`/v1/invoices/${id}/verify`)
  }

  async listEvents(id: string): Promise<PaginatedResponse<LifecycleEntry>> {
    return this.client.get<PaginatedResponse<LifecycleEntry>>(`/v1/invoices/${id}/events`)
  }

  async getAuditTrail(
    id: string,
    params?: { limit?: number; starting_after?: string; action?: string },
  ): Promise<PaginatedResponse<Record<string, unknown>>> {
    const queryParams: Record<string, string> = {}
    if (params?.limit) queryParams.limit = String(params.limit)
    if (params?.starting_after) queryParams.starting_after = params.starting_after
    if (params?.action) queryParams.action = params.action
    const qs = new URLSearchParams(queryParams).toString()
    const url = qs ? `/v1/invoices/${id}/audit-trail?${qs}` : `/v1/invoices/${id}/audit-trail`
    return this.client.get(url)
  }

  /** Async audit trail PDF generation. */
  async generateAuditTrailPdf(id: string, options?: RequestOptions): Promise<JobResponse> {
    return this.client.post<JobResponse>(`/v1/invoices/${id}/audit-trail/pdf`, undefined, options)
  }

  /** Stripe payment link (Pro plan). */
  async createPaymentLink(id: string, params?: PaymentLinkCreateParams, options?: RequestOptions): Promise<PaymentLinkResponse> {
    return this.client.post<PaymentLinkResponse>(`/v1/invoices/${id}/payment-link`, params, options)
  }

  /** Token for client-facing payment portal. */
  async createPaymentToken(id: string, options?: RequestOptions): Promise<PaymentTokenResponse> {
    return this.client.post<PaymentTokenResponse>(`/v1/invoices/${id}/payment-token`, undefined, options)
  }

  /**
   * Generate a signed client-portal link for a finalized invoice. The
   * URL points to a public, branded portal where the customer can view
   * the invoice, download the PDF and trigger the payment flow. The
   * token embedded in the URL grants read-only access to a single
   * invoice and expires after the configured lifetime.
   *
   * Rejects with `invalid_status_transition` if the invoice is still
   * in draft.
   */
  async createPortalLink(
    id: string,
    options?: RequestOptions,
  ): Promise<{ url: string; token: string; expires_at: string }> {
    return this.client.post(`/v1/invoices/${id}/portal-link`, undefined, options)
  }

  /** Record a supplier invoice received outside the platform (manual entry). */
  async createIncoming(
    params: IncomingInvoiceCreateParams,
    options?: RequestOptions,
  ): Promise<ReceivedInvoice> {
    return this.client.post<ReceivedInvoice>('/v1/invoices/incoming', params, options)
  }

  /** List inbound supplier invoices (manual entries + e-invoices received via the PA). */
  listIncoming(params?: InvoiceListParams): AutoPaginatingList<ReceivedInvoice> {
    return new AutoPaginatingList<ReceivedInvoice>(this.client, '/v1/invoices/incoming', params)
  }
}
