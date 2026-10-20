/** Detecção de contornos e símbolos fora do visualizador (usado pelo Claude). */
import { useStore } from './store'
import { findSnap, snapIndexFor } from './snap'
import type { SnapIndex } from './snap'
import { fillAt, findSymbols, reasonText } from './geoWorker'
import { polyArea } from './geometry'
import type { Pt, Sheet } from './types'
import { t } from './i18n'

export async function indexFor(sh: Sheet): Promise<SnapIndex> {
  const src = useStore.getState().sources[sh.src]
  const page = await src.doc.getPage(sh.srcIndex + 1)
  return snapIndexFor(page, sh, src)
}

const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y)

/** Descarta vazios pequenos (símbolos, pilares) — abaixo do mínimo configurado em m². */
export function filterHoles(sheetId: string, holes: Pt[][]) {
  const st = useStore.getState()
  const sc = st.scales[sheetId]
  const min = sc ? st.minHole / (sc.metersPerUnit * sc.metersPerUnit) : 400
  return holes.filter((h) => polyArea(h) >= min)
}

/** Ajusta os vértices do contorno aos cantos reais e remove os pontos intermediários alinhados. */
export function refineRing(idx: SnapIndex | null, ring: Pt[], halfLine: number): Pt[] {
  const tol = halfLine + 1.8
  const pts: { p: Pt; corner: boolean }[] = []
  for (const v of ring) {
    const h = findSnap(idx, v, tol, [])
    const corner = !!h && (h.kind === 'endpoint' || h.kind === 'intersection')
    const q = corner ? h!.pt : v
    if (!pts.length || dist(pts[pts.length - 1].p, q) > 0.4) pts.push({ p: q, corner })
  }
  if (pts.length > 2 && dist(pts[0].p, pts[pts.length - 1].p) < 0.4) pts.pop()
  // tira vértices quase alinhados com os vizinhos (ruído da rasterização ao longo de uma linha)
  const lineTol = halfLine + 1.2
  const off = (a: Pt, b: Pt, c: Pt) => {
    const L = dist(a, c)
    return L < 1e-6 ? dist(a, b) : Math.abs((c.x - a.x) * (a.y - b.y) - (a.x - b.x) * (c.y - a.y)) / L
  }
  let changed = true
  while (changed && pts.length > 3) {
    changed = false
    for (let i = 0; i < pts.length && pts.length > 3; i++) {
      const a = pts[(i - 1 + pts.length) % pts.length], b = pts[i], c = pts[(i + 1) % pts.length]
      const t = off(a.p, b.p, c.p)
      if ((!b.corner && t < lineTol) || t < 0.25) {
        pts.splice(i, 1)
        changed = true
        i--
      }
    }
  }
  return pts.map((x) => x.p)
}

/** Contorno fechado em volta do ponto, com vértices ajustados aos cantos reais. */
export async function detectRegion(sh: Sheet, p: Pt, gap = useStore.getState().fillGap): Promise<{ outer: Pt[]; holes: Pt[][] } | string> {
  const idx = await indexFor(sh)
  const r = await fillAt(sh, idx, p, gap)
  if (!r.ok) return reasonText(r.reason) ?? t('regions.nao_foi_possivel_detectar')
  const refine = (ring: Pt[]) => refineRing(idx, ring, r.halfLine ?? 1)
  const outer = refine(r.outer!)
  if (outer.length < 3) return 'Contorno muito pequeno'
  return { outer, holes: filterHoles(sh.id, r.holes!.map(refine).filter((h) => h.length >= 3)) }
}

/** Procura cópias do desenho dentro de `rect` (na folha `source`) nas folhas `targets`. */
export async function symbolsIn(source: Sheet, rect: { x: number; y: number; w: number; h: number }, targets: Sheet[]) {
  const srcIdx = await indexFor(source)
  const out: Record<string, Pt[]> = {}
  for (const sh of targets) {
    const idx = sh.id === source.id ? srcIdx : await indexFor(sh)
    const r = await findSymbols(sh, idx, source, srcIdx, rect, true)
    if (r.ok) out[sh.id] = r.centers.map(([x, y]) => ({ x, y }))
    else if (r.reason === 'vector-empty' && sh.id === source.id) {
      const { findSymbolsRasterOn } = await import('./symbolRaster')
      out[sh.id] = await findSymbolsRasterOn(sh, rect)
    } else out[sh.id] = []
  }
  return out
}
