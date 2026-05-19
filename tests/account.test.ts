import { describe, it, expect, vi, beforeEach } from 'vitest'
import Facturino from '../src/index.js'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  } as unknown as Response
}

describe('Account resource', () => {
  let facturino: Facturino

  beforeEach(() => {
    mockFetch.mockReset()
    facturino = new Facturino('fac_test_abc123')
  })

  it('retrieves the authenticated account from /v1/account', async () => {
    const account = {
      object: 'account',
      userId: 'usr_abc',
      companyId: 'comp_xyz',
      plan: 'pro',
      livemode: false,
      apiKeyPrefix: 'fac_test_',
      permissions: [],
      company: {
        id: 'comp_xyz',
        name: 'ACME SAS',
        siret: '44306184100047',
        vatRegime: 'normal',
      },
      user: { emailVerified: true },
    }
    mockFetch.mockResolvedValueOnce(jsonResponse(200, account))

    const result = await facturino.account.retrieve()

    expect(mockFetch).toHaveBeenCalledOnce()
    const [url, init] = mockFetch.mock.calls[0]
    expect(url).toContain('/v1/account')
    expect((init as RequestInit).method).toBe('GET')
    expect(result).toEqual(account)
  })

  it('exposes livemode + apiKeyPrefix so callers can disambiguate envs', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse(200, {
        object: 'account',
        userId: 'usr_live',
        companyId: 'comp_live',
        plan: 'free',
        livemode: true,
        apiKeyPrefix: 'fac_live_',
        permissions: [],
        company: null,
        user: { emailVerified: false },
      }),
    )

    const result = await facturino.account.retrieve()
    expect(result.livemode).toBe(true)
    expect(result.apiKeyPrefix).toBe('fac_live_')
    expect(result.company).toBeNull()
  })
})
