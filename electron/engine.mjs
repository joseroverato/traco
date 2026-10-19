// Motor completo do app de PC (processo principal): PDFium (tarja definitiva) + OCR em português.
import path from 'node:path'
import fs from 'node:fs'
import { createRequire } from 'node:module'

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

const OBJ = { text: 1, path: 2, image: 3, shading: 4, form: 5 }

/** Aloca N floats no heap do WASM, executa fn e libera. */
function withFloats(m, n, fn) {
  const { malloc, free } = m.pdfium.wasmExports
  const ptr = malloc(4 * n)
  try {
    return fn(ptr, (i) => m.pdfium.getValue(ptr + 4 * i, 'float'))
  } finally {
    free(ptr)
  }
}

const bounds = (m, obj) =>
  withFloats(m, 4, (ptr, get) => (m.FPDFPageObj_GetBounds(obj, ptr, ptr + 4, ptr + 8, ptr + 12) ? { l: get(0), b: get(1), r: get(2), t: get(3) } : null))

const matrixOf = (m, obj) =>
  withFloats(m, 6, (ptr, get) => {
    // FS_MATRIX {a,b,c,d,e,f}
    return m.FPDFPageObj_GetMatrix(obj, ptr) ? [get(0), get(1), get(2), get(3), get(4), get(5)] : [1, 0, 0, 1, 0, 0]
  })

/** Composição: aplica A depois de B (ponto local → B → A). */
const mul = (A, B) => [
  A[0] * B[0] + A[2] * B[1], A[1] * B[0] + A[3] * B[1],
  A[0] * B[2] + A[2] * B[3], A[1] * B[2] + A[3] * B[3],
  A[0] * B[4] + A[2] * B[5] + A[4], A[1] * B[4] + A[3] * B[5] + A[5],
]
const apply = (M, x, y) => [M[0] * x + M[2] * y + M[4], M[1] * x + M[3] * y + M[5]]
const toPage = (M, bb) => {
  const pts = [apply(M, bb.l, bb.b), apply(M, bb.r, bb.b), apply(M, bb.l, bb.t), apply(M, bb.r, bb.t)]
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1])
  return { l: Math.min(...xs), b: Math.min(...ys), r: Math.max(...xs), t: Math.max(...ys) }
}
const touches = (a, R) => a.l < R.r && a.r > R.l && a.b < R.t && a.t > R.b
const inside = (a, R) => a.l >= R.l && a.r <= R.r && a.b >= R.b && a.t <= R.t

/** Ponto da folha (pt, topo-esquerda, já girada) → espaço do PDF. Usa um dispositivo 100× maior para não perder precisão (a API só aceita inteiros). */
function devToPage(m, page, W, H, x, y) {
  const K = 100
  const { malloc, free } = m.pdfium.wasmExports
  const p = malloc(16)
  try {
    if (!m.FPDF_DeviceToPage(page, 0, 0, Math.round(W * K), Math.round(H * K), 0, Math.round(x * K), Math.round(y * K), p, p + 8)) throw new Error('Conversão de coordenadas falhou')
    return [m.pdfium.getValue(p, 'double'), m.pdfium.getValue(p + 8, 'double')]
  } finally {
    free(p)
  }
}

/** Apaga os pixels de uma imagem que ficam sob a tarja. Devolve false se não foi possível (imagem girada/sem bitmap). */
function blankImage(m, page, obj, M, R) {
  const mat = mul(M, matrixOf(m, obj))
  if (Math.abs(mat[1]) > 1e-3 || Math.abs(mat[2]) > 1e-3 || !mat[0] || !mat[3]) return false
  const bmp = m.FPDFImageObj_GetBitmap(obj)
  if (!bmp) return false
  try {
    const w = m.FPDFBitmap_GetWidth(bmp), h = m.FPDFBitmap_GetHeight(bmp)
    // espaço da imagem: quadrado unitário; v cresce para baixo
    const u0 = (R.l - mat[4]) / mat[0], u1 = (R.r - mat[4]) / mat[0]
    const v0 = 1 - (R.t - mat[5]) / mat[3], v1 = 1 - (R.b - mat[5]) / mat[3]
    const x0 = Math.max(0, Math.floor(Math.min(u0, u1) * w)), x1 = Math.min(w, Math.ceil(Math.max(u0, u1) * w))
    const y0 = Math.max(0, Math.floor(Math.min(v0, v1) * h)), y1 = Math.min(h, Math.ceil(Math.max(v0, v1) * h))
    if (x1 <= x0 || y1 <= y0) return true
    m.FPDFBitmap_FillRect(bmp, x0, y0, x1 - x0, y1 - y0, 0xff000000)
    return !!m.FPDFImageObj_SetBitmap(0, 0, obj, bmp)
  } finally {
    m.FPDFBitmap_Destroy(bmp)
  }
}

/**
 * Trechos de texto que realmente têm algum caractere sob a tarja. A caixa do trecho inteiro inclui a altura da linha e
 * "encosta" em texto vizinho; a caixa justa de cada glifo não. Assim só some o que está de fato coberto.
 */
