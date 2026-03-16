import type { HttpClient } from '../client.js'
import type {
  ApiKey,
  ApiKeyCreateParams,
  PaginatedResponse,
  RequestOptions,
} from '../types.js'

/** API key lifecycle — creation, rotation, and revocation. */
export class ApiKeys {
  constructor(private readonly client: HttpClient) {}

  /** Full key value only returned on create. */
  async create(params: ApiKeyCreateParams, options?: RequestOptions): Promise<ApiKey> {
    return this.client.post<ApiKey>('/v1/api-keys', params, options)
  }

  async list(): Promise<PaginatedResponse<ApiKey>> {
    return this.client.get<PaginatedResponse<ApiKey>>('/v1/api-keys')
  }

  async get(id: string): Promise<ApiKey> {
    return this.client.get<ApiKey>(`/v1/api-keys/${id}`)
  }

  /** Immediate and irreversible. */
  async revoke(id: string): Promise<void> {
    await this.client.del<void>(`/v1/api-keys/${id}`)
  }

  /** Rotate: revoke old, create new with same permissions. */
  async roll(id: string): Promise<ApiKey> {
    return this.client.post<ApiKey>(`/v1/api-keys/${id}/roll`)
  }
}
