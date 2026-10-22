import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist'
import type { Sheet } from './types'
import type { OptionalContentConfig } from 'pdfjs-dist/types/src/display/optional_content_config'
import { useStore } from './store'
import { t } from './i18n'

// pdf.js só é baixado quando o primeiro PDF é aberto (abertura do app mais rápida).
let lib: Promise<typeof import('pdfjs-dist')> | null = null
function pdfjsLib() {
  if (!lib)
    lib = (async () => {
      // WebViews antigas (Android) não têm Promise.withResolvers: usam a versão "legacy" do pdf.js, que traz os remendos
      const old = !('withResolvers' in Promise)
      const pdfjs = (old ? await import('pdfjs-dist/legacy/build/pdf.mjs') : await import('pdfjs-dist')) as typeof import('pdfjs-dist')
      if (import.meta.env.VITE_SINGLE === '1') {
        // prévia em arquivo único: worker embutido via Blob
        const code = (await import('pdfjs-dist/build/pdf.worker.min.mjs?raw')).default
        pdfjs.GlobalWorkerOptions.workerSrc = URL.createObjectURL(new Blob([code], { type: 'text/javascript' }))
      } else if (old) {
        pdfjs.GlobalWorkerOptions.workerSrc = (await import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url')).default
      } else {
        pdfjs.GlobalWorkerOptions.workerSrc = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default
      }
      return pdfjs
    })()
  return lib
}

export type { PDFDocumentProxy, PDFPageProxy }
export const pdfOps = async () => (await pdfjsLib()).OPS

export interface Source {
  id: string
  name: string
  bytes: ArrayBuffer // cópia íntegra (pdf.js consome o buffer que recebe)
  doc: PDFDocumentProxy
}

const uid = () => Math.random().toString(36).slice(2, 10)

export async function openSource(data: ArrayBuffer, name: string, id = uid()): Promise<Source> {
  const bytes = data.slice(0)
  const pdfjs = await pdfjsLib()
  const doc = await pdfjs.getDocument({ data: new Uint8Array(data) }).promise
  return { id, name, bytes, doc }
}

export async function sheetsOf(src: Source): Promise<Sheet[]> {
  let labels: string[] | null = null
  try {
    labels = await src.doc.getPageLabels()
  } catch {
    labels = null
  }
  const out: Sheet[] = []
  for (let i = 0; i < src.doc.numPages; i++) {
    const p = await src.doc.getPage(i + 1)
    const vp = p.getViewport({ scale: 1 })
    out.push({ id: uid(), src: src.id, srcIndex: i, baseRot: p.rotate, rot: 0, label: labels?.[i] || t('pdf.folha', { v: i + 1 }), width: vp.width, height: vp.height })
  }
  return out
}

export const sheetRotation = (s: Sheet) => (((s.baseRot + s.rot) % 360) + 360) % 360

export function viewportOf(page: PDFPageProxy, s: Sheet, scale: number) {
  return page.getViewport({ scale, rotation: sheetRotation(s) })
}

/** Texto da página (para detectar número de prancha). */
export async function pageText(src: Source, index: number) {
  const p = await src.doc.getPage(index + 1)
  const tc = await p.getTextContent()
  return tc.items.map((i) => ('str' in i ? i.str : '')).join(' ')
}

/** Renderiza uma folha num canvas com largura alvo (miniaturas, comparação). */
export async function renderSheet(src: Source, s: Sheet, scale: number, canvas = document.createElement('canvas')) {
  const page = await src.doc.getPage(s.srcIndex + 1)
  const vp = viewportOf(page, s, scale)
  canvas.width = Math.ceil(vp.width)
  canvas.height = Math.ceil(vp.height)
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  const oc = await ocConfig(src)
  await page.render({ canvasContext: ctx, viewport: vp, ...(oc ? { optionalContentConfigPromise: Promise.resolve(oc) } : {}) }).promise
  return canvas
}

/**
 * Escalas escritas num texto de prancha, da mais frequente para a menos: "ESC 1:50", "ESCALA 1/100", "SCALE 1:50",
 * "ÉCHELLE 1:20", "MASSSTAB 1:100" / "M 1:50", "SCALA 1:50", "比例 1:50"… (os idiomas do Traço).
 */
export function scalesIn(txt: string): number[] {
  const re = /(?:(?<![A-Za-zÀ-ÿ])ESC(?:ALA)?|(?<![A-Za-zÀ-ÿ])SCALE|(?<![A-Za-zÀ-ÿ])SCALA|(?<![A-Za-zÀ-ÿ])[EÉ]CHELLE|(?<![A-Za-zÀ-ÿ])MA(?:SS|ß)STAB|(?<![A-Za-zÀ-ÿ])M(?=\.?\s*1\s*[:/])|比例)\.?\s*[:=–-：]?\s*1\s*[:/]\s*(\d{1,4})(?!\s*["”″])/gi
  const count = new Map<number, number>()
  for (const m of txt.matchAll(re)) {
    const n = Number(m[1])
    if (n >= 1 && n <= 5000) count.set(n, (count.get(n) ?? 0) + 1)
  }
  // escrita americana: 1/4" = 1'-0", 1-1/2" = 1'-0", 1" = 20'
  const us = /(\d+(?:-\d+\/\d+|\/\d+)?)\s*(?:["”″]|in\b)\s*=\s*(\d+)\s*['′’]\s*(?:-?\s*0\s*["”″]?)?/gi
  for (const m of txt.matchAll(us)) {
    const [whole, frac] = m[1].split('-')
    const paper = frac ? Number(whole) + Number(frac.split('/')[0]) / Number(frac.split('/')[1]) : whole.includes('/') ? Number(whole.split('/')[0]) / Number(whole.split('/')[1]) : Number(whole)
    const n = Math.round((Number(m[2]) * 12) / paper)
    if (paper > 0 && n >= 1 && n <= 5000) count.set(n, (count.get(n) ?? 0) + 1)
  }
  return [...count.entries()].sort((x, y) => y[1] - x[1]).map(([n]) => n)
}

/** Procura a escala escrita na prancha. Retorna os N encontrados, do mais frequente. */
export async function detectScales(src: Source, index: number): Promise<number[]> {
  try {
    return scalesIn(await pageText(src, index))
  } catch {
    return []
  }
}

// ---------------------------------------------------------------- camadas (OCG) do PDF
const ocCache = new Map<string, Promise<OptionalContentConfig | null>>()

/** Configuração de camadas do PDF com as ocultas aplicadas (null se o PDF não tem camadas). */
export function ocConfig(src: Source): Promise<OptionalContentConfig | null> {
  let p = ocCache.get(src.id)
  if (!p) {
    p = src.doc.getOptionalContentConfig().catch(() => null)
    ocCache.set(src.id, p)
  }
  const hidden = useStore.getState().hiddenLayers[src.id] ?? []
  return p.then((cfg) => {
    if (!cfg) return null
    const groups = cfg.getGroups() as Record<string, unknown> | null
    if (!groups || !Object.keys(groups).length) return null
    for (const id of Object.keys(groups)) cfg.setVisibility(id, !hidden.includes(id))
    return cfg
  })
}

export interface LayerInfo { id: string; name: string; depth: number }
/** Lista de camadas na ordem do PDF (com hierarquia). */
export async function layersOf(src: Source): Promise<LayerInfo[]> {
  const cfg = await ocConfig(src)
  if (!cfg) return []
  const groups = cfg.getGroups() as Record<string, { name: string }>
  const out: LayerInfo[] = []
  const seen = new Set<string>()
  const walk = (items: unknown, depth: number) => {
    if (!Array.isArray(items)) return
    for (const it of items) {
      if (typeof it === 'string') {
        if (groups[it] && !seen.has(it)) { seen.add(it); out.push({ id: it, name: groups[it].name || it, depth }) }
      } else if (it && typeof it === 'object' && 'order' in (it as object)) walk((it as { order: unknown }).order, depth + 1)
    }
  }
  walk(cfg.getOrder(), 0)
  for (const [id, g] of Object.entries(groups)) if (!seen.has(id)) out.push({ id, name: g.name || id, depth: 0 })
  return out
}

/** Chave que muda quando a visibilidade das camadas de uma fonte muda (para caches). */
export const layerKey = (srcId: string) => (useStore.getState().hiddenLayers[srcId] ?? []).join(',')
