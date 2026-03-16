import type { HttpClient } from '../client.js'
import type {
  SandboxResetResponse,
  SimulateStatusParams,
  SimulateStatusResponse,
  RequestOptions,
} from '../types.js'

/** Test-mode utilities — reset data, simulate PA status transitions, and seed fixtures. */
export class Sandbox {
  constructor(private readonly client: HttpClient) {}

  async resetData(): Promise<SandboxResetResponse> {
    return this.client.post<SandboxResetResponse>('/v1/sandbox/reset')
  }

  /** Simulate PA status transition. Triggers webhooks. */
  async simulateStatus(
    invoiceId: string,
    params: SimulateStatusParams,
    options?: RequestOptions,
  ): Promise<SimulateStatusResponse> {
    return this.client.post<SimulateStatusResponse>(
      `/v1/sandbox/simulate-status/${invoiceId}`,
      params,
      options,
    )
  }

  /** Alias for resetData(). */
  async createFixtures(): Promise<SandboxResetResponse> {
    return this.resetData()
  }
}
