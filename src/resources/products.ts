import type { HttpClient } from '../client.js'
import { AutoPaginatingList } from '../pagination.js'
import type {
  Product,
  ProductCreateParams,
  ProductUpdateParams,
  ProductListParams,
  JobResponse,
  RequestOptions,
} from '../types.js'

/** Product catalog management with CSV import/export support. */
export class Products {
  constructor(private readonly client: HttpClient) {}

  async create(params: ProductCreateParams, options?: RequestOptions): Promise<Product> {
    return this.client.post<Product>('/v1/products', params, options)
  }

  list(params?: ProductListParams): AutoPaginatingList<Product> {
    return new AutoPaginatingList<Product>(this.client, '/v1/products', params)
  }

  async get(id: string): Promise<Product> {
    return this.client.get<Product>(`/v1/products/${id}`)
  }

  async update(id: string, params: ProductUpdateParams): Promise<Product> {
    return this.client.patch<Product>(`/v1/products/${id}`, params)
  }

  async del(id: string): Promise<void> {
    await this.client.del<void>(`/v1/products/${id}`)
  }

  async importCsv(content: string, options?: RequestOptions): Promise<JobResponse> {
    return this.client.post<JobResponse>('/v1/products/import', { content }, options)
  }

  async exportCsv(): Promise<JobResponse> {
    return this.client.post<JobResponse>('/v1/products/export')
  }
}
