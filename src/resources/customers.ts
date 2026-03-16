import type { HttpClient } from '../client.js'
import { AutoPaginatingList } from '../pagination.js'
import type {
  Customer,
  CustomerCreateParams,
  CustomerUpdateParams,
  CustomerListParams,
  CustomerLookupParams,
  SireneLookupResponse,
  JobResponse,
  RequestOptions,
} from '../types.js'

/** CRUD operations on customers, with SIRENE lookup and CSV import/export. */
export class Customers {
  constructor(private readonly client: HttpClient) {}

  async create(params: CustomerCreateParams, options?: RequestOptions): Promise<Customer> {
    return this.client.post<Customer>('/v1/customers', params, options)
  }

  list(params?: CustomerListParams): AutoPaginatingList<Customer> {
    return new AutoPaginatingList<Customer>(this.client, '/v1/customers', params)
  }

  async get(id: string): Promise<Customer> {
    return this.client.get<Customer>(`/v1/customers/${id}`)
  }

  async update(id: string, params: CustomerUpdateParams): Promise<Customer> {
    return this.client.patch<Customer>(`/v1/customers/${id}`, params)
  }

  async del(id: string): Promise<void> {
    await this.client.del<void>(`/v1/customers/${id}`)
  }

  /** Sirene lookup by SIRET or name. */
  async lookup(params: CustomerLookupParams): Promise<SireneLookupResponse> {
    return this.client.post<SireneLookupResponse>('/v1/customers/lookup', params)
  }

  async importCsv(content: string, options?: RequestOptions): Promise<JobResponse> {
    return this.client.post<JobResponse>('/v1/customers/import', { content }, options)
  }

  async exportCsv(): Promise<JobResponse> {
    return this.client.post<JobResponse>('/v1/customers/export')
  }
}
