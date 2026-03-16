import type { HttpClient } from '../client.js'
import { AutoPaginatingList } from '../pagination.js'
import { FacturinoError } from '../errors.js'
import { Payments } from './payments.js'
import type {
  Invoice,
  InvoiceCreateParams,
  InvoiceUpdateParams,
  InvoiceListParams,
  InvoiceStatusResponse,
  InvoiceVerifyResponse,
  DocumentUrlResponse,
  JobResponse,
  PaymentLinkResponse,
  PaymentLinkCreateParams,
  PaymentTokenResponse,
  PaginatedResponse,
  LifecycleEntry,
  RequestOptions,
} from '../types.js'

/** Manages invoice lifecycle — creation, finalization, sending, and document retrieval. */
export class Invoices {
  readonly payments: Payments

  constructor(private readonly client: HttpClient) {
    this.payments = new Payments(client)
  }

  async create(params: InvoiceCreateParams, options?: RequestOptions): Promise<Invoice> {
    return this.client.post<Invoice>('/v1/invoices', params, options)
  }

  list(params?: InvoiceListParams): AutoPaginatingList<Invoice> {
    return new AutoPaginatingList<Invoice>(this.client, '/v1/invoices', params)
  }

  async get(id: string): Promise<Invoice> {
    return this.client.get<Invoice>(`/v1/invoices/${id}`)
  }

  async update(id: string, params: InvoiceUpdateParams): Promise<Invoice> {
    return this.client.patch<Invoice>(`/v1/invoices/${id}`, params)
  }

  /** Soft-delete (draft only). */
  async del(id: string): Promise<void> {
    await this.client.del<void>(`/v1/invoices/${id}`)
  }

  /** Assign number and lock. Irreversible. */
  async finalize(id: string, options?: RequestOptions): Promise<Invoice> {
    return this.client.post<Invoice>(`/v1/invoices/${id}/finalize`, undefined, options)
  }

  /** Submit to PA. Returns 202 (async). */
  async send(id: string, options?: RequestOptions): Promise<{ id: string; object: 'invoice'; status: string }> {
    return this.client.post(`/v1/invoices/${id}/send`, undefined, options)
  }

  /**
   * Not supported under French e-invoicing law. Issue a credit note instead.
   */
  cancel(_id: string): never {
    throw new FacturinoError(
      'Cancelling invoices is not supported under French e-invoicing law. Issue a credit note instead.'
    )
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
}
