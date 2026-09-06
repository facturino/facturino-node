import type { HttpClient } from '../client.js'
import { AutoPaginatingList } from '../pagination.js'
import type { WebhookEvent, EventListParams, EventRetryResult } from '../types.js'

/** Webhook event log — list, inspect, and retry delivery of past events. */
export class Events {
  constructor(private readonly client: HttpClient) {}

  list(params?: EventListParams): AutoPaginatingList<WebhookEvent> {
    return new AutoPaginatingList<WebhookEvent>(this.client, '/v1/events', params)
  }

  async get(id: string): Promise<WebhookEvent> {
    return this.client.get<WebhookEvent>(`/v1/events/${id}`)
  }

  /**
   * Retry the delivery. Without `endpointId`, only endpoints where delivery
   * failed are retried (an event delivered everywhere is refused). With
   * `endpointId`, the event is replayed to that endpoint even if already
   * delivered — keep your receiver idempotent by event id.
   */
  async retry(id: string, params?: { endpointId?: string }): Promise<EventRetryResult> {
    return this.client.post<EventRetryResult>(`/v1/events/${id}/retry`, params?.endpointId ? { endpointId: params.endpointId } : undefined)
  }
}
