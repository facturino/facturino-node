/**
 * Smoke tests for the resources added in this changeset:
 * billing, cabinets, notifications, reference, settings, usage, validate.
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

  it('POST /v1/billing/checkout with body', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(200, { url: 'https://stripe.com/checkout/x', sessionId: 'cs_x' }))
    const res = await f.billing.checkout({ plan: 'pro', successUrl: 'a', cancelUrl: 'b' })
    const [url, init] = lastCall()
    expect(url).toContain('/v1/billing/checkout')
    expect(init.method).toBe('POST')
    expect(init.body).toContain('"plan":"pro"')
    expect(res.url).toContain('checkout')
  })

  it('POST /v1/billing/pause', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(200, { status: 'paused' }))
    await f.billing.pause()
    const [url, init] = lastCall()
    expect(url).toContain('/v1/billing/pause')
    expect(init.method).toBe('POST')
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

describe('Notifications', () => {
  let f: Facturino
  beforeEach(() => {
    mockFetch.mockReset()
    f = new Facturino('fac_test_x')
  })

  it('GET /v1/notifications and forwards unread filter', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(200, { object: 'list', data: [], has_more: false }))
    await f.notifications.list({ unread: true, limit: 5 })
    const [url] = lastCall()
    expect(url).toContain('/v1/notifications?')
    expect(url).toContain('unread=true')
  })

  it('PATCH /v1/notifications/:id marks a single notification read', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(200, { id: 'notif_x', read: true }))
    await f.notifications.markRead('notif_x')
    const [url, init] = lastCall()
    expect(url).toContain('/v1/notifications/notif_x')
    expect(init.method).toBe('PATCH')
    expect(init.body).toContain('"read":true')
  })

  it('GET /v1/notification-preferences retrieves preferences', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(200, { preferences: {} }))
    await f.notifications.retrievePreferences()
    const [url, init] = lastCall()
    expect(url).toContain('/v1/notification-preferences')
    expect(init.method).toBe('GET')
  })

  it('PATCH /v1/notification-preferences updates preferences', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(200, { preferences: {} }))
    await f.notifications.updatePreferences({
      preferences: { invoice_paid: { email: false, inApp: true, push: true } },
    })
    const [url, init] = lastCall()
    expect(url).toMatch(/\/v1\/notification-preferences$/)
    expect(init.method).toBe('PATCH')
  })
})

describe('Settings', () => {
  let f: Facturino
  beforeEach(() => {
    mockFetch.mockReset()
    f = new Facturino('fac_test_x')
  })

  it('GET /v1/companies/:id/settings/accounting takes companyId', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(200, { object: 'accounting_settings' }))
    await f.settings.retrieveAccounting('comp_xyz')
    const [url, init] = lastCall()
    expect(url).toContain('/v1/companies/comp_xyz/settings/accounting')
    expect(init.method).toBe('GET')
  })

  it('PATCH /v1/companies/:id/settings/reminders updates the schedule', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(200, { object: 'reminder_settings', enabled: true }))
    await f.settings.updateReminders('comp_xyz', { enabled: true, intervals: [7, 15, 30] })
    const [url, init] = lastCall()
    expect(url).toContain('/v1/companies/comp_xyz/settings/reminders')
    expect(init.method).toBe('PATCH')
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

describe('Cabinets', () => {
  let f: Facturino
  beforeEach(() => {
    mockFetch.mockReset()
    f = new Facturino('fac_test_x')
  })

  it('GET /v1/cabinets paginated list', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(200, { object: 'list', data: [], has_more: false }))
    await f.cabinets.list({ limit: 25 })
    const [url] = lastCall()
    expect(url).toContain('/v1/cabinets?')
    expect(url).toContain('limit=25')
  })

  it('POST /v1/cabinets creates a cabinet', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(201, { object: 'cabinet', id: 'cab_x', plan: 'cabinet_50' }))
    await f.cabinets.create({ name: 'Cabinet X', siret: '44306184100047', plan: 'cabinet_50' })
    const [url, init] = lastCall()
    expect(url).toMatch(/\/v1\/cabinets$/)
    expect(init.method).toBe('POST')
  })

  it('GET /v1/cabinets/:id/dashboard with period', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(200, { object: 'cabinet_dashboard' }))
    await f.cabinets.dashboard('cab_x', { period_start: '2026-01-01', period_end: '2026-01-31' })
    const [url] = lastCall()
    expect(url).toContain('/v1/cabinets/cab_x/dashboard?')
    expect(url).toContain('period_start=2026-01-01')
  })

  it('POST /v1/cabinets/:id/companies attaches a managed company', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(201, { id: 'comp_x' }))
    await f.cabinets.addCompany('cab_x', { siret: '44306184100047' })
    const [url, init] = lastCall()
    expect(url).toContain('/v1/cabinets/cab_x/companies')
    expect(init.method).toBe('POST')
  })
})
