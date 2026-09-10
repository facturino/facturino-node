import { describe, it, expect, expectTypeOf, vi, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { createHmac } from 'node:crypto'
import Facturino, { Webhooks } from '../src/index.js'
import type { InvoiceEinvoicing, InvoicePreviousSubmission, PaRejectionCategory, PaRejectionSource, PaymentCollectionStatus, WebhookEvent } from '../src/index.js'

const fixture = JSON.parse(readFileSync(new URL('./fixtures/contract-2.7.0.json', import.meta.url), 'utf8'))
afterEach(() => vi.unstubAllGlobals())

describe('2.7.0 contract', () => {
  it('exposes nullable coded verdicts and the complete collection status', () => {
    expectTypeOf<InvoiceEinvoicing['rejectionSource']>().toEqualTypeOf<PaRejectionSource | null | undefined>()
    expectTypeOf<InvoicePreviousSubmission['rejectionCategory']>().toEqualTypeOf<PaRejectionCategory | null | undefined>()
    expectTypeOf<PaymentCollectionStatus['sentAt']>().toEqualTypeOf<string | null>()
    const category: PaRejectionCategory = 'addressing_error'
    const other: PaRejectionCategory = 'other'
    expect([category, other]).toEqual(['addressing_error', 'other'])
    // @ts-expect-error A status is not a rejection source.
    const invalidSource: PaRejectionSource = 'rejected'
    expect(invalidSource).toBe('rejected')
  })

  it('decodes FAC2026-00090 through the invoice resource without losing raw words, notes or nulls', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(fixture.invoice), { headers: { 'content-type': 'application/json' } })))
    const invoice = await new Facturino('fac_test_contract').invoices.get('inv_00090')
    expect(invoice.number).toBe('FAC2026-00090')
    expect(invoice.einvoicing).toEqual(fixture.invoice.einvoicing)
    expect(invoice.einvoicing?.rejectionCategory).toBe('addressing_error')
    expect(invoice.einvoicing?.previousSubmissions?.[0].rejectionNote).toBe('L’adresse de réception doit être confirmée.')
    expect(invoice.einvoicing?.submissionArtefact?.routingIdentifier).toBe('0225:73282932000074')
  })

  it('verifies signed events and preserves the typed data and null request', () => {
    const secret = 'whsec_contract_fixture'
    const timestamp = Math.floor(Date.now() / 1000)
    for (const example of fixture.events) {
      const payload = JSON.stringify(example)
      const signature = createHmac('sha256', secret).update(`${timestamp}.${payload}`).digest('hex')
      const event: WebhookEvent = new Webhooks().constructEvent(payload, `t=${timestamp},v1=${signature}`, secret)
      expect(event).toEqual(example)
      expect(event.request).toBeNull()
    }
  })

  it('reads collection outcomes, advisory warnings and the linked invoice number', () => {
    const pending: PaymentCollectionStatus = fixture.payment.fr212
    const blocked: PaymentCollectionStatus = fixture.blockedPayment.fr212
    expect(pending.state).toBe('awaiting_deposit')
    expect(pending.sentAt).toBeNull()
    expect(blocked.lastErrorReason).toBe('Invoice identifier is rejected.')
    expect(fixture.customer.warnings[0].code).toBe('buyer_nature_suspect')
    expect(fixture.taxDecision.warnings[0].param).toBe('customerId')
    expect(fixture.creditNote.relatedInvoiceNumber).toBe('FAC2026-00090')
  })

  it('returns a scheduling receipt when replaying to an already-delivered endpoint', async () => {
    const result = { id: 'evt_example', object: 'event', retryScheduled: true, endpointId: 'we_example' }
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify(result), { headers: { 'content-type': 'application/json' } }))
    vi.stubGlobal('fetch', fetch)
    expect(await new Facturino('fac_test_contract').events.retry(result.id, { endpointId: result.endpointId })).toEqual(result)
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ endpointId: result.endpointId })
  })
})
