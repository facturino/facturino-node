import { createServer, type Server } from 'node:http'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { HttpClient } from '../src/client.js'
import { ConnectionError, RateLimitError } from '../src/errors.js'

const KEY = 'fac_test_local'
const errorBody = { error: { type: 'rate_limit_error', code: 'rate_limit_exceeded', message: 'Slow down', request_id: 'req_local' } }
async function close(server: Server) {
  server.closeAllConnections()
  await new Promise<void>((resolve) => server.close(() => resolve()))
}
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

describe('mutation retries', () => {
  it('applies once when a real local server commits then cuts the response', async () => {
    const movements = new Map<string, number>()
    const seen: string[] = []
    const server = createServer((req, res) => {
      req.resume()
      req.on('end', () => {
        const key = String(req.headers['idempotency-key'] ?? '')
        seen.push(key)
        if (!movements.has(key)) movements.set(key, movements.size + 1)
        if (seen.length === 1) { req.socket.destroy(); return }
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ id: movements.get(key) }))
      })
    })
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    try {
      const client = new HttpClient(KEY, { baseUrl: `http://127.0.0.1:${(server.address() as {port:number}).port}` })
      expect(await client.post('/payments', { amount: 1188 })).toEqual({ id: 1 })
      expect(seen).toHaveLength(2)
      expect(seen[0]).toBeTruthy()
      expect(seen[1]).toBe(seen[0])
      expect(movements.size).toBe(1)
      expect(await client.post('/payments', { amount: 1188 })).toEqual({ id: 2 })
    } finally { await close(server) }
  })

  it('keeps the body read within the Node timeout', async () => {
    const server = createServer((_req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.write('{"id":') // headers arrive; body deliberately never ends
    })
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    try {
      const client = new HttpClient(KEY, { baseUrl: `http://127.0.0.1:${(server.address() as {port:number}).port}`, timeout: 80, maxRetries: 0 })
      await expect(client.post('/payments', {})).rejects.toBeInstanceOf(ConnectionError)
    } finally { await close(server) }
  })

  it('does not retry an unkeyed POST, including connection failures', async () => {
    const fetch = vi.fn().mockRejectedValue(new TypeError('fetch failed'))
    vi.stubGlobal('fetch', fetch)
    const client = new HttpClient(KEY, { autoIdempotency: false })
    await expect(client.post('/payments', {})).rejects.toBeInstanceOf(ConnectionError)
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(fetch.mock.calls[0][1].headers).not.toHaveProperty('Idempotency-Key')
  })

  it('honors an explicit key with automatic generation disabled', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify(errorBody), { status: 429, headers: { 'Retry-After': '0', 'Content-Type': 'application/json' } })).mockResolvedValue(new Response('{}', { headers: { 'Content-Type': 'application/json' } }))
    vi.stubGlobal('fetch', fetch)
    await new HttpClient(KEY, { autoIdempotency: false }).post('/payments', {}, { idempotencyKey: 'caller-key' })
    expect(fetch.mock.calls.map((call) => call[1].headers['Idempotency-Key'])).toEqual(['caller-key', 'caller-key'])
  })

  it('waits the full 90-second Retry-After without a premature attempt', async () => {
    vi.useFakeTimers()
    const fetch = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify(errorBody), { status: 429, headers: { 'Retry-After': '90', 'Content-Type': 'application/json' } })).mockResolvedValue(new Response('{}', { headers: { 'Content-Type': 'application/json' } }))
    vi.stubGlobal('fetch', fetch)
    const result = new HttpClient(KEY, { retryBudgetMs: 100_000 }).post('/payments', {})
    await vi.advanceTimersByTimeAsync(89_999)
    expect(fetch).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1)
    await expect(result).resolves.toEqual({})
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('returns 429 when Retry-After exceeds the remaining cumulative budget', async () => {
    vi.useFakeTimers()
    const fetch = vi.fn().mockImplementation(() => Promise.resolve(new Response(JSON.stringify(errorBody), { status: 429, headers: { 'Retry-After': '40', 'Content-Type': 'application/json' } })))
    vi.stubGlobal('fetch', fetch)
    const result = new HttpClient(KEY).post('/payments', {}).catch((error) => error)
    await vi.advanceTimersByTimeAsync(40_000)
    expect(await result).toBeInstanceOf(RateLimitError)
    expect(fetch).toHaveBeenCalledTimes(2)
  })
})
