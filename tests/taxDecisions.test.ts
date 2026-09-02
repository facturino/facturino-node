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

const finalDecision = {
  id: 'taxdec_9c1f',
  object: 'tax_decision',
  status: 'final',
  customerId: 'cus_8f2k4m9n',
  currency: 'eur',
  priceMode: 'tax_exclusive',
  effectiveAt: '2026-09-15',
  expired: false,
  totals: { totalHT: 2900, totalVAT: 580, totalTTC: 3480 },
  amountToCharge: 3480,
  invoiceChannel: 'einvoicing',
  transactionReporting: 'none',
  paymentReporting: 'fr212',
  foreignTaxReviewRequired: false,
  vies: null,
  issues: [],
  retryOfTaxDecisionId: null,
}

const createParams = {
  customerId: 'cus_8f2k4m9n',
  effectiveAt: '2026-09-15',
  currency: 'eur',
  priceMode: 'tax_exclusive' as const,
  lines: [{
    reference: 'abo-pro',
    description: 'Abonnement Pro',
    category: 'electronically_supplied_services' as const,
    rateCategory: 'standard' as const,
    unitAmount: 2900,
    quantity: '1',
  }],
}

function lastRequest(): { url: string; init: RequestInit } {
  const [url, init] = mockFetch.mock.calls.at(-1) as [string, RequestInit]
  return { url, init }
}

