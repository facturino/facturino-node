# Facturino Node.js SDK

[![npm](https://img.shields.io/npm/v/@facturino/node)](https://www.npmjs.com/package/@facturino/node)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Official Node.js / TypeScript client for the [Facturino API](https://facturino.com/docs/api). Requires Node 18+.

## Installation

```bash
npm install @facturino/node
```

## Usage

```typescript
import Facturino from '@facturino/node'

const facturino = new Facturino('fac_test_xxx')

const invoice = await facturino.invoices.create({
  customerId: 'cus_xxx',
  buyer: {
    companyName: 'Acme SAS',
    siret: '55208131766522',
    address: { line1: '10 rue de la Paix', postalCode: '75002', city: 'Paris', country: 'FR' },
  },
  lines: [{
    description: 'Consulting',
    quantity: '1',      // decimal string
    unit: 'flat_rate',
    unitPrice: 10000,   // 100.00 EUR (centimes)
    vatRate: 2000,      // 20.00% (centièmes de pourcent)
    vatCode: 'S',
  }],
  dates: { issued: '2026-07-01', due: '2026-07-31' },
  payment: { terms: 'Paiement à 30 jours', termsDays: 30, method: 'transfer', latePaymentRate: '10.00', collectionFee: '40.00' },
})

const finalized = await facturino.invoices.finalize(invoice.id)

// One-shot: pass `autoFinalize: true` (and optionally
// `autoSend: { email: true, pa: true }`) to `invoices.create(...)` to
// finalize — and deliver by email and/or to the PA — in a single call.
```

## Configuration

```typescript
const facturino = new Facturino('fac_test_xxx', {
  maxRetries: 3,      // retries on 429/5xx
  timeout: 30000,     // ms
  apiVersion: '2026-03-01',
})
```

## Amounts

Monetary values are integers in **centimes** (10000 = 100.00 EUR).
VAT rates are integers in **centipercent** (2000 = 20.00%).

## Pagination

```typescript
// Auto-paginate
for await (const inv of facturino.invoices.list({ limit: 25 })) {
  console.log(inv.id)
}

// Single page
const page = await facturino.invoices.list({ status: 'draft' })
```

## Resources

```typescript
// Invoices
facturino.invoices.create(params)
facturino.invoices.get('inv_xxx')
facturino.invoices.get('inv_xxx', { expand: ['customer', 'credit_notes'] })
facturino.invoices.update('inv_xxx', params)
facturino.invoices.del('inv_xxx')
facturino.invoices.finalize('inv_xxx')
facturino.invoices.send('inv_xxx')
facturino.invoices.getPdf('inv_xxx')
facturino.invoices.getFacturx('inv_xxx')
facturino.invoices.getXml('inv_xxx', 'cii')
facturino.invoices.list({ convertedFrom: 'quo_xxx' })  // invoices issued from a quote

// Payments (sub-resource)
facturino.invoices.payments.create('inv_xxx', { amount: 10000, method: 'transfer', paidAt: '...' })
facturino.invoices.payments.list('inv_xxx')
facturino.invoices.payments.cancel('inv_xxx', 'pay_xxx')

// Customers
facturino.customers.create(params)
facturino.customers.lookup({ siret: '73282932000074' })
// contacts[].role: 'billing' | 'technical' | 'main' (billing receives invoices)

// Products
facturino.products.list({ q: 'consult', category: 'services', active: true })

// Quotes
facturino.quotes.create(params)
facturino.quotes.send('quo_xxx')
facturino.quotes.accept('quo_xxx')
facturino.quotes.convert('quo_xxx')  // -> draft invoice
facturino.quotes.clone('quo_xxx')    // -> duplicated draft quote

// Credit Notes
facturino.creditNotes.create(params)
facturino.creditNotes.finalize('crn_xxx')

// Recurring Invoices
facturino.recurringInvoices.create(params)
facturino.recurringInvoices.pause('rec_xxx')
facturino.recurringInvoices.resume('rec_xxx')

// E-Reporting
facturino.ereporting.createDeclaration(params)
facturino.ereporting.submitDeclaration('erp_xxx')

// Exports
facturino.exports.generateFec({ period_start: '2026-01-01', period_end: '2026-12-31' })

// Jobs
facturino.jobs.poll('job_xxx')  // wait for async completion

// Sandbox (test mode only)
facturino.sandbox.resetData()
facturino.sandbox.simulateStatus('inv_xxx', { status: 'approved' })

// Reference & health (public, no auth)
facturino.reference.listLegalForms({ search: 'SAS' })
facturino.reference.listPaProviders()  // supported Plateformes Agréées (BYOPA)
facturino.health.check()

// Also: companies, events, webhookEndpoints, products
```

> **Public token endpoints** — the recipient-facing portals (`/pay/:token`,
> `/portal/:token`, `/quote-portal/:token`) are intentionally not exposed by the
> SDK: they are opened by the end recipient through a hosted page, not called
> with an API key.

## Webhooks

```typescript
app.post('/webhooks', express.raw({ type: 'application/json' }), (req, res) => {
  try {
    const event = facturino.webhooks.constructEvent(
      req.body,
      req.headers['facturino-signature'] as string,
      'whsec_xxx',
    )
    console.log(event.type, event.data.id)
    res.json({ received: true })
  } catch (err) {
    res.status(400).send('Invalid signature')
  }
})
```

## Idempotency

```typescript
await facturino.invoices.create(params, { idempotencyKey: 'unique-id' })
```

## Errors

```typescript
import { ApiError, RateLimitError, NotFoundError } from '@facturino/node'

try {
  await facturino.invoices.get('inv_xxx')
} catch (err) {
  if (err instanceof NotFoundError) { /* 404 */ }
  if (err instanceof RateLimitError) { console.log(err.retryAfter) }
  if (err instanceof ApiError) { console.log(err.code, err.requestId) }
}
```

## TypeScript

All types are exported:

```typescript
import type { Invoice, Customer, WebhookEvent } from '@facturino/node'
```

## Development

```bash
git clone https://github.com/facturino/facturino-node.git
cd facturino-node
npm install
npm test
npm run build
```

## License

MIT
