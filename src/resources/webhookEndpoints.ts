import type { HttpClient } from '../client.js'
import { AutoPaginatingList } from '../pagination.js'
import type {
  WebhookEndpoint,
  WebhookEndpointCreateParams,
  WebhookEndpointUpdateParams,
  PaginationParams,
  RequestOptions,
} from '../types.js'

/** Manages webhook endpoint registrations and their event subscriptions. */
export class WebhookEndpoints {
  constructor(private readonly client: HttpClient) {}

  /** Secret only returned on create. */
  async create(params: WebhookEndpointCreateParams, options?: RequestOptions): Promise<WebhookEndpoint> {
    return this.client.post<WebhookEndpoint>('/v1/webhook-endpoints', params, options)
  }

  list(params?: PaginationParams): AutoPaginatingList<WebhookEndpoint> {
    return new AutoPaginatingList<WebhookEndpoint>(this.client, '/v1/webhook-endpoints', params)
  }

  async get(id: string): Promise<WebhookEndpoint> {
    return this.client.get<WebhookEndpoint>(`/v1/webhook-endpoints/${id}`)
  }

  async update(id: string, params: WebhookEndpointUpdateParams): Promise<WebhookEndpoint> {
    return this.client.patch<WebhookEndpoint>(`/v1/webhook-endpoints/${id}`, params)
  }

  async del(id: string): Promise<void> {
    await this.client.del<void>(`/v1/webhook-endpoints/${id}`)
  }
}
