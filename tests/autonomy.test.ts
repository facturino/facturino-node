import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { expect, it } from 'vitest'
import ts from 'typescript'
it('types operational projections, nullable history and autonomous event families', () => {
  const corpus = JSON.parse(readFileSync(new URL('./fixtures/contract/autonomy.json', import.meta.url), 'utf8'))
  const file = fileURLToPath(new URL('./__autonomy__.ts', import.meta.url))
  const source = `import type { ObligationFollowUp, InvoiceEinvoicing, PaymentCollectionStatus, TypedWebhookEvent } from '../src/index.js';
const obligation: ObligationFollowUp = ${JSON.stringify(corpus.obligation)};
const completed: ObligationFollowUp = ${JSON.stringify(corpus.completed)};
const customerAction: ObligationFollowUp = ${JSON.stringify(corpus.customerAction)};
const invoice: InvoiceEinvoicing = ${JSON.stringify(corpus.einvoicing)};
const payment: PaymentCollectionStatus = ${JSON.stringify(corpus.fr212)};
const events: TypedWebhookEvent[] = ${JSON.stringify(corpus.events)};
const historical: Pick<InvoiceEinvoicing, 'obligation'>[] = [{}, {obligation: null}];`
  const options: ts.CompilerOptions = { noEmit: true, strict: true, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.NodeNext, moduleResolution: ts.ModuleResolutionKind.NodeNext, skipLibCheck: true }
  const host = ts.createCompilerHost(options), read = host.getSourceFile.bind(host)
  host.getSourceFile = (name, ...args) => name === file ? ts.createSourceFile(name, source, ts.ScriptTarget.ES2022, true) : read(name, ...args)
  expect(ts.getPreEmitDiagnostics(ts.createProgram([file], options, host)).map(d => ts.flattenDiagnosticMessageText(d.messageText, '\n'))).toEqual([])
})
