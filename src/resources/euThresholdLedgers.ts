import type { HttpClient } from '../client.js'
import type {
  EuThresholdAdjustmentParams,
  EuThresholdCorrectionParams,
  EuThresholdEntryListParams,
  EuThresholdLedger,
  EuThresholdLedgerEntryList,
  EuThresholdReviewParams,
  EuThresholdReviewResolutionParams,
  OpenEuThresholdLedgerParams,
  RequestOptions,
} from '../types.js'

/**
 * The annual EU threshold ledger — the running total the common EUR 10,000
 * threshold is assessed on.
 *
 * It is deliberately separate from the seller's fiscal profile: a profile
 * revision is an immutable RULE that decisions freeze, while a turnover total
 * moves with every sale and gets corrected. Keeping them apart is what lets a
 * correction be recorded without rewriting the rule a frozen decision was taken
 * under.
 *
 * It carries TWO counters, strictly apart and INDEPENDENT: the common
 * EUR 10,000 threshold (art. 59c(1) — distance sales of goods AND cross-border
 * services to consumers) and the EUR 100,000 location-evidence threshold
 * (Reg. 282/2011 art. 24b — electronically supplied services, domestic ones
 * included). Reading one off the other would open a single-evidence regime on
 * turnover the regulation does not count towards it, and neither bounds the
 * other: a seller whose electronic services are mostly domestic legitimately
 * declares more on the second than on the first.
 *
 * Nothing is assumed. Opening a year declares four figures — the two totals and
 * their services part — plus whether every covered sale goes through Facturino.
 * Sales made elsewhere are never assumed absent: under `mixed_channels` they
 * enter through adjustments, and the ledger serves a decision only up to the day
 * those channels are declared complete through.
 *
 * The ledger is append-only: there is no update and no delete. Giving an amount
 * back is a qualified CORRECTION, which names the movement it corrects; what
 * cannot be qualified that way puts the ledger under review instead.
 */
export class EuThresholdLedgers {
  constructor(private readonly client: HttpClient) {}

  /**
   * Open a calendar year.
   *
   * A year already open is never rewritten (`eu_threshold_year_already_open`):
   * decisions were frozen on its opening figures.
   */
  async open(
    params: OpenEuThresholdLedgerParams,
    options?: RequestOptions,
  ): Promise<EuThresholdLedger> {
    return this.client.post<EuThresholdLedger>('/v1/eu-threshold-ledgers', params, options)
  }

  /**
   * Read the ledger of a year: acquired totals, held slices, what remains, and
   * the first page of movements.
   */
  async retrieve(year: string, params?: EuThresholdEntryListParams): Promise<EuThresholdLedger> {
    return this.client.get<EuThresholdLedger>(
      `/v1/eu-threshold-ledgers/${year}${toQuery(params)}`,
    )
  }

  /** Alias of {@link retrieve}. */
  async get(year: string): Promise<EuThresholdLedger> {
    return this.retrieve(year)
  }

  /**
   * Walk the movements page by page, newest first.
   *
   * The ledger keeps every movement; a page shows some. `next_cursor` names the
   * last one returned.
   */
  async listEntries(
    year: string,
    params?: EuThresholdEntryListParams,
  ): Promise<EuThresholdLedgerEntryList> {
    return this.client.get<EuThresholdLedgerEntryList>(
      `/v1/eu-threshold-ledgers/${year}/entries${toQuery(params)}`,
    )
  }

  /**
   * Record turnover made on another channel.
   *
   * Append-only and idempotent on your own `reference`, compared through a
   * canonical fingerprint of the WHOLE body: replaying the same adjustment adds
   * nothing, and reusing the reference for any different fact answers
   * `eu_threshold_entry_conflict`. A negative amount is impossible here —
   * giving an amount back is {@link correct}.
   */
  async adjust(
    year: string,
    params: EuThresholdAdjustmentParams,
    options?: RequestOptions,
  ): Promise<EuThresholdLedger> {
    return this.client.post<EuThresholdLedger>(
      `/v1/eu-threshold-ledgers/${year}/adjustments`,
      params,
      options,
    )
  }

  /**
   * Take a qualified amount back out of the running total.
   *
   * Directive 2006/112/EC art. 90(1) reduces the taxable amount of a supply on
   * cancellation, refusal or a price reduction after the supply, and the
   * thresholds count the VALUE of the supplies — so the correction names the
   * movement it corrects (`correctsEntryId`), its qualification, the resource it
   * rests on and its evidence. The ledger keeps the BALANCE of each movement
   * inside the transaction, so the corrections of one movement never add up to
   * more than it brought in (`eu_threshold_correction_exceeds_counted`); an
   * unknown movement answers `eu_threshold_correction_target_unknown`, and one
   * that brought no turnover in `eu_threshold_correction_target_not_correctable`.
   * Each entry publishes its `remainingMin`, so the balance is readable before
   * the correction is attempted.
   *
   * Decisions already frozen are never rewritten: they were correct on the
   * figures of their own day. Only the total the NEXT operations read changes.
   */
  async correct(
    year: string,
    params: EuThresholdCorrectionParams,
    options?: RequestOptions,
  ): Promise<EuThresholdLedger> {
    return this.client.post<EuThresholdLedger>(
      `/v1/eu-threshold-ledgers/${year}/corrections`,
      params,
      options,
    )
  }

  /**
   * Stop deciding on this ledger: its running total is known to be wrong.
   *
   * Every reservation then answers `eu_threshold_review_required`. This is the
   * honest exit when an amount must come out and no qualified correction can
   * name the movement it corrects.
   */
  async review(
    year: string,
    params: EuThresholdReviewParams,
    options?: RequestOptions,
  ): Promise<EuThresholdLedger> {
    return this.client.post<EuThresholdLedger>(
      `/v1/eu-threshold-ledgers/${year}/review`,
      params,
      options,
    )
  }

  /**
   * Serve decisions again — on a RECONCILIATION that matches, never on a
   * comment. See {@link EuThresholdReviewResolutionParams}.
   */
  async resolveReview(
    year: string,
    params: EuThresholdReviewResolutionParams,
    options?: RequestOptions,
  ): Promise<EuThresholdLedger> {
    return this.client.post<EuThresholdLedger>(
      `/v1/eu-threshold-ledgers/${year}/review/resolve`,
      params,
      options,
    )
  }
}

/** Query string for the cursor pagination, empty when nothing is asked. */
function toQuery(params?: EuThresholdEntryListParams): string {
  if (params === undefined) return ''
  const search = new URLSearchParams()
  if (params.limit !== undefined) search.set('limit', String(params.limit))
  if (params.starting_after !== undefined) search.set('starting_after', params.starting_after)
  const query = search.toString()
  return query === '' ? '' : `?${query}`
}
