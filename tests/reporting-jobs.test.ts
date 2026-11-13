/**
 * Reports, invoice export jobs and the audit trail PDF, against the shapes the
 * API sends (camelCase reports; `invoice_export` jobs; 501 on the audit trail PDF).
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import Facturino, { ApiError } from '../src/index.js'

const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
const diagnose = (source: string): string[] => {
  const virtualPath = fileURLToPath(new URL('./__reporting_jobs__.ts', import.meta.url))
  const options: ts.CompilerOptions = { noEmit: true, strict: true, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.NodeNext, moduleResolution: ts.ModuleResolutionKind.NodeNext, skipLibCheck: true }
  const host = ts.createCompilerHost(options)
  const read = host.getSourceFile.bind(host)
  host.getSourceFile = (path, language, onError, create) => path === virtualPath ? ts.createSourceFile(path, source, ts.ScriptTarget.ES2022, true) : read(path, language, onError, create)
  const program = ts.createProgram([virtualPath], options, host)
  return ts.getPreEmitDiagnostics(program).map(d => ts.flattenDiagnosticMessageText(d.messageText, '\n'))
}
afterEach(() => vi.unstubAllGlobals())

const vatBody = {
  object: 'vat_report',
  period: { start: '2026-01-01', end: '2026-03-31' },
  vatBreakdown: [{ rate: '20.00', taxableAmount: 10000, vatAmount: 2000 }],
  totalHT: 10000, totalVAT: 2000, totalTTC: 12000, invoiceCount: 3,
}
const revenueGroup = {
  revenue: { invoiced: 12000, creditNotes: -2400, net: 9600 },
  payments: { received: 6000, outstanding: 3600 },
  invoiceCount: 3, creditNoteCount: 1,
}
const revenueBody = { object: 'revenue_report', period: { start: '2026-01-01', end: '2026-03-31' }, ...revenueGroup,
  breakdown: [{ period: '2026-Q1', ...revenueGroup }] }

describe('reports', () => {
  it('reads the camelCase VAT and revenue reports with non-zero values, typed as numbers', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(response(vatBody)).mockResolvedValueOnce(response(revenueBody)))
    const client = new Facturino('fac_test_reports')
    const vat = await client.reporting.vatReport({ period_start: '2026-01-01', period_end: '2026-03-31' })
    const revenue = await client.reporting.revenueReport({ period_start: '2026-01-01', period_end: '2026-03-31', group_by: 'quarter' })
    expect([vat.vatBreakdown[0].rate, vat.vatBreakdown[0].taxableAmount, vat.vatBreakdown[0].vatAmount, vat.totalHT, vat.totalVAT, vat.totalTTC, vat.invoiceCount])
      .toEqual(['20.00', 10000, 2000, 10000, 2000, 12000, 3])
    expect([revenue.revenue.creditNotes, revenue.invoiceCount, revenue.creditNoteCount, revenue.breakdown?.[0].revenue.creditNotes, revenue.breakdown?.[0].creditNoteCount])
      .toEqual([-2400, 3, 1, -2400, 1])
    // A snake_case field type would read `number | undefined` here and fail to compile.
    const source = `import type { VatReport, RevenueReport } from '../src/index.js';\n`
      + `declare const vat: VatReport;\ndeclare const revenue: RevenueReport;\n`
      + `const total: number = vat.totalHT + vat.invoiceCount + vat.vatBreakdown[0].taxableAmount;\n`
      + `const credits: number = revenue.revenue.creditNotes + revenue.invoiceCount + revenue.creditNoteCount;\n`
      + `const grouped: number = revenue.breakdown![0].revenue.creditNotes + revenue.breakdown![0].invoiceCount + revenue.breakdown![0].creditNoteCount;\n`
      + `void [total, credits, grouped];`
    expect(diagnose(source)).toEqual([])
  })
})

describe('invoice export jobs', () => {
  it('reads an invoice_export job with included, failed and truncated', async () => {
    const body = {
      id: 'job_export', object: 'job', type: 'invoice_export', status: 'completed_with_errors',
      invoiceId: null, progress: 100, result: 'exports/job_export.zip', error: null,
      included: 4998, failed: 2, truncated: true, created: '2026-11-13T10:00:00.000Z',
    }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(response(body)))
    const job = await new Facturino('fac_test_jobs').jobs.get('job_export')
    expect([job.type, job.included, job.failed, job.truncated]).toEqual(['invoice_export', 4998, 2, true])
    const source = `import type { Job, JobType } from '../src/index.js';\n`
      + `declare const job: Job;\n`
      + `const type: JobType = 'invoice_export';\n`
      + `const included: number | undefined = job.included;\nconst failed: number | undefined = job.failed;\nconst truncated: boolean | undefined = job.truncated;\n`
      + `void [type, included, failed, truncated];`
    expect(diagnose(source)).toEqual([])
  })

  it('stops polling on a partial export (completed_with_errors)', async () => {
    const job = { id: 'job_export', object: 'job', type: 'invoice_export', invoiceId: null, progress: 100,
      result: null, error: null, created: '2026-11-13T10:00:00.000Z' }
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response({ ...job, status: 'processing' }))
      .mockResolvedValue(response({ ...job, status: 'completed_with_errors', failed: 2 }))
    vi.stubGlobal('fetch', fetchMock)
    const polled = await new Facturino('fac_test_jobs').jobs.poll('job_export', 0, 5)
    expect([polled.status, polled.failed]).toEqual(['completed_with_errors', 2])
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})

describe('audit trail PDF', () => {
  it('surfaces the 501 not_implemented answer as an API error, without retrying', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response({
      error: { type: 'api_error', code: 'not_implemented', message: 'Audit trail PDF is not available yet.', request_id: 'req_501' },
    }, 501))
    vi.stubGlobal('fetch', fetchMock)
    const error = await new Facturino('fac_test_audit').invoices.generateAuditTrailPdf('inv_1').catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect([(error as ApiError).status, (error as ApiError).code]).toEqual([501, 'not_implemented'])
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
