import { beforeAll, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs'
import { redactWith } from '../shared/redact-core.mjs'
import type { PdfiumModule } from '../shared/redact-core.mjs'

/** A tarja definitiva (mesmo código do app de PC e da versão web) tem de remover o conteúdo de verdade. */
const require = createRequire(import.meta.url)
let m: PdfiumModule

beforeAll(async () => {
  const { init } = await import('@embedpdf/pdfium')
  m = (await init({ wasmBinary: readFileSync(require.resolve('@embedpdf/pdfium/pdfium.wasm')) })) as unknown as PdfiumModule
  m.PDFiumExt_Init()
}, 30000)

// folha A4 (595 × 842 pt); textos em posições bem separadas
async function fixture() {
  const doc = await PDFDocument.create()
  const page = doc.addPage([595, 842])
  const font = await doc.embedFont(StandardFonts.Helvetica)
  page.drawText('SEGREDO', { x: 100, y: 700, size: 14, font })
  page.drawText('PUBLICO', { x: 100, y: 500, size: 14, font })
  page.drawText('VIZINHO', { x: 100, y: 683, size: 14, font }) // logo abaixo de SEGREDO, quase encostando
  page.drawLine({ start: { x: 50, y: 300 }, end: { x: 500, y: 300 }, thickness: 2, color: rgb(0, 0, 0) })
  return new Uint8Array(await doc.save())
}

async function textos(bytes: Uint8Array) {
  const d = await pdfjs.getDocument({ data: bytes.slice(), useSystemFonts: true }).promise
  const out: string[] = []
  for (let i = 1; i <= d.numPages; i++) out.push(...(await (await d.getPage(i)).getTextContent()).items.map((t) => ('str' in t ? t.str : '')))
  return out.join(' ')
}

describe('tarja definitiva (PDFium)', () => {
  it('remove o texto coberto e mantém o resto', async () => {
    const src = await fixture()
    expect(await textos(src)).toContain('SEGREDO')
    // topo-esquerda: SEGREDO está em y=700 (de baixo) → 842−700 = 142 do topo
    const out = redactWith(m, src, [{ page: 0, rect: [90, 130, 200, 148] }])
    const t = await textos(out)
    expect(t).not.toContain('SEGREDO')
    expect(t).toContain('PUBLICO')
  })

  it('não apaga texto vizinho que só encosta na tarja', async () => {
    const out = redactWith(m, await fixture(), [{ page: 0, rect: [90, 130, 200, 148] }])
    expect(await textos(out)).toContain('VIZINHO')
  })

  it('traço que atravessa a tarja é mantido (medições); só some o totalmente coberto', async () => {
    const src = await fixture()
    const out = redactWith(m, src, [{ page: 0, rect: [200, 535, 260, 549] }]) // cruza a linha em y=300 → 542 do topo
    expect(out.stats?.paths).toBe(0)
    const total = redactWith(m, src, [{ page: 0, rect: [30, 530, 520, 555] }]) // cobre a linha inteira
    expect(total.stats?.paths).toBe(1)
  })

  it('PDF inválido dá erro claro', () => {
    expect(() => redactWith(m, new Uint8Array([1, 2, 3, 4]), [{ page: 0, rect: [0, 0, 10, 10] }])).toThrow(/PDFium/)
  })

  it('devolve um PDF que ainda abre', async () => {
    const out = redactWith(m, await fixture(), [{ page: 0, rect: [90, 130, 200, 148] }])
    expect(new TextDecoder().decode(out.slice(0, 5))).toBe('%PDF-')
    expect(await textos(out)).toContain('PUBLICO')
  })
})
