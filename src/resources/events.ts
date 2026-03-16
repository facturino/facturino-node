import type { HttpClient } from '../client.js'
import { AutoPaginatingList } from '../pagination.js'
import type { WebhookEvent, EventListParams } from '../types.js'

/** Webhook event log — list, inspect, and retry delivery of past events. */
export class Events {
  constructor(private readonly client: HttpClient) {}

  list(params?: EventListParams): AutoPaginatingList<WebhookEvent> {
    return new AutoPaginatingList<WebhookEvent>(this.client, '/v1/events', params)
  }

  async get(id: string): Promise<WebhookEvent> {
    return this.client.get<WebhookEvent>(`/v1/events/${id}`)
  }

  async retry(id: string): Promise<WebhookEvent> {
    return this.client.post<WebhookEvent>(`/v1/events/${id}/retry`)
  }
}
