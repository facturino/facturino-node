import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { HttpClient } from '../src/client.js'
import {
  ApiError,
  AuthenticationError,
  RateLimitError,
  NotFoundError,
  PlanLimitError,
  ConnectionError,
} from '../src/errors.js'

// Mock fetch globally
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

function jsonResponse(status: number, body: unknown, headers?: Record<string, string>): Response {
  const h = new Headers({ 'content-type': 'application/json', ...headers })
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: h,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  } as unknown as Response
}

describe('HttpClient', () => {
  beforeEach(() => {
    mockFetch.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('constructor', () => {
    it('should throw if no API key is provided', () => {
      expect(() => new HttpClient('')).toThrow('No API key provided')
    })

    it('should throw if API key has invalid format', () => {
      expect(() => new HttpClient('sk_test_123')).toThrow('Invalid API key format')
    })

    it('should accept a valid test key', () => {
      expect(() => new HttpClient('fac_test_abc123')).not.toThrow()
    })

    it('should accept a valid live key', () => {
      expect(() => new HttpClient('fac_live_abc123')).not.toThrow()
    })
  })

  describe('request', () => {
    it('should send correct headers', async () => {
      const client = new HttpClient('fac_test_abc123')

      mockFetch.mockResolvedValueOnce(
        jsonResponse(200, { id: 'inv_123', object: 'invoice' })
      )

      await client.get('/v1/invoices/inv_123')

      expect(mockFetch).toHaveBeenCalledTimes(1)
      const [url, opts] = mockFetch.mock.calls[0]
      expect(url).toBe('https://facturino.com/api/v1/invoices/inv_123')
      expect(opts.headers['Authorization']).toBe('Bearer fac_test_abc123')
      expect(opts.headers['Content-Type']).toBe('application/json')
      expect(opts.headers['Facturino-Version']).toBe('2026-09-01')
      expect(opts.headers['User-Agent']).toMatch(/^facturino-node\//)
    })

    it('should use custom base URL', async () => {
      const client = new HttpClient('fac_test_abc123', {
        baseUrl: 'http://localhost:5001/api',
      })

      mockFetch.mockResolvedValueOnce(
        jsonResponse(200, { id: 'inv_123' })
      )

      await client.get('/v1/invoices/inv_123')

      const [url] = mockFetch.mock.calls[0]
      expect(url).toBe('http://localhost:5001/api/v1/invoices/inv_123')
    })

    it('should send POST body as JSON', async () => {
      const client = new HttpClient('fac_test_abc123')

      mockFetch.mockResolvedValueOnce(
        jsonResponse(201, { id: 'cus_123', object: 'customer' })
      )

      await client.post('/v1/customers', { name: 'ACME', type: 'company' })

      const [, opts] = mockFetch.mock.calls[0]
      expect(opts.method).toBe('POST')
      expect(JSON.parse(opts.body)).toEqual({ name: 'ACME', type: 'company' })
    })

    it('should send Idempotency-Key header when provided', async () => {
      const client = new HttpClient('fac_test_abc123')

      mockFetch.mockResolvedValueOnce(
        jsonResponse(201, { id: 'inv_123' })
      )

      await client.post('/v1/invoices', { customer: 'cus_123' }, {
        idempotencyKey: 'idem_abc123',
      })

      const [, opts] = mockFetch.mock.calls[0]
      expect(opts.headers['Idempotency-Key']).toBe('idem_abc123')
    })

    it('should handle 204 No Content', async () => {
      const client = new HttpClient('fac_test_abc123')

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 204,
        headers: new Headers(),
        json: () => Promise.reject(new Error('no json')),
        text: () => Promise.resolve(''),
      } as unknown as Response)

      const result = await client.del('/v1/invoices/inv_123')
      expect(result).toBeUndefined()
    })
  })

  describe('error handling', () => {
    it('should throw AuthenticationError on 401', async () => {
      const client = new HttpClient('fac_test_abc123')

      mockFetch.mockResolvedValueOnce(
        jsonResponse(401, {
          error: {
            type: 'authentication_error',
            code: 'invalid_api_key',
            message: 'Invalid API key',
            request_id: 'req_123',
          },
        })
      )

      await expect(client.get('/v1/invoices')).rejects.toThrow(AuthenticationError)
    })

    it('should throw NotFoundError on 404', async () => {
      const client = new HttpClient('fac_test_abc123')

      mockFetch.mockResolvedValueOnce(
        jsonResponse(404, {
          error: {
            type: 'not_found_error',
            code: 'resource_not_found',
            message: 'Invoice not found',
            request_id: 'req_123',
          },
        })
      )

      await expect(client.get('/v1/invoices/inv_999')).rejects.toThrow(NotFoundError)
    })

    it('should throw PlanLimitError on 402', async () => {
      const client = new HttpClient('fac_test_abc123')

      mockFetch.mockResolvedValueOnce(
        jsonResponse(402, {
          error: {
            type: 'plan_limit_error',
            code: 'quota_exceeded',
            message: 'Invoice quota exceeded',
            request_id: 'req_123',
          },
        })
      )

      await expect(client.post('/v1/invoices', {})).rejects.toThrow(PlanLimitError)
    })

    it('should throw RateLimitError on 429 with retryAfter', async () => {
      const client = new HttpClient('fac_test_abc123', { maxRetries: 0 })

      mockFetch.mockResolvedValueOnce(
        jsonResponse(429, {
          error: {
            type: 'rate_limit_error',
            code: 'rate_limit',
            message: 'Too many requests',
            request_id: 'req_123',
          },
        }, { 'retry-after': '30' })
      )

      try {
        await client.get('/v1/invoices')
        expect.fail('should have thrown')
      } catch (err) {
        expect(err).toBeInstanceOf(RateLimitError)
        expect((err as RateLimitError).retryAfter).toBe(30)
      }
    })

    it('should include structured error fields', async () => {
      const client = new HttpClient('fac_test_abc123', { maxRetries: 0 })

      mockFetch.mockResolvedValueOnce(
        jsonResponse(422, {
          error: {
            type: 'validation_error',
            code: 'invalid_field_value',
            message: 'name is required',
            param: 'name',
            doc_url: 'https://facturino.com/docs/api/customers',
            request_id: 'req_456',
            hint: 'Provide a company name',
          },
        })
      )

      try {
        await client.post('/v1/customers', {})
        expect.fail('should have thrown')
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError)
        const apiErr = err as ApiError
        expect(apiErr.status).toBe(422)
        expect(apiErr.type).toBe('validation_error')
        expect(apiErr.code).toBe('invalid_field_value')
        expect(apiErr.param).toBe('name')
        expect(apiErr.docUrl).toBe('https://facturino.com/docs/api/customers')
        expect(apiErr.requestId).toBe('req_456')
        expect(apiErr.hint).toBe('Provide a company name')
      }
    })
  })

  describe('retry logic', () => {
    it('should retry on 500 and succeed', async () => {
      const client = new HttpClient('fac_test_abc123', { maxRetries: 2 })

      mockFetch
        .mockResolvedValueOnce(
          jsonResponse(500, {
            error: { type: 'api_error', code: 'internal', message: 'Error', request_id: 'req_1' },
          })
        )
        .mockResolvedValueOnce(
          jsonResponse(200, { id: 'inv_123', object: 'invoice' })
        )

      const result = await client.get<{ id: string }>('/v1/invoices/inv_123')
      expect(result.id).toBe('inv_123')
      expect(mockFetch).toHaveBeenCalledTimes(2)
    })

    it('should retry on 429 and succeed', async () => {
      const client = new HttpClient('fac_test_abc123', { maxRetries: 1 })

      mockFetch
        .mockResolvedValueOnce(
          jsonResponse(429, {
            error: { type: 'rate_limit_error', code: 'rate_limit', message: 'Slow down', request_id: 'req_1' },
          }, { 'retry-after': '1' })
        )
        .mockResolvedValueOnce(
          jsonResponse(200, { id: 'inv_123' })
        )

      const result = await client.get<{ id: string }>('/v1/invoices/inv_123')
      expect(result.id).toBe('inv_123')
      expect(mockFetch).toHaveBeenCalledTimes(2)
    })

    it('should not retry on 400', async () => {
      const client = new HttpClient('fac_test_abc123', { maxRetries: 2 })

      mockFetch.mockResolvedValueOnce(
        jsonResponse(400, {
          error: { type: 'invalid_request_error', code: 'bad_request', message: 'Bad', request_id: 'req_1' },
        })
      )

      await expect(client.post('/v1/invoices', {})).rejects.toThrow(ApiError)
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })

    it('should throw after exhausting retries', async () => {
      const client = new HttpClient('fac_test_abc123', { maxRetries: 1 })

      mockFetch
        .mockResolvedValueOnce(
          jsonResponse(503, {
            error: { type: 'api_error', code: 'service_unavailable', message: 'Down', request_id: 'req_1' },
          })
        )
        .mockResolvedValueOnce(
          jsonResponse(503, {
            error: { type: 'api_error', code: 'service_unavailable', message: 'Down', request_id: 'req_2' },
          })
        )

      await expect(client.get('/v1/invoices')).rejects.toThrow(ApiError)
      expect(mockFetch).toHaveBeenCalledTimes(2) // 1 initial + 1 retry
    })

    it('should handle timeout errors', async () => {
      const client = new HttpClient('fac_test_abc123', { maxRetries: 0, timeout: 100 })

      mockFetch.mockImplementation(() => {
        const err = new Error('The operation was aborted')
        err.name = 'AbortError'
        return Promise.reject(err)
      })

      await expect(client.get('/v1/invoices')).rejects.toThrow(ConnectionError)
    })
  })
})
