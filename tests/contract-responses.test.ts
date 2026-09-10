import { afterEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import Facturino from '../src/index.js'

const resources = { invoice: 'Invoice', payment: 'Payment', customer: 'Customer', creditNote: 'CreditNote', taxDecision: 'TaxDecision', event: 'WebhookEvent' } as const
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
const fixture = (name: string) => JSON.parse(readFileSync(new URL(`./fixtures/contract/${name}.json`, import.meta.url), 'utf8'))
afterEach(() => vi.unstubAllGlobals())

describe('actual server response corpus', () => {
  it.each(Object.keys(resources))('deserializes %s through the resource', async name => {
    const body = fixture(name)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(body)))
    const client = new Facturino('fac_test_corpus')
    const calls: Record<string, () => Promise<unknown>> = {
      invoice: () => client.invoices.get(body.id),
      payment: () => client.payments.create(body.invoiceId, { amount: 50000, method: 'transfer', paidAt: body.paidAt }),
      customer: () => client.customers.get(body.id),
      creditNote: () => client.creditNotes.get(body.id),
      taxDecision: () => client.taxDecisions.get(body.id),
      event: () => client.events.get(body.id),
    }
    expect(await calls[name]()).toEqual(body)
  })

  it('type checks the concrete JSON values, not only a cast from JSON.parse', () => {
    const virtualPath = fileURLToPath(new URL('./__contract_corpus__.ts', import.meta.url))
    const source = `import type { ${Object.values(resources).join(', ')}, TypedWebhookEvent } from '../src/index.js';\n`
      + Object.entries(resources).map(([name, type]) => `const ${name}: ${type} = ${JSON.stringify(fixture(name))};`).join('\n')
      + `\nconst events: TypedWebhookEvent[] = ${JSON.stringify(fixture('events'))};\nvoid events;`
    const options: ts.CompilerOptions = { noEmit: true, strict: true, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.NodeNext, moduleResolution: ts.ModuleResolutionKind.NodeNext, skipLibCheck: true }
    const host = ts.createCompilerHost(options)
    const read = host.getSourceFile.bind(host)
    host.getSourceFile = (path, language, onError, create) => path === virtualPath ? ts.createSourceFile(path, source, ts.ScriptTarget.ES2022, true) : read(path, language, onError, create)
    const program = ts.createProgram([virtualPath], options, host)
    expect(ts.getPreEmitDiagnostics(program).map(d => ts.flattenDiagnosticMessageText(d.messageText, '\n'))).toEqual([])
  })

  it('stops the iterator on a disappeared cursor instead of repeating the first page', async () => {
    const request = vi.fn()
      .mockResolvedValueOnce(response({ object: 'list', data: [{ id: 'inv_deleted' }], has_more: true, next_cursor: 'inv_deleted' }))
      .mockResolvedValueOnce(response({ error: { type: 'invalid_request_error', code: 'invalid_field_value', param: 'starting_after', message: 'Cursor no longer exists', request_id: 'req_cursor' } }, 400))
    vi.stubGlobal('fetch', request)
    const iterator = new Facturino('fac_test_corpus').invoices.list()[Symbol.asyncIterator]()
    expect((await iterator.next()).value.id).toBe('inv_deleted')
    await expect(iterator.next()).rejects.toMatchObject({ code: 'invalid_field_value', param: 'starting_after' })
    expect(request).toHaveBeenCalledTimes(2)
    expect(String(request.mock.calls[1][0])).toContain('starting_after=inv_deleted')
  })
})
