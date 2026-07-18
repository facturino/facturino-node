import type { HttpClient } from '../client.js'
import { AutoPaginatingList } from '../pagination.js'
import type {
  Payment,
  PaymentCreateParams,
  PaymentCancelResult,
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

  /**
   * Cancel a recorded payment. The payment is kept for the audit trail
   * (status `cancelled`) and the invoice is re-settled from the reversal.
   * Rejected once the payment has been reported to the tax authority.
   */
  async cancel(
    invoiceId: string,
    paymentId: string,
    options?: RequestOptions,
  ): Promise<PaymentCancelResult> {
    return this.client.post<PaymentCancelResult>(
      `/v1/invoices/${invoiceId}/payments/${paymentId}/cancel`,
      undefined,
      options,
    )
  }
}
