import type { HttpClient } from '../client.js'
import type { Account } from '../types.js'

/**
 * Account introspection — returns the authenticated user, the active
 * company, the current plan and the scopes attached to the API key in
 * use. Every integration should expose this on a "Connected to
 * Facturino" surface so users can confirm which company and which
 * environment (`fac_test_` vs `fac_live_`) their requests target.
 */
export class AccountResource {
  constructor(private readonly client: HttpClient) {}

  /**
   * Return the account context (user, company, plan, livemode, scopes)
   * associated with the API key used by this client. Equivalent to
   * Stripe's `accounts.retrieve('me')` — no path parameter, the key
   * implicitly identifies "self".
   */
  async retrieve(): Promise<Account> {
    return this.client.get<Account>('/v1/account')
  }
}
