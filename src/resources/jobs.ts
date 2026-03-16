import type { HttpClient } from '../client.js'
import type { Job } from '../types.js'

/** Track and poll async background jobs such as PDF generation or PA submission. */
export class Jobs {
  constructor(private readonly client: HttpClient) {}

  async get(id: string): Promise<Job> {
    return this.client.get<Job>(`/v1/jobs/${id}`)
  }

  /** Poll until completed or failed. */
  async poll(id: string, intervalMs = 2000, maxAttempts = 30): Promise<Job> {
    for (let i = 0; i < maxAttempts; i++) {
      const job = await this.get(id)

      if (job.status === 'completed' || job.status === 'failed') {
        return job
      }

      await new Promise((resolve) => setTimeout(resolve, intervalMs))
    }

    throw new Error(`Job ${id} did not complete within ${maxAttempts} polling attempts`)
  }
}
