/**
 * Tests for methods backfilled to reach 100% API coverage:
 *   - account: scheduleDeletion, cancelDeletion, requestExport,
 *     downloadExport, updateNotifications
 *   - companies: create, updateInvoicingSettings, addMilestone
 *   - invoices: createPortalLink
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import Facturino from '../src/index.js'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  } as unknown as Response
}

function lastCall(): [string, RequestInit] {
  const [url, init] = mockFetch.mock.calls[mockFetch.mock.calls.length - 1] as [string, RequestInit]
  return [url, init]
}

describe('Account — RGPD lifecycle', () => {
  let f: Facturino
  beforeEach(() => {
    mockFetch.mockReset()
    f = new Facturino('fac_test_x')
  })

  it('POST /v1/account/schedule-deletion schedules the 30-day grace period', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse(200, {
        object: 'account_deletion',
        deletionScheduledAt: '2026-06-19T00:00:00.000Z',
        message: 'Account scheduled for deletion in 30 days.',
      }),
    )
    const res = await f.account.scheduleDeletion()
    const [url, init] = lastCall()
    expect(url).toContain('/v1/account/schedule-deletion')
    expect(init.method).toBe('POST')
    expect(res.deletionScheduledAt).toMatch(/^2026-/)
  })

  it('POST /v1/account/cancel-deletion clears a pending deletion', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse(200, { object: 'account_deletion', deletionScheduledAt: null }),
    )
    await f.account.cancelDeletion()
    const [url, init] = lastCall()
    expect(url).toContain('/v1/account/cancel-deletion')
    expect(init.method).toBe('POST')
  })

  it('POST /v1/account/export starts an RGPD export job', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse(200, {
        object: 'account_export',
        exportId: 'rgpdexp_abc',
        status: 'pending',
        message: 'Export is being prepared. You will be notified when ready.',
      }),
    )
    const res = await f.account.requestExport()
    const [url, init] = lastCall()
    expect(url).toContain('/v1/account/export')
    expect(init.method).toBe('POST')
    expect(res.exportId).toBe('rgpdexp_abc')
  })

  it('GET /v1/account/exports/:id/download returns a short-lived signed URL', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse(200, {
        url: 'https://storage.googleapis.com/facturino-archive/...',
        expiresAt: '2026-05-20T12:05:00.000Z',
      }),
    )
    const res = await f.account.downloadExport('rgpdexp_abc')
    const [url, init] = lastCall()
    expect(url).toContain('/v1/account/exports/rgpdexp_abc/download')
    expect(init.method).toBe('GET')
    expect(res.url).toContain('https://')
  })

  it('PATCH /v1/account/notifications updates email broadcast preferences', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(200, { invoicePaid: false, productNews: true }))
    await f.account.updateNotifications({ invoicePaid: false, productNews: true })
    const [url, init] = lastCall()
    expect(url).toContain('/v1/account/notifications')
    expect(init.method).toBe('PATCH')
    expect(init.body).toContain('"invoicePaid":false')
  })
})

describe('Companies — backfilled methods', () => {
  let f: Facturino
  beforeEach(() => {
    mockFetch.mockReset()
    f = new Facturino('fac_test_x')
  })

  it('POST /v1/companies creates a new company subject to plan quota', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse(200, { id: 'comp_new', name: 'ACME SAS' }),
    )
    await f.companies.create({
      name: 'ACME SAS',
      siret: '44306184100047',
      address: {
        line1: '12 rue de Rivoli',
        postalCode: '75001',
        city: 'Paris',
        countryCode: 'FR',
      },
      vatRegime: 'normal',
    })
    const [url, init] = lastCall()
    expect(url).toContain('/v1/companies')
    expect(init.method).toBe('POST')
    expect(init.body).toContain('"siret":"44306184100047"')
  })

  it('PATCH /v1/companies/:id/invoicing-settings updates invoicing config', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(200, { id: 'comp_xyz' }))
    await f.companies.updateInvoicingSettings('comp_xyz', { vatRegime: 'franchise' })
    const [url, init] = lastCall()
    expect(url).toContain('/v1/companies/comp_xyz/invoicing-settings')
    expect(init.method).toBe('PATCH')
    expect(init.body).toContain('"vatRegime":"franchise"')
  })

  it('POST /v1/companies/:id/milestones marks an onboarding milestone', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse(200, {
        object: 'company_milestone',
        milestone: 'first_invoice_sent',
        reachedAt: '2026-05-20T12:00:00.000Z',
      }),
    )
    const res = await f.companies.addMilestone('comp_xyz', 'first_invoice_sent')
    const [url, init] = lastCall()
    expect(url).toContain('/v1/companies/comp_xyz/milestones')
    expect(init.method).toBe('POST')
    expect(init.body).toContain('"milestone":"first_invoice_sent"')
    expect(res.milestone).toBe('first_invoice_sent')
  })
})

describe('Invoices — backfilled portal link', () => {
  it('POST /v1/invoices/:id/portal-link returns a signed client-portal URL', async () => {
    mockFetch.mockReset()
    const f = new Facturino('fac_test_x')
    mockFetch.mockResolvedValueOnce(
      jsonResponse(200, {
        url: 'https://facturino.com/portal/inv_x?token=...',
        token: 'plt_secret',
        expires_at: '2026-05-21T12:00:00.000Z',
      }),
    )
    const res = await f.invoices.createPortalLink('inv_x')
    const [url, init] = lastCall()
    expect(url).toContain('/v1/invoices/inv_x/portal-link')
    expect(init.method).toBe('POST')
    expect(res.url).toContain('/portal/')
  })
})
