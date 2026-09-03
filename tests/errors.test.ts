import { describe, it, expect, vi, beforeEach } from 'vitest'
import Facturino, {
  ApiError,
  ApiInternalError,
  AuthenticationError,
  ConflictError,
  InvalidRequestError,
  NotFoundError,
  PermissionError,
  PlanLimitError,
  RateLimitError,
  ValidationError,
} from '../src/index.js'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

function errorResponse(status: number, type: string, code: string, headers?: Record<string, string>): Response {
  return {
    ok: false,
    status,
    headers: new Headers({ 'content-type': 'application/json', ...(headers ?? {}) }),
    json: () =>
      Promise.resolve({
        error: {
          type,
          code,
          message: `${type}: ${code}`,
          request_id: 'req_abc',
          doc_url: `https://facturino.com/docs/errors#${code}`,
        },
      }),
    text: () => Promise.resolve(''),
  } as unknown as Response
}

describe('Error mapping', () => {
  let client: Facturino

  beforeEach(() => {
    mockFetch.mockReset()
    // Disable retries so we test the error class, not the retry loop.
    client = new Facturino('fac_test_abc123', { maxRetries: 0 })
  })

  // For each HTTP status we expect the most specific subclass — `ApiError`
  // is the catch-all and should never be matched when a status-specific
  // class exists. This protects callers using `instanceof` for branching.
  const cases: Array<{
    status: number
    type: string
    code: string
    klass: new (...args: never[]) => ApiError
  }> = [
    { status: 400, type: 'invalid_request_error', code: 'missing_required_field', klass: InvalidRequestError },
    { status: 401, type: 'authentication_error', code: 'invalid_api_key', klass: AuthenticationError },
    { status: 402, type: 'plan_limit_error', code: 'quota_exceeded', klass: PlanLimitError },
    { status: 403, type: 'permission_error', code: 'scope_insufficient', klass: PermissionError },
    { status: 404, type: 'not_found_error', code: 'not_found', klass: NotFoundError },
    { status: 409, type: 'conflict_error', code: 'conflict', klass: ConflictError },
    { status: 422, type: 'validation_error', code: 'validation_error', klass: ValidationError },
    { status: 500, type: 'api_error', code: 'internal_error', klass: ApiInternalError },
    { status: 503, type: 'api_error', code: 'internal_error', klass: ApiInternalError },
  ]

  for (const { status, type, code, klass } of cases) {
    it(`maps HTTP ${status} (${type}) to ${klass.name}`, async () => {
      mockFetch.mockResolvedValueOnce(errorResponse(status, type, code))
      await expect(client.invoices.get('inv_404')).rejects.toBeInstanceOf(klass)
    })
  }

  it('extracts Retry-After header on RateLimitError', async () => {
    mockFetch.mockResolvedValueOnce(
      errorResponse(429, 'rate_limit_error', 'rate_limit_exceeded', { 'retry-after': '12' }),
    )
    try {
      await client.invoices.get('inv_404')
      throw new Error('should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(RateLimitError)
      expect((err as RateLimitError).retryAfter).toBe(12)
    }
  })

  /** An error response carrying detailed reasons. */
  function detailedResponse(): Response {
    return {
      ok: false,
      status: 422,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: () =>
        Promise.resolve({
          error: {
            type: 'validation_error',
            code: 'validation_error',
            message: 'Buyer territory could not be resolved.',
            param: 'customerId',
            request_id: 'req_abc',
            issues: [
              {
                code: 'invalid_postal_code',
                param: 'customer.address.postalCode',
                message: 'Buyer territory could not be resolved.',
              },
            ],
          },
        }),
      text: () => Promise.resolve(''),
    } as unknown as Response
  }

  it('exposes the detailed reasons of a refusal on `issues`', async () => {
    mockFetch.mockResolvedValueOnce(detailedResponse())
    try {
      await client.invoices.get('inv_1')
      throw new Error('should have thrown')
    } catch (err) {
      const e = err as ValidationError
      // The main code is unchanged: it stays the value to branch on.
      expect(e.code).toBe('validation_error')
      expect(e.param).toBe('customerId')
      // The detail says WHICH field to fix.
      expect(e.issues).toEqual([
        {
          code: 'invalid_postal_code',
          param: 'customer.address.postalCode',
          message: 'Buyer territory could not be resolved.',
        },
      ])
    }
  })

  it('gives an EMPTY list when a refusal carries no detail — never undefined', async () => {
    // Reading `issues` must never need a null check.
    mockFetch.mockResolvedValueOnce(errorResponse(404, 'not_found_error', 'not_found'))
    try {
      await client.invoices.get('inv_404')
      throw new Error('should have thrown')
    } catch (err) {
      expect((err as ApiError).issues).toEqual([])
    }
  })

  it('preserves request_id and doc_url on every ApiError', async () => {
    mockFetch.mockResolvedValueOnce(errorResponse(422, 'validation_error', 'validation_error'))
    try {
      await client.invoices.get('inv_404')
      throw new Error('should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(ValidationError)
      const e = err as ValidationError
      expect(e.requestId).toBe('req_abc')
      expect(e.docUrl).toBe('https://facturino.com/docs/errors#validation_error')
      expect(e.code).toBe('validation_error')
      expect(e.type).toBe('validation_error')
    }
  })
})
