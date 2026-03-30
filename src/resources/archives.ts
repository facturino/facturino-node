import type { HttpClient } from '../client.js'
import { AutoPaginatingList } from '../pagination.js'
import type {
  PaginationParams,
  RequestOptions,
} from '../types.js'

/** Archive retrieval — access legally archived invoices and verify integrity. */
export class Archives {
  constructor(private readonly client: HttpClient) {}

  list(params?: PaginationParams): AutoPaginatingList<{ id: string; [key: string]: unknown }> {
    return new AutoPaginatingList<{ id: string; [key: string]: unknown }>(this.client, '/v1/archives', params)
  }

  async get(invoiceId: string): Promise<{ id: string; [key: string]: unknown }> {
    return this.client.get<{ id: string; [key: string]: unknown }>(`/v1/archives/${invoiceId}`)
  }
}
