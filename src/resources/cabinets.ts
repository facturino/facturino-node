import type { HttpClient } from '../client.js'
import type {
  Cabinet,
  CabinetActivity,
  CabinetBillingSplit,
  CabinetCompanySummary,
  CabinetCreateParams,
  CabinetDashboard,
  CabinetBrandingUpdate,
  PaginatedResponse,
  RequestOptions,
} from '../types.js'

/** Encode a flat object as a `?k=v&…` query string (skips undefined/null). */
function buildQuery(params: Record<string, unknown>): string {
  const entries: [string, string][] = []
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue
    entries.push([k, String(v)])
  }
  return entries.length === 0 ? '' : `?${new URLSearchParams(entries).toString()}`
}

/**
 * Cabinets — multi-company management for chartered-accountant cabinets
 * (plans `cabinet_50`, `cabinet_200`, `cabinet_500`). A cabinet groups
 * managed client companies under a single billing entity and exposes
 * cross-company dashboards, activity feeds, and branding.
 *
 * Calls require a `cabinet_*` plan; integrations on `pro` and below get
 * `plan_limit_error` on every endpoint here.
 */
export class Cabinets {
  constructor(private readonly client: HttpClient) {}

  /** Paginated list of cabinets owned by the authenticated account. */
  async list(params?: {
    limit?: number
    starting_after?: string
    ending_before?: string
  }): Promise<PaginatedResponse<Cabinet>> {
    const qs = params ? buildQuery(params) : ''
    return this.client.get<PaginatedResponse<Cabinet>>(`/v1/cabinets${qs}`)
  }

  async retrieve(id: string): Promise<Cabinet> {
    return this.client.get<Cabinet>(`/v1/cabinets/${id}`)
  }

  /** Create a new cabinet — only allowed under a `cabinet_*` plan. */
  async create(params: CabinetCreateParams, options?: RequestOptions): Promise<Cabinet> {
    return this.client.post<Cabinet>('/v1/cabinets', params, options)
  }

  /** Update the white-label branding (logo, colors, custom domain). */
  async updateBranding(id: string, params: CabinetBrandingUpdate): Promise<Cabinet> {
    return this.client.patch<Cabinet>(`/v1/cabinets/${id}/branding`, params)
  }

  /** Cross-company KPI dashboard (revenue, overdue, e-reporting status). */
  async dashboard(id: string, params?: {
    period_start?: string
    period_end?: string
  }): Promise<CabinetDashboard> {
    const qs = params ? buildQuery(params) : ''
    return this.client.get<CabinetDashboard>(`/v1/cabinets/${id}/dashboard${qs}`)
  }

  /** Reverse-chronological activity feed across every managed company. */
  async activity(id: string, params?: {
    limit?: number
    starting_after?: string
  }): Promise<PaginatedResponse<CabinetActivity>> {
    const qs = params ? buildQuery(params) : ''
    return this.client.get<PaginatedResponse<CabinetActivity>>(`/v1/cabinets/${id}/activity${qs}`)
  }

  /**
   * Per-company breakdown of the active subscription invoice — useful
   * for cabinets that rebill subscription costs to their clients.
   */
  async billingSplit(id: string): Promise<CabinetBillingSplit> {
    return this.client.get<CabinetBillingSplit>(`/v1/cabinets/${id}/billing-split`)
  }

  /** List the companies managed under a cabinet. */
  async listCompanies(id: string, params?: {
    limit?: number
    starting_after?: string
  }): Promise<PaginatedResponse<CabinetCompanySummary>> {
    const qs = params ? buildQuery(params) : ''
    return this.client.get<PaginatedResponse<CabinetCompanySummary>>(`/v1/cabinets/${id}/companies${qs}`)
  }

  /** Attach an existing company (by SIRET or by ID) under the cabinet. */
  async addCompany(
    id: string,
    params: { companyId?: string; siret?: string; companyName?: string },
    options?: RequestOptions,
  ): Promise<CabinetCompanySummary> {
    return this.client.post<CabinetCompanySummary>(`/v1/cabinets/${id}/companies`, params, options)
  }

  /** Invite a team member onto the cabinet (admin / accountant / viewer role). */
  async inviteMember(
    id: string,
    params: { email: string; role: string; displayName?: string },
    options?: RequestOptions,
  ): Promise<{ id: string; status: string }> {
    return this.client.post(`/v1/cabinets/${id}/members`, params, options)
  }
}
