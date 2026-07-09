import { describe, it, expect } from 'vitest'
import { createHmac } from 'node:crypto'
import { Webhooks } from '../src/webhooks.js'
import { FacturinoError } from '../src/errors.js'

describe('Webhooks', () => {
  const webhooks = new Webhooks()
  const secret = 'whsec_test_secret_key_12345'

  function makePayload(): string {
    return JSON.stringify({
      id: 'evt_123',
      object: 'event',
      type: 'invoice.finalized',
      apiVersion: '2026-03-01',
      data: { id: 'inv_456', object: 'invoice', status: 'finalized' },
      delivered: false,
      livemode: false,
      created: '2026-03-15T10:00:00Z',
      updated: '2026-03-15T10:00:00Z',
    })
  }

  function sign(payload: string, sec: string, timestamp?: number): string {
    const ts = timestamp ?? Math.floor(Date.now() / 1000)
    const signedPayload = `${ts}.${payload}`
    const signature = createHmac('sha256', sec).update(signedPayload).digest('hex')
    return `t=${ts},v1=${signature}`
  }

  describe('constructEvent', () => {
    it('should verify and parse a valid webhook event', () => {
      const payload = makePayload()
      const signature = sign(payload, secret)

      const event = webhooks.constructEvent(payload, signature, secret)

      expect(event.id).toBe('evt_123')
      expect(event.type).toBe('invoice.finalized')
      expect(event.data.status).toBe('finalized')
    })

    it('should accept Buffer payload', () => {
      const payload = makePayload()
      const buffer = Buffer.from(payload, 'utf-8')
      const signature = sign(payload, secret)

      const event = webhooks.constructEvent(buffer, signature, secret)
      expect(event.id).toBe('evt_123')
    })

    it('should throw on invalid signature', () => {
      const payload = makePayload()
      const ts = Math.floor(Date.now() / 1000)
      const badSig = `t=${ts},v1=${'a'.repeat(64)}`

      expect(() =>
        webhooks.constructEvent(payload, badSig, secret)
      ).toThrow(FacturinoError)
      expect(() =>
        webhooks.constructEvent(payload, badSig, secret)
      ).toThrow('verification failed')
    })

    it('should throw on tampered payload', () => {
      const payload = makePayload()
      const signature = sign(payload, secret)

      const tampered = payload.replace('inv_456', 'inv_999')

      expect(() =>
        webhooks.constructEvent(tampered, signature, secret)
      ).toThrow('verification failed')
    })

    it('should throw on wrong secret', () => {
      const payload = makePayload()
      const signature = sign(payload, 'wrong_secret')

      expect(() =>
        webhooks.constructEvent(payload, signature, secret)
      ).toThrow('verification failed')
    })

    it('should throw on missing signature header', () => {
      const payload = makePayload()

      expect(() =>
        webhooks.constructEvent(payload, '', secret)
      ).toThrow('Missing Facturino-Signature')
    })

    it('should throw on missing secret', () => {
      const payload = makePayload()
      const signature = sign(payload, secret)

      expect(() =>
        webhooks.constructEvent(payload, signature, '')
      ).toThrow('Missing webhook signing secret')
    })

    it('should throw on malformed signature header', () => {
      const payload = makePayload()

      expect(() =>
        webhooks.constructEvent(payload, 'invalid_format', secret)
      ).toThrow('Invalid Facturino-Signature header format')
    })
  })

  describe('timestamp tolerance', () => {
    it('should accept event within tolerance', () => {
      const payload = makePayload()
      const now = Math.floor(Date.now() / 1000)
      const signature = sign(payload, secret, now - 60) // 60 seconds ago

      expect(() =>
        webhooks.constructEvent(payload, signature, secret)
      ).not.toThrow()
    })

    it('should reject event outside tolerance', () => {
      const payload = makePayload()
      const now = Math.floor(Date.now() / 1000)
      const signature = sign(payload, secret, now - 600) // 10 minutes ago

      expect(() =>
        webhooks.constructEvent(payload, signature, secret, { tolerance: 300 })
      ).toThrow('outside tolerance')
    })

    it('should accept custom tolerance', () => {
      const payload = makePayload()
      const now = Math.floor(Date.now() / 1000)
      const signature = sign(payload, secret, now - 500) // 500 seconds ago

      // Should fail with default 300s tolerance
      expect(() =>
        webhooks.constructEvent(payload, signature, secret, { tolerance: 300 })
      ).toThrow('outside tolerance')

      // Should pass with 600s tolerance
      expect(() =>
        webhooks.constructEvent(payload, signature, secret, { tolerance: 600 })
      ).not.toThrow()
    })

    it('should reject future timestamps outside tolerance', () => {
      const payload = makePayload()
      const now = Math.floor(Date.now() / 1000)
      const signature = sign(payload, secret, now + 600) // 10 minutes in the future

      expect(() =>
        webhooks.constructEvent(payload, signature, secret, { tolerance: 300 })
      ).toThrow('outside tolerance')
    })
  })

  describe('generateTestSignature', () => {
    it('should generate a valid signature for testing', () => {
      const payload = makePayload()
      const ts = Math.floor(Date.now() / 1000)

      const signature = webhooks.generateTestSignature(payload, secret, ts)

      expect(signature).toMatch(/^t=\d+,v1=[a-f0-9]{64}$/)

      // Should be verifiable
      expect(() =>
        webhooks.constructEvent(payload, signature, secret)
      ).not.toThrow()
    })

    it('should use current time when timestamp is omitted', () => {
      const payload = makePayload()

      const signature = webhooks.generateTestSignature(payload, secret)

      expect(signature).toMatch(/^t=\d+,v1=[a-f0-9]{64}$/)

      // Should verify successfully (within tolerance since it uses current time)
      expect(() =>
        webhooks.constructEvent(payload, signature, secret)
      ).not.toThrow()
    })
  })

  describe('verifySignature', () => {
    it('should verify without parsing', () => {
      const payload = makePayload()
      const signature = sign(payload, secret)

      expect(() =>
        webhooks.verifySignature(payload, signature, secret)
      ).not.toThrow()
    })
  })
})