describe('TaxDecisions resource', () => {
  let facturino: Facturino

  beforeEach(() => {
    mockFetch.mockReset()
    facturino = new Facturino('fac_test_abc123')
  })

  it('is exposed on the client', () => {
    expect(facturino.taxDecisions).toBeDefined()
    expect(typeof facturino.taxDecisions.create).toBe('function')
    expect(typeof facturino.taxDecisions.retrieve).toBe('function')
  })

  it('POSTs to /v1/tax-decisions with the exact body', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(201, finalDecision))

    const decision = await facturino.taxDecisions.create(createParams, { idempotencyKey: 'order-4711' })

    const { url, init } = lastRequest()
    expect(url).toBe('https://facturino.com/api/v1/tax-decisions')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body as string)).toEqual(createParams)
    expect(decision.amountToCharge).toBe(3480)
  })

  it('sends the Idempotency-Key header when one is given', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(201, finalDecision))

    await facturino.taxDecisions.create(createParams, { idempotencyKey: 'order-4711' })

    const headers = lastRequest().init.headers as Record<string, string>
    expect(headers['Idempotency-Key']).toBe('order-4711')
  })

  it('refuses an empty Idempotency-Key before any request', async () => {
    await expect(
      facturino.taxDecisions.create(createParams, { idempotencyKey: '   ' }),
    ).rejects.toThrow('Idempotency-Key is required')
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('refuses a key longer than the API accepts, without a round trip', async () => {
    await expect(
      facturino.taxDecisions.create(createParams, { idempotencyKey: 'k'.repeat(256) }),
    ).rejects.toThrow('at most 255 characters')
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('accepts a key of exactly the maximum length', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(201, finalDecision))
    await facturino.taxDecisions.create(createParams, { idempotencyKey: 'k'.repeat(255) })
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('sends the current dated contract version', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(201, finalDecision))
    await facturino.taxDecisions.create(createParams, { idempotencyKey: 'order-version' })
    const headers = lastRequest().init.headers as Record<string, string>
    expect(headers['Facturino-Version']).toBe('2026-09-01')
  })

  it('returns the decision on a 200 replay exactly as on a 201 creation', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(201, finalDecision))
    const created = await facturino.taxDecisions.create(createParams, { idempotencyKey: 'order-replay' })

    mockFetch.mockResolvedValueOnce(jsonResponse(200, finalDecision))
    const replayed = await facturino.taxDecisions.create(createParams, { idempotencyKey: 'order-replay' })

    expect(replayed).toEqual(created)
    expect(replayed.id).toBe(finalDecision.id)
  })

  it('surfaces a 409 as a ConflictError, and never as a decision', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(409, {
      error: {
        type: 'invalid_request_error',
        code: 'conflict',
        message: 'This Idempotency-Key was already used with a different request body.',
      },
    }))

    await expect(
      facturino.taxDecisions.create(
        { ...createParams, effectiveAt: '2026-09-16' },
        { idempotencyKey: 'order-replay' },
      ),
    ).rejects.toMatchObject({
      name: 'ConflictError',
      status: 409,
      code: 'conflict',
    })
    // A conflict is never retried: the key identifies one request.
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('keeps the same Idempotency-Key across transport retries', async () => {
    mockFetch
      .mockResolvedValueOnce(jsonResponse(503, { error: { message: 'unavailable' } }))
      .mockResolvedValueOnce(jsonResponse(201, finalDecision))

    await facturino.taxDecisions.create(createParams, { idempotencyKey: 'order-4711' })

    expect(mockFetch).toHaveBeenCalledTimes(2)
    // A retry that changed the key would take a SECOND decision instead of
    // replaying the first one.
    for (const call of mockFetch.mock.calls) {
      const headers = (call[1] as RequestInit).headers as Record<string, string>
      expect(headers['Idempotency-Key']).toBe('order-4711')
    }
  })

  it('keeps quantities as strings and amounts as integers on the wire', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(201, finalDecision))

    await facturino.taxDecisions.create({
      ...createParams,
      lines: [{
        ...createParams.lines[0],
        quantity: '2.500000',
        unitAmount: 2900,
        discount: { type: 'percent', value: 2500 },
      }],
    }, { idempotencyKey: 'order-quantity' })

    const body = JSON.parse(lastRequest().init.body as string)
    // A float quantity would not survive: 0.1 + 0.2 is not 0.3.
    expect(body.lines[0].quantity).toBe('2.500000')
    expect(typeof body.lines[0].quantity).toBe('string')
    expect(body.lines[0].unitAmount).toBe(2900)
    expect(Number.isInteger(body.lines[0].unitAmount)).toBe(true)
    // Centi-percent: 2500 is 25.00 %.
    expect(body.lines[0].discount).toEqual({ type: 'percent', value: 2500 })
  })

  it('serializes evidence in camelCase, with no raw signal', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(201, finalDecision))

    await facturino.taxDecisions.create({
      ...createParams,
      locationEvidence: [{
        kind: 'ip_geolocation',
        country: 'FR',
        postalCode: '75002',
        thirdParty: true,
        source: 'psp',
        collectedAt: '2026-09-15',
        reference: 'ch_3Kj9aLZ',
      }],
      nonEuBusinessEvidence: {
        kind: 'vat_or_similar_number',
        reference: 'CH-123456',
        issuedByCountry: 'CH',
        reasonableVerificationPerformed: true,
        collectedAt: '2026-09-15',
      },
    }, { idempotencyKey: 'order-evidence' })

    const body = JSON.parse(lastRequest().init.body as string)
    expect(body.locationEvidence[0].thirdParty).toBe(true)
    expect(body.nonEuBusinessEvidence.reasonableVerificationPerformed).toBe(true)
    // The territorial signal travels, never the raw one.
    const serialized = lastRequest().init.body as string
    for (const forbidden of ['"ip"', '"payload"', '"iban"', '"cardNumber"']) {
      expect(serialized).not.toContain(forbidden)
    }
  })

  it('GETs a decision by id', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(200, finalDecision))

    const decision = await facturino.taxDecisions.retrieve('taxdec_9c1f')

    const { url, init } = lastRequest()
    expect(url).toBe('https://facturino.com/api/v1/tax-decisions/taxdec_9c1f')
    expect(init.method).toBe('GET')
    expect(decision.id).toBe('taxdec_9c1f')
  })

  it('exposes get() as an alias of retrieve()', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(200, finalDecision))
    await facturino.taxDecisions.get('taxdec_9c1f')
    expect(lastRequest().url).toBe('https://facturino.com/api/v1/tax-decisions/taxdec_9c1f')
  })

  it('reports a non-final decision with null amounts', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(201, {
      ...finalDecision,
      status: 'pending_verification',
      totals: null,
      amountToCharge: null,
      invoiceChannel: null,
      transactionReporting: null,
      paymentReporting: null,
      settledObligations: {
        invoiceChannel: 'none', transactionReporting: 'ereporting', paymentReporting: null,
      },
      issues: [{ code: 'vies_unavailable', message: 'VIES is unreachable.' }],
    }))

    const decision = await facturino.taxDecisions.create(createParams, { idempotencyKey: 'order-pending' })

    expect(decision.status).toBe('pending_verification')
    // `null`, never `0`: absent is not "nothing to charge".
    expect(decision.amountToCharge).toBeNull()
    expect(decision.totals).toBeNull()
    expect(decision.issues[0].code).toBe('vies_unavailable')
    // The three document axes stay null — an axis is never read off a decision
    // that did not conclude — while what French law settled anyway is a VALUE.
    expect(decision.invoiceChannel).toBeNull()
    expect(decision.settledObligations).toEqual({
      invoiceChannel: 'none', transactionReporting: 'ereporting', paymentReporting: null,
    })
  })

  it('reads the EU B2C destination trace, rate entry included', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(201, {
      ...finalDecision,
      euB2cDestination: {
        coveredLineIds: ['line-1'],
        ruleKinds: ['tbe_services'],
        destinationMemberState: 'DE',
        destinationTerritoryId: 'DE',
        place: 'destination',
        basis: 'threshold_exceeded',
        reference: 'Directive 2006/112/CE art. 59 quater §1',
        detail: 'Declared previous-year total exceeds the cap',
        threshold: {
          decidedOn: 'ledger_cumulative',
          capCents: 1000000,
          stateId: '2026_test',
          year: '2026',
          stateVersion: 4,
          sequence: 7,
          reservationId: 'claim_1',
          coverageMode: 'mixed_channels',
          previousYearAmountCents: 0,
          currentYearOpeningCents: 100000,
          openingDeclaredAt: '2026-01-01',
          externalCompleteThroughDate: '2026-09-15',
          adjustmentTotalCents: 40000,
          adjustmentCount: 1,
          cumulativeBeforeMinCents: 140000,
          cumulativeBeforeMaxCents: 140000,
          operationValueMinCents: 2900,
          operationValueMaxCents: 2900,
          cumulativeAfterMinCents: 142900,
          cumulativeAfterMaxCents: 142900,
        },
        option: null,
        mechanism: { kind: 'oss_union', memberState: 'DE', reference: 'régime UE' },
        rate: {
          registryVersion: 'eu-standard-rates-2026-09-01',
          memberState: 'DE',
          territoryId: 'DE',
          regionId: null,
          centipercent: 1900,
          validFrom: '2026-09-01',
          validTo: null,
          source: 'Commission européenne',
          verifiedAt: '2026-09-01',
        },
      },
    }))

    const decision = await facturino.taxDecisions.create(createParams, { idempotencyKey: 'order-eu' })

    // The rate a document is taxed at must be auditable years later: version,
    // source and verification date travel with the decision, not in prose.
    expect(decision.euB2cDestination?.place).toBe('destination')
    expect(decision.euB2cDestination?.rate?.centipercent).toBe(1900)
    expect(decision.euB2cDestination?.rate?.registryVersion).toBe('eu-standard-rates-2026-09-01')
    expect(decision.euB2cDestination?.mechanism?.kind).toBe('oss_union')
    // The ledger the decision drew on, and the slice it took there.
    expect(decision.euB2cDestination?.threshold?.stateId).toBe('2026_test')
    expect(decision.euB2cDestination?.threshold?.sequence).toBe(7)
    expect(decision.euB2cDestination?.threshold?.cumulativeAfterMinCents).toBe(142900)
  })

  it('opens a threshold year, reads it back and adjusts it', async () => {
    const ledger = {
      object: 'eu_threshold_ledger',
      id: '2026_test',
      companyId: 'cmp_1',
      livemode: false,
      year: '2026',
      version: 1,
      status: 'open',
      review: null,
      capCents: 1000000,
      evidenceCapCents: 10000000,
      opening: {
        previousYearAmount: 250000,
        currentYearOpening: 100000,
        previousYearEvidenceAmount: 150000,
        currentYearEvidenceOpening: 60000,
        coverageMode: 'mixed_channels',
        externalCompleteThroughDate: '2026-01-01',
        declaredAt: '2026-01-01T09:00:00.000Z',
      },
      externalCompleteThroughDate: '2026-01-01',
      adjustmentTotal: 0,
      adjustmentEvidenceTotal: 0,
      adjustmentCount: 0,
      correctionTotal: 0,
      correctionEvidenceTotal: 0,
      correctionCount: 0,
      acquiredMin: 100000,
      acquiredMax: 100000,
      acquiredEvidenceMin: 60000,
      acquiredEvidenceMax: 60000,
      reservedMin: 0,
      reservedMax: 0,
      reservedEvidenceMin: 0,
      reservedEvidenceMax: 0,
      remainingMin: 900000,
      evidenceRemainingMin: 9940000,
      settledCount: 0,
      lastConsumedEffectiveAt: null,
      reservations: [],
      entries: [],
      entriesHasMore: false,
      entriesNextCursor: null,
      created: '2026-01-01T00:00:00.000Z',
      updated: '2026-01-01T00:00:00.000Z',
    }

    mockFetch.mockResolvedValueOnce(jsonResponse(201, ledger))
    const opened = await facturino.euThresholdLedgers.open({
      year: '2026',
      previousYearAmount: 250000,
      currentYearOpening: 100000,
      previousYearEvidenceAmount: 150000,
      currentYearEvidenceOpening: 60000,
      coverageMode: 'mixed_channels',
      externalCompleteThroughDate: '2026-01-01',
    })
    expect(lastRequest().url).toBe('https://facturino.com/api/v1/eu-threshold-ledgers')
    expect(opened.remainingMin).toBe(900000)
    // Acquired and reserved are published apart, and never summed: a held slice
    // may still disappear.
    expect(opened.acquiredMin).toBe(100000)
    expect(opened.reservedMax).toBe(0)
    // The second counter has its own cap and its own remainder.
    expect(opened.evidenceCapCents).toBe(10000000)
    expect(opened.evidenceRemainingMin).toBe(9940000)

    mockFetch.mockResolvedValueOnce(jsonResponse(200, ledger))
    await facturino.euThresholdLedgers.retrieve('2026')
    expect(lastRequest().url).toBe('https://facturino.com/api/v1/eu-threshold-ledgers/2026')

    mockFetch.mockResolvedValueOnce(jsonResponse(201, { ...ledger, adjustmentTotal: 40000 }))
    const adjusted = await facturino.euThresholdLedgers.adjust('2026', {
      reference: 'adj-marketplace-08',
      amount: 40000,
      evidenceAmount: 25000,
      externalCompleteThroughDate: '2026-09-15',
      reason: 'Marketplace sales, August',
    })
    expect(lastRequest().url)
      .toBe('https://facturino.com/api/v1/eu-threshold-ledgers/2026/adjustments')
    expect(adjusted.adjustmentTotal).toBe(40000)
  })

  it('walks the movements with a cursor rather than pretending to show them all', async () => {
    const page = {
      object: 'list',
      url: '/v1/eu-threshold-ledgers/2026/entries',
      data: [{ id: 'adj_abc', sequence: 1, kind: 'external_adjustment' }],
      has_more: true,
      next_cursor: 'adj_abc',
    }
    mockFetch.mockResolvedValueOnce(jsonResponse(200, page))
    const first = await facturino.euThresholdLedgers.listEntries('2026', { limit: 1 })
    expect(lastRequest().url)
      .toBe('https://facturino.com/api/v1/eu-threshold-ledgers/2026/entries?limit=1')
    expect(first.next_cursor).toBe('adj_abc')

    mockFetch.mockResolvedValueOnce(jsonResponse(200, { ...page, has_more: false, next_cursor: null }))
    await facturino.euThresholdLedgers.listEntries('2026', { limit: 1, starting_after: 'adj_abc' })
    expect(lastRequest().url).toBe(
      'https://facturino.com/api/v1/eu-threshold-ledgers/2026/entries?limit=1&starting_after=adj_abc',
    )
  })

  it('gives an amount back through a QUALIFIED correction, never a negative amount', async () => {
    // Art. 90(1) reduces the taxable amount of an identified supply — so the
    // correction names the movement it corrects, its qualification and its
    // evidence. There is no generic minus sign anywhere in this resource.
    mockFetch.mockResolvedValueOnce(jsonResponse(201, { object: 'eu_threshold_ledger', correctionTotal: 20000 }))
    const corrected = await facturino.euThresholdLedgers.correct('2026', {
      reference: 'cor-credit-note-12',
      correctsEntryId: 'adj_abc',
      kind: 'credit_note',
      amount: 20000,
      evidenceAmount: 10000,
      relatedResourceType: 'credit_note',
      relatedResourceId: 'crn_123',
      evidenceReference: 'AV-2026-0012',
      reason: 'Full credit note on a sale counted in August',
    })
    expect(lastRequest().url)
      .toBe('https://facturino.com/api/v1/eu-threshold-ledgers/2026/corrections')
    expect(JSON.parse(lastRequest().init.body as string).correctsEntryId).toBe('adj_abc')
    expect(corrected.correctionTotal).toBe(20000)
  })

  it('reads the REMAINING balance of a movement, not only its amount', async () => {
    // A reader that only saw `amountMin` would offer a correction the ledger is
    // about to refuse: a movement gives back what it brought in, once.
    mockFetch.mockResolvedValueOnce(jsonResponse(200, {
      object: 'list',
      url: '/v1/eu-threshold-ledgers/2026/entries',
      data: [{
        id: 'opening', kind: 'opening', amountMin: 100000,
        correctable: true, correctedMin: 30000, correctionCount: 1,
        remainingMin: 70000, remainingEvidenceMin: 50000,
      }],
      has_more: false,
      next_cursor: null,
    }))
    const page = await facturino.euThresholdLedgers.listEntries('2026')
    expect(page.data[0].remainingMin).toBe(70000)
    expect(page.data[0].correctedMin).toBe(30000)
    expect(page.data[0].correctable).toBe(true)
  })

  it('stops deciding on a ledger under review, and settles it by RECONCILIATION', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(200, {
      object: 'eu_threshold_ledger',
      status: 'review_required',
      review: { code: 'declared_by_administrator', detail: 'Opening figure disputed', openedAt: 'x' },
    }))
    const reviewed = await facturino.euThresholdLedgers.review('2026', {
      reason: 'Opening figure disputed by the accountant',
    })
    expect(lastRequest().url).toBe('https://facturino.com/api/v1/eu-threshold-ledgers/2026/review')
    expect(reviewed.status).toBe('review_required')

    mockFetch.mockResolvedValueOnce(jsonResponse(200, { object: 'eu_threshold_ledger', status: 'open', review: null }))
    const settled = await facturino.euThresholdLedgers.resolveReview('2026', {
      reconciledVersion: 4,
      reconciledAcquiredMin: 100000,
      reconciledAcquiredEvidenceMin: 60000,
      evidenceReference: 'RECON-2026-09',
      reason: 'Figure confirmed and corrected by adjustment',
    })
    expect(lastRequest().url)
      .toBe('https://facturino.com/api/v1/eu-threshold-ledgers/2026/review/resolve')
    // A comment alone never reopens a ledger: the verified figures travel.
    const sent = JSON.parse(lastRequest().init.body as string)
    expect(sent.reconciledVersion).toBe(4)
    expect(sent.reconciledAcquiredMin).toBe(100000)
    expect(sent.evidenceReference).toBe('RECON-2026-09')
    expect(settled.status).toBe('open')
  })

  it('lets the two counters diverge: neither bounds the other', async () => {
    // The common threshold counts only cross-border supplies; the evidence one
    // counts domestic electronic services too. A publisher selling mostly at
    // home legitimately declares far more on the second.
    mockFetch.mockResolvedValueOnce(jsonResponse(201, {
      object: 'eu_threshold_ledger', acquiredMin: 10000, acquiredEvidenceMin: 2000000,
    }))
    const opened = await facturino.euThresholdLedgers.open({
      year: '2026',
      previousYearAmount: 10000,
      currentYearOpening: 10000,
      previousYearEvidenceAmount: 4000000,
      currentYearEvidenceOpening: 2000000,
      coverageMode: 'facturino_only',
      externalCompleteThroughDate: '2026-01-01',
    })
    expect(opened.acquiredEvidenceMin).toBeGreaterThan(opened.acquiredMin)
  })

  it('sends the movement of goods an integration line needs', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(201, finalDecision))

    await facturino.taxDecisions.create({
      taxSource: 'integration',
      customerId: 'cus_8f2k4m9n',
      effectiveAt: '2026-09-15',
      currency: 'eur',
      priceMode: 'tax_exclusive',
      lines: [{
        reference: 'line-1',
        description: 'Chaise',
        category: 'goods',
        goodsMovement: 'dispatched_to_buyer_territory',
        unitAmount: 2900,
        quantity: '1',
        vatRate: 1900,
        vatCode: 'S',
      }],
    }, { idempotencyKey: 'order-goods' })

    const body = JSON.parse(lastRequest().init.body as string) as {
      lines: Array<{ goodsMovement?: string }>
    }
    expect(body.lines[0].goodsMovement).toBe('dispatched_to_buyer_territory')
  })

  it('retries a pending decision with new evidence', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(201, {
      ...finalDecision,
      retryOfTaxDecisionId: 'taxdec_previous',
    }))

    const decision = await facturino.taxDecisions.create({
      ...createParams,
      retryOfTaxDecisionId: 'taxdec_previous',
      locationEvidence: [{
        kind: 'billing_address',
        country: 'FR',
        thirdParty: false,
        source: 'declared',
        collectedAt: '2026-09-15',
      }],
    }, { idempotencyKey: 'order-retry' })

    const body = JSON.parse(lastRequest().init.body as string)
    expect(body.retryOfTaxDecisionId).toBe('taxdec_previous')
    // The commercial operation is unchanged; only the evidence is added.
    expect(body.lines).toEqual(createParams.lines)
    expect(decision.retryOfTaxDecisionId).toBe('taxdec_previous')
  })

  it('offers no way to mutate a decision', () => {
    const resource = facturino.taxDecisions as unknown as Record<string, unknown>
    for (const method of ['update', 'patch', 'del', 'delete', 'cancel']) {
      expect(resource[method]).toBeUndefined()
    }
  })
})

