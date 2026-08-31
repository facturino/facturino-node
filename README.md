# Facturino Node.js SDK

[![npm](https://img.shields.io/npm/v/@facturino/node)](https://www.npmjs.com/package/@facturino/node)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Official Node.js / TypeScript client for the [Facturino API](https://facturino.com/docs/api). Requires Node 18+.

## Installation

```bash
npm install @facturino/node
```

## Usage

The recommended path is decision-first: identity → final tax decision →
create the decision-backed draft immediately → your chosen collection flow.
Facturino imposes no payment service provider and no payment method: an
immediate capture, a bank transfer, a direct debit or payment on agreed terms
all fit the same contract.

```typescript
import Facturino from '@facturino/node'

const facturino = new Facturino('fac_test_xxx')

// 1. Decide before the final amount is presented, the invoice is issued,
//    or collection starts.
const decision = await facturino.taxDecisions.create({
  taxSource: 'facturino',   // or 'integration' to supply your own VAT
  customerId: 'cus_8f2k4m9n',
  effectiveAt: '2026-09-15',
  currency: 'eur',
  priceMode: 'tax_exclusive',
  lines: [{
    reference: 'abo-pro',
    description: 'Abonnement Pro',
    category: 'electronically_supplied_services',
    rateCategory: 'standard',
    unitAmount: 2900,   // integer cents
    quantity: '1',      // decimal STRING, never a float
  }],
}, { idempotencyKey: `order-${orderId}` })

// 2. Act only on a final decision. `pending_verification` does not mean
//    "nothing to charge": totals and amountToCharge are null, not 0.
if (decision.status !== 'final') {
  return askForMissingEvidence(decision.issues)
}

// 3. Create the decision-backed draft immediately: no VAT is restated,
//    the amounts are the decision's.
const invoice = await facturino.invoices.create({
  customerId: decision.customerId,
  taxDecisionId: decision.id,
  decisionLines: [{ taxLineRef: 'abo-pro', unit: 'month' }],
  buyer: buyerSnapshot,
  dates: { issued: '2026-09-15', due: '2026-10-15' },
  payment: paymentTerms,
})

// 4. Choose your collection flow — see the two variants below.
```

**Immediate collection** — capture the decided amount, verify, then finalize:

```typescript
// Capture exactly amountToCharge through your payment provider, payment
// processor, bank transfer or external collection flow. Carry `decision.id`
// in the provider metadata, order reference or custom reference. The
// settlement keeps its OWN financial reference (charge id, transfer
// wording…): the two identifiers are different things and must stay distinct.
const settlement = await yourCollectionProcess.capture({
  amount: decision.amountToCharge!,   // never a locally computed total
  currency: decision.currency,
  metadata: { taxDecisionId: decision.id },
})

// Re-read the decision by its own id and verify what was actually captured.
const source = await facturino.taxDecisions.retrieve(decision.id)
if (settlement.amount !== source.amountToCharge) throw new Error('amount mismatch')
if (settlement.currency !== source.currency) throw new Error('currency mismatch')

await facturino.invoices.finalize(invoice.id)

// Record the REAL payment — its real date, method and the settlement's
// financial reference (never the decision id).
await facturino.payments.create(invoice.id, {
  amount: settlement.amount,
  // transfer, card, check, cash, direct_debit, sepa, paypal or other
  method: settlement.method,
  reference: settlement.reference,
  paidAt: settlement.paidAt,
})

// Send to the platform only on the channel the FROZEN decision states.
if (source.invoiceChannel === 'einvoicing') {
  await facturino.invoices.send(invoice.id)
}
```

**Payment on terms** — finalize and deliver now, collect later:

```typescript
await facturino.invoices.finalize(invoice.id)
if (decision.invoiceChannel === 'einvoicing') {
  await facturino.invoices.send(invoice.id)
}

// …once the transfer arrives, record the REAL collection date.
await facturino.payments.create(invoice.id, {
  amount: decision.amountToCharge!,
  method: 'transfer',
  reference: 'VIR-2026-000871',
  paidAt: '2026-10-12',
})
```

## Configuration

```typescript
const facturino = new Facturino('fac_test_xxx', {
  maxRetries: 3,      // retries on 429/5xx
  timeout: 30000,     // ms
  apiVersion: '2026-09-01',
})
```

## Tax decisions

The full walkthrough lives in [Usage](#usage). A decision is immutable: it
fixes the VAT, the exact `amountToCharge` and the reporting obligations of one
commercial operation, then never changes. Only a `final` decision carries
amounts, and the amount always comes from the decision — never from a locally
computed total.

### Optional: carrying the decision id through a PSP

These are examples, not requirements. If you collect through a PSP, keep the
decision id on the payment so step 4 can verify what was actually captured.

Stripe — any field that survives the round trip works; `metadata` is the usual one:

```typescript
const intent = await stripe.paymentIntents.create({
  amount: decision.amountToCharge!,
  currency: decision.currency,
  metadata: { facturino_tax_decision_id: decision.id },
})
```

PayPal has no `metadata`; carry the decision id in `custom_id`, and convert the
cents to decimal units for the order amount:

```typescript
custom_id: decision.id,
amount: {
  currency_code: decision.currency.toUpperCase(),
  value: (decision.amountToCharge! / 100).toFixed(2),
},
```

### What a decision states

| Field | Meaning |
|---|---|
| `status` | `final`, `pending_verification` or `unsupported`. Only `final` carries amounts. |
| `amountToCharge` | Exact amount to debit, integer cents. `null` unless `final`. |
| `totals` | `totalHT` / `totalVAT` / `totalTTC`, integer cents. `null` unless `final`. |
| `invoiceChannel` | `einvoicing` or `none` — whether the invoice travels the network. |
| `transactionReporting` | `ereporting`, `none` or `outside_scope`. |
| `paymentReporting` | `fr212`, `ereporting` or `none`. |
| `foreignTaxReviewRequired` | A foreign tax may apply; review it outside Facturino. |
| `vies` | VIES status only (`valid`, `invalid`, `unavailable`, `invalid_format`). |
| `issues` | What is missing, when the decision is not final. |
| `obligationReasons` | Why each axis carries the obligation it does. |
| `expiresAt` / `expired` | Past this instant the decision no longer opens a payment. |

`create()` requires an `Idempotency-Key` (255 characters at most; the SDK checks
it before sending). The API answers `201` on creation and `200` when the same
key already produced that decision — both return the decision, so your code
reads one shape either way. Reusing the same key with a different body answers
`409` and raises `ConflictError`.

Facturino decides **French VAT and the matching French obligations**. It does
not provide worldwide tax compliance: when a foreign tax may apply, the decision
says so through `foreignTaxReviewRequired`. An operation whose `invoiceChannel`
is `none` is not deposited on a certified platform — its obligation, if any,
goes through e-reporting.

### Missing evidence, then a retry

A decision that lacks a location or business-status proof comes back
`pending_verification`. Supply the evidence and retry the SAME operation:

```typescript
const retried = await facturino.taxDecisions.create({
  ...sameOperation,
  retryOfTaxDecisionId: pending.id,
  locationEvidence: [{
    kind: 'billing_address',
    country: 'FR',
    postalCode: '75002',
    thirdParty: false,
    source: 'declared',
    collectedAt: '2026-09-15',
  }],
}, { idempotencyKey: `order-${orderId}-retry-${pending.id}` })
```

Send the territorial **signal**, never the raw one: a country and, where the
territory needs it, a postal code — not an IP address, a PSP payload or bank
account details. `reference` is a bounded opaque identifier such as a charge id.

## Three status axes

A document has three states that do not follow from one another. The historical
`status` field stays populated as their projection.

```typescript
invoice.documentStatus     // draft | finalized | cancelled
invoice.transmissionStatus // not_applicable | pending | sending | deposited | transmitted | approved | rejected
invoice.transmissionDetail // available | received | suspended | refused | null
invoice.paymentStatus      // unpaid | partially_paid | paid | partially_refunded | refunded
```

Recording a payment never moves the transmission axis, and a refund does not
erase the collection that happened.

## Supplying your own VAT (`taxSource: 'integration'`)

If your own tax engine concludes the VAT, create the decision under the
`integration` source: the same commercial and territorial data, plus the VAT
per line (`vatRate`, `vatCode`, and `vatexCode` for exempt categories).
Facturino validates the coherence of the supplied values and refuses any
detectable contradiction (`integration_vat_incoherent`) — it never silently
corrects a rate. The amounts, the legal mentions and the three reporting axes
are still decided server-side, by the same engines. The invoice is then created
exactly like a facturino-sourced one, and carries `taxSource: 'integration'`.

```typescript
const decision = await facturino.taxDecisions.create({
  taxSource: 'integration',
  customerId: 'cus_xxx',
  effectiveAt: '2026-09-15',
  currency: 'eur',
  priceMode: 'tax_exclusive',
  lines: [{
    reference: 'consulting',
    description: 'Consulting',
    category: 'services',
    unitAmount: 10000,  // 100.00 EUR (integer cents)
    quantity: '1',      // decimal string
    vatRate: 2000,      // 20.00% — supplied, never corrected
    vatCode: 'S',
  }],
}, { idempotencyKey: `order-${orderId}` })

const invoice = await facturino.invoices.create({
  customerId: 'cus_xxx',
  taxDecisionId: decision.id,
  decisionLines: [{ taxLineRef: 'consulting', unit: 'flat_rate' }],
  buyer: buyerSnapshot,
  dates: { issued: '2026-09-15', due: '2026-10-15' },
  payment: { terms: 'Paiement à 30 jours', termsDays: 30, method: 'transfer', latePaymentRate: '10.00', collectionFee: '40.00' },
})

const finalized = await facturino.invoices.finalize(invoice.id)

// One-shot: pass `autoFinalize: true` (and optionally
// `autoSend: { email: true }`) to finalize — and deliver by email — in a
// single call.
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
// Tax decisions (immutable — no update, no delete)
facturino.taxDecisions.create(params, { idempotencyKey })
facturino.taxDecisions.retrieve('taxdec_xxx')

// Invoices
facturino.invoices.create({ taxDecisionId, decisionLines, ... })  // always backed by a FINAL decision
// `deposits` and `schedule` are settled server-side against the decided
// amount; the decided total never changes. A create without a decision is
// rejected locally, before any HTTP call.
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

// Quotes — convert, decide, bind, finalize: ONE invoice throughout.
facturino.quotes.create(params)
facturino.quotes.send('quo_xxx')
facturino.quotes.accept('quo_xxx')
facturino.quotes.clone('quo_xxx')    // -> duplicated draft quote

// A converted quote yields a COMMERCIAL draft: it states the operation and no
// VAT (`taxSource: null`). Bind a final decision to that same invoice, then
// finalize it — never create a second one.
const { invoiceId } = await facturino.quotes.convert('quo_xxx')
const decision = await facturino.taxDecisions.create(decisionInput, { idempotencyKey })
await facturino.invoices.bindTaxDecision(invoiceId, {
  taxDecisionId: decision.id,
  decisionLines: [{ taxLineRef: 'l1', unit: 'unit' }],
})
await facturino.invoices.finalize(invoiceId)

// Credit Notes
facturino.creditNotes.create({ relatedInvoiceId, creditNoteType, reasonCode, creditedLines })
// A credit note inherits the fiscal position of the invoice it corrects —
// source, snapshot and lines. It never restates any VAT.
facturino.creditNotes.finalize('crn_xxx')

// Recurring Invoices
facturino.recurringInvoices.create({ ..., taxInputs })     // each occurrence decided on its own date,
                                                           // under the recurrence's single fiscal source
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

An `Idempotency-Key` protects the **replay of one request**. It is not a
deduplicator: the API never decides on its own that two requests "mean the same
thing".

- **Same key + same canonical body** — the first 2xx response is replayed
  verbatim, and the operation is not executed a second time.
- **Same key + different body** — `409 idempotency_error`. A key belongs to a
  request, not to an endpoint.
- **Different keys** — two distinct operations, even with byte-identical bodies.
  Two requests describing the same operation are **not** deduplicated
  automatically; the key, and only the key, declares that two sends are the same
  attempt.
- **Canonical body** — JSON object keys are compared in a stable order, so
  reordering them does not change the request. Changing a value, adding or
  removing a field does. Array order is significant: two lines swapped are two
  different documents.
- **Failure before execution** (validation, read-only field, sanitisation)
  releases the key, so a corrected retry with the same key runs.
- **Business refusal during execution** is stored and replayed; the operation is
  not re-executed.
- **Scope** — 24 hours, per API key. `POST /v1/tax-decisions` additionally
  carries a durable business idempotency that never expires.

```typescript
// Same key + same body -> the first response, replayed.
await facturino.invoices.create(params, { idempotencyKey: 'order-4821' })

// Retry with new evidence is NOT idempotency. It takes a NEW decision on the
// same commercial operation: use a NEW key and link the previous decision.
await facturino.taxDecisions.create(
  { ...operation, retryOfTaxDecisionId: suspended.id },
  { idempotencyKey: 'order-4821-retry-1' },
)
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