function coveredText(m, page, R) {
  const hit = new Set()
  const tp = m.FPDFText_LoadPage(page)
  if (!tp) return null
  const { malloc, free } = m.pdfium.wasmExports
  const p = malloc(32)
  try {
    const n = m.FPDFText_CountChars(tp)
    for (let i = 0; i < n; i++) {
      if (!m.FPDFText_GetCharBox(tp, i, p, p + 8, p + 16, p + 24)) continue
      const c = { l: m.pdfium.getValue(p, 'double'), r: m.pdfium.getValue(p + 8, 'double'), b: m.pdfium.getValue(p + 16, 'double'), t: m.pdfium.getValue(p + 24, 'double') }
      if (c.r <= c.l || c.t <= c.b || !touches(c, R)) continue
      const obj = m.FPDFText_GetTextObject(tp, i)
      if (obj) hit.add(obj)
    }
  } finally {
    free(p)
    m.FPDFText_ClosePage(tp)
  }
  return hit
}

/** Varre os objetos (da página ou de um formulário) e remove o que está sob a tarja. */
function scrub(m, page, owner, M, R, stats, covered) {
  const isForm = owner !== null
  const count = isForm ? m.FPDFFormObj_CountObjects(owner) : m.FPDFPage_CountObjects(page)
  for (let i = count - 1; i >= 0; i--) {
    const obj = isForm ? m.FPDFFormObj_GetObject(owner, i) : m.FPDFPage_GetObject(page, i)
    if (!obj) continue
    const bb = bounds(m, obj)
    if (!bb) continue
    const pb = toPage(M, bb)
    if (!touches(pb, R)) continue
    const type = m.FPDFPageObj_GetType(obj)
    const remove = () => {
      const ok = isForm ? m.FPDFFormObj_RemoveObject(owner, obj) : m.FPDFPage_RemoveObject(page, obj)
      if (ok) m.FPDFPageObj_Destroy(obj)
      return ok
    }
    if (type === OBJ.text) {
      // trecho com glifo sob a tarja: some inteiro (nunca deixa texto oculto). Se o mapa de glifos falhar, usa a caixa do trecho (mais conservador)
      if ((!covered || covered.has(obj)) && remove()) stats.text++
    } else if (type === OBJ.path || type === OBJ.shading) {
      // traço/preenchimento: só some se estiver totalmente coberto; os que atravessam ficam (medições)
      if (inside(pb, R) && remove()) stats.paths++
    } else if (type === OBJ.image) {
      if (inside(pb, R)) {
        if (remove()) stats.images++
      } else if (blankImage(m, page, obj, M, R)) stats.images++
      else if (remove()) stats.images++
    } else if (type === OBJ.form) {
      scrub(m, page, obj, mul(M, matrixOf(m, obj)), R, stats, covered)
    }
  }
}

function save(m, doc) {
  const w = m.PDFiumExt_OpenFileWriter()
  try {
    if (!m.PDFiumExt_SaveAsCopy(doc, w)) throw new Error('PDFium não conseguiu gravar o PDF')
    const size = m.PDFiumExt_GetFileWriterSize(w)
    const { malloc, free } = m.pdfium.wasmExports
    const buf = malloc(size)
    try {
      m.PDFiumExt_GetFileWriterData(w, buf, size)
      return Buffer.from(m.pdfium.HEAPU8.slice(buf, buf + size))
    } finally {
      free(buf)
    }
  } finally {
    m.PDFiumExt_CloseFileWriter(w)
  }
}

/**
 * Tarja definitiva preservando o vetor: remove texto, pixels de imagens e traços totalmente cobertos.
 * `rect` vem em pontos no sistema da folha (origem no canto superior esquerdo, já girada).
 */
export async function redact(bytes, items) {
  const m = await pdfium()
  const { malloc, free } = m.pdfium.wasmExports
  const src = Buffer.from(bytes)
  const mem = malloc(src.length)
  m.pdfium.HEAPU8.set(src, mem)
  const doc = m.FPDF_LoadMemDocument(mem, src.length, '')
  if (!doc) {
    free(mem)
    throw new Error('PDFium não conseguiu abrir o PDF')
  }
  const stats = { text: 0, paths: 0, images: 0 }
  try {
    const byPage = new Map()
    for (const it of items) {
      if (!byPage.has(it.page)) byPage.set(it.page, [])
      byPage.get(it.page).push(it)
    }
    for (const [i, list] of byPage) {
      const page = m.FPDF_LoadPage(doc, i)
      if (!page) continue
      try {
        const W = m.FPDF_GetPageWidthF(page), H = m.FPDF_GetPageHeightF(page)
        for (const it of list) {
          // sistema da folha → espaço do PDF (cuida de rotação e caixa com origem deslocada)
          const conv = (x, y) => devToPage(m, page, W, H, x, y)
          const a = conv(it.rect[0], it.rect[1]), b = conv(it.rect[2], it.rect[3])
          const R = { l: Math.min(a[0], b[0]), r: Math.max(a[0], b[0]), b: Math.min(a[1], b[1]), t: Math.max(a[1], b[1]) }
          scrub(m, page, null, [1, 0, 0, 1, 0, 0], R, stats, coveredText(m, page, R))
        }
        m.FPDFPage_GenerateContent(page)
      } finally {
        m.FPDF_ClosePage(page)
      }
    }
    const out = save(m, doc)
    out.stats = stats
    return out
  } finally {
    m.FPDF_CloseDocument(doc)
    free(mem)
  }
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
