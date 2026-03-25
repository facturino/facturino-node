import type { HttpClient } from '../client.js'
import { AutoPaginatingList } from '../pagination.js'
import type {
  ReceivedInvoice,
  ReceivedInvoiceListParams,
  ReceivedInvoiceRefuseParams,
  ReceivedInvoiceRecordPaymentParams,
  ReceivedInvoiceActionResponse,
} from '../types.js'

/** Received (incoming) invoices from PA — list, retrieve, approve, refuse, suspend, record payment. */
export class ReceivedInvoices {
  constructor(private readonly client: HttpClient) {}

  list(params?: ReceivedInvoiceListParams): AutoPaginatingList<ReceivedInvoice> {
    return new AutoPaginatingList<ReceivedInvoice>(this.client, '/v1/received-invoices', params)
  }

  async get(id: string): Promise<ReceivedInvoice> {
    return this.client.get<ReceivedInvoice>(`/v1/received-invoices/${id}`)
  }

  async approve(id: string): Promise<ReceivedInvoiceActionResponse> {
    return this.client.post<ReceivedInvoiceActionResponse>(`/v1/received-invoices/${id}/approve`)
  }

  async refuse(id: string, params: ReceivedInvoiceRefuseParams): Promise<ReceivedInvoiceActionResponse> {
    return this.client.post<ReceivedInvoiceActionResponse>(`/v1/received-invoices/${id}/refuse`, params)
  }

  async suspend(id: string): Promise<ReceivedInvoiceActionResponse> {
    return this.client.post<ReceivedInvoiceActionResponse>(`/v1/received-invoices/${id}/suspend`)
  }

  async recordPayment(id: string, params: ReceivedInvoiceRecordPaymentParams): Promise<ReceivedInvoiceActionResponse> {
    return this.client.post<ReceivedInvoiceActionResponse>(`/v1/received-invoices/${id}/record-payment`, params)
  }
}
