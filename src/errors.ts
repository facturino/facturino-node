import type { ApiErrorBody } from './types.js'

/** Base SDK error. */
export class FacturinoError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'FacturinoError'
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

/** Structured API error response. */
export class ApiError extends FacturinoError {
  readonly status: number
  readonly type: string
  readonly code: string
  readonly param?: string
  readonly docUrl?: string
  readonly requestId: string
  readonly hint?: string

  constructor(status: number, body: ApiErrorBody) {
    const err = body.error
    super(err.message)
    this.name = 'ApiError'
    this.status = status
    this.type = err.type
    this.code = err.code
    this.param = err.param
    this.docUrl = err.doc_url
    this.requestId = err.request_id
    this.hint = err.hint
  }
}

/**
 * 400 — request payload is malformed, a field is missing or invalid.
 * Inspect `error.param` to identify the offending field.
 */
export class InvalidRequestError extends ApiError {
  constructor(status: number, body: ApiErrorBody) {
    super(status, body)
    this.name = 'InvalidRequestError'
  }
}

/**
 * 422 — Zod schema validation rejected the payload. The offending field is
 * surfaced in `error.param`. Distinct from {@link InvalidRequestError} so
 * callers can differentiate "shape malformed" (400) from "value out of
 * range / wrong type" (422) when re-displaying validation feedback.
 */
export class ValidationError extends ApiError {
  constructor(status: number, body: ApiErrorBody) {
    super(status, body)
    this.name = 'ValidationError'
  }
}

/** 401 — invalid, revoked, or missing API key. */
export class AuthenticationError extends ApiError {
  constructor(status: number, body: ApiErrorBody) {
    super(status, body)
    this.name = 'AuthenticationError'
  }
}

/**
 * 403 — the API key authenticated successfully but lacks the scope required
 * for the requested operation. The required scope is exposed in
 * `error.param`.
 */
export class PermissionError extends ApiError {
  constructor(status: number, body: ApiErrorBody) {
    super(status, body)
    this.name = 'PermissionError'
  }
}

/** 404 — resource not found, or not visible with this key's livemode. */
export class NotFoundError extends ApiError {
  constructor(status: number, body: ApiErrorBody) {
    super(status, body)
    this.name = 'NotFoundError'
  }
}

/**
 * 409 — the request conflicts with the current state of the resource
 * (state-machine transition refused, finalized invoice cannot be edited,
 * idempotency key reused with a different payload).
 */
export class ConflictError extends ApiError {
  constructor(status: number, body: ApiErrorBody) {
    super(status, body)
    this.name = 'ConflictError'
  }
}

/** 429 — rate limit exceeded. `retryAfter` is the recommended back-off in seconds. */
export class RateLimitError extends ApiError {
  readonly retryAfter: number | null

  constructor(status: number, body: ApiErrorBody, retryAfter: number | null) {
    super(status, body)
    this.name = 'RateLimitError'
    this.retryAfter = retryAfter
  }
}

/** 402 — quota or plan limit exceeded. Upgrade or revoke resources to recover. */
export class PlanLimitError extends ApiError {
  constructor(status: number, body: ApiErrorBody) {
    super(status, body)
    this.name = 'PlanLimitError'
  }
}

/**
 * 500/503 — Facturino is experiencing an internal error. The API is monitored
 * automatically; safe to retry with exponential back-off.
 */
export class ApiInternalError extends ApiError {
  constructor(status: number, body: ApiErrorBody) {
    super(status, body)
    this.name = 'ApiInternalError'
  }
}

/** Network or timeout error. Not surfaced by the API itself. */
export class ConnectionError extends FacturinoError {
  constructor(message: string) {
    super(message)
    this.name = 'ConnectionError'
  }
}
