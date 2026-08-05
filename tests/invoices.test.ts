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

describe('Invoices resource', () => {
  let facturino: Facturino

  beforeEach(() => {
    mockFetch.mockReset()
    facturino = new Facturino('fac_test_abc123')
  })

  describe('create', () => {
    it('should POST to /v1/invoices', async () => {
      const mockInvoice = {
        id: 'inv_123',
        object: 'invoice',
        status: 'draft',
        customer: { ref: 'cus_456', snapshot: { name: 'ACME', address: {} } },
      }

      mockFetch.mockResolvedValueOnce(jsonResponse(201, mockInvoice))

      const result = await facturino.invoices.create({
        customer: 'cus_456',
        items: [{
          description: 'Consulting',
          quantity: 1,
          unit_price: 10000,
          vat_rate: 2000,
        }],
      })

      expect(result.id).toBe('inv_123')
      expect(result.status).toBe('draft')

      const [url, opts] = mockFetch.mock.calls[0]
      expect(url).toContain('/v1/invoices')
      expect(opts.method).toBe('POST')
      const body = JSON.parse(opts.body)
      expect(body.customer).toBe('cus_456')
      expect(body.items[0].unit_price).toBe(10000)
    })

    it('should send idempotency key', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse(201, { id: 'inv_123' }))

      await facturino.invoices.create(
        { customer: 'cus_1', items: [{ description: 'Test', quantity: 1, unit_price: 100, vat_rate: 2000 }] },
        { idempotencyKey: 'idem_key_123' }
      )

      const [, opts] = mockFetch.mock.calls[0]
      expect(opts.headers['Idempotency-Key']).toBe('idem_key_123')
    })
  })

  describe('get', () => {
    it('should GET /v1/invoices/:id', async () => {
      const mockInvoice = { id: 'inv_123', object: 'invoice', status: 'finalized' }
      mockFetch.mockResolvedValueOnce(jsonResponse(200, mockInvoice))

      const result = await facturino.invoices.get('inv_123')
      expect(result.id).toBe('inv_123')
      expect(result.status).toBe('finalized')

      const [url] = mockFetch.mock.calls[0]
      expect(url).toContain('/v1/invoices/inv_123')
    })

    it('should pass comma-separated expand and return expanded objects', async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse(200, {
          id: 'inv_123',
          object: 'invoice',
          status: 'finalized',
          expanded: {
            credit_notes: [{ id: 'crn_1', object: 'credit_note' }],
            net_balance: '80.00',
          },
        }),
      )

      const result = await facturino.invoices.get('inv_123', {
        expand: ['customer', 'credit_notes'],
      })

      const [url] = mockFetch.mock.calls[0]
      expect(url).toContain('expand=customer,credit_notes')
      expect(result.expanded?.net_balance).toBe('80.00')
      expect(result.expanded?.credit_notes).toHaveLength(1)
    })
  })

  describe('update', () => {
    it('should PATCH /v1/invoices/:id', async () => {
      const mockInvoice = { id: 'inv_123', object: 'invoice', notes: 'Updated' }
      mockFetch.mockResolvedValueOnce(jsonResponse(200, mockInvoice))

      const result = await facturino.invoices.update('inv_123', { notes: 'Updated' })
      expect(result.notes).toBe('Updated')

      const [url, opts] = mockFetch.mock.calls[0]
      expect(url).toContain('/v1/invoices/inv_123')
      expect(opts.method).toBe('PATCH')
    })
  })

  describe('del', () => {
    it('should DELETE /v1/invoices/:id', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 204,
        headers: new Headers(),
        json: () => Promise.reject(new Error('no json')),
        text: () => Promise.resolve(''),
      } as unknown as Response)

      await expect(facturino.invoices.del('inv_123')).resolves.toBeUndefined()

      const [url, opts] = mockFetch.mock.calls[0]
      expect(url).toContain('/v1/invoices/inv_123')
      expect(opts.method).toBe('DELETE')
    })
  })

  describe('finalize', () => {
    it('should POST /v1/invoices/:id/finalize', async () => {
      const mockInvoice = { id: 'inv_123', object: 'invoice', status: 'finalized', number: 'FAC-2026-00001' }
      mockFetch.mockResolvedValueOnce(jsonResponse(200, mockInvoice))

      const result = await facturino.invoices.finalize('inv_123')
      expect(result.status).toBe('finalized')
      expect(result.number).toBe('FAC-2026-00001')

      const [url, opts] = mockFetch.mock.calls[0]
      expect(url).toContain('/v1/invoices/inv_123/finalize')
      expect(opts.method).toBe('POST')
    })
  })

  describe('send', () => {
    it('should POST /v1/invoices/:id/send', async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse(202, { id: 'inv_123', object: 'invoice', status: 'sending' })
      )

      const result = await facturino.invoices.send('inv_123')
      expect(result.status).toBe('sending')
    })
  })

  describe('getStatus', () => {
    it('should GET /v1/invoices/:id/status', async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse(200, {
          status: 'approved',
          einvoicing: { paStatus: 'accepted', paId: 'pa_123' },
          dates: { due: '2026-04-01', finalizedAt: '2026-03-01' },
        })
      )

      const result = await facturino.invoices.getStatus('inv_123')
      expect(result.status).toBe('approved')
      expect(result.einvoicing.paId).toBe('pa_123')
    })
  })

  describe('verify', () => {
    it('should GET /v1/invoices/:id/verify', async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse(200, {
          id: 'inv_123',
          object: 'invoice',
          verified: true,
          chain_length: 5,
          details: 'Chain verified',
        })
      )

      const result = await facturino.invoices.verify('inv_123')
      expect(result.verified).toBe(true)
      expect(result.chain_length).toBe(5)
    })
  })

  describe('list (auto-pagination)', () => {
    it('should return first page when awaited', async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse(200, {
          object: 'list',
          url: '/v1/invoices',
          data: [{ id: 'inv_1' }, { id: 'inv_2' }],
          has_more: false,
          next_cursor: null,
        })
      )

      const page = await facturino.invoices.list({ limit: 10 })
      expect(page.data).toHaveLength(2)
      expect(page.has_more).toBe(false)
    })

    it('should iterate through multiple pages', async () => {
      mockFetch
        .mockResolvedValueOnce(
          jsonResponse(200, {
            object: 'list',
            url: '/v1/invoices',
            data: [{ id: 'inv_1' }, { id: 'inv_2' }],
            has_more: true,
            next_cursor: 'inv_2',
          })
        )
        .mockResolvedValueOnce(
          jsonResponse(200, {
            object: 'list',
            url: '/v1/invoices',
            data: [{ id: 'inv_3' }],
            has_more: false,
            next_cursor: null,
          })
        )

      const ids: string[] = []
      for await (const invoice of facturino.invoices.list({ limit: 2 })) {
        ids.push(invoice.id)
      }

      expect(ids).toEqual(['inv_1', 'inv_2', 'inv_3'])
      expect(mockFetch).toHaveBeenCalledTimes(2)

      // Verify second call uses starting_after cursor
      const [url2] = mockFetch.mock.calls[1]
      expect(url2).toContain('starting_after=inv_2')
    })

    it('should pass status filter', async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse(200, {
          object: 'list',
          url: '/v1/invoices',
          data: [],
          has_more: false,
          next_cursor: null,
        })
      )

      await facturino.invoices.list({ status: 'draft', limit: 5 })

      const [url] = mockFetch.mock.calls[0]
      expect(url).toContain('status=draft')
      expect(url).toContain('limit=5')
    })
  })

  describe('payments sub-resource', () => {
    it('should POST /v1/invoices/:id/payments', async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse(201, {
          id: 'pay_123',
          object: 'payment',
          amount: '100.00',
          method: 'transfer',
        })
      )

      const result = await facturino.invoices.payments.create('inv_123', {
        amount: 10000,
        method: 'transfer',
        paidAt: '2026-03-15T00:00:00Z',
      })

      expect(result.id).toBe('pay_123')

      const [url, opts] = mockFetch.mock.calls[0]
      expect(url).toContain('/v1/invoices/inv_123/payments')
      expect(opts.method).toBe('POST')
      const body = JSON.parse(opts.body)
      expect(body.amount).toBe(10000)
    })

    it('should accept the paypal payment method', async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse(201, { id: 'pay_pp', object: 'payment', amount: '100.00', method: 'paypal' })
      )
      // `method: 'paypal'` type-checks against PaymentMethod (union now includes it).
      const result = await facturino.invoices.payments.create('inv_123', {
        amount: 10000,
        method: 'paypal',
        paidAt: '2026-03-15T00:00:00Z',
      })
      expect(result.method).toBe('paypal')
      const [, opts] = mockFetch.mock.calls[0]
      expect(JSON.parse(opts.body).method).toBe('paypal')
    })

    it('should GET /v1/invoices/:id/payments', async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse(200, {
          object: 'list',
          url: '/v1/invoices/inv_123/payments',
          data: [{ id: 'pay_1' }, { id: 'pay_2' }],
          has_more: false,
          next_cursor: null,
        })
      )

      const page = await facturino.invoices.payments.list('inv_123')
      expect(page.data).toHaveLength(2)
    })

    it('should POST /v1/invoices/:id/payments/:paymentId/cancel', async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse(200, {
          id: 'pay_123',
          object: 'payment',
          status: 'cancelled',
          invoiceStatus: 'partially_paid',
          amountDue: 5000,
        })
      )

      const result = await facturino.invoices.payments.cancel('inv_123', 'pay_123')
      expect(result.status).toBe('cancelled')
      expect(result.amountDue).toBe(5000)

      const [url, opts] = mockFetch.mock.calls[0]
      expect(url).toContain('/v1/invoices/inv_123/payments/pay_123/cancel')
      expect(opts.method).toBe('POST')
    })
  })

  describe('getPdf', () => {
    it('should return download URL when PDF exists', async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse(200, { url: 'https://storage.example.com/invoice.pdf', expires_in: 900 })
      )

      const result = await facturino.invoices.getPdf('inv_123')
      expect('url' in result).toBe(true)
    })

    it('should return job when PDF needs generation', async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse(202, { id: 'job_123', object: 'job', type: 'pdf', status: 'pending', invoice_id: 'inv_123' })
      )

      const result = await facturino.invoices.getPdf('inv_123')
      expect('status' in result && result.status === 'pending').toBe(true)
    })

    it('should pass template query parameter', async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse(200, { url: 'https://example.com/pdf', expires_in: 900 })
      )

      await facturino.invoices.getPdf('inv_123', 'modern')

      const [url] = mockFetch.mock.calls[0]
      expect(url).toContain('template=modern')
    })
  })

  describe('getXml', () => {
    it('should default to CII format', async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse(200, '<xml>cii</xml>')
      )

      await facturino.invoices.getXml('inv_123')

      const [url] = mockFetch.mock.calls[0]
      expect(url).not.toContain('format=')
    })

    it('should accept UBL format', async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse(200, '<xml>ubl</xml>')
      )

      await facturino.invoices.getXml('inv_123', 'ubl')

      const [url] = mockFetch.mock.calls[0]
      expect(url).toContain('format=ubl')
    })
  })

  describe('payment link and token', () => {
    it('should POST /v1/invoices/:id/payment-link', async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse(200, {
          object: 'payment_link',
          url: 'https://checkout.stripe.com/xxx',
          session_id: 'cs_123',
        })
      )

      const result = await facturino.invoices.createPaymentLink('inv_123', {
        success_url: 'https://example.com/success',
      })

      expect(result.url).toContain('stripe.com')
    })

    it('should POST /v1/invoices/:id/payment-token', async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse(200, {
          object: 'payment_token',
          token: 'abc123',
          pay_url: '/pay/abc123',
          expires_at: '2026-03-16T00:00:00Z',
        })
      )

      const result = await facturino.invoices.createPaymentToken('inv_123')
      expect(result.token).toBe('abc123')
    })
  })
})
