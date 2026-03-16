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

/** 401 -- invalid, revoked, or missing API key. */
export class AuthenticationError extends ApiError {
  constructor(status: number, body: ApiErrorBody) {
    super(status, body)
    this.name = 'AuthenticationError'
  }
}

/** 429 -- rate limit exceeded. */
export class RateLimitError extends ApiError {
  readonly retryAfter: number | null

  constructor(status: number, body: ApiErrorBody, retryAfter: number | null) {
    super(status, body)
    this.name = 'RateLimitError'
    this.retryAfter = retryAfter
  }
}

/** 404 -- resource not found. */
export class NotFoundError extends ApiError {
  constructor(status: number, body: ApiErrorBody) {
    super(status, body)
    this.name = 'NotFoundError'
  }
}

/** 402 -- quota or plan limit exceeded. */
export class PlanLimitError extends ApiError {
  constructor(status: number, body: ApiErrorBody) {
    super(status, body)
    this.name = 'PlanLimitError'
  }
}

/** Network or timeout error. */
export class ConnectionError extends FacturinoError {
  constructor(message: string) {
    super(message)
    this.name = 'ConnectionError'
  }
}
