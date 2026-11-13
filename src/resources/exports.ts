import type { HttpClient } from '../client.js'
import type { FecExportParams, InvoiceExportParams, JobResponse, RequestOptions } from '../types.js'

/**
 * Data exports — FEC accounting files and the invoices ZIP. For RGPD data
 * portability (art. 20), use `account.requestExport`.
 */
export class Exports {
  constructor(private readonly client: HttpClient) {}

  /** Async FEC generation (art. A.47 A-1 LPF). Pro/Cabinet plan. */
  async generateFec(params?: FecExportParams, options?: RequestOptions): Promise<JobResponse> {
    return this.client.post<JobResponse>('/v1/exports/fec', params ?? {}, options)
  }

  async getFecStatus(jobId: string): Promise<JobResponse> {
    return this.client.get<JobResponse>(`/v1/exports/fec/${jobId}`)
  }

  async getExportStatus(jobId: string): Promise<JobResponse> {
    return this.client.get<JobResponse>(`/v1/exports/${jobId}`)
  }

  /**
   * Bulk export finalized invoices as a ZIP (Factur-X PDF + CII XML per invoice).
   * Available on all plans. Optionally filter by issue-date period and/or
   * lifecycle statuses; with no params, every non-draft invoice is exported.
   * Without `statuses`, credit notes are included too (`avoirs/` folder of the
   * ZIP). `manifest.csv` lists every piece with its type, totals, due date,
   * payment status and linked invoice. The archive holds at most 5 000
   * pieces; beyond that the job carries `truncated: true`.
   */
  async exportInvoices(params?: InvoiceExportParams, options?: RequestOptions): Promise<JobResponse> {
    return this.client.post<JobResponse>('/v1/exports/invoices', params ?? {}, options)
  }
}
