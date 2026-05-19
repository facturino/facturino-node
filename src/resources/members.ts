import type { HttpClient } from '../client.js'
import type {
  Member,
  MemberInviteParams,
  MemberUpdateParams,
  PaginatedResponse,
  RequestOptions,
} from '../types.js'

/** Team member management — invite, update roles, and revoke access. */
export class Members {
  constructor(private readonly client: HttpClient) {}

  private path(companyId: string): string {
    return `/v1/companies/${companyId}/members`
  }

  async list(companyId: string): Promise<PaginatedResponse<Member>> {
    return this.client.get<PaginatedResponse<Member>>(this.path(companyId))
  }

  async get(companyId: string, id: string): Promise<Member> {
    return this.client.get<Member>(`${this.path(companyId)}/${id}`)
  }

  async invite(companyId: string, params: MemberInviteParams, options?: RequestOptions): Promise<Member> {
    return this.client.post<Member>(this.path(companyId), params, options)
  }

  async updateRole(companyId: string, id: string, params: MemberUpdateParams): Promise<Member> {
    return this.client.patch<Member>(`${this.path(companyId)}/${id}`, params)
  }

  async revoke(companyId: string, id: string): Promise<void> {
    await this.client.del<void>(`${this.path(companyId)}/${id}`)
  }

  /** Re-send the invitation email to a pending member (owner/admin only). */
  async resendInvitation(companyId: string, id: string, options?: RequestOptions): Promise<Member> {
    return this.client.post<Member>(`${this.path(companyId)}/${id}/resend-invitation`, undefined, options)
  }
}
