import type { HttpClient } from '../client.js'
import type { LegalForm, NafCode, PaginatedResponse } from '../types.js'

/** Encode a flat object as a `?k=v&…` query string (skips undefined/null). */
function buildQuery(params: Record<string, unknown>): string {
  const entries: [string, string][] = []
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue
    entries.push([k, String(v)])
  }
  return entries.length === 0 ? '' : `?${new URLSearchParams(entries).toString()}`
}

/**
 * Reference — static lookup tables maintained by INSEE that integrations
 * need to power their own company / customer forms:
 *
 *  - `legalForms` — French legal-form codes (SARL, SAS, EI…)
 *  - `nafCodes` — French NAF activity codes (Rev. 2, 2008)
 *
 * Both lists are stable and cacheable for the lifetime of the
 * integration's process. The endpoint paginates so the SDK exposes
 * `listLegalForms()` / `listNafCodes()` returning the full server
 * response — callers typically fetch once on app start and keep the
 * result in memory.
 */
export class Reference {
  constructor(private readonly client: HttpClient) {}

  /**
   * List INSEE legal forms (4-digit codes + sigles + labels).
   * Filter by `search` to autocomplete a form field.
   */
  async listLegalForms(params?: {
    search?: string
    limit?: number
  }): Promise<PaginatedResponse<LegalForm>> {
    const qs = params ? buildQuery(params) : ''
    return this.client.get<PaginatedResponse<LegalForm>>(`/v1/reference/legal-forms${qs}`)
  }

  /**
   * List NAF activity codes (Rev. 2). Filter by `search` to
   * autocomplete on label fragments ("conseil", "transport"…).
   */
  async listNafCodes(params?: {
    search?: string
    limit?: number
  }): Promise<PaginatedResponse<NafCode>> {
    const qs = params ? buildQuery(params) : ''
    return this.client.get<PaginatedResponse<NafCode>>(`/v1/reference/naf-codes${qs}`)
  }
}
