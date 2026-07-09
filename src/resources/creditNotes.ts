import type { HttpClient } from '../client.js'
import { AutoPaginatingList } from '../pagination.js'
import type {
  CreditNote,
  CreditNoteCreateParams,
  CreditNoteUpdateParams,
  CreditNoteListParams,
  DocumentUrlResponse,
  JobResponse,
  RequestOptions,
} from '../types.js'

/** Credit note operations — the legal way to correct or cancel a finalized invoice. */
export class CreditNotes {
  constructor(private readonly client: HttpClient) {}

  async create(params: CreditNoteCreateParams, options?: RequestOptions): Promise<CreditNote> {
    return this.client.post<CreditNote>('/v1/credit-notes', params, options)
  }

  list(params?: CreditNoteListParams): AutoPaginatingList<CreditNote> {
    return new AutoPaginatingList<CreditNote>(this.client, '/v1/credit-notes', params)
  }

  async get(id: string): Promise<CreditNote> {
    return this.client.get<CreditNote>(`/v1/credit-notes/${id}`)
  }

  async update(id: string, params: CreditNoteUpdateParams): Promise<CreditNote> {
    return this.client.patch<CreditNote>(`/v1/credit-notes/${id}`, params)
  }

  async del(id: string): Promise<void> {
    await this.client.del<void>(`/v1/credit-notes/${id}`)
  }

  /** Assign number and lock. Irreversible. */
  async finalize(id: string, options?: RequestOptions): Promise<CreditNote> {
    return this.client.post<CreditNote>(`/v1/credit-notes/${id}/finalize`, undefined, options)
  }

  /** Submit to PA. */
  async send(id: string, options?: RequestOptions): Promise<{ id: string; object: 'credit_note'; status: string }> {
    return this.client.post(`/v1/credit-notes/${id}/send`, undefined, options)
  }

  /**
   * Send the credit note to its customer by email with the PDF (and optional
   * Factur-X XML) attached. Returns `{status: 'sent'}` on success or
   * `{status: 'pending'}` if the PDF is still being generated.
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
    | { status: 'sent'; creditNoteId: string; recipient: string; sentAt: string }
    | { status: 'pending'; creditNoteId: string; jobId: string; pollUrl: string; reason: string }
  > {
    return this.client.post(`/v1/credit-notes/${id}/email`, params, options)
  }

  async getPdf(id: string): Promise<DocumentUrlResponse | JobResponse> {
    return this.client.get(`/v1/credit-notes/${id}/pdf`)
  }

  /** Factur-X PDF/A-3 with embedded XML. URL or async job. */
  async getFacturx(id: string): Promise<DocumentUrlResponse | JobResponse> {
    return this.client.get(`/v1/credit-notes/${id}/facturx`)
  }

  /** Raw CII or UBL XML. */
  async getXml(id: string, format?: 'cii' | 'ubl'): Promise<string> {
    const query = format ? `?format=${format}` : ''
    return this.client.get<string>(`/v1/credit-notes/${id}/xml${query}`)
  }
}
