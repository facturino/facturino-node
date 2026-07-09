// Marks the CommonJS build as such for Node's module resolver.
//
// The package root declares "type": "module", so Node would otherwise treat
// every .js file — including the CommonJS output under dist/cjs/ — as ESM and
// fail to load it via require(). Dropping a { "type": "commonjs" } manifest in
// dist/cjs/ scopes that subtree back to CommonJS, completing the dual build.
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

// npm runs scripts with the package root as the working directory.
const cjsDir = resolve('dist', 'cjs')
mkdirSync(cjsDir, { recursive: true })
writeFileSync(resolve(cjsDir, 'package.json'), `${JSON.stringify({ type: 'commonjs' }, null, 2)}\n`)
console.log('fixup-cjs: wrote dist/cjs/package.json { "type": "commonjs" }')
