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
  // Pending: complete the named facts. Unsupported: explain the refusal.
  return showDecisionIssues(decision.status, decision.issues)
}
//    Notices explain what the decision retained and what the seller can do
//    next. Show them to the seller.
showToSeller(decision.notices)

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

**Immediate collection** — capture the decided amount, verify, then finalize WITH the collection:

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

// Finalize AND record the REAL payment in one call: the numbering and the
// collection land in the same transaction, so the issued original (PDF and
// Factur-X) is rendered on a settled invoice. `payment` is the very object
// `payments.create()` takes — its real date, method and the settlement's
// financial reference (never the decision id).
await facturino.invoices.finalize(invoice.id, {
  payment: {
    amount: settlement.amount,
    // transfer, card, check, cash, direct_debit, sepa, paypal or other
    method: settlement.method,
    reference: settlement.reference,
    paidAt: settlement.paidAt,
  },
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
| `totals` | `totalHT` / `totalVAT` / `totalTTC`, plus optional `totalLocalTax`, integer cents. `totalTTC` includes local tax. `null` unless `final`. |
| `lines[].category` | Decided supply category; `null` only on a pending quote/draft line whose category was not declared (`supply_category_not_declared`). Direct decision requests always require `category` on every line. |
| `invoiceChannel` | `einvoicing` or `none` — whether the invoice travels the network. |
| `transactionReporting` | `ereporting`, `none` or `outside_scope`. |
| `paymentReporting` | `fr212`, `ereporting` or `none`. |
| `settledObligations` | The axes French law settles DESPITE a non-final decision. `null` when final — the three axes above are then the settled ones. Each axis inside is `null` when it depends on the treatment that could not be concluded. It authorises nothing. |
| `foreignTaxReviewRequired` | A foreign tax may apply; review it outside Facturino. |
| `vies` | VIES status only (`valid`, `invalid`, `unavailable`, `invalid_format`). |
| `legalCategory` | Optional SIRENE legal-category consultation frozen with the decision: `source` (`sirene`), `siren`, `status` (`found`, `not_found`, `unavailable`), nullable `legalCategoryCode`, and civil date `checkedAt`. Absent when no consultation was due, including historical responses. Typed as `TaxDecisionLegalCategory`; status and category code are open strings. |
| `issues` | Why the decision is not final: a missing fact and remedy for `pending_verification`, or the refusal for `unsupported`. Each entry has a stable `code` and optional `detailCode`, `reference` and `lineId`. Empty on `final`. |
| `notices` | What the decision retained and what the seller can do next, whatever its status. Always present, empty when there is nothing to report. Show them to the seller; act only on `final`. |
| `customer.retainedVatNumber` | The VAT number the decision retained — the only one the document and its electronic invoice carry. `customer.vatNumber` stays the number as declared. |
| `obligationReasons` | Why each axis carries the obligation it does. |
| `expiresAt` / `expired` | Past this instant the decision no longer opens a payment. |

`create()` requires an `Idempotency-Key` (255 characters at most; the SDK checks
it before sending). The API answers `201` on creation and `200` when the same
key already produced that decision — both return the decision, so your code
reads one shape either way. Reusing the same key with a different body answers
`409` and raises `ConflictError`.

Facturino decides **French VAT, Saint-Martin TGCA and the matching French obligations**. It does
not provide worldwide tax compliance: when a foreign tax may apply, the decision
says so through `foreignTaxReviewRequired`. An operation whose `invoiceChannel`
is `none` is not deposited on a certified platform — its obligation, if any,
goes through e-reporting.

### Notices: what a decision retained

Always act only on a `final` decision, and read its `notices` too. A notice is
information about the result and the seller's next steps. It never stands for a
missing fact. Examples include a consumer territory established by two
concordant items of different kinds, or because every possible territory gives
the same complete tax result; a VAT number set aside because national
registration establishes status; destination VAT invoiced with guidance on
registration (`destination_mechanism_missing`); and unmodelled local taxes the
integrator assumes under the `integration` source. `issues` alone says what
keeps the decision from being final.

```typescript
if (decision.status === 'final') {
  for (const notice of decision.notices) {
    // `code` is stable; `detailCode`, `reference` and `lineId` are optional.
    console.log(notice.code, notice.detailCode, notice.message, notice.lineId)
  }
}
```

Codes and `detailCode` values are open strings: treat an unknown notice code as
a generic notice. Invoices and credit notes freeze the notices of their decision
in `taxSnapshot.notices`;
a credit note repeats those of the invoice it credits.

### Buyer status and legal presumptions

Customers accept an optional `taxStatus` (`taxable` or `non_taxable`) on creation
and update, and return it when present. A business buyer whose status is not
evidenced stays pending; Facturino never supplies a missing fact. On
`business_status_not_evidenced`, `detailCode: tax_status_not_declared` means
INSEE legal category 7, 8 or 9 (association, public body, foundation) without
`taxStatus`; declare that status. `detailCode: legal_category_unresolved` means
SIRENE could not give the category; complete the buyer's legal-form data or
declare `taxStatus`. The consultation, when due, is frozen in `legalCategory`.

The only legal presumption is art. 18(2), second subparagraph, of Implementing
Regulation (EU) 282/2011. It covers telecommunications, broadcasting and
electronically supplied services to a buyer established in the EU VAT territory
(Monaco included) who communicated no VAT number. Within that scope, the buyer
is treated as a non-taxable person, with a notice and
`customer.natureBasis: declared_business_not_evidenced`. A communicated but
unvalidated number leaves `eu_b2b_vat_number_not_validated` pending. Categories
7, 8 and 9 without `taxStatus` keep their refusal.

`customer.natureBasis: declared_non_taxable` means the customer declared
`taxStatus: non_taxable`. If that customer is a legal person carrying a VAT
number, VIES is consulted: a valid number makes its services follow
taxable-person rules (CGI art. 259-0); an unreachable VIES leaves its services
pending (`vies_unavailable`). `natureBasis` stays an open string.

### Optional local-tax fields

The decision's `sellerProfile` may carry
`localTaxRegistrations`: each entry has a `territory` (`MF` today), a `reference`,
an `effectiveFrom` civil date (`YYYY-MM-DD`) and an `effectiveTo` civil date or
`null` for an open-ended registration.

Under either decision source, a request line may carry `localTaxExemption`
(`cgism_253` or `not_used_in_saint_martin` today). Decided lines and invoice
`items` may return `localTax`: `code` (`tgca_mf` today), `rateCentipercent`
(integer, 400 = 4%), `amount` (integer cents), `reference` and `exemption`
(a string or `null`). Decision and invoice totals may return `totalLocalTax`
in integer cents, separately from `totalVAT`. Under both sources, a registration
in force gives 4% TGCA on services subject to Saint-Martin TGCA. A declared
exemption gives 0 with the mention. Without either, the decision is
`pending_verification` with `com_taaf_supplier_local_tax_liable`. Local tax is
included in line totals, `totalTTC`, `amountToCharge` and the invoice's
`amountDue`; TGCA is separate from French VAT.

All these additions are optional; older responses may omit them. Local-tax
codes, territories and exemption reasons are open strings: accept future
values as well as today's documented ones. The API contract date stays
2026-09-01.

### Missing evidence, then a retry

Every missing fact leaves the decision `pending_verification`, without amounts,
with an issue naming the fact and its remedy. This includes unevidenced buyer
status (`business_status_not_evidenced`, `eu_b2b_vat_number_not_validated`,
`non_eu_business_status_not_evidenced`), VIES unreachable (`vies_unavailable`),
insufficient or contradictory location evidence (`location_evidence_insufficient`,
`location_evidence_contradictory`, `location_evidence_relief_undetermined`), an
undeclared threshold (`eu_threshold_state_missing`) and unknown goods movement
(`goods_movement_unknown`). An EU address without the postal code needed to
distinguish VAT territories is refused under both sources
(`destination_regional_scope_undetermined`); supply the postal code.

Supply the missing facts and retry the SAME operation:

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

A case the engine does not model is `unsupported` under `facturino`. The
unmodelled overseas taxes and EU special territories described below stay open
under `integration`: the decision is `final`, with a notice carrying the same
code and `foreignTaxReviewRequired: true`; the integrator declares and assumes
the tax. The same applies to goods dispatched to another member state or XI for
a non-taxable legal person that communicated a VAT number
(`non_taxable_legal_person_goods_regime_not_modelled`).

Both sources refuse a document that mixes category `O` with any other category:
`unsupported`, `vat_category_o_split_required` (EN 16931 BR-O-11 to BR-O-14).
Issue two documents. An `unsupported` decision explains the refusal; only a
`final` decision authorises invoicing or collection.

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

### What this source is not

`vatRate`, `vatCode` and `vatexCode` describe **French VAT**. Saint-Martin TGCA
is decided separately in `localTax` under both sources. For unmodelled local
taxes or withholding, `integration` leaves the tax declaration and responsibility
to the integrator, with a notice and `foreignTaxReviewRequired: true`.

### Overseas collectivities and the TAAF

Saint-Pierre-et-Miquelon (`PM`), Saint-Barthélemy (`BL`), Saint-Martin (`MF`),
French Polynesia (`PF`), New Caledonia (`NC`), Wallis-and-Futuna (`WF`) and the
TAAF (`TF`) are not part of France for VAT (CGI art. 256-0). Each legislates its
own indirect taxation, and no answer is deduced from a neighbour.

**Buyer established in one of the seven.** For an operation *located* in the
collectivity, French VAT is out of scope: the line is category `O` at 0. Cases
settled by a collectivity's text stay `final` under both sources: New Caledonia
where the taxable buyer accounts for the tax (art. Lp. 507-1), Saint-Barthélemy,
Saint-Pierre-et-Miquelon, and goods shipped to Saint-Martin.

Unmodelled local taxes are `unsupported` under `facturino`. Under `integration`
they stay `final`, with a notice carrying the same code and
`foreignTaxReviewRequired: true`; the integrator declares and assumes the tax.

| Issue under `facturino`, notice under `integration` | When |
| --- | --- |
| `com_taaf_local_tax_not_determined` | Non-taxable buyer (electronically supplied service to a consumer, CGI art. 259 D): a consumer self-assesses nothing, only the supplier could be called on to collect the collectivity's tax. |
| `com_taaf_local_regime_not_sourced` | Wallis-and-Futuna, TAAF: no official act held states who bears the tax. |
| `com_taaf_payment_withholding_not_modelled` | French Polynesia: the client withholds 10 % at source on the payment, and the service is taxed locally there. |

**Saint-Martin TGCA.** Under both sources, a seller registration in force gives
4% per line in `localTax`; a declared `localTaxExemption` (`cgism_253` or
`not_used_in_saint_martin`) gives 0 with the mention. Without either, the
decision is `pending_verification` with `com_taaf_supplier_local_tax_liable`.
`totals.totalLocalTax` is included in `totalTTC` and the amount to collect. TGCA
is invoiced separately from French VAT (CGIsm art. 252 and 258 to 264).

A general service to a consumer established in Saint-Martin without
`localTaxExemption` carries `com_taaf_local_regime_not_sourced` with
`detailCode: french_vat_and_tgca_cumulation`: `unsupported` under `facturino`,
`final` with a notice and `foreignTaxReviewRequired: true` under `integration`.
French VAT is due; the integrator assumes the unmodelled TGCA treatment.

**Seller established in one of the seven.** The decision is **not final**
(`unsupported`), with the *issue* `seller_com_taaf_local_tax_not_determined`: the
local tax of its collectivity decides what it invoices, and that is outside the
perimeter. This one is an issue, not a notice.

Under the `integration` source a positive French VAT rate on a
line located in a collectivity answers `422 integration_vat_incoherent`: only
category `O` at 0 (`VATEX-EU-O`) describes such a place, and a positive rate
would declare a local tax as French VAT. `placeOfSupply` is **required** on every
line as soon as the buyer is established in one of the seven — the place of the
operation is what says whether the local tax is at stake, and it is never assumed
(`422 integration_vat_incoherent` otherwise) — and it must be the place Facturino
decides. A place located in France follows the French VAT rules; the
Saint-Martin general-service case above still needs its local-tax treatment.

## B2C sales to consumers in other member states

An **electronically supplied service** to a consumer established in another
member state (Directive 2006/112/EC art. 58) and an **intra-EU distance sale** of
goods (art. 33(a)) follow one common regime. A **general** B2C service does not:
it stays taxed where the supplier is established (art. 45), and nothing below
concerns it.

Four questions are answered separately, in this order. Collapsing any two of them
produces a wrong rate:

1. is the operation covered by a destination rule;
2. does the common **EUR 10,000** threshold still allow taxation at origin
   (art. 59c(1));
3. did the seller **opt** for taxation at destination (art. 59c(3));
4. how is the tax due at destination **declared** — Union one-stop shop, or a
   local VAT registration in that member state?

The one-stop shop answers the **last** of the four: it is a way of declaring and
paying a tax, not a rule of place. Without it and without a local registration,
the tax due at destination is still due: it is invoiced exactly as with the
one-stop shop (same rate, same lines, same axes), and the notice
`destination_mechanism_missing` says how to register in time. It never falls back
on the seller's own national VAT.

That does not make the questions watertight in fact. For a **French** seller,
registering for the Union scheme is how the option of art. 59c(3) is exercised:
an **active** registration therefore settles the place at destination on its own,
and the threshold has nothing left to decide (`basis: "oss_union_registration"`,
`threshold: null`). The registration is dated — one opened in October decides
nothing for a September sale, and one that ended decides nothing any more. It is
sourced for France only: the way the option is exercised is fixed by the member
state where it is exercised, so a seller established elsewhere keeps the ordinary
threshold path and states its option explicitly.

The threshold is an **inclusive** cap of `1000000` centimes excluding VAT, open
only to a seller established in a **single** member state; the operation that
carries the running total past it is itself taxed at destination.

That running total lives in an **annual ledger** — `/v1/eu-threshold-ledgers`,
one per company, per mode and per calendar year — and NOT on the fiscal profile.
A profile revision is an immutable rule that decisions freeze; a turnover total
moves with every sale and gets corrected, so the two are kept apart. Facturino
keeps the register of the operations it receives; the sales made on your other
channels must be brought in by an adjustment, or by the opening declaration:

- **opening a year** declares four figures — the previous year's total and the
  total already made this year, each with its *services* part (see the two
  counters below) — plus the coverage mode: `facturino_only` (every covered sale
  goes through Facturino) or `mixed_channels`;
- **an adjustment** adds the turnover of another channel and moves forward the
  day those channels are declared complete through. Under `mixed_channels` a
  decision is served only up to that day.

**Two counters, strictly apart — and independent.** The same movements feed two
thresholds that do not measure the same thing: the common EUR 10,000 threshold
above, and the EUR 100,000 threshold of Reg. 282/2011 art. 24b that governs how
many items of location evidence are required. The second counts only telecom,
broadcasting and electronically supplied services, **domestic ones included**;
the first counts only **cross-border** supplies. A distance sale of goods raises
the first and never the second — and a domestic electronic service raises the
second and never the first.

Neither bounds the other, in either direction: a publisher selling mostly at home
legitimately declares far more on the evidence counter than on the common one.
That is why every figure comes in a pair (`amount` / `evidenceAmount`,
`acquiredMin` / `acquiredEvidenceMin`, …) rather than as a total and a share of
it, and why the single-evidence relaxation is **computed by the engine** on that
second counter rather than declared by the seller.

**Acquired and reserved are published apart, and never summed.** `acquiredMin`
is what the year has certainly made; `reservedMin` is the slices held right now
by operations still being decided. A held slice may still disappear, and one
combined "total" would hide exactly that.

Nothing is assumed: no year starts at zero on its own, and no sale made elsewhere
is presumed absent. A decision reserves its slice of the total in a transaction
and consumes it with the decision itself, so two concurrent operations never read
the same figure as certain and a replay counts nothing twice. A verdict is frozen
only when it holds at **both** bounds — with every concurrent slice counted and
with none of them — which is what makes an abandoned operation simply disappear
instead of staying in the total as turnover that never existed.

**Giving an amount back is a qualified correction, never a negative
adjustment.** Directive 2006/112/EC art. 90(1) reduces the taxable amount of a
supply on cancellation, refusal or a price reduction after the supply, and the
thresholds count the VALUE of the supplies — so a correction names the movement
it corrects, its qualification, the resource it rests on and its evidence.

A movement gives back what it brought in **once**, whatever the number of
corrections: the ledger keeps each movement's balance inside the same
transaction, and every entry publishes its `remainingMin`. `correctsEntryId` is
restricted to the ids the ledger itself mints — it reaches a document path, and
free text must not.

What cannot be qualified that way is not subtracted at all: the ledger goes
**under review** and stops deciding, rather than freeze verdicts on a total
nobody stands behind. A review is settled by **reconciliation**, never by a
comment: you state the version you checked and the two acquired totals you
verified, and only an exact agreement reopens the ledger.

**A decision is never frozen without its slice.** If the slice it held has
disappeared when the decision is about to be written, the transaction is
abandoned — no decision, no audit entry, no settled claim
(`409 eu_threshold_reservation_lost`) — and the ledger goes under review on a
path of its own, so the review survives that abandonment. Freezing a decision the
running total does not carry would leave the sale inside a decision and outside
the year the next operation reads.

Movements are paginated with a cursor (`limit`, `starting_after`): the ledger
keeps them all, a page shows some.

Missing threshold or location facts leave `pending_verification`, without
amounts. A missing postal code needed to distinguish VAT territories also
prevents a final decision under both sources.

| Issue code | Missing fact and remedy |
| --- | --- |
| `eu_threshold_state_missing` | The EUR 10,000 threshold is not declared. Open the year's ledger with the declared opening figures. |
| `destination_regional_scope_undetermined` | The EU address lacks the postal code needed to distinguish VAT territories. Supply it. |
| `location_evidence_insufficient`, `location_evidence_contradictory` | Supply sufficient location evidence to establish the consumer territory (art. 24b). |
| `location_evidence_relief_undetermined` | One third-party item is supplied and the single-evidence relief cannot be established (`evidenceRelief.status: undeterminable`). Complete the ledger's services figures or supply a second item of a different kind. |

A notice explains a retained result and what the seller can do next:

| Notice code | When |
| --- | --- |
| `destination_mechanism_missing` | Destination taxation is due with neither the Union scheme nor a local registration valid for that state on that date. The tax is invoiced; the notice's `detailCode` (`threshold_exceeded`, `destination_option` or `multi_member_state_establishment`) says which operation starts the registration period. Register with the one-stop shop by the 10th of the month that follows the first operation subject to the regime for it to apply from that operation (Implementing Regulation (EU) 282/2011 art. 57 quinquies), or register in the member state. |
| `location_evidence_contradictory` | The consumer territory is established by two concordant items of different kinds (`detailCode: concordant_evidence`), or every possible territory gives the same complete tax result (`detailCode: same_treatment`). The notice explains the retained territory. |

What follows keeps the decision **non final**, without an amount, once a
threshold is *declared*.

| Issue code | When |
| --- | --- |
| `eu_threshold_external_coverage_incomplete` | Other channels exist and are not declared complete through the operation date. Record an adjustment — even a zero one, which simply states that nothing happened. |
| `eu_threshold_backdated_operation` | The operation predates one already counted, and decisions were frozen on that running total. It is refused rather than silently recomputed. |
| `eu_threshold_concurrent_decision_pending` | Other operations of the company are being decided at this very moment, and the cap falls between "all of them confirmed" and "all abandoned". Nothing is frozen on that: decide again once they conclude. |
| `eu_threshold_review_required` | The ledger is under review — its running total is known to be wrong, and no verdict rests on it until the review is settled. |
| `destination_threshold_operation_value_missing` | A line value cannot be sized, so no slice of the total can be taken for it. |
| `destination_threshold_price_mode_ambiguous` | Tax-inclusive price: the VAT-exclusive value depends on the rate the threshold has to decide, and the bounds fall on both sides of the cap. |
| `destination_option_period_invalid` | The option is declared over less than its minimum binding period. |
| `destination_option_scope_not_sourced` | Seller established outside France: the binding period is fixed by the member state where the option is exercised, and only the French one is sourced here. |
| `destination_establishment_in_member_state` | The seller declares an establishment in the destination member state: which establishment supplies then decides both the place and the mechanism, and no fact of the contract names it. A local VAT registration alone is not an establishment. |
| `franchise_destination_taxation_not_modelled` | Seller under the French small-enterprise exemption whose operation is taxed by another member state. |

Rates come from a **local, dated, versioned registry**: no network call during a
decision, and a decision replayed years later reproduces the same rate. A rate
change is a new period, never a rewrite. Only the **standard** rate of the 27
member states is tabulated — the scope of the reduced rates follows a national
classification this contract does not hold, and an ordinary electronically
supplied service is never granted the rate an electronic publication may benefit
from (`destination_rate_band_not_available`). An effect date before the registry
answers `destination_rate_not_sourced_for_date`.

A **region publishing its own standard rate** never blocks a whole member state.
What governs the region decides the answer:

- **the rate follows the place of the operation.** The region is then a territory
  of its own and the address decides: Portugal mainland 23%, Madeira 22%, Azores
  16% (CIVA art. 18, CTT postal ranges). Without the postal code needed to
  distinguish the territories, the decision stays non-final under both sources
  (`destination_regional_scope_undetermined`); supply the postal code. No
  mainland rate is substituted;
- **the rate is reserved to operations carried out in the zone by a supplier
  established there.** A supplier at distance does not acquire it from the
  consumer's address, so the national rate is the final answer — and no postal
  cartography of the zone is needed to say so: Austrian Jungholz and
  Kleinwalsertal (§ 10(4) UStG — 20%, not 19%), and the Greek island regime FOR
  SERVICES, which AADE reserves to a supplier established on the island for an
  operation performed there. An electronically supplied service from France is
  therefore taxed at 24% in Greece, in Athens and in Kalymnos alike;
- **the rate follows the destination and the zone is not cartographied here.**
  Neither the regional rate nor the national one can be asserted, so the
  operation is refused: `destination_regional_regime_not_sourced`, non-final and
  without an amount. This is Greece FOR GOODS: since 2026-01-01 the islands of
  fewer than 20,000 inhabitants apply a reduced standard rate to the goods
  delivered there, intra-community acquisitions included, and the list of those
  islands is not cartographied by postal code here. An intra-EU distance sale of
  goods to Greece is therefore refused — in Athens as in Kalymnos — and never
  taxed at 24% by default. The answer is given per FAMILY of operation: the same
  member state can be settled for services and left open for goods.

### The annual ledger

```typescript
// Open the year — nothing starts at zero on its own.
await facturino.euThresholdLedgers.open({
  year: '2026',
  previousYearAmount: 250000,     // cents, VAT excluded
  currentYearOpening: 100000,
  coverageMode: 'mixed_channels', // other channels exist
  externalCompleteThroughDate: '2026-01-01',
})

// Bring in what was sold elsewhere. Append-only, idempotent on `reference`.
await facturino.euThresholdLedgers.adjust('2026', {
  reference: 'marketplace-2026-08',
  amount: 40000,
  externalCompleteThroughDate: '2026-09-15',
  reason: 'Marketplace sales, August',
})

const ledger = await facturino.euThresholdLedgers.retrieve('2026')
ledger.cumulativeMin  // total already acquired, in cents
ledger.remainingMin   // what is left before the cap
```

### The same rule under `taxSource: 'integration'`

An integration that concludes its own VAT does not get a different territoriality.
The `integration` source traverses the same coverage, the same threshold, the same
option, the same evidence and the same declarative mechanism; what differs is the
outcome. Where `facturino` **produces** the rate, `integration` **compares** the
one you supply to the legal result:

- equal — decision `final`;
- a category no B2C supply taxed at destination can carry (`AE`, `K`, `G`, `O`),
  or a `placeOfSupply` the rule contradicts — `422 integration_vat_incoherent`;
- a rate neither the destination **standard** rate nor the published bands of the
  seller's own territory confirm — non-final, with
  `eu_b2c_rate_supplied_mismatch`. Facturino holds only the standard rate of
  another member state, and only the bands it publishes for a French territory,
  so it can neither confirm a reduced rate nor correct yours. At origin that
  refusal asserts NO foreign tax: the operation is taxed in France;
- a missing fact — `pending_verification`, as under `facturino`, with the fact
  and remedy in `issues`.

The confrontation reaches BOTH places the rule can settle, and the territorial
frontier is shared too: a seller established outside the French VAT territory
raises under `integration` exactly the obstacle it raises under `facturino` (the
decision is `unsupported`). A buyer established in a territory excluded from the
EU VAT territory (the Canary Islands, Ceuta, Melilla, Åland…) gives
`eu_special_territory_not_implemented`: `unsupported` under `facturino`, `final`
under `integration` with a notice and `foreignTaxReviewRequired: true`. The
integrator declares and assumes the tax.

Because of this, `goodsMovement` is **required** on a goods line as soon as the
buyer is a consumer of another member state: that movement decides whether the
distance-sale rule applies, and it is never assumed.

### What the decision freezes

`TaxDecision.euB2cDestination` carries what the rule concluded, as data rather
than as a sentence — the verdict and its basis, the threshold figures it was
decided on, the declarative mechanism, and the rate entry with its registry
version, its source, its verification date, its period and its region. It is
present as soon as the rule covers a line — including on a decision that is NOT
final, where it states exactly what is missing — and `null` on every operation
the rule does not reach.

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

## Products and quote supply categories

Products store and return optional `kind` (`goods` or `service`) and
`supplyCategory`. `kind` classifies the document; `supplyCategory` declares its
fiscal nature: `goods`, `services`, `electronically_supplied_services`, `deposit`
or `ancillary_costs`. These categories are hints on an open string: accept
future values, and preserve absence on older products. Deposits and ancillary
costs follow the principal operation of the document; the decision line names
that operation through `relatedCategory`.

```typescript
const product = await facturino.products.create({
  name: 'Online subscription',
  unitPrice: 10000,
  vatRate: 2000,
  vatCode: 'S',
  unit: 'month',
  kind: 'service',
  supplyCategory: 'electronically_supplied_services',
})
await facturino.products.update(product.id, {
  reference: 'SUB-MONTH', category: 'subscriptions', active: true,
  tags: ['online'],
})
```

Product creation, update and read also expose optional `vatexCode`, using the
open `VatexCode` type. The API accepts the 88 official CIUS-FR codes and stores
legacy `VATEX-FR-261` / `VATEX-FR-AUTOLIQ` as `VATEX-FR-CGI261-4` /
`VATEX-FR-AE`; an older product may still carry its earlier spelling.

Quote create/update lines accept optional `kind` and `supplyCategory`. Quote
responses return `items[].supplyCategory`; conversion copies the declaration
unchanged into the commercial draft invoice, and an omission stays undeclared.
A quote's indicative VAT does not decide its fiscal category.

For a quote or draft service line with no declared `supplyCategory`, the engine
reads both `services` and `electronically_supplied_services`. If the complete
result is identical — VAT, category, mentions, local tax and all three obligation
axes — the decision is `final`, the line's `category` is `services`, and the
notice `supply_category_not_declared` explains the result. Otherwise it is
`pending_verification`, with issue `supply_category_not_declared`, no amounts and
`category: null` on that line. Declare its `supplyCategory` to resolve it. With
neither `kind` nor `supplyCategory`, no service reading is presumed: the line
stays pending. `kind: goods` can establish the `goods` category.

This applies to lines read from quotes and drafts. **Every line sent directly
to `POST /v1/tax-decisions` still requires `category`, under both sources.**
Historical decision lines keep their category. API contract date remains
2026-09-01.

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
- **Same key + different body** — `409 conflict`. A key belongs to a
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