describe('documents backed by a decision', () => {
  let facturino: Facturino

  beforeEach(() => {
    mockFetch.mockReset()
    facturino = new Facturino('fac_test_abc123')
  })

  const buyer = {
    companyName: 'ACME SAS',
    address: { line1: '2 rue', postalCode: '75002', city: 'Paris', country: 'FR' },
  }

  it('creates an invoice from a decision, with presentation lines only', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(201, {
      id: 'inv_1',
      object: 'invoice',
      status: 'draft',
      documentStatus: 'draft',
      transmissionStatus: 'not_applicable',
      paymentStatus: 'unpaid',
      taxSource: 'facturino',
      taxDecisionId: 'taxdec_9c1f',
    }))

    const invoice = await facturino.invoices.create({
      customerId: 'cus_8f2k4m9n',
      taxDecisionId: 'taxdec_9c1f',
      decisionLines: [{ taxLineRef: 'abo-pro', unit: 'month' }],
      buyer,
      dates: { issued: '2026-09-15', due: '2026-10-15' },
      payment: { terms: '30 jours', termsDays: 30, method: 'transfer' },
    })

    const body = JSON.parse(lastRequest().init.body as string)
    expect(body.taxDecisionId).toBe('taxdec_9c1f')
    expect(body.decisionLines).toEqual([{ taxLineRef: 'abo-pro', unit: 'month' }])
    // No VAT is restated: it comes from the decision.
    expect(body.lines).toBeUndefined()
    expect(JSON.stringify(body)).not.toContain('"vatRate"')

    expect(invoice.taxSource).toBe('facturino')
    expect(invoice.documentStatus).toBe('draft')
    expect(invoice.transmissionStatus).toBe('not_applicable')
    expect(invoice.paymentStatus).toBe('unpaid')
  })

  it('creates an INTEGRATION-sourced decision: supplied VAT travels verbatim', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(201, {
      id: 'taxdec_int1', object: 'tax_decision', taxSource: 'integration', status: 'final',
    }))
    const decision = await facturino.taxDecisions.create({
      taxSource: 'integration',
      customerId: 'cus_8f2k4m9n',
      effectiveAt: '2026-09-15',
      currency: 'eur',
      priceMode: 'tax_exclusive',
      lines: [{
        reference: 'abo-pro', description: 'Abonnement Pro', category: 'electronically_supplied_services',
        unitAmount: 2900, quantity: '1', vatRate: 2000, vatCode: 'S',
      }],
    }, { idempotencyKey: 'op-int-1' })
    expect(decision.taxSource).toBe('integration')
    const [, opts] = mockFetch.mock.calls[0]
    const body = JSON.parse(opts.body)
    expect(body.taxSource).toBe('integration')
    expect(body.lines[0].vatRate).toBe(2000)
    expect(body.lines[0].vatCode).toBe('S')
  })

  it('refuses the retired lines contract locally, and requires the decision', async () => {
    // `lines` is not part of the contract: the VAT comes from the decision.
    await expect(facturino.invoices.create({
      customerId: 'cus_8f2k4m9n',
      taxDecisionId: 'taxdec_9c1f',
      decisionLines: [{ taxLineRef: 'abo-pro', unit: 'month' }],
      buyer,
      dates: { issued: '2026-09-15', due: '2026-10-15' },
      payment: { terms: '30 jours', termsDays: 30, method: 'transfer' },
      lines: [{}],
    } as never)).rejects.toThrow(`'lines' is not part of the invoice contract`)

    // No decision at all → immediate local refusal, no round trip.
    await expect(facturino.invoices.create({
      customerId: 'cus_8f2k4m9n',
      buyer,
      dates: { issued: '2026-09-15', due: '2026-10-15' },
      payment: { terms: '30 jours', termsDays: 30, method: 'transfer' },
    } as never)).rejects.toThrow(`'taxDecisionId' is required`)
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('accepts deposits and schedule alongside the decision — settled server-side', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(201, { id: 'inv_1', object: 'invoice', status: 'draft' }))
    await facturino.invoices.create({
      customerId: 'cus_8f2k4m9n',
      taxDecisionId: 'taxdec_9c1f',
      decisionLines: [{ taxLineRef: 'abo-pro', unit: 'month' }],
      buyer,
      dates: { issued: '2026-09-15', due: '2026-10-15' },
      payment: { terms: '30 jours', termsDays: 30, method: 'transfer' },
      deposits: [{ invoiceId: 'inv_dep' }],
      schedule: [
        { amount: 1740, dueDate: '2026-09-30' },
        { amount: 1740, dueDate: '2026-10-15' },
      ],
    } as never)
    const [, opts] = mockFetch.mock.calls[0]
    const body = JSON.parse(opts.body)
    expect(body.deposits).toEqual([{ invoiceId: 'inv_dep' }])
    expect(body.schedule).toHaveLength(2)
  })

  it('reads the three status axes independently of the summary projection', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(200, {
      id: 'inv_1',
      object: 'invoice',
      status: 'deposited',
      documentStatus: 'finalized',
      transmissionStatus: 'deposited',
      transmissionDetail: null,
      paymentStatus: 'partially_paid',
      taxSource: 'facturino',
    }))

    const invoice = await facturino.invoices.get('inv_1')

    // A collection never moves the transmission axis, and the summary `status`
    // stays populated as their projection.
    expect(invoice.status).toBe('deposited')
    expect(invoice.documentStatus).toBe('finalized')
    expect(invoice.transmissionStatus).toBe('deposited')
    expect(invoice.paymentStatus).toBe('partially_paid')
  })

  it('credits a decided invoice through creditedLines', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(201, {
      id: 'crn_1',
      object: 'credit_note',
      status: 'draft',
      documentStatus: 'draft',
      taxSource: 'facturino',
      originalInvoiceId: 'inv_1',
      originalTaxDecisionId: 'taxdec_9c1f',
    }))

    const creditNote = await facturino.creditNotes.create({
      relatedInvoiceId: 'inv_1',
      creditNoteType: 'partial',
      reasonCode: 'quality',
      creditedLines: [{ taxLineRef: 'abo-pro', amountTTC: 1200 }],
    })

    const body = JSON.parse(lastRequest().init.body as string)
    expect(body.creditedLines).toEqual([{ taxLineRef: 'abo-pro', amountTTC: 1200 }])
    // The VAT is inherited from the invoice snapshot, never restated.
    expect(body.items).toBeUndefined()
    expect(creditNote.originalTaxDecisionId).toBe('taxdec_9c1f')
  })

  it('sends recurring fiscal inputs instead of a stored decision', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(201, { id: 'rin_1', object: 'recurring_invoice' }))

    await facturino.recurringInvoices.create({
      customerId: 'cus_8f2k4m9n',
      frequency: 'monthly',
      startDate: '2026-09-01',
      nextGenerationDate: '2026-09-01',
      taxInputs: {
        priceMode: 'tax_exclusive',
        lines: [{
          reference: 'abo-pro',
          description: 'Abonnement Pro',
          category: 'electronically_supplied_services',
          rateCategory: 'standard',
          unitAmount: 2900,
          quantity: '1',
          unit: 'month',
        }],
      },
      templateInvoice: { paymentTermsDays: 30 },
    })

    const body = JSON.parse(lastRequest().init.body as string)
    expect(body.taxInputs.priceMode).toBe('tax_exclusive')
    expect(body.taxInputs.lines[0].quantity).toBe('1')
    // No decision id travels: each occurrence is decided on its own date.
    expect(JSON.stringify(body)).not.toContain('taxDecisionId')
    expect(body.templateInvoice.items).toBeUndefined()
  })
})

