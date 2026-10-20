/**
 * Snap na geometria vetorial do PDF (linhas de parede, cotas, eixos…).
 * Extrai os segmentos do conteúdo da página (operator list do pdf.js), guarda num índice
 * em grade e responde: extremidade, interseção, ponto médio ou ponto sobre a linha.
 */
import type { PDFPageProxy } from 'pdfjs-dist'
import { layerKey, ocConfig, pdfOps, viewportOf } from './pdf'
import type { Source } from './pdf'
import type { Pt, Sheet } from './types'
import { t } from './i18n'

export type SnapKind = 'endpoint' | 'intersection' | 'midpoint' | 'nearest' | 'markup'
export interface SnapHit {
  pt: Pt
  kind: SnapKind
  seg?: [number, number, number, number]
}

type M = [number, number, number, number, number, number]
const mul = (a: M, b: M): M => [
  a[0] * b[0] + a[1] * b[2], a[0] * b[1] + a[1] * b[3],
  a[2] * b[0] + a[3] * b[2], a[2] * b[1] + a[3] * b[3],
  a[4] * b[0] + a[5] * b[2] + b[4], a[4] * b[1] + a[5] * b[3] + b[5],
]
const ap = (m: M, x: number, y: number): [number, number] => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]]

const CELL = 12 // pt
const MAX_SEGS = 1_500_000

export class SnapIndex {
  segs: Float32Array
  n = 0
  grid = new Map<number, number[]>()
  constructor(cap = 4096) {
    this.segs = new Float32Array(cap * 4)
  }
  private key(cx: number, cy: number) {
    return (cx + 1024) * 8192 + (cy + 1024)
  }
  add(x1: number, y1: number, x2: number, y2: number) {
    const len = Math.hypot(x2 - x1, y2 - y1)
    if (len < 0.3 || this.n >= MAX_SEGS) return
    if (this.n * 4 + 4 > this.segs.length) {
      const g = new Float32Array(this.segs.length * 2)
      g.set(this.segs)
      this.segs = g
    }
    const id = this.n++
    this.segs.set([x1, y1, x2, y2], id * 4)
    // registra a linha em todas as células que ela atravessa
    const steps = Math.max(1, Math.ceil(len / (CELL / 2)))
    let last = -1
    for (let i = 0; i <= steps; i++) {
      const t = i / steps
      const k = this.key(Math.floor((x1 + (x2 - x1) * t) / CELL), Math.floor((y1 + (y2 - y1) * t) / CELL))
      if (k === last) continue
      last = k
      const arr = this.grid.get(k)
      if (!arr) this.grid.set(k, [id])
      else if (arr[arr.length - 1] !== id) arr.push(id)
    }
  }
  near(p: Pt, r: number): number[] {
    const out = new Set<number>()
    const x0 = Math.floor((p.x - r) / CELL), x1 = Math.floor((p.x + r) / CELL)
    const y0 = Math.floor((p.y - r) / CELL), y1 = Math.floor((p.y + r) / CELL)
    for (let cx = x0; cx <= x1; cx++)
      for (let cy = y0; cy <= y1; cy++) {
        const arr = this.grid.get(this.key(cx, cy))
        if (arr) for (const id of arr) out.add(id)
      }
    return [...out]
  }
  seg(id: number): [number, number, number, number] {
    const o = id * 4
    return [this.segs[o], this.segs[o + 1], this.segs[o + 2], this.segs[o + 3]]
  }
}

const cache = new Map<string, Promise<SnapIndex>>()

/** Índice de snap da folha (calculado uma vez, em segundo plano). */
export function snapIndexFor(page: PDFPageProxy, sheet: Sheet, src?: Source): Promise<SnapIndex> {
  const key = `${sheet.src}:${sheet.srcIndex}:${sheet.rot}:${layerKey(sheet.src)}`
  let p = cache.get(key)
  if (!p) {
    p = build(page, sheet, src)
    cache.set(key, p)
  }
  return p
}

