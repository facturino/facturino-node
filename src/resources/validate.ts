import type { HttpClient } from '../client.js'
import type { ValidateParams, ValidateResponse } from '../types.js'

/**
 * Validate — dry-run conformity check of an invoice draft against the same
 * EN16931 / CIUS-FR rules as `invoices.create`, without persisting anything.
 *
 * Call it before `invoices.create` to surface conformity warnings early. To
 * check a customer's SIRET/VAT, use `customers.lookup` (SIRENE/VIES).
 */
export class Validate {
  constructor(private readonly client: HttpClient) {}

  /**
   * Validate an invoice payload and return `{ valid, warnings }`. Accepts the
   * same shape as `invoices.create`; nothing is created.
   */
  async run(params: ValidateParams): Promise<ValidateResponse> {
    return this.client.post<ValidateResponse>('/v1/validate', params)
  }
}
