// Motor completo do app de PC (processo principal): PDFium (tarja definitiva) + OCR (português e inglês embutidos; outros idiomas sob demanda).
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
// Português e inglês vão dentro do instalador; os demais idiomas são baixados uma vez (com a permissão da pessoa) e ficam no cache.
const BUNDLED = { por: '@tesseract.js-data/por', eng: '@tesseract.js-data/eng' }
const CODES = { pt: 'por', en: 'eng', es: 'spa', fr: 'fra', de: 'deu', it: 'ita', zh: 'chi_sim' }
const workers = new Map()
const code = (lang) => CODES[lang] ?? 'eng'

/** O idioma de OCR já está disponível sem internet? Se não, `size` é o tamanho aproximado do download (MB). */
export function ocrStatus(lang, cacheDir) {
  const c = code(lang)
  const ready = c in BUNDLED || ['.traineddata', '.traineddata.gz'].some((e) => fs.existsSync(path.join(cacheDir, c + e)))
  return { ready, size: 4 }
}

async function worker(lang, cacheDir) {
  const c = code(lang)
  if (!workers.has(c)) {
    const { createWorker } = await import('tesseract.js')
    const opts = { cachePath: cacheDir, gzip: true }
    if (c in BUNDLED) opts.langPath = path.join(path.dirname(require.resolve(BUNDLED[c] + '/package.json')), '4.0.0')
    const p = createWorker(c, 1, opts)
    p.catch(() => workers.delete(c)) // falha (ex.: sem internet): tenta de novo na próxima vez
    workers.set(c, p)
  }
  return workers.get(c)
}

/** OCR de uma imagem PNG (folha renderizada). Retorna palavras com caixa em px. */
export async function ocr(png, cacheDir, lang = 'pt') {
  const w = await worker(lang, cacheDir)
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
  for (const p of workers.values()) (await p.catch(() => null))?.terminate()
}
