import { randomUUID } from 'node:crypto'
import type { FacturinoConfig, ApiErrorBody, RequestOptions } from './types.js'
import {
  ApiError,
  ApiInternalError,
  AuthenticationError,
  ConflictError,
  ConnectionError,
  InvalidRequestError,
  NotFoundError,
  PermissionError,
  PlanLimitError,
  RateLimitError,
  ValidationError,
} from './errors.js'

const DEFAULT_BASE_URL = 'https://facturino.com/api'
const DEFAULT_MAX_RETRIES = 3
const DEFAULT_TIMEOUT = 30_000
const DEFAULT_API_VERSION = '2026-09-01'

const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503])
const INITIAL_RETRY_DELAY_MS = 500
const MAX_RETRY_DELAY_MS = 30_000

export const VERSION = '2.8.0'

/** HTTP client with retries, exponential backoff, and structured errors. */
export class HttpClient {
  private readonly apiKey: string
  private readonly baseUrl: string
  private readonly maxRetries: number
  private readonly timeout: number
  private readonly apiVersion: string
  private readonly autoIdempotency: boolean
  private readonly retryBudgetMs: number

  constructor(apiKey: string, config: FacturinoConfig = {}) {
    if (!apiKey) {
      throw new Error(
        'No API key provided. Pass your key as the first argument: new Facturino("fac_test_...")'
      )
    }

    if (!apiKey.startsWith('fac_test_') && !apiKey.startsWith('fac_live_')) {
      throw new Error(
        'Invalid API key format. Keys must start with "fac_test_" or "fac_live_".'
      )
    }

    this.apiKey = apiKey
    this.baseUrl = (config.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, '')
    this.maxRetries = config.maxRetries ?? DEFAULT_MAX_RETRIES
    this.timeout = config.timeout ?? DEFAULT_TIMEOUT
    this.apiVersion = config.apiVersion ?? DEFAULT_API_VERSION
    this.autoIdempotency = config.autoIdempotency ?? true
    this.retryBudgetMs = config.retryBudgetMs ?? 60_000
    if (!Number.isFinite(this.retryBudgetMs) || this.retryBudgetMs < 0) throw new Error('retryBudgetMs must be finite and non-negative')
  }

  async request<T>(
    method: string,
    path: string,
    body?: unknown,
    options?: RequestOptions,
  ): Promise<T> {
    method = method.toUpperCase()
    const url = `${this.baseUrl}${path}`
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Facturino-Version': this.apiVersion,
      'User-Agent': `facturino-node/${VERSION}`,
    }

    const key = options?.idempotencyKey ?? (method === 'POST' && this.autoIdempotency ? randomUUID() : undefined)
    if (key) headers['Idempotency-Key'] = key
    const canRetry = method !== 'POST' || Boolean(key)
    const serializedBody = body !== undefined && method !== 'GET' ? JSON.stringify(body) : undefined
    let remainingBudget = this.retryBudgetMs

    let lastError: Error | null = null
    let retryAfterMs: number | null = null

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      if (attempt > 0) {
        const delay = retryAfterMs ?? this.getRetryDelay(attempt, lastError)
        if (delay > remainingBudget) throw lastError
        remainingBudget -= delay
        await sleep(delay)
      }

