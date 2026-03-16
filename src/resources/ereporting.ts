import type { HttpClient } from '../client.js'
import { AutoPaginatingList } from '../pagination.js'
import type {
  EReporting,
  EReportingCreateParams,
  EReportingListParams,
  RequestOptions,
} from '../types.js'

/** E-reporting declarations for B2C and international transactions (art. 290 CGI). */
export class EReportingResource {
  constructor(private readonly client: HttpClient) {}

  async createDeclaration(params: EReportingCreateParams, options?: RequestOptions): Promise<EReporting> {
    return this.client.post<EReporting>('/v1/ereporting/declarations', params, options)
  }

  list(params?: EReportingListParams): AutoPaginatingList<EReporting> {
    return new AutoPaginatingList<EReporting>(this.client, '/v1/ereporting/declarations', params)
  }

  async get(id: string): Promise<EReporting> {
    return this.client.get<EReporting>(`/v1/ereporting/declarations/${id}`)
  }

  async submitDeclaration(id: string, options?: RequestOptions): Promise<EReporting> {
    return this.client.post<EReporting>(`/v1/ereporting/declarations/${id}/submit`, undefined, options)
  }
}