async function build(page: PDFPageProxy, sheet: Sheet, src?: Source): Promise<SnapIndex> {
  const OPS = await pdfOps()
  const oc = src ? await ocConfig(src) : null
  const vis: boolean[] = [] // pilha de conteúdo marcado: false = camada oculta
  let hiddenDepth = 0
  const vp = viewportOf(page, sheet, 1)
  const V = vp.transform as M
  const ol = await page.getOperatorList()
  const idx = new SnapIndex()
  let ctm: M = [1, 0, 0, 1, 0, 0]
  const stack: M[] = []
  const toView = (x: number, y: number) => {
    const [ux, uy] = ap(ctm, x, y)
    return ap(V, ux, uy)
  }
  for (let i = 0; i < ol.fnArray.length; i++) {
    const fn = ol.fnArray[i]
    const a = ol.argsArray[i]
    if (fn === OPS.beginMarkedContentProps) {
      const v = !(oc && a[0] === 'OC' && a[1] && !oc.isVisible(a[1]))
      vis.push(v)
      if (!v) hiddenDepth++
      continue
    } else if (fn === OPS.beginMarkedContent) {
      vis.push(true)
      continue
    } else if (fn === OPS.endMarkedContent) {
      if (vis.pop() === false) hiddenDepth--
      continue
    }
    if (fn === OPS.save) stack.push(ctm)
    else if (fn === OPS.restore) ctm = stack.pop() ?? ctm
    else if (fn === OPS.transform) ctm = mul(a as M, ctm)
    else if (fn === OPS.paintFormXObjectBegin) {
      stack.push(ctm)
      if (Array.isArray(a[0]) || a[0] instanceof Float32Array) ctm = mul(Array.from(a[0] as number[]) as M, ctm)
    } else if (fn === OPS.paintFormXObjectEnd) ctm = stack.pop() ?? ctm
    else if (fn === OPS.constructPath && hiddenDepth === 0) {
      const ops = a[0] as number[]
      const c = a[1] as number[]
      let k = 0
      let cur: [number, number] | null = null
      let start: [number, number] | null = null
      for (const op of ops) {
        if (op === OPS.moveTo) {
          cur = toView(c[k], c[k + 1])
          start = cur
          k += 2
        } else if (op === OPS.lineTo) {
          const nx = toView(c[k], c[k + 1])
          if (cur) idx.add(cur[0], cur[1], nx[0], nx[1])
          cur = nx
          k += 2
        } else if (op === OPS.curveTo) {
          // curva: aproxima por 4 trechos retos (snap em arcos de portas, pilares redondos…)
          const p0 = cur
          const p1 = [c[k], c[k + 1]], p2 = [c[k + 2], c[k + 3]], p3 = [c[k + 4], c[k + 5]]
          const end = toView(p3[0], p3[1])
          if (p0) curve(idx, p0, toView(p1[0], p1[1]), toView(p2[0], p2[1]), end)
          cur = end
          k += 6
        } else if (op === OPS.curveTo2 || op === OPS.curveTo3) {
          const end = toView(c[k + 2], c[k + 3])
          if (cur) idx.add(cur[0], cur[1], end[0], end[1])
          cur = end
          k += 4
        } else if (op === OPS.rectangle) {
          const x = c[k], y = c[k + 1], w = c[k + 2], h = c[k + 3]
          const p = [toView(x, y), toView(x + w, y), toView(x + w, y + h), toView(x, y + h)]
          for (let j = 0; j < 4; j++) idx.add(p[j][0], p[j][1], p[(j + 1) % 4][0], p[(j + 1) % 4][1])
          cur = p[0]
          start = p[0]
          k += 4
        } else if (op === OPS.closePath) {
          if (cur && start) idx.add(cur[0], cur[1], start[0], start[1])
          cur = start
        }
      }
    }
    if (i % 20000 === 0) await new Promise((r) => setTimeout(r)) // não trava a tela em plantas grandes
  }
  return idx
}

