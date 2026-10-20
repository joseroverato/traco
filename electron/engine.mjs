// Motor completo do app de PC (processo principal): PDFium (tarja definitiva) + OCR em português.
import path from 'node:path'
import fs from 'node:fs'
import { createRequire } from 'node:module'

import { redactWith } from '../shared/redact-core.mjs'

const require = createRequire(import.meta.url)

// ---------------------------------------------------------------- PDFium (WebAssembly, licença MIT/BSD)
let pdfiumP = null
function pdfium() {
  if (!pdfiumP)
    pdfiumP = (async () => {
      const { init } = await import('@embedpdf/pdfium')
      const wasmBinary = fs.readFileSync(require.resolve('@embedpdf/pdfium/pdfium.wasm'))
      const m = await init({ wasmBinary })
      m.PDFiumExt_Init()
      return m
    })()
  return pdfiumP
}

/**
 * Tarja definitiva preservando o vetor: remove texto, pixels de imagens e traços totalmente cobertos.
 * `rect` vem em pontos no sistema da folha (origem no canto superior esquerdo, já girada).
 */
export async function redact(bytes, items) {
  const out = Buffer.from(redactWith(await pdfium(), bytes, items))
  return out
}

// ---------------------------------------------------------------- OCR
let workerP = null
async function worker(cacheDir) {
  if (!workerP) {
    const { createWorker } = await import('tesseract.js')
    const langDir = path.join(path.dirname(require.resolve('@tesseract.js-data/por/package.json')), '4.0.0')
    workerP = createWorker('por', 1, { langPath: langDir, cachePath: cacheDir, gzip: true })
  }
  return workerP
}

/** OCR de uma imagem PNG (folha renderizada). Retorna palavras com caixa em px. */
export async function ocr(png, cacheDir) {
  const w = await worker(cacheDir)
  const { data } = await w.recognize(Buffer.from(png), {}, { blocks: true, text: true })
  const words = []
  for (const b of data.blocks ?? [])
    for (const p of b.paragraphs ?? [])
      for (const l of p.lines ?? [])
        for (const wd of l.words ?? []) {
          if (!wd.text?.trim()) continue
          words.push({ text: wd.text, x: wd.bbox.x0, y: wd.bbox.y0, w: wd.bbox.x1 - wd.bbox.x0, h: wd.bbox.y1 - wd.bbox.y0, conf: Math.round(wd.confidence) })
        }
  return { text: data.text ?? '', words }
}

export async function shutdown() {
  if (workerP) (await workerP).terminate()
}
