// Gera THIRD_PARTY_LICENSES.md a partir das dependências diretas do package.json (versão e licença instaladas).
// Uso: npm run licenses
import { readFileSync, writeFileSync, existsSync } from 'node:fs'

const root = new URL('../', import.meta.url)
const pkg = JSON.parse(readFileSync(new URL('package.json', root), 'utf8'))
const names = [...Object.keys(pkg.dependencies ?? {}), ...Object.keys(pkg.devDependencies ?? {})].sort((a, b) => a.localeCompare(b))

const rows = []
for (const name of names) {
  const file = new URL(`node_modules/${name}/package.json`, root)
  if (!existsSync(file)) continue
  const j = JSON.parse(readFileSync(file, 'utf8'))
  const license = typeof j.license === 'object' ? j.license.type : j.license ?? (j.licenses ?? []).map((l) => l.type).join(' OR ') ?? '?'
  const site = typeof j.repository === 'string' ? j.repository : j.repository?.url ?? j.homepage ?? ''
  rows.push({ name, version: j.version, license: license || '?', site: site.replace(/^git\+/, '').replace(/\.git$/, '').replace(/^git:\/\//, 'https://') })
}

const md = `# Licenças de terceiros

O Traço usa as bibliotecas abertas abaixo (dependências diretas; as transitivas têm licenças permissivas equivalentes). Cada pacote traz o seu próprio texto de licença em \`node_modules/<pacote>/\`. Esta lista é gerada por \`npm run licenses\`.

Componentes que merecem destaque:

- **PDFium** (via \`@embedpdf/pdfium\`, WebAssembly): BSD-3-Clause / Apache-2.0 (texto em \`LICENSE.pdfium\` dentro do pacote). Faz a tarja definitiva no app de PC.
- **PDF.js** (\`pdfjs-dist\`): Apache-2.0. Abre e desenha os PDFs.
- **Tesseract.js**: Apache-2.0. OCR em português, com os dados de idioma de \`@tesseract.js-data/por\` (licença no próprio pacote).
- **three.js**: MIT. Modo 3D.
- **Electron**: MIT. App de PC.

| Pacote | Versão | Licença | Origem |
|---|---|---|---|
${rows.map((r) => `| ${r.name} | ${r.version} | ${r.license} | ${r.site} |`).join('\n')}
`
writeFileSync(new URL('THIRD_PARTY_LICENSES.md', root), md)
console.log(`THIRD_PARTY_LICENSES.md: ${rows.length} pacotes`)
