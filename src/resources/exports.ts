import type { HttpClient } from '../client.js'
import type { FecExportParams, JobResponse, RequestOptions } from '../types.js'

/** Data exports — FEC accounting files and full RGPD data portability. */
export class Exports {
  constructor(private readonly client: HttpClient) {}

  /** Async FEC generation (art. A.47 A-1 LPF). Pro/Cabinet plan. */
  async generateFec(params?: FecExportParams, options?: RequestOptions): Promise<JobResponse> {
    return this.client.post<JobResponse>('/v1/exports/fec', params ?? {}, options)
  }

  async getFecStatus(jobId: string): Promise<JobResponse> {
    return this.client.get<JobResponse>(`/v1/exports/fec/${jobId}`)
  }

  async exportRgpd(options?: RequestOptions): Promise<JobResponse> {
    return this.client.post<JobResponse>('/v1/exports/full', undefined, options)
  }

  async getExportStatus(jobId: string): Promise<JobResponse> {
    return this.client.get<JobResponse>(`/v1/exports/${jobId}`)
  }
}