describe('parity guard', () => {
  it('keeps the tax-decision surface exposed', () => {
    const facturino = new Facturino('fac_test_abc123')
    // If this fails, the resource or one of its methods was dropped from the
    // client — which would silently remove the fiscal contract from the SDK.
    expect(facturino.taxDecisions).toBeDefined()
    for (const method of ['create', 'retrieve', 'get'] as const) {
      expect(typeof facturino.taxDecisions[method]).toBe('function')
    }
  })

  it('keeps the critical decision fields readable', () => {
    // A compile-time contract: dropping any of these from `TaxDecision` breaks
    // this assignment, and with it the build.
    const decision: Pick<
      import('../src/types.js').TaxDecision,
      'status' | 'amountToCharge' | 'totals' | 'invoiceChannel'
      | 'transactionReporting' | 'paymentReporting' | 'settledObligations'
      | 'euB2cDestination' | 'foreignTaxReviewRequired'
      | 'retryOfTaxDecisionId' | 'expired' | 'rulesVersion' | 'operationFingerprint'
      | 'obligationReasons' | 'vies' | 'issues'
    > = {
      status: 'final',
      amountToCharge: 3480,
      totals: { totalHT: 2900, totalVAT: 580, totalTTC: 3480 },
      invoiceChannel: 'einvoicing',
      transactionReporting: 'none',
      paymentReporting: 'fr212',
      // A final decision duplicates nothing: its axes are the three above.
      settledObligations: null,
      // `null` on every operation the EU B2C destination rule does not reach.
      euB2cDestination: null,
      foreignTaxReviewRequired: false,
      retryOfTaxDecisionId: null,
      expired: false,
      rulesVersion: 'fr-vat-2021-07-01',
      operationFingerprint: 'sha256:…',
      obligationReasons: [],
      vies: null,
      issues: [],
    }
    expect(decision.status).toBe('final')
  })
})
