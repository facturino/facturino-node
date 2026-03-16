import type { HttpClient } from '../client.js'
import type {
  Company,
  CompanyUpdateParams,
  CgvResponse,
  PaginatedResponse,
  RequestOptions,
} from '../types.js'

/** Company profile and settings — legal information, bank details, and CGV documents. */
export class Companies {
  constructor(private readonly client: HttpClient) {}

  async list(): Promise<PaginatedResponse<Company>> {
    return this.client.get<PaginatedResponse<Company>>('/v1/companies')
  }

  async get(id: string): Promise<Company> {
    return this.client.get<Company>(`/v1/companies/${id}`)
  }

  async update(id: string, params: CompanyUpdateParams): Promise<Company> {
    return this.client.patch<Company>(`/v1/companies/${id}`, params)
  }

  /** Base64-encoded PDF, max 5 MB. */
  async uploadCgv(companyId: string, content: string, options?: RequestOptions): Promise<CgvResponse> {
    return this.client.post<CgvResponse>(`/v1/companies/${companyId}/cgv`, { content }, options)
  }

  async getCgv(companyId: string): Promise<CgvResponse> {
    return this.client.get<CgvResponse>(`/v1/companies/${companyId}/cgv`)
  }

  async deleteCgv(companyId: string): Promise<CgvResponse> {
    return this.client.del<CgvResponse>(`/v1/companies/${companyId}/cgv`)
  }
}
