import type { HttpClient } from '../client.js'
import type { HealthStatus } from '../types.js'

/**
 * Health — lightweight liveness probe for the Facturino API. Returns the
 * service status and the API version; handy for uptime checks and to confirm
 * an API key reaches the platform before running real traffic.
 */
export class Health {
  constructor(private readonly client: HttpClient) {}

  /** Return the current service health snapshot (`GET /v1/health`). */
  async check(): Promise<HealthStatus> {
    return this.client.get<HealthStatus>('/v1/health')
  }
}
