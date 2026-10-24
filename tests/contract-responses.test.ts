import { afterEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import Facturino from '../src/index.js'

const resources = { invoice: 'Invoice', payment: 'Payment', customer: 'Customer', creditNote: 'CreditNote', taxDecision: 'TaxDecision', event: 'WebhookEvent' } as const
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
const fixture = (name: string) => JSON.parse(readFileSync(new URL(`./fixtures/contract/${name}.json`, import.meta.url), 'utf8'))
const diagnose = (source: string): string[] => {
  const virtualPath = fileURLToPath(new URL('./__contract_corpus__.ts', import.meta.url))
  const options: ts.CompilerOptions = { noEmit: true, strict: true, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.NodeNext, moduleResolution: ts.ModuleResolutionKind.NodeNext, skipLibCheck: true }
  const host = ts.createCompilerHost(options)
  const read = host.getSourceFile.bind(host)
  host.getSourceFile = (path, language, onError, create) => path === virtualPath ? ts.createSourceFile(path, source, ts.ScriptTarget.ES2022, true) : read(path, language, onError, create)
  const program = ts.createProgram([virtualPath], options, host)
  return ts.getPreEmitDiagnostics(program).map(d => ts.flattenDiagnosticMessageText(d.messageText, '\n'))
}
afterEach(() => vi.unstubAllGlobals())

describe('actual server response corpus', () => {
  it.each(Object.keys(resources))('deserializes %s through the resource', async name => {
    const body = fixture(name)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(body)))
    const client = new Facturino('fac_test_corpus')
    const calls: Record<string, () => Promise<unknown>> = {
      invoice: () => client.invoices.get(body.id),
      payment: () => client.payments.create(body.invoiceId, { amount: 50000, method: 'transfer', paidAt: body.paidAt }),
      customer: () => client.customers.get(body.id),
      creditNote: () => client.creditNotes.get(body.id),
      taxDecision: () => client.taxDecisions.get(body.id),
      event: () => client.events.get(body.id),
    }
    expect(await calls[name]()).toEqual(body)
  })

  it('type checks the concrete JSON values, not only a cast from JSON.parse', () => {
    const source = `import type { ${Object.values(resources).join(', ')}, TypedWebhookEvent } from '../src/index.js';\n`
      + Object.entries(resources).map(([name, type]) => `const ${name}: ${type} = ${JSON.stringify(fixture(name))};`).join('\n')
      + `\nconst legalCategoryDecision: TaxDecision = ${JSON.stringify(fixture('legal-category'))};`
      + `\nconst events: TypedWebhookEvent[] = ${JSON.stringify(fixture('events'))};\nvoid events;`
    expect(diagnose(source)).toEqual([])
  })

  it('accepts official CIUS-FR and future VATEX codes while rejecting non-string values', () => {
    const codes = [
      'VATEX-EU-AE', 'VATEX-EU-D', 'VATEX-EU-F', 'VATEX-EU-G', 'VATEX-EU-IC', 'VATEX-EU-O',
      'VATEX-FR-FRANCHISE', 'VATEX-FR-CNWVAT', 'VATEX-FR-AUTOLIQ', 'VATEX-FR-261',
      'VATEX-FR-CGI261-4', 'VATEX-FR-CGI261-7', 'VATEX-FR-CGI295', 'VATEX-EU-132-1I', 'VATEX-FR-AE',
      'VATEX-FUTURE-CODE',
    ]
    const invoice = fixture('invoice'), creditNote = fixture('creditNote')
    invoice.items[0].vatexCode = 'VATEX-FR-CGI261-4'
    creditNote.items[0].vatexCode = 'VATEX-EU-132-1I'
    const source = `import type { VatexCode, Invoice, CreditNote, InvoiceLineItemParam, VatBreakdown } from '../src/index.js';\n`
      + `const codes: VatexCode[] = ${JSON.stringify(codes)};\n`
      + `const fromApi: string = 'VATEX-FUTURE-CODE';\nconst future: VatexCode = fromApi;\n`
      + `const invoice: Invoice = ${JSON.stringify(invoice)};\n`
      + `const creditNote: CreditNote = ${JSON.stringify(creditNote)};\n`
      + `const line: InvoiceLineItemParam = { description: 'Training', quantity: '1', unit: 'hour', unitPrice: 10000, vatRate: 0, vatCode: 'E', vatexCode: 'VATEX-FR-CGI295' };\n`
      + `const breakdown: VatBreakdown = { rate: 0, code: 'E', vatexCode: 'VATEX-FR-CGI261-7', base: 10000, amount: 0 };\n`
      + `// @ts-expect-error VATEX codes must remain strings\nconst number: VatexCode = 1;\n`
      + `// @ts-expect-error VATEX codes must remain strings\nconst boolean: VatexCode = true;\n`
      + `// @ts-expect-error VATEX codes must remain strings\nconst nullable: VatexCode = null;\n`
      + `void [codes, future, invoice, creditNote, line, breakdown];`
    expect(diagnose(source)).toEqual([])
  })

  it('carries the retained-result fields in the corpus: notices, retained VAT number', () => {
    expect(fixture('taxDecision').notices).toEqual([])
    expect(fixture('taxDecision').customer).toHaveProperty('retainedVatNumber', null)
    expect(fixture('invoice').taxSnapshot.notices).toEqual([])
    expect(fixture('creditNote').taxSnapshot.notices).toEqual([])
  })

  describe('product and quote supply categories', () => {
    // SDK-only samples: the shared response corpus stays unchanged.
    const sample = () => JSON.parse(readFileSync(new URL('./fixtures/sdk/supply-category.json', import.meta.url), 'utf8'))
    const data = sample()
    const historicalProduct = () => {
      const { kind, supplyCategory, vatexCode, ...body } = data.product
      return body
    }
    const quote = (category: string | undefined) => {
      const body = sample().quote
      if (category === undefined) delete body.items[0].supplyCategory
      else body.items[0].supplyCategory = category
      return body
    }
    const converted = (category: string | undefined) => {
      const body = fixture('invoice'), source = quote(category)
      delete body.taxDecisionId
      delete body.taxSnapshot
      return {
        ...body, taxSource: null, customer: source.customer, items: source.items, totals: source.totals,
        commercialDraft: {
          priceMode: 'tax_exclusive', totalCents: 10000,
          lines: [{ ...data.draftLine, ...(category === undefined ? {} : { supplyCategory: category }) }],
        },
      }
    }
    const decision = (pending: boolean) => {
      const body = fixture('taxDecision')
      if (!pending) return { ...body, notices: [data.notice] }
      return {
        ...body, status: 'pending_verification', lines: [data.pendingLine],
        customer: { ...body.customer, nature: 'consumer', natureBasis: 'declared_consumer', territoryId: 'DE', declaredCountry: 'DE', declaredPostalCode: '10115', legalRegistrationId: null },
        totals: null, amountToCharge: null, vatBreakdown: [],
        invoiceChannel: null, transactionReporting: null, paymentReporting: null,
        issues: [data.issue], notices: [],
      }
    }

    it('type checks product writes, quote lines, future categories and historical omissions', () => {
      const products = data.categories.map((supplyCategory: string) => ({ ...data.productCreate, kind: supplyCategory === 'goods' ? 'goods' : 'service', supplyCategory }))
      const lines = data.categories.map((supplyCategory: string) => ({ ...data.quoteLineInput, supplyCategory }))
      const source = `import type { Product, ProductCreateParams, ProductUpdateParams, Quote, QuoteCreateParams, QuoteUpdateParams, InvoiceLineItemParam, Invoice } from '../src/index.js';\n`
        + `const product: Product = ${JSON.stringify(data.product)};\n`
        + `const historical: Product = ${JSON.stringify(historicalProduct())};\n`
        + `const creates: ProductCreateParams[] = ${JSON.stringify(products)};\n`
        + `const oldCreate: ProductCreateParams = { name: 'Historical', unitPrice: 10000, vatRate: 2000, vatCode: 'S', unit: 'unit' };\n`
        + `const updates: ProductUpdateParams[] = [${JSON.stringify(data.productUpdate)}, {}, { kind: 'goods', supplyCategory: 'future_supply_category', vatexCode: 'VATEX-FUTURE-CODE', tags: [] }];\n`
        + `const futureProduct: Product = { ...product, kind: 'goods', supplyCategory: 'future_supply_category', vatexCode: 'VATEX-FUTURE-CODE' };\n`
        + `const quote: Quote = ${JSON.stringify(data.quote)};\n`
        + `const oldQuote: Quote = ${JSON.stringify(quote(undefined))};\n`
        + `const lines: InvoiceLineItemParam[] = ${JSON.stringify(lines)};\n`
        + `const oldLine: InvoiceLineItemParam = { description: 'Historical', quantity: '1', unit: 'unit', unitPrice: 10000, vatRate: 2000, vatCode: 'S' };\n`
        + `const createQuote: QuoteCreateParams = { customerId: 'cus_supply_sdk', lines };\n`
        + `const updateQuote: QuoteUpdateParams = { lines };\n`
        + [undefined, 'electronically_supplied_services', 'future_supply_category'].map((category, i) => `const draft${i}: Invoice = ${JSON.stringify(converted(category))};\n`).join('')
        + `const kind: 'goods' | 'service' | undefined = product.kind;\n`
        + `const category: string | undefined = quote.items[0].supplyCategory;\n`
        + `void [historical, creates, oldCreate, updates, futureProduct, oldQuote, oldLine, createQuote, updateQuote, kind, category];`
      expect(diagnose(source)).toEqual([])
    })

    it('type checks pending null categories and final service-category notices', () => {
      const source = `import type { TaxDecision, TaxDecisionLine, TaxDecisionIssue, TaxDecisionNotice } from '../src/index.js';\n`
        + `const pending: TaxDecision = ${JSON.stringify(decision(true))};\n`
        + `const final: TaxDecision = ${JSON.stringify(decision(false))};\n`
        + `const historical: TaxDecision = ${JSON.stringify(fixture('taxDecision'))};\n`
        + `const line: TaxDecisionLine = ${JSON.stringify(data.pendingLine)};\n`
        + `const issue: TaxDecisionIssue = ${JSON.stringify(data.issue)};\n`
        + `const notice: TaxDecisionNotice = ${JSON.stringify(data.notice)};\n`
        + `void [pending, final, historical, line, issue, notice];`
      expect(diagnose(source)).toEqual([])
    })

    it('keeps direct decision input categories required and rejects malformed optional fields', () => {
      const common = { reference: 'line-1', description: 'Service', unitAmount: 10000, quantity: '1' }
      const facturino = { ...common, rateCategory: 'standard' }
      const integration = { ...common, vatRate: 0, vatCode: 'O' }
      const { category, ...missingCategory } = data.pendingLine
      const invalid = [
        ['TaxDecisionLineParam', facturino], ['TaxDecisionLineParam', { ...facturino, category: null }],
        ['IntegrationTaxDecisionLineParam', integration], ['IntegrationTaxDecisionLineParam', { ...integration, category: null }],
        ['TaxDecisionLine', missingCategory],
        ["Product['supplyCategory']", 1], ["ProductCreateParams['supplyCategory']", 1], ["ProductUpdateParams['supplyCategory']", null],
        ["LineItem['supplyCategory']", 1], ["InvoiceLineItemParam['supplyCategory']", 1],
        ["Product['kind']", 'services'], ["ProductCreateParams['kind']", false], ["ProductUpdateParams['tags']", 'tag'],
        ["ProductCreateParams['vatexCode']", 1],
      ]
      const source = `import type { Product, ProductCreateParams, ProductUpdateParams, LineItem, InvoiceLineItemParam, TaxDecisionLineParam, IntegrationTaxDecisionLineParam, TaxDecisionLine } from '../src/index.js';\n`
        + invalid.map(([type, value], i) => `// @ts-expect-error Invalid contract value must be rejected\nconst invalid${i}: ${type} = ${JSON.stringify(value)};\n`).join('')
      expect(diagnose(source)).toEqual([])
    })

    it('serializes and reads product kind, fiscal category, VATEX and update fields', async () => {
      const updated = { ...data.product, ...data.productUpdate }
      const request = vi.fn()
        .mockResolvedValueOnce(response(data.product, 201))
        .mockResolvedValueOnce(response(updated))
        .mockResolvedValueOnce(response(updated))
      vi.stubGlobal('fetch', request)
      const client = new Facturino('fac_test_sdk')
      expect(await client.products.create(data.productCreate)).toEqual(data.product)
      expect(await client.products.update(data.product.id, data.productUpdate)).toEqual(updated)
      expect(await client.products.get(data.product.id)).toEqual(updated)
      expect(request.mock.calls[0][0]).toContain('/v1/products')
      expect(request.mock.calls[0][1].method).toBe('POST')
      expect(JSON.parse(request.mock.calls[0][1].body)).toEqual(data.productCreate)
      expect(request.mock.calls[1][0]).toContain(`/v1/products/${data.product.id}`)
      expect(request.mock.calls[1][1].method).toBe('PATCH')
      expect(JSON.parse(request.mock.calls[1][1].body)).toEqual(data.productUpdate)
    })

    it.each(['goods', 'future_supply_category'])('preserves product supplyCategory %s and future VATEX strings', async supplyCategory => {
      const input = { ...data.productCreate, kind: supplyCategory === 'goods' ? 'goods' : 'service', supplyCategory, vatexCode: 'VATEX-FUTURE-CODE' }
      const body = { ...data.product, ...input }
      const request = vi.fn().mockResolvedValue(response(body, 201))
      vi.stubGlobal('fetch', request)
      expect(await new Facturino('fac_test_sdk').products.create(input)).toEqual(body)
      expect(JSON.parse(request.mock.calls[0][1].body)).toEqual(input)
    })

    it('serializes quote creation and update and reads declared categories', async () => {
      const input = { customerId: data.quote.customer.ref, lines: [data.quoteLineInput] }
      const update = { lines: [{ ...data.quoteLineInput, supplyCategory: 'services' }] }
      const updated = quote('services')
      const request = vi.fn()
        .mockResolvedValueOnce(response(data.quote, 201))
        .mockResolvedValueOnce(response(updated))
        .mockResolvedValueOnce(response(updated))
      vi.stubGlobal('fetch', request)
      const client = new Facturino('fac_test_sdk')
      expect(await client.quotes.create(input)).toEqual(data.quote)
      expect(await client.quotes.update(data.quote.id, update)).toEqual(updated)
      expect(await client.quotes.get(data.quote.id)).toEqual(updated)
      expect(request.mock.calls[0][0]).toContain('/v1/quotes')
      expect(request.mock.calls[0][1].method).toBe('POST')
      expect(JSON.parse(request.mock.calls[0][1].body)).toEqual(input)
      expect(request.mock.calls[1][0]).toContain(`/v1/quotes/${data.quote.id}`)
      expect(request.mock.calls[1][1].method).toBe('PATCH')
      expect(JSON.parse(request.mock.calls[1][1].body)).toEqual(update)
    })

    it.each([
      { label: 'declared', category: 'electronically_supplied_services' },
      { label: 'future', category: 'future_supply_category' },
      { label: 'undeclared', category: undefined },
    ])('reads $label supplyCategory unchanged on quote conversion', async ({ category }) => {
      const body = converted(category)
      const request = vi.fn().mockResolvedValue(response(body))
      vi.stubGlobal('fetch', request)
      const result = await new Facturino('fac_test_sdk').quotes.convert(data.quote.id)
      expect(result).toEqual(body)
      if (category === undefined) {
        expect(result.items[0]).not.toHaveProperty('supplyCategory')
        expect(result.commercialDraft?.lines[0]).not.toHaveProperty('supplyCategory')
      } else {
        expect(result.items[0].supplyCategory).toBe(category)
        expect(result.commercialDraft?.lines[0].supplyCategory).toBe(category)
      }
      expect(request.mock.calls[0][0]).toContain(`/v1/quotes/${data.quote.id}/convert`)
      expect(request.mock.calls[0][1].method).toBe('POST')
      expect(request.mock.calls[0][1].body).toBeUndefined()
    })

    it.each([false, true])('reads undeclared-category decisions with pending=%s', async pending => {
      const body = decision(pending)
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(body)))
      const result = await new Facturino('fac_test_sdk').taxDecisions.get(body.id)
      expect(result).toEqual(body)
      if (pending) {
        expect(result.status).toBe('pending_verification')
        expect(result.lines[0].category).toBeNull()
        expect(result.lines[0].amountHT).toBeNull()
        expect(result.lines[0].amountVAT).toBeNull()
        expect(result.lines[0].amountTTC).toBeNull()
        expect(result.totals).toBeNull()
        expect(result.amountToCharge).toBeNull()
        expect(result.issues).toEqual([data.issue])
        expect(result.notices).toEqual([])
      } else {
        expect(result.status).toBe('final')
        expect(result.lines[0].category).toBe('services')
        expect(result.amountToCharge).toBe(12000)
        expect(result.issues).toEqual([])
        expect(result.notices).toEqual([data.notice])
      }
    })

    it('reads historical product, quote and decision responses without inventing fields', async () => {
      const product = historicalProduct(), oldQuote = quote(undefined), oldDecision = fixture('taxDecision')
      vi.stubGlobal('fetch', vi.fn()
        .mockResolvedValueOnce(response(product))
        .mockResolvedValueOnce(response(oldQuote))
        .mockResolvedValueOnce(response(oldDecision)))
      const client = new Facturino('fac_test_sdk')
      const actualProduct = await client.products.get(product.id)
      const actualQuote = await client.quotes.get(oldQuote.id)
      const actualDecision = await client.taxDecisions.get(oldDecision.id)
      expect(actualProduct).toEqual(product)
      expect(actualProduct).not.toHaveProperty('kind')
      expect(actualProduct).not.toHaveProperty('supplyCategory')
      expect(actualProduct).not.toHaveProperty('vatexCode')
      expect(actualQuote).toEqual(oldQuote)
      expect(actualQuote.items[0]).not.toHaveProperty('supplyCategory')
      expect(actualDecision).toEqual(oldDecision)
      expect(actualDecision.lines[0].category).toBe('services')
    })

    it('omits undeclared optional fields when serializing historical product and quote writes', async () => {
      const { kind, supplyCategory, vatexCode, tags, ...productInput } = data.productCreate
      const { kind: lineKind, supplyCategory: lineCategory, ...lineInput } = data.quoteLineInput
      const quoteInput = { customerId: data.quote.customer.ref, lines: [lineInput] }
      const request = vi.fn()
        .mockResolvedValueOnce(response(historicalProduct(), 201))
        .mockResolvedValueOnce(response(quote(undefined), 201))
      vi.stubGlobal('fetch', request)
      const client = new Facturino('fac_test_sdk')
      await client.products.create(productInput)
      await client.quotes.create(quoteInput)
      expect(JSON.parse(request.mock.calls[0][1].body)).toEqual(productInput)
      expect(JSON.parse(request.mock.calls[1][1].body)).toEqual(quoteInput)
    })
  })

  describe('what a decision retained', () => {
    const unevidenced = { code: 'business_status_not_evidenced', message: 'Electronically supplied services to an EU VAT territory buyer who communicated no VAT number: treated as a non-taxable person.', reference: 'Implementing Regulation (EU) 282/2011 art. 18(2), second subparagraph' }
    const mismatch = { code: 'vat_number_territory_mismatch', detailCode: 'vat_number_ignored_national_registration', message: 'The VAT number was set aside: the national registration establishes the business status.', lineId: 'line-1' }
    const issue = { code: 'business_status_not_evidenced', detailCode: 'einvoicing_buyer_registration_required', message: 'The buyer SIRET is required for the electronic invoice.', reference: 'CGI art. 242 nonies A', lineId: 'line-1' }
    const decide = (customer: object, notices: object[]) => { const body = fixture('taxDecision'); return { ...body, customer: { ...body.customer, ...customer }, notices } }
    // The art. 18(2) presumption requires no communicated VAT number and TBE services.
    const decision = () => {
      const body = decide({ nature: 'consumer', natureBasis: 'declared_business_not_evidenced', vatNumber: null, retainedVatNumber: null }, [unevidenced])
      return { ...body, lines: body.lines.map((line: object) => ({ ...line, category: 'electronically_supplied_services', effectiveCategory: 'electronically_supplied_services' })) }
    }
    const retained = () => decide({ nature: 'business', natureBasis: 'declared_business_with_registration', vatNumber: 'DE811128135', retainedVatNumber: null }, [mismatch])
    const pendingDecision = (issues: object[]) => ({
      ...decide({ nature: 'business', natureBasis: 'declared_business_without_identification', legalRegistrationId: null }, []),
      status: 'pending_verification', totals: null, amountToCharge: null, issues,
    })
    const invoice = () => { const body = fixture('invoice'); return { ...body, taxSnapshot: { ...body.taxSnapshot, notices: [unevidenced, mismatch] } } }
    const creditNote = () => { const body = fixture('creditNote'); return { ...body, taxSnapshot: { ...body.taxSnapshot, notices: [unevidenced] } } }

    it('type checks a final decision that carries notices, and the documents that freeze them', () => {
      const pending = pendingDecision([issue])
      const source = `import type { TaxDecision, TaxDecisionNotice, TaxDecisionIssue, Invoice, CreditNote, EuThresholdLedgerEntry, IntegrationTaxDecisionLineParam } from '../src/index.js';\n`
        + `const decision: TaxDecision = ${JSON.stringify(decision())};\n`
        + `const retained: TaxDecision = ${JSON.stringify(retained())};\n`
        + `const pending: TaxDecision = ${JSON.stringify(pending)};\n`
        + `const invoice: Invoice = ${JSON.stringify(invoice())};\n`
        + `const creditNote: CreditNote = ${JSON.stringify(creditNote())};\n`
        + `const notices: TaxDecisionNotice[] = [...decision.notices, ...(invoice.taxSnapshot?.notices ?? []), ...(creditNote.taxSnapshot?.notices ?? [])];\n`
        + `const detail: string | undefined = pending.issues[0].detailCode;\n`
        + `const issue: TaxDecisionIssue = { code: 'x', message: 'm', detailCode: 'd', reference: 'r', lineId: 'l' };\n`
        + `const number: string | null | undefined = retained.customer.retainedVatNumber;\n`
        + `const revoked: EuThresholdLedgerEntry['kind'] = 'reservation_released';\n`
        + `const line: IntegrationTaxDecisionLineParam = { reference: 'l', description: 'd', category: 'services', unitAmount: 1, quantity: '1', vatRate: 2000, vatCode: 'S', placeOfSupplyRule: 'general', placeOfSupply: 'FR-MET' };\n`
        + `void [notices, detail, issue, number, revoked, line];`
      expect(diagnose(source)).toEqual([])
    })

    it('keeps the published ledger kinds closed: a revocation reads as a release', () => {
      const source = `import type { EuThresholdLedgerEntry } from '../src/index.js';\nconst kind: EuThresholdLedgerEntry['kind'] = 'reservation_revoked';\nvoid kind;`
      expect(diagnose(source)).not.toEqual([])
    })

    it('rejects a notice of the wrong shape, so the check above is not vacuous', () => {
      const source = `import type { TaxDecisionNotice } from '../src/index.js';\nconst bad: TaxDecisionNotice = { code: 'x', message: 'm', lineId: 1 };\nvoid bad;`
      expect(diagnose(source)).not.toEqual([])
    })

    it('hydrates notices, the retained VAT number and the issue detail through the resources', async () => {
      const client = new Facturino('fac_test_corpus')
      const pending = pendingDecision([issue])
      vi.stubGlobal('fetch', vi.fn()
        .mockResolvedValueOnce(response(decision()))
        .mockResolvedValueOnce(response(retained()))
        .mockResolvedValueOnce(response(pending))
        .mockResolvedValueOnce(response(invoice()))
        .mockResolvedValueOnce(response(creditNote())))

      // A FINAL decision carries a notice: act on it, and show the notice to the seller.
      const final = await client.taxDecisions.get('taxdec_c6_fixture')
      expect(final.status).toBe('final')
      expect(final.notices).toEqual([unevidenced])
      expect(final.notices[0].lineId).toBeUndefined()
      expect(final.customer.natureBasis).toBe('declared_business_not_evidenced')
      expect(final.customer.vatNumber).toBeNull()
      expect(final.customer.retainedVatNumber).toBeNull()

      const kept = await client.taxDecisions.get('taxdec_c6_fixture')
      expect(kept.notices[0].detailCode).toBe('vat_number_ignored_national_registration')
      expect(kept.notices[0].lineId).toBe('line-1')
      expect(kept.customer.vatNumber).toBe('DE811128135')
      expect(kept.customer.retainedVatNumber).toBeNull()

      const blocked = await client.taxDecisions.get('taxdec_c6_fixture')
      expect(blocked.issues[0]).toEqual(issue)
      expect(blocked.issues[0].detailCode).toBe('einvoicing_buyer_registration_required')

      expect((await client.invoices.get('inv_c6_fixture')).taxSnapshot?.notices).toEqual([unevidenced, mismatch])
      expect((await client.creditNotes.get('crn_c6_fixture')).taxSnapshot?.notices).toEqual([unevidenced])
    })
  })

  describe('optional legal-category consultation', () => {
    it('types every field, nullable codes, open values and historical omissions', () => {
      const source = `import type { TaxDecision, TaxDecisionLegalCategory, TaxDecisionIssue, TaxDecisionNotice, TaxDecisionCustomer } from '../src/index.js';\n`
        + `const decision: TaxDecision = ${JSON.stringify(fixture('legal-category'))};\n`
        + `const historical: TaxDecision = ${JSON.stringify(fixture('taxDecision'))};\n`
        + `const optional: TaxDecisionLegalCategory | undefined = historical.legalCategory;\n`
        + `const consultation: TaxDecisionLegalCategory = decision.legalCategory!;\n`
        + `const source: 'sirene' = consultation.source;\n`
        + `const siren: string = consultation.siren;\n`
        + `const status: string = consultation.status;\n`
        + `const code: string | null = consultation.legalCategoryCode;\n`
        + `const checkedAt: string = consultation.checkedAt;\n`
        + `const outcomes: TaxDecisionLegalCategory[] = ['not_found', 'unavailable', 'future_status'].map(status => ({ ...consultation, status, legalCategoryCode: null }));\n`
        + `const future: TaxDecisionLegalCategory = { ...consultation, legalCategoryCode: 'future_category' };\n`
        + `const issue: TaxDecisionIssue = { code: 'future_code', detailCode: 'future_detail', message: 'Complete the named fact.' };\n`
        + `const notice: TaxDecisionNotice = { code: 'future_code', detailCode: 'future_detail', message: 'Retained result.' };\n`
        + `const nature: TaxDecisionCustomer['natureBasis'] = 'future_basis';\n`
        + `// @ts-expect-error The optional consultation is not nullable.\nconst absent: TaxDecision['legalCategory'] = null;\n`
        + `// @ts-expect-error The code accepts strings or null, never numbers.\nconst badCode: TaxDecisionLegalCategory = { ...consultation, legalCategoryCode: 5710 };\n`
        + `// @ts-expect-error Registry fields must be typed.\nconst badSiren: TaxDecisionLegalCategory = { ...consultation, siren: 123456789 };\n`
        + `void [optional, source, siren, status, code, checkedAt, outcomes, future, issue, notice, nature, absent, badCode, badSiren];`
      expect(diagnose(source)).toEqual([])
    })

    it('reads every frozen consultation field through the resource', async () => {
      const body = fixture('legal-category')
      const { legalCategory, ...original } = body
      expect(original).toEqual(fixture('taxDecision'))
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(body)))
      const decision = await new Facturino('fac_test_corpus').taxDecisions.get(body.id)
      expect(decision).toEqual(body)
      expect(decision.legalCategory).toEqual(legalCategory)
      expect(decision.legalCategory?.source).toBe('sirene')
      expect(decision.legalCategory?.siren).toBe('123456789')
      expect(decision.legalCategory?.status).toBe('found')
      expect(decision.legalCategory?.legalCategoryCode).toBe('5710')
      expect(decision.legalCategory?.checkedAt).toBe('2026-09-15')
    })

    it('reads historical decisions without inventing a consultation', async () => {
      const body = fixture('taxDecision')
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(body)))
      const decision = await new Facturino('fac_test_corpus').taxDecisions.get(body.id)
      expect(decision.legalCategory).toBeUndefined()
      expect(decision).not.toHaveProperty('legalCategory')
    })
  })

  describe('optional local-tax fields', () => {
    const local = fixture('local-tax')
    const customer = (taxStatus: string) => ({ ...fixture('customer'), taxStatus })
    const decision = (tax = local.tax, registration = local.registration) => {
      const body = fixture('taxDecision')
      return {
        ...body,
        sellerProfile: { ...body.sellerProfile, localTaxRegistrations: [registration] },
        lines: body.lines.map((line: object) => ({ ...line, localTax: tax })),
        totals: { ...body.totals, totalLocalTax: tax.amount, totalTTC: body.totals.totalTTC + tax.amount },
        amountToCharge: body.amountToCharge + tax.amount,
      }
    }
    const invoice = (tax = local.tax) => {
      const body = fixture('invoice')
      return {
        ...body,
        items: body.items.map((line: { lineTotal: number }) => ({ ...line, localTax: tax, lineTotal: line.lineTotal + tax.amount })),
        totals: { ...body.totals, totalLocalTax: tax.amount, totalTTC: body.totals.totalTTC + tax.amount, amountDue: body.totals.amountDue + tax.amount },
      }
    }
    const line = { reference: 'line-1', description: 'Service', category: 'services', rateCategory: 'standard', unitAmount: 10000, quantity: '1' }
    const integrationLine = { reference: 'line-1', description: 'Service', category: 'services', unitAmount: 10000, quantity: '1', vatRate: 0, vatCode: 'O', vatexCode: 'VATEX-EU-O', placeOfSupply: 'MF' }
    const params = { customerId: 'cus_c6_fixture', effectiveAt: '2026-09-15', currency: 'eur', priceMode: 'tax_exclusive' }

    it('type checks concrete responses, nullable registrations and future string values', () => {
      const source = `import type { Customer, TaxDecision, Invoice, LocalTax, LocalTaxRegistration, SellerTaxProfile } from '../src/index.js';\n`
        + `const customer: Customer = ${JSON.stringify(customer('taxable'))};\n`
        + `const nonTaxable: Customer = ${JSON.stringify(customer('non_taxable'))};\n`
        + [local.tax, local.exemptTax, local.futureTax].map((tax, i) =>
          `const decision${i}: TaxDecision = ${JSON.stringify(decision(tax, i === 2 ? local.futureRegistration : local.registration))};\n`
          + `const invoice${i}: Invoice = ${JSON.stringify(invoice(tax))};\n`).join('')
        + `const profile: SellerTaxProfile = decision0.sellerProfile;\n`
        + `const registrations: LocalTaxRegistration[] | undefined = profile.localTaxRegistrations;\n`
        + `const tax: LocalTax | undefined = decision0.lines[0].localTax;\n`
        + `const itemTax: LocalTax | undefined = invoice0.items[0].localTax;\n`
        + `const total: number | undefined = decision0.totals?.totalLocalTax;\n`
        + `const invoiceTotal: number | undefined = invoice0.totals.totalLocalTax;\n`
        + `const status: 'taxable' | 'non_taxable' | undefined = customer.taxStatus;\n`
        + `void [customer, nonTaxable, registrations, tax, itemTax, total, invoiceTotal, status];`
      expect(diagnose(source)).toEqual([])
    })

    it('type checks both creation sources and customer writes with or without the optional fields', () => {
      const customerParams = { name: 'Client', type: 'company', address: fixture('customer').address }
      const source = `import type { CustomerCreateParams, CustomerUpdateParams, TaxDecisionCreateParams, SellerTaxProfile } from '../src/index.js';\n`
        + `const customers: CustomerCreateParams[] = ${JSON.stringify([customerParams, ...['taxable', 'non_taxable'].map(taxStatus => ({ ...customerParams, taxStatus }))])};\n`
        + `const updates: CustomerUpdateParams[] = [{}, { taxStatus: 'taxable' }, { taxStatus: 'non_taxable' }];\n`
        + `const decisions: TaxDecisionCreateParams[] = ${JSON.stringify(['facturino', 'integration'].flatMap(taxSource => {
          const input = taxSource === 'facturino' ? line : integrationLine
          return [{ ...params, taxSource, lines: [input] }, ...local.exemptions.map((localTaxExemption: string) => ({ ...params, taxSource, lines: [{ ...input, localTaxExemption }] }))]
        }))};\n`
        + `const profiles: SellerTaxProfile[] = [{}, { localTaxRegistrations: [] }, { futureField: true }];\n`
        + `void [customers, updates, decisions, profiles];`
      expect(diagnose(source)).toEqual([])
    })

    it.each([
      ["Customer['taxStatus']", 'future_status'],
      ["CustomerCreateParams['taxStatus']", 'future_status'],
      ["CustomerUpdateParams['taxStatus']", 'future_status'],
      ["TaxDecisionLineParam['localTaxExemption']", 1],
      ["IntegrationTaxDecisionLineParam['localTaxExemption']", 1],
      ["LocalTax['code']", 1],
      ["LocalTax['rateCentipercent']", '400'],
      ["LocalTax['amount']", '400'],
      ["LocalTax['reference']", 1],
      ["LocalTax['exemption']", false],
      ["LocalTaxRegistration['territory']", 1],
      ["LocalTaxRegistration['reference']", 1],
      ["LocalTaxRegistration['effectiveFrom']", 1],
      ["LocalTaxRegistration['effectiveTo']", 1],
      ["SellerTaxProfile['localTaxRegistrations']", {}],
      ["Totals['totalLocalTax']", '400'],
      ["NonNullable<TaxDecision['totals']>['totalLocalTax']", '400'],
      ["LineItem['localTax']", { ...local.tax, amount: '400' }],
      ["TaxDecisionLine['localTax']", { ...local.tax, exemption: false }],
    ])('rejects an invalid value for %s', (type, value) => {
      const source = `import type { Customer, CustomerCreateParams, CustomerUpdateParams, TaxDecisionLineParam, IntegrationTaxDecisionLineParam, LocalTax, LocalTaxRegistration, SellerTaxProfile, Totals, TaxDecision, LineItem, TaxDecisionLine } from '../src/index.js';\n`
        + `const invalid: ${type} = ${JSON.stringify(value)};\nvoid invalid;`
      expect(diagnose(source)).not.toEqual([])
    })

    it.each(['taxable', 'non_taxable'] as const)('sends and reads customer taxStatus %s on create, update and retrieve', async taxStatus => {
      const body = customer(taxStatus)
      const request = vi.fn()
        .mockResolvedValueOnce(response(body, 201))
        .mockResolvedValueOnce(response(body))
        .mockResolvedValueOnce(response(body))
      vi.stubGlobal('fetch', request)
      const client = new Facturino('fac_test_corpus')
      const input = { name: body.name, type: 'individual' as const, address: body.address, taxStatus }
      expect(await client.customers.create(input)).toEqual(body)
      expect(await client.customers.update(body.id, { taxStatus })).toEqual(body)
      expect(await client.customers.get(body.id)).toEqual(body)
      expect(request.mock.calls[0][0]).toContain('/v1/customers')
      expect(request.mock.calls[0][1].method).toBe('POST')
      expect(JSON.parse(request.mock.calls[0][1].body)).toEqual(input)
      expect(request.mock.calls[1][0]).toContain(`/v1/customers/${body.id}`)
      expect(request.mock.calls[1][1].method).toBe('PATCH')
      expect(JSON.parse(request.mock.calls[1][1].body)).toEqual({ taxStatus })
    })

    it.each(['facturino', 'integration'] as const)('forwards all localTaxExemption strings with source %s', async taxSource => {
      const request = vi.fn().mockImplementation(() => Promise.resolve(response(decision(), 201)))
      vi.stubGlobal('fetch', request)
      const client = new Facturino('fac_test_corpus')
      for (const localTaxExemption of local.exemptions) {
        const common = { customerId: params.customerId, effectiveAt: params.effectiveAt, currency: params.currency, priceMode: 'tax_exclusive' as const }
        const input = taxSource === 'facturino'
          ? { ...common, taxSource, lines: [{ ...line, category: 'services' as const, rateCategory: 'standard' as const, localTaxExemption }] }
          : { ...common, taxSource, lines: [{ ...integrationLine, category: 'services' as const, vatCode: 'O' as const, localTaxExemption }] }
        const result = await client.taxDecisions.create(input, { idempotencyKey: `${taxSource}-${localTaxExemption}` })
        expect(result).toEqual(decision())
        const [url, init] = request.mock.calls.at(-1)!
        expect(url).toContain('/v1/tax-decisions')
        expect(init.method).toBe('POST')
        expect(JSON.parse(init.body)).toEqual(input)
      }
      expect(request).toHaveBeenCalledTimes(local.exemptions.length)
    })

    it.each(['tax', 'exemptTax', 'futureTax'])('reads %s, registrations and totals through decision and invoice resources', async name => {
      const tax = local[name]
      const registration = name === 'futureTax' ? local.futureRegistration : local.registration
      const decided = decision(tax, registration)
      const invoiced = invoice(tax)
      vi.stubGlobal('fetch', vi.fn()
        .mockResolvedValueOnce(response(decided))
        .mockResolvedValueOnce(response(invoiced)))
      const client = new Facturino('fac_test_corpus')
      const actualDecision = await client.taxDecisions.get(decided.id)
      const actualInvoice = await client.invoices.get(invoiced.id)
      expect(actualDecision).toEqual(decided)
      expect(actualDecision.sellerProfile.localTaxRegistrations).toEqual([registration])
      expect(actualDecision.lines[0].localTax).toEqual(tax)
      expect(actualDecision.totals?.totalLocalTax).toBe(tax.amount)
      expect(actualInvoice).toEqual(invoiced)
      expect(actualInvoice.items[0].localTax).toEqual(tax)
      expect(actualInvoice.totals.totalLocalTax).toBe(tax.amount)
    })

    it('preserves historical omissions without inventing defaults', async () => {
      const decided = fixture('taxDecision'), invoiced = fixture('invoice'), buyer = fixture('customer')
      vi.stubGlobal('fetch', vi.fn()
        .mockResolvedValueOnce(response(decided))
        .mockResolvedValueOnce(response(invoiced))
        .mockResolvedValueOnce(response(buyer)))
      const client = new Facturino('fac_test_corpus')
      const actualDecision = await client.taxDecisions.get(decided.id)
      const actualInvoice = await client.invoices.get(invoiced.id)
      const actualCustomer = await client.customers.get(buyer.id)
      expect(actualDecision.sellerProfile).not.toHaveProperty('localTaxRegistrations')
      expect(actualDecision.lines[0]).not.toHaveProperty('localTax')
      expect(actualDecision.totals).not.toHaveProperty('totalLocalTax')
      expect(actualInvoice.items[0]).not.toHaveProperty('localTax')
      expect(actualInvoice.totals).not.toHaveProperty('totalLocalTax')
      expect(actualCustomer).not.toHaveProperty('taxStatus')
    })
  })

  it('stops the iterator on a disappeared cursor instead of repeating the first page', async () => {
    const request = vi.fn()
      .mockResolvedValueOnce(response({ object: 'list', data: [{ id: 'inv_deleted' }], has_more: true, next_cursor: 'inv_deleted' }))
      .mockResolvedValueOnce(response({ error: { type: 'invalid_request_error', code: 'invalid_field_value', param: 'starting_after', message: 'Cursor no longer exists', request_id: 'req_cursor' } }, 400))
    vi.stubGlobal('fetch', request)
    const iterator = new Facturino('fac_test_corpus').invoices.list()[Symbol.asyncIterator]()
    expect((await iterator.next()).value.id).toBe('inv_deleted')
    await expect(iterator.next()).rejects.toMatchObject({ code: 'invalid_field_value', param: 'starting_after' })
    expect(request).toHaveBeenCalledTimes(2)
    expect(String(request.mock.calls[1][0])).toContain('starting_after=inv_deleted')
  })
})
