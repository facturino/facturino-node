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

  // --- Stripe Connect ---

  async connectStripe(params: { returnUrl: string; refreshUrl: string }): Promise<{ url: string }> {
    return this.client.post<{ url: string }>('/v1/companies/stripe-connect', params)
  }

  async getStripeDashboard(): Promise<{ url: string }> {
    return this.client.get<{ url: string }>('/v1/companies/stripe-dashboard')
  }

  async disconnectStripe(): Promise<{ deleted: boolean }> {
    return this.client.del<{ deleted: boolean }>('/v1/companies/stripe-connect')
  }

  // --- PA Connection (BYOPA) ---

  /** Connect a PA — the client provides their own PA account credentials. */
  async connectPA(companyId: string, params: {
    provider: 'super_pdp' | 'iopole' | 'b2brouter' | 'seqino' | 'afnor_generic'
    clientId?: string
    clientSecret?: string
    apiKey?: string
    customBaseUrl?: string
  }): Promise<{ provider: string; status: string; connectedAt: string }> {
    return this.client.post(`/v1/companies/${companyId}/pa-connection`, params)
  }

  /** Disconnect the PA from a company. */
  async disconnectPA(companyId: string): Promise<{ deleted: boolean }> {
    return this.client.del<{ deleted: boolean }>(`/v1/companies/${companyId}/pa-connection`)
  }

  /** Test the PA connection (health check + credential validation). */
  async testPAConnection(companyId: string): Promise<{ healthy: boolean; latencyMs: number; details: string }> {
    return this.client.post(`/v1/companies/${companyId}/pa-connection/test`, {})
  }
}
