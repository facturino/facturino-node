import type { HttpClient } from '../client.js'
import type {
  VatReportParams,
  VatReport,
  RevenueReportParams,
  RevenueReport,
} from '../types.js'

/** Financial reporting — VAT and revenue reports (Essential+ plans). */
export class Reporting {
  constructor(private readonly client: HttpClient) {}

  /** VAT report aggregated by rate for a given period. Amounts in integer centimes. */
  async vatReport(params: VatReportParams): Promise<VatReport> {
    const qs = new URLSearchParams({
      period_start: params.period_start,
      period_end: params.period_end,
    }).toString()
    return this.client.get<VatReport>(`/v1/reporting/vat?${qs}`)
  }

  /** Revenue report with invoiced, credit notes, payments, and optional breakdown. Amounts in integer centimes. */
  async revenueReport(params: RevenueReportParams): Promise<RevenueReport> {
    const queryParams: Record<string, string> = {
      period_start: params.period_start,
      period_end: params.period_end,
    }
    if (params.group_by) {
      queryParams.group_by = params.group_by
    }
    const qs = new URLSearchParams(queryParams).toString()
    return this.client.get<RevenueReport>(`/v1/reporting/revenue?${qs}`)
  }
}
