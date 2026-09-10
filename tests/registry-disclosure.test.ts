import { readFileSync } from 'node:fs'
import { afterEach, expect, it, vi } from 'vitest'
import Facturino, { type SireneLookupResponse } from '../src/index.js'
afterEach(() => vi.unstubAllGlobals())
it('reads protected lookup fields without inventing identity or losing disclosure', async () => {
  const body = JSON.parse(readFileSync(new URL('./fixtures/contract/registry-disclosure.json', import.meta.url), 'utf8'))
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } })))
  const actual: SireneLookupResponse = await new Facturino('fac_test_fixture').customers.lookup({ siret: body.data.siret })
  expect(actual).toEqual(body)
  expect(actual.data?.disclosure?.status).toBe('P')
  expect(actual.data?.name).toBe('')
  expect(actual.data?.disclosure?.withheldFields).toContain('address.line1')
})
