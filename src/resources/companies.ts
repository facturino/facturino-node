import type { HttpClient } from '../client.js'
import type {
  Address,
  BankDetails,
  Company,
  CompanyUpdateParams,
  CgvResponse,
  InvoiceSettings,
  PaginatedResponse,
  PATestResult,
  RequestOptions,
} from '../types.js'

/** Body for `POST /v1/companies` — create a new company under the authenticated user. */
export interface CompanyCreateParams {
  name: string
  siret: string
  address: Address
  vatNumber?: string
  legalForm?: string | { code: string; sigle?: string; label?: string } | null
  naf?: string | { code: string; label?: string } | null
  tvaIntracom?: string
  rcs?: string
  capitalSocial?: string
  vatRegime?: 'normal' | 'franchise' | 'simplified' | 'debit'
  email?: string
  phone?: string
  website?: string
  bankDetails?: BankDetails
}

/** Body for `PATCH /v1/companies/:id/invoicing-settings`. */
export type InvoicingSettingsUpdate = Partial<InvoiceSettings> & {
  vatRegime?: 'normal' | 'franchise' | 'simplified' | 'debit'
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
   * Update the invoicing settings (numbering format, default payment
   * terms, default VAT rate, footer mentions…) and the VAT regime for
   * the active company. The `id` parameter must match the company the
   * API key is scoped to.
   */
  async updateInvoicingSettings(
    id: string,
    params: InvoicingSettingsUpdate,
  ): Promise<Company> {
    return this.client.patch<Company>(
      `/v1/companies/${id}/invoicing-settings`,
      params,
    )
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

  // --- Stripe Connect ---

  /**
   * Start a Stripe Connect onboarding session for the active company.
   * Returns the hosted onboarding URL the user must be redirected to.
   * `return_url` is where Stripe sends the user back once onboarding is
   * complete or abandoned.
   */
  async createStripeConnect(params: { return_url: string }): Promise<{ url: string }> {
    return this.client.post<{ url: string }>('/v1/companies/stripe-connect', params)
  }

  async getStripeDashboard(): Promise<{ url: string }> {
    return this.client.get<{ url: string }>('/v1/companies/stripe-dashboard')
  }

  /** Disconnect the Stripe Connect account from the active company. */
  async deleteStripeConnect(): Promise<{ deleted: boolean }> {
    return this.client.del<{ deleted: boolean }>('/v1/companies/stripe-connect')
  }

  /**
   * @deprecated Use {@link createStripeConnect}. Kept for backward
   * compatibility; the `refreshUrl` argument is ignored and `returnUrl`
   * is forwarded as the contract `return_url` field.
   */
  async connectStripe(params: { returnUrl: string; refreshUrl?: string }): Promise<{ url: string }> {
    return this.createStripeConnect({ return_url: params.returnUrl })
  }

  /** @deprecated Use {@link deleteStripeConnect}. */
  async disconnectStripe(): Promise<{ deleted: boolean }> {
    return this.deleteStripeConnect()
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

  /**
   * Test the PA connection: verifies network reachability and credential
   * validity via a directory lookup of the company SIRET. Returns a
   * {@link PATestResult}. A `healthy: false` result carries an `errorCode`:
   * `pa_credentials_invalid` (fix credentials), `pa_unreachable` (PA/network
   * outage), `pa_not_supported` (the PA has no directory lookup — a capability
   * gap, not a failure of your setup), or `pa_error`.
   */
  async testPAConnection(companyId: string): Promise<PATestResult> {
    return this.client.post<PATestResult>(`/v1/companies/${companyId}/pa-connection/test`, {})
  }
}
