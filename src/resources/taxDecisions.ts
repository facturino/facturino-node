import type { HttpClient } from '../client.js'
import type { TaxDecision, TaxDecisionCreateParams, RequestOptions } from '../types.js'

/**
 * Tax decisions — the fiscal position of one commercial operation.
 *
 * A decision fixes the VAT, the exact amount to charge and the three reporting
 * axes, then never changes. Ask for one BEFORE you charge anything: the amount
 * to debit is `amountToCharge`, not a total computed locally.
 *
 * The resource is immutable by design — there is no update and no delete. To
 * re-decide the same operation after supplying missing evidence, create a new
 * decision with `retryOfTaxDecisionId`.
 */
/** Maximum length the API accepts for `Idempotency-Key`. */
const MAX_IDEMPOTENCY_KEY_LENGTH = 255

export class TaxDecisions {
  constructor(private readonly client: HttpClient) {}

  /**
   * Take a decision on a commercial operation.
   *
   * Business idempotency is durable here, beyond the 24-hour transport window,
   * and it is keyed on the KEY — not on the operation. The SAME
   * `idempotencyKey` with the SAME canonical body always replays the SAME
   * decision, so a retry after a lost response costs nothing and charges
   * nothing twice. Two DIFFERENT keys describing the same operation produce TWO
   * decisions: nothing matches them up, and reusing one key with a different
   * body answers `409`.
   *
   * Only a `final` decision carries amounts. On `pending_verification` or
   * `unsupported`, `totals` and `amountToCharge` are `null` — never `0` — and
   * `issues` says what is missing.
   */
  async create(
    params: TaxDecisionCreateParams,
    options: RequestOptions & { idempotencyKey: string },
  ): Promise<TaxDecision> {
    const key = typeof options?.idempotencyKey === 'string' ? options.idempotencyKey.trim() : ''
    if (key.length === 0) {
      throw new Error('Idempotency-Key is required to create a tax decision')
    }
    // The API caps the key at 255 characters. Checking it here turns a round
    // trip and a 400 into an immediate, local error.
    if (key.length > MAX_IDEMPOTENCY_KEY_LENGTH) {
      throw new Error(
        `Idempotency-Key must be at most ${MAX_IDEMPOTENCY_KEY_LENGTH} characters (received ${key.length})`,
      )
    }
    // 201 on creation, 200 when the same key already produced this decision.
    // Both carry the decision itself, so the caller reads one shape either way;
    // a different body under the same key answers 409 (ConflictError).
    return this.client.post<TaxDecision>('/v1/tax-decisions', params, options)
  }

  /**
   * Read a decision back — typically after a payment capture, to check that the
   * captured amount, currency and buyer match what was decided.
   */
  async retrieve(id: string): Promise<TaxDecision> {
    return this.client.get<TaxDecision>(`/v1/tax-decisions/${id}`)
  }

  /** Alias of {@link TaxDecisions.retrieve}, for consistency with the other resources. */
  async get(id: string): Promise<TaxDecision> {
    return this.retrieve(id)
  }
}
