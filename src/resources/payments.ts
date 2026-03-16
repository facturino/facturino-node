import type { HttpClient } from '../client.js'
import { AutoPaginatingList } from '../pagination.js'
import type {
  Payment,
  PaymentCreateParams,
  PaginationParams,
  RequestOptions,
} from '../types.js'

/** Records payments against an invoice — accessed via `facturino.invoices.payments`. */
export class Payments {
  constructor(private readonly client: HttpClient) {}

  async create(
    invoiceId: string,
    params: PaymentCreateParams,
    options?: RequestOptions,
  ): Promise<Payment> {
    return this.client.post<Payment>(
      `/v1/invoices/${invoiceId}/payments`,
      params,
      options,
    )
  }

  list(
    invoiceId: string,
    params?: PaginationParams,
  ): AutoPaginatingList<Payment> {
    return new AutoPaginatingList<Payment>(
      this.client,
      `/v1/invoices/${invoiceId}/payments`,
      params,
    )
  }
}
