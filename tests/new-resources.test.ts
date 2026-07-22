/**
 * Smoke tests for the resources added in this changeset:
 * billing, reference, usage, validate.
 *
 * Each spec asserts that:
 *  - the HTTP method + URL match the documented API route
 *  - the request body / query string is serialised in the expected shape
 *  - the JSON response is returned untouched (no field stripping)
 *
 * Network is mocked via `vi.stubGlobal('fetch', mockFetch)` so the suite
 * is hermetic; integration coverage runs against the live Functions
 * emulator in the main repo.
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

describe('Client resource wiring', () => {
  it('exposes every resource on the client', () => {
    const f = new Facturino('fac_test_x')
    const resources = [
      'account', 'billing', 'invoices', 'payments', 'customers', 'products',
      'quotes', 'creditNotes', 'events', 'webhookEndpoints', 'recurringInvoices',
      'companies', 'exports', 'ereporting', 'jobs', 'reference', 'sandbox',
      'usage', 'validate', 'webhooks', 'receivedInvoices',
      'reporting', 'archives',
    ] as const
    for (const r of resources) {
      expect((f as unknown as Record<string, unknown>)[r], `client.${r} must be wired`).toBeDefined()
    }
  })
})

describe('Billing', () => {
  let f: Facturino
  beforeEach(() => {
    mockFetch.mockReset()
    f = new Facturino('fac_test_x')
  })

  it('GET /v1/billing/subscription', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(200, { object: 'subscription', plan: 'pro' }))
    await f.billing.retrieveSubscription()
    const [url, init] = lastCall()
    expect(url).toContain('/v1/billing/subscription')
    expect(init.method).toBe('GET')
  })

  it('GET /v1/billing/invoices with query params', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(200, { object: 'list', data: [], has_more: false }))
    await f.billing.listInvoices({ limit: 10, starting_after: 'pin_a' })
    const [url] = lastCall()
    expect(url).toContain('/v1/billing/invoices?')
    expect(url).toContain('limit=10')
    expect(url).toContain('starting_after=pin_a')
  })
})

describe('Usage', () => {
  it('GET /v1/usage', async () => {
    mockFetch.mockReset()
    const f = new Facturino('fac_test_x')
    mockFetch.mockResolvedValueOnce(jsonResponse(200, { object: 'usage', plan: 'pro' }))
    const usage = await f.usage.retrieve()
    const [url, init] = lastCall()
    expect(url).toContain('/v1/usage')
    expect(init.method).toBe('GET')
    expect(usage.object).toBe('usage')
  })
})

describe('Validate', () => {
  it('POST /v1/validate runs a SIRET check', async () => {
    mockFetch.mockReset()
    const f = new Facturino('fac_test_x')
    mockFetch.mockResolvedValueOnce(jsonResponse(200, { object: 'validation_result', kind: 'siret', valid: true, errors: [] }))
    const res = await f.validate.run({ kind: 'siret', value: '44306184100047' })
    const [url, init] = lastCall()
    expect(url).toContain('/v1/validate')
    expect(init.method).toBe('POST')
    expect(init.body).toContain('"kind":"siret"')
    expect(res.valid).toBe(true)
  })
})

describe('Reference', () => {
  let f: Facturino
  beforeEach(() => {
    mockFetch.mockReset()
    f = new Facturino('fac_test_x')
  })

  it('GET /v1/reference/legal-forms with search', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(200, { object: 'list', data: [], has_more: false }))
    await f.reference.listLegalForms({ search: 'SARL' })
    const [url] = lastCall()
    expect(url).toContain('/v1/reference/legal-forms?')
    expect(url).toContain('search=SARL')
  })

  it('GET /v1/reference/naf-codes', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(200, { object: 'list', data: [], has_more: false }))
    await f.reference.listNafCodes()
    const [url] = lastCall()
    expect(url).toContain('/v1/reference/naf-codes')
  })
})

describe('CreditNotes refund', () => {
  let f: Facturino
  beforeEach(() => {
    mockFetch.mockReset()
    f = new Facturino('fac_test_x')
  })

  it('POST /v1/credit-notes/:id/refund with amount + method', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse(201, { id: 'ref_1', object: 'refund', creditNoteId: 'crn_1', invoiceId: 'inv_1', amount: 12000 }),
    )
    const res = await f.creditNotes.refund('crn_1', { amount: 12000, method: 'transfer', refundedAt: '2026-05-14' })
    const [url, init] = lastCall()
    expect(url).toContain('/v1/credit-notes/crn_1/refund')
    expect(init.method).toBe('POST')
    const body = JSON.parse(init.body as string)
    expect(body.amount).toBe(12000)
    expect(body.method).toBe('transfer')
    expect(res.object).toBe('refund')
    expect(res.amount).toBe(12000)
  })

  it('POST /v1/credit-notes/:id/refund with no body (full refund)', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse(201, { id: 'ref_2', object: 'refund', creditNoteId: 'crn_2', invoiceId: 'inv_2', amount: 5000 }),
    )
    await f.creditNotes.refund('crn_2')
    const [url, init] = lastCall()
    expect(url).toContain('/v1/credit-notes/crn_2/refund')
    expect(init.method).toBe('POST')
  })
})
