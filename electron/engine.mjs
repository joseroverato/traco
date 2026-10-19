// Motor completo do app de PC (processo principal): MuPDF + OCR em português.
import * as mupdf from 'mupdf'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

const open = (bytes) => mupdf.Document.openDocument(Buffer.from(bytes), 'application/pdf').asPDF()
const out = (doc, opts) => Buffer.from(doc.saveToBuffer(opts).asUint8Array())

/** Tarja definitiva: remove texto, imagens (pixels) e traços totalmente cobertos. */
export function redact(bytes, items) {
  const doc = open(bytes)
  const byPage = new Map()
  for (const it of items) {
    if (!byPage.has(it.page)) byPage.set(it.page, [])
    byPage.get(it.page).push(it)
  }
  for (const [i, list] of byPage) {
    const page = doc.loadPage(i)
    for (const it of list) {
      const a = page.createAnnotation('Redact')
      a.setRect(it.rect)
      a.update()
    }
    page.applyRedactions(false, mupdf.PDFPage.REDACT_IMAGE_PIXELS, mupdf.PDFPage.REDACT_LINE_ART_REMOVE_IF_COVERED, mupdf.PDFPage.REDACT_TEXT_REMOVE)
  }
  return out(doc, 'garbage,compress')
}

/** Otimização: remove objetos duplicados/órfãos, comprime fluxos, fontes e imagens, subconjunto de fontes. */
export function optimize(bytes) {
  const doc = open(bytes)
  try {
    doc.subsetFonts()
  } catch {
    /* alguns PDFs não permitem */
  }
  const res = out(doc, 'garbage=deduplicate,compress,compress-fonts,compress-images,clean')
  return res.length < bytes.length ? res : Buffer.from(bytes) // nunca piora o arquivo
}

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
