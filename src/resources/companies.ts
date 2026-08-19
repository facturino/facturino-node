import type { HttpClient } from '../client.js'
import type {
  Address,
  BankDetails,
  Company,
  CompanyUpdateParams,
  CgvResponse,
  LegalFormInput,
  NafCodeInput,
  PaginatedResponse,
  RequestOptions,
} from '../types.js'

/** Body for `POST /v1/companies` — create a new company under the authenticated user. */
export interface CompanyCreateParams {
  name: string
  siret: string
  address: Address
  vatNumber?: string
  legalForm?: LegalFormInput
  naf?: NafCodeInput
  tvaIntracom?: string
  rcs?: string
  capitalSocial?: string
  vatRegime?: 'normal' | 'normal_quarterly' | 'franchise' | 'simplified' | 'debit'
  email?: string
  phone?: string
  website?: string
  bankDetails?: BankDetails
}

/** Company profile and settings — legal information, bank details, and CGV documents. */
export class Companies {
  constructor(private readonly client: HttpClient) {}

  async list(): Promise<PaginatedResponse<Company>> {
    return this.client.get<PaginatedResponse<Company>>('/v1/companies')
  }

  /**
   * Create a new company under the authenticated user. Subject to the
   * per-plan company quota (free: 1, essential: 1, pro: 3, cabinet_*: 50+);
   * exceeding the quota returns a `402 plan_limit_error`.
   */
  async create(params: CompanyCreateParams, options?: RequestOptions): Promise<Company> {
    return this.client.post<Company>('/v1/companies', params, options)
  }

  async get(id: string): Promise<Company> {
    return this.client.get<Company>(`/v1/companies/${id}`)
  }

  async update(id: string, params: CompanyUpdateParams): Promise<Company> {
    return this.client.patch<Company>(`/v1/companies/${id}`, params)
  }

  /**
   * Mark an onboarding milestone as reached (e.g. `first_invoice_sent`,
   * `pa_connected`, `bank_added`). Used by the dashboard to compute the
   * onboarding progress and surface remaining steps.
   */
  async addMilestone(
    id: string,
    milestone: string,
  ): Promise<{ object: 'company_milestone'; milestone: string; reachedAt: string }> {
    return this.client.post(`/v1/companies/${id}/milestones`, { milestone })
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
