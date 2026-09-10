import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { expect, it } from 'vitest'
import ts from 'typescript'

it('type checks seller routing and payment attribution including historical omissions and explicit null', () => {
  const corpus = JSON.parse(readFileSync(new URL('./fixtures/contract/after-train.json', import.meta.url), 'utf8'))
  const file = fileURLToPath(new URL('./__after_train__.ts', import.meta.url))
  const text = `import type { InvoiceEinvoicing, TypedWebhookEvent } from '../src/index.js';
`
    + `const tracking: InvoiceEinvoicing = ${JSON.stringify(corpus.einvoicing)};
`
    + `const events: TypedWebhookEvent[] = ${JSON.stringify([corpus.paymentEvent, corpus.legacyPaymentEvent, corpus.unattributedPaymentEvent])};`
  const options: ts.CompilerOptions = { noEmit: true, strict: true, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.NodeNext, moduleResolution: ts.ModuleResolutionKind.NodeNext, skipLibCheck: true }
  const host = ts.createCompilerHost(options), read = host.getSourceFile.bind(host)
  host.getSourceFile = (name, ...args) => name === file ? ts.createSourceFile(name, text, ts.ScriptTarget.ES2022, true) : read(name, ...args)
  const program = ts.createProgram([file], options, host)
  expect(ts.getPreEmitDiagnostics(program).map(d => ts.flattenDiagnosticMessageText(d.messageText, '\n'))).toEqual([])
})
