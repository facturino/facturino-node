import type { HttpClient } from '../client.js'
import type { ValidateParams, ValidateResponse } from '../types.js'

/**
 * Validate — synchronous structural validation of business identifiers
 * (SIRET, VAT number, IBAN, BIC) and document payloads (invoice
 * line items against EN16931 / CIUS-FR Schematron rules).
 *
 * Useful client-side to surface errors before hitting the
 * write endpoints. Validate calls do not mutate any resource.
 */
export class Validate {
  constructor(private readonly client: HttpClient) {}

  /**
   * Run a single validation request. The shape depends on `kind`:
   * `siret` / `vat` / `iban` / `bic` accept a `value` string;
   * `invoice` accepts a full invoice payload and runs Schematron
   * against EN16931 + CIUS-FR.
   */
  async run(params: ValidateParams): Promise<ValidateResponse> {
    return this.client.post<ValidateResponse>('/v1/validate', params)
  }
}