      retryAfterMs = null
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), this.timeout)

      try {
        const fetchOptions: RequestInit = {
          method,
          headers,
          signal: controller.signal,
        }

        if (body !== undefined && method !== 'GET') {
          fetchOptions.body = serializedBody
        }

        const response = await fetch(url, fetchOptions)

        const seconds = parseRetryAfter(response.headers.get('retry-after'))
        retryAfterMs = seconds === null ? null : seconds * 1000
        if (response.status === 204) {
          return undefined as T
        }

        let responseBody: unknown
        const contentType = response.headers.get('content-type') ?? ''
        if (contentType.includes('application/json')) {
          responseBody = await response.json()
        } else {
          const text = await response.text()
          responseBody = text as unknown
        }

        if (response.ok) {
          return responseBody as T
        }

        const errorBody = responseBody as ApiErrorBody
        const hasStructuredError =
          errorBody &&
          typeof errorBody === 'object' &&
          'error' in errorBody &&
          typeof (errorBody as ApiErrorBody).error === 'object'

        if (!hasStructuredError) {
          const syntheticError: ApiErrorBody = {
            error: {
              type: 'api_error',
              code: 'unknown',
              message: typeof responseBody === 'string' ? responseBody : `HTTP ${response.status}`,
              request_id: response.headers.get('x-request-id') ?? 'req_unknown',
            },
          }
          lastError = this.buildError(response.status, syntheticError, response.headers)
        } else {
          lastError = this.buildError(response.status, errorBody, response.headers)
        }

        if (RETRYABLE_STATUS_CODES.has(response.status) && canRetry && attempt < this.maxRetries) {
          continue
        }

        throw lastError
      } catch (err) {
        if (err instanceof ApiError) {
          throw err
        }

        if (err instanceof Error && err.name === 'AbortError') {
          lastError = new ConnectionError(
            `Request to ${method} ${path} timed out after ${this.timeout}ms`
          )
          if (canRetry && attempt < this.maxRetries) {
            continue
          }
          throw lastError
        }

        if (err instanceof TypeError && /fetch|network|terminated/i.test(err.message)) {
          lastError = new ConnectionError(
            `Network error on ${method} ${path}: ${err.message}`
          )
          if (canRetry && attempt < this.maxRetries) {
            continue
          }
          throw lastError
        }

        throw err
      } finally {
        clearTimeout(timeoutId)
      }
    }

    throw lastError ?? new ConnectionError('Request failed after all retries')
  }

  async get<T>(path: string): Promise<T> {
    return this.request<T>('GET', path)
  }

  async post<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>('POST', path, body, options)
  }

  async patch<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>('PATCH', path, body)
  }

  async del<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('DELETE', path, body)
  }

  /**
   * Map an HTTP status + error body to the most specific {@link ApiError}
   * subclass. Both the status and the `error.type` from the body are used:
   * the status decides the primary class (401 → Authentication, 429 →
   * RateLimit…) but for 4xx codes that share a status — notably 422 vs
   * 400 — we look at `body.error.type` to discriminate further.
   */
  private buildError(
    status: number,
    body: ApiErrorBody,
    headers: Headers,
  ): ApiError {
    const type = body?.error?.type

    switch (status) {
      case 400:
        return new InvalidRequestError(status, body)
      case 401:
        return new AuthenticationError(status, body)
      case 402:
        return new PlanLimitError(status, body)
      case 403:
        return new PermissionError(status, body)
      case 404:
        return new NotFoundError(status, body)
      case 409:
        return new ConflictError(status, body)
      case 422:
        return new ValidationError(status, body)
      case 429: {
        return new RateLimitError(status, body, parseRetryAfter(headers.get('retry-after')))
      }
      case 500:
      case 502:
      case 503:
      case 504:
        return new ApiInternalError(status, body)
      default:
        // Use the body `type` as a fallback for non-standard status codes so
        // a 418 with `type: 'rate_limit_error'` still maps to the right
        // class instead of falling through to the generic `ApiError`.
        if (type === 'validation_error') return new ValidationError(status, body)
        if (type === 'authentication_error') return new AuthenticationError(status, body)
        if (type === 'permission_error') return new PermissionError(status, body)
        if (type === 'conflict_error') return new ConflictError(status, body)
        if (type === 'plan_limit_error') return new PlanLimitError(status, body)
        if (type === 'rate_limit_error') return new RateLimitError(status, body, null)
        if (type === 'not_found_error') return new NotFoundError(status, body)
        if (type === 'api_error') return new ApiInternalError(status, body)
        return new ApiError(status, body)
    }
  }

  private getRetryDelay(attempt: number, lastError: Error | null): number {
    if (lastError instanceof RateLimitError && lastError.retryAfter !== null) {
      return lastError.retryAfter * 1000
    }

    const baseDelay = INITIAL_RETRY_DELAY_MS * Math.pow(2, attempt - 1)
    const jitter = baseDelay * 0.2 * Math.random()
    return Math.min(baseDelay + jitter, MAX_RETRY_DELAY_MS)
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function parseRetryAfter(value: string | null): number | null {
  if (value === null || !value.trim()) return null
  const numeric = Number(value)
  if (Number.isFinite(numeric)) return numeric >= 0 ? numeric : null
  const seconds = Math.max(0, (Date.parse(value) - Date.now()) / 1000)
  return Number.isFinite(seconds) ? seconds : null
}
