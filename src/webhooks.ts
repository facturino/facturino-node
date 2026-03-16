import { createHmac, timingSafeEqual } from 'node:crypto'
import { FacturinoError } from './errors.js'
import type { WebhookEvent } from './types.js'

const DEFAULT_TOLERANCE_SECONDS = 300 // 5 minutes

export interface WebhookVerifyOptions {
  /** Max event age in seconds (default: 300). */
  tolerance?: number
}

/** HMAC-SHA256 webhook signature verification. Header format: `t=<ts>,v1=<sig>` */
export class Webhooks {
  /** Verify signature and parse the event payload. */
  constructEvent(
    payload: string | Buffer,
    signature: string,
    secret: string,
    options?: WebhookVerifyOptions,
  ): WebhookEvent {
    this.verifySignature(payload, signature, secret, options)

    const body = typeof payload === 'string' ? payload : payload.toString('utf-8')
    const event = JSON.parse(body) as WebhookEvent

    return event
  }

  /** Verify signature without parsing. Throws on mismatch or stale timestamp. */
  verifySignature(
    payload: string | Buffer,
    signature: string,
    secret: string,
    options?: WebhookVerifyOptions,
  ): void {
    if (!signature) {
      throw new FacturinoError('Missing Facturino-Signature header')
    }

    if (!secret) {
      throw new FacturinoError('Missing webhook signing secret')
    }

    const tolerance = options?.tolerance ?? DEFAULT_TOLERANCE_SECONDS

    const parts = signature.split(',')
    const timestampPart = parts.find((p) => p.startsWith('t='))
    const signaturePart = parts.find((p) => p.startsWith('v1='))

    if (!timestampPart || !signaturePart) {
      throw new FacturinoError(
        'Invalid Facturino-Signature header format. Expected "t=<timestamp>,v1=<signature>".'
      )
    }

    const timestamp = parseInt(timestampPart.slice(2), 10)
    const expectedSignature = signaturePart.slice(3)

    if (Number.isNaN(timestamp)) {
      throw new FacturinoError('Invalid timestamp in Facturino-Signature header')
    }

    const now = Math.floor(Date.now() / 1000)
    if (Math.abs(now - timestamp) > tolerance) {
      throw new FacturinoError(
        `Webhook timestamp is outside tolerance of ${tolerance} seconds. ` +
        `Event timestamp: ${timestamp}, current time: ${now}.`
      )
    }

    const payloadStr = typeof payload === 'string' ? payload : payload.toString('utf-8')
    const signedPayload = `${timestamp}.${payloadStr}`
    const computedSignature = createHmac('sha256', secret)
      .update(signedPayload)
      .digest('hex')

    const expectedBuf = Buffer.from(expectedSignature, 'hex')
    const computedBuf = Buffer.from(computedSignature, 'hex')

    if (
      expectedBuf.length !== computedBuf.length ||
      !timingSafeEqual(expectedBuf, computedBuf)
    ) {
      throw new FacturinoError(
        'Webhook signature verification failed. The payload may have been tampered with.'
      )
    }
  }

  /** Generate a test signature header. */
  generateTestSignature(
    payload: string,
    secret: string,
    timestamp?: number,
  ): string {
    const ts = timestamp ?? Math.floor(Date.now() / 1000)
    const signedPayload = `${ts}.${payload}`
    const signature = createHmac('sha256', secret)
      .update(signedPayload)
      .digest('hex')
    return `t=${ts},v1=${signature}`
  }
}
