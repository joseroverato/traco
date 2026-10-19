// Gera release/latest.yml (lido pelo electron-updater) para o instalador NSIS próprio.
import { createHash } from 'node:crypto'
import { readFileSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url)))
const name = `Traco-Setup-${pkg.version}.exe`
const file = path.join('release', name)
const buf = readFileSync(file)
const sha512 = createHash('sha512').update(buf).digest('base64')
const size = statSync(file).size
const yml = `version: ${pkg.version}
files:
  - url: ${name}
    sha512: ${sha512}
    size: ${size}
path: ${name}
sha512: ${sha512}
releaseDate: '${new Date().toISOString()}'
`
writeFileSync(path.join('release', 'latest.yml'), yml)
console.log(yml)