function curve(idx: SnapIndex, p0: [number, number], p1: [number, number], p2: [number, number], p3: [number, number]) {
  let prev = p0
  for (let s = 1; s <= 4; s++) {
    const t = s / 4, u = 1 - t
    const x = u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0]
    const y = u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1]
    idx.add(prev[0], prev[1], x, y)
    prev = [x, y]
  }
}

function project(p: Pt, s: [number, number, number, number]) {
  const [x1, y1, x2, y2] = s
  const dx = x2 - x1, dy = y2 - y1
  const L2 = dx * dx + dy * dy
  const t = Math.max(0, Math.min(1, ((p.x - x1) * dx + (p.y - y1) * dy) / L2))
  return { x: x1 + dx * t, y: y1 + dy * t, t }
}

function intersect(a: [number, number, number, number], b: [number, number, number, number]): Pt | null {
  const [x1, y1, x2, y2] = a, [x3, y3, x4, y4] = b
  const d = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4)
  if (Math.abs(d) < 1e-9) return null
  const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / d
  const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / d
  if (t < -0.001 || t > 1.001 || u < -0.001 || u > 1.001) return null
  return { x: x1 + t * (x2 - x1), y: y1 + t * (y2 - y1) }
}

const d = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y)

/**
 * Melhor ponto de snap perto de `p`. `tol` em unidades da folha (pt).
 * Prioridade: vértice de marcação > extremidade > interseção > ponto médio > sobre a linha.
 */
export function findSnap(idx: SnapIndex | null, p: Pt, tol: number, extra: Pt[] = []): SnapHit | null {
  let best: SnapHit | null = null
  let bestD = Infinity
  for (const q of extra) {
    const dd = d(p, q)
    if (dd < tol && dd < bestD) {
      best = { pt: q, kind: 'markup' }
      bestD = dd
    }
  }
  if (best) return best
  if (!idx) return null
  const ids = idx.near(p, tol)
  if (!ids.length) return null
  // extremidades
  for (const id of ids) {
    const s = idx.seg(id)
    for (const q of [{ x: s[0], y: s[1] }, { x: s[2], y: s[3] }]) {
      const dd = d(p, q)
      if (dd < tol && dd < bestD) {
        best = { pt: q, kind: 'endpoint', seg: s }
        bestD = dd
      }
    }
  }
  if (best && bestD < tol * 0.6) return best
  // segmentos que passam perto do cursor
  const close = ids
    .map((id) => {
      const s = idx.seg(id)
      const pr = project(p, s)
      return { s, pr, dd: d(p, pr) }
    })
    .filter((c) => c.dd < tol)
    .sort((a, b) => a.dd - b.dd)
    .slice(0, 24)
  // interseções
  for (let i = 0; i < close.length; i++)
    for (let j = i + 1; j < close.length; j++) {
      const q = intersect(close[i].s, close[j].s)
      if (!q) continue
      const dd = d(p, q)
      if (dd < tol && dd < bestD) {
        best = { pt: q, kind: 'intersection' }
        bestD = dd
      }
    }
  if (best) return best
  // ponto médio
  for (const c of close) {
    const m = { x: (c.s[0] + c.s[2]) / 2, y: (c.s[1] + c.s[3]) / 2 }
    const dd = d(p, m)
    if (dd < tol * 0.7 && dd < bestD) {
      best = { pt: m, kind: 'midpoint', seg: c.s }
      bestD = dd
    }
  }
  if (best) return best
  // sobre a linha (perpendicular)
  if (close[0]) return { pt: { x: close[0].pr.x, y: close[0].pr.y }, kind: 'nearest', seg: close[0].s }
  return null
}

export const SNAP_LABEL: Record<SnapKind, string> = {
  get endpoint() { return t('snap.extremidade') },
  get intersection() { return t('snap.intersecao') },
  get midpoint() { return t('snap.ponto_medio') },
  get nearest() { return t('snap.sobre_a_linha') },
  get markup() { return t('snap.vertice') },
}
