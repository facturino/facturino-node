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

  async list(): Promise<PaginatedResponse<Member>> {
    return this.client.get<PaginatedResponse<Member>>('/v1/members')
  }

  async get(id: string): Promise<Member> {
    return this.client.get<Member>(`/v1/members/${id}`)
  }

  async invite(params: MemberInviteParams, options?: RequestOptions): Promise<Member> {
    return this.client.post<Member>('/v1/members', params, options)
  }

  async updateRole(id: string, params: MemberUpdateParams): Promise<Member> {
    return this.client.patch<Member>(`/v1/members/${id}`, params)
  }

  async revoke(id: string): Promise<void> {
    await this.client.del<void>(`/v1/members/${id}`)
  }
}
