import type { HttpClient } from '../client.js'
import type { UsageSummary } from '../types.js'

/**
 * Usage — current period consumption metrics for the authenticated
 * account (invoices issued, storage used, PA submissions, API calls).
 *
 * Useful for in-app dashboards and proactive plan-upgrade nudges
 * before a quota hit triggers a 402 from the API.
 */
export class Usage {
  constructor(private readonly client: HttpClient) {}

  /**
   * Return the current usage snapshot. The response includes the plan
   * limits and the consumption so far for each metered dimension; no
   * historical data — the dashboard uses `GET /v1/exports/revenue`
   * for trend lines.
   */
  async retrieve(): Promise<UsageSummary> {
    return this.client.get<UsageSummary>('/v1/usage')
  }
}
