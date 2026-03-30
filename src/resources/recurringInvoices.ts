import type { HttpClient } from '../client.js'
import { AutoPaginatingList } from '../pagination.js'
import type {
  RecurringInvoice,
  RecurringInvoiceCreateParams,
  RecurringInvoiceUpdateParams,
  RecurringInvoiceListParams,
  RequestOptions,
} from '../types.js'

/** Scheduled invoice templates that automatically generate invoices on a recurring basis. */
export class RecurringInvoices {
  constructor(private readonly client: HttpClient) {}

  async create(params: RecurringInvoiceCreateParams, options?: RequestOptions): Promise<RecurringInvoice> {
    return this.client.post<RecurringInvoice>('/v1/recurring-invoices', params, options)
  }

  list(params?: RecurringInvoiceListParams): AutoPaginatingList<RecurringInvoice> {
    return new AutoPaginatingList<RecurringInvoice>(this.client, '/v1/recurring-invoices', params)
  }

  async get(id: string): Promise<RecurringInvoice> {
    return this.client.get<RecurringInvoice>(`/v1/recurring-invoices/${id}`)
  }

  async update(id: string, params: RecurringInvoiceUpdateParams): Promise<RecurringInvoice> {
    return this.client.patch<RecurringInvoice>(`/v1/recurring-invoices/${id}`, params)
  }

  async del(id: string): Promise<void> {
    await this.client.del<void>(`/v1/recurring-invoices/${id}`)
  }

  async resume(id: string): Promise<RecurringInvoice> {
    return this.client.post<RecurringInvoice>(`/v1/recurring-invoices/${id}/resume`)
  }

  async pause(id: string): Promise<RecurringInvoice> {
    return this.client.post<RecurringInvoice>(`/v1/recurring-invoices/${id}/pause`)
  }
}
