import type { HttpClient } from '../client.js'
import { AutoPaginatingList } from '../pagination.js'
import type {
  Quote,
  QuoteCreateParams,
  QuoteUpdateParams,
  QuoteListParams,
  DocumentUrlResponse,
  JobResponse,
  Invoice,
  RequestOptions,
} from '../types.js'

/** Quote lifecycle — create, send, accept or refuse, and convert to invoice. */
export class Quotes {
  constructor(private readonly client: HttpClient) {}

  async create(params: QuoteCreateParams, options?: RequestOptions): Promise<Quote> {
    return this.client.post<Quote>('/v1/quotes', params, options)
  }

  list(params?: QuoteListParams): AutoPaginatingList<Quote> {
    return new AutoPaginatingList<Quote>(this.client, '/v1/quotes', params)
  }

  async get(id: string): Promise<Quote> {
    return this.client.get<Quote>(`/v1/quotes/${id}`)
  }

  async update(id: string, params: QuoteUpdateParams): Promise<Quote> {
    return this.client.patch<Quote>(`/v1/quotes/${id}`, params)
  }

  async del(id: string): Promise<void> {
    await this.client.del<void>(`/v1/quotes/${id}`)
  }

  async send(id: string, options?: RequestOptions): Promise<Quote> {
    return this.client.post<Quote>(`/v1/quotes/${id}/send`, undefined, options)
  }

  async accept(id: string, options?: RequestOptions): Promise<Quote> {
    return this.client.post<Quote>(`/v1/quotes/${id}/accept`, undefined, options)
  }

  async refuse(id: string, options?: RequestOptions): Promise<Quote> {
    return this.client.post<Quote>(`/v1/quotes/${id}/refuse`, undefined, options)
  }

  /** Convert accepted quote to draft invoice. */
  async convert(id: string, options?: RequestOptions): Promise<Invoice> {
    return this.client.post<Invoice>(`/v1/quotes/${id}/convert`, undefined, options)
  }

  async getPdf(id: string): Promise<DocumentUrlResponse | JobResponse> {
    return this.client.get(`/v1/quotes/${id}/pdf`)
  }
}
