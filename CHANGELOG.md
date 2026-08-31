# Changelog

All notable changes to `@facturino/node` are documented here. This project
adheres to [Semantic Versioning](https://semver.org/) and
[Keep a Changelog](https://keepachangelog.com/).

## [2.0.0] - 2026-08-31

The first STABLE tax determination contract. Every invoice is born from an
immutable tax decision, under one of two equal fiscal sources.

### Added
- `taxDecisions` resource: `create()` and `retrieve()` on `POST /v1/tax-decisions`
  and `GET /v1/tax-decisions/{id}`. A decision fixes the VAT, the exact
  `amountToCharge` and the three reporting axes for one operation, then never
  changes. `get()` is available as an alias of `retrieve()`.
- Two fiscal sources, as a discriminated union on the REQUIRED `taxSource`
  param: `'facturino'` (the VAT is determined by Facturino) and `'integration'`
  (your own engine supplies `vatRate`, `vatCode` and `vatexCode` per line —
  validated for coherence, refused on any detectable contradiction, never
  silently corrected). Types: `FacturinoTaxDecisionCreateParams`,
  `IntegrationTaxDecisionCreateParams`, `IntegrationTaxDecisionLineParam`.
- Tax-decision types: `TaxDecision` (now carrying `taxSource`),
  `TaxDecisionLineParam`, `TaxDecisionStatus`, `PriceMode`, `SupplyCategory`,
  `RateCategory`, `GoodsMovement`, `TaxDecisionDiscount`, `ViesResult`,
  `LocationEvidenceParam`, `NonEuBusinessEvidenceParam` and their result
  counterparts, `InvoiceChannel`, `TransactionReporting`, `PaymentReporting`.
- `Invoice` and `CreditNote` expose the three status axes — `documentStatus`,
  `transmissionStatus`, `transmissionDetail`, `paymentStatus` — alongside
  `taxSource`, `taxDecisionId` and `taxSnapshot`. `status` is a derived
  one-word SUMMARY of the axes, never an authority of its own.
- `invoices.bindTaxDecision(id, { taxDecisionId, decisionLines })`:
  `POST /v1/invoices/{id}/bind-tax-decision`. Freezes a FINAL decision onto a
  commercial draft that already exists — the one `quotes.convert()` produced —
  so the quote cycle runs on ONE document: convert → decide → bind → finalize.
  The invoice stays a draft; `finalize()` issues it. Idempotent on the decision.
  Type: `InvoiceBindTaxDecisionParams`.
- `invoices.create()` accepts `deposits` and `schedule` alongside the decision:
  both are settled server-side against the decided amount, inside the creation
  transaction — the decided total never changes.

### Changed — BREAKING
- `invoices.create()` REQUIRES `taxDecisionId` + `decisionLines`. The direct
  `lines` contract is removed: an invoice's VAT always comes from its decision.
- `taxDecisions.create()` REQUIRES `taxSource` (`'facturino' | 'integration'`).
- `creditNotes.create()` / `.update()` take `creditedLines` only; the `items`
  contract is removed. A credit note inherits the fiscal position — source,
  snapshot and lines — of the invoice it corrects.
- `recurringInvoices.create()` REQUIRES `taxInputs` (with its `taxSource`);
  `templateInvoice.items` is removed. Every occurrence takes a NEW decision on
  its own effective date, under the recurrence's single fiscal source.
- `invoices.update()` patches non-fiscal fields only (`dates`, `payment`,
  `notes`, `purchaseOrderNumber`, `metadata`): the fiscal content of a draft is
  frozen by its decision.
- `TaxSource` is `'facturino' | 'integration'` — the two equal journeys, and
  the only two. A commercial draft that has not been decided yet reads
  `taxSource: null`: it states the operation and no fiscal conclusion.
- The API serves the single stable contract date `2026-09-01`.

### Notes
- `taxDecisions.create()` requires a non-empty `idempotencyKey`, at most 255
  characters — the SDK checks the bound locally so an over-long key fails
  immediately instead of after a round trip. A decision is never created through
  a retry of a lost response: the same key replays the same decision.

## [1.2.0] - 2026-08-19

### Added
- `Company.vatRegime` and `CompanyUpdateParams.vatRegime` now accept
  `normal_quarterly` (réel normal under quarterly VAT returns — e-reporting
  transmitted monthly, before the 10th). Additive and backward-compatible;
  existing values are unaffected.

## [1.1.0] - 2026-08-05

### Added
- `PaymentMethod` now includes `paypal`. The API may add further payment method
  values over time; treat the type as extensible and tolerate unknown values.

## [1.0.0] - 2026-07-25 — Initial release
