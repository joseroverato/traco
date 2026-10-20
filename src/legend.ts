import { useStore } from './store'
import { bbox } from './geometry'
import { summarize } from './summary'
import type { Markup } from './types'

/** Linhas da legenda (também usadas na exportação para PDF). */
export function legendRows(m: Markup) {
  const s = useStore.getState()
  const scope = m.legend?.scope ?? 'sheet'
  const ms = s.markups.filter((x) => x.kind !== 'viewport' && (scope === 'all' || x.page === m.page))
  return summarize(ms, s.presets, s.scales, s.sheets, s.markups)
}

/** Geometria da tabela da legenda em unidades da folha (pt). */
export function legendLayout(m: Markup, rows: ReturnType<typeof legendRows>) {
  const b = bbox(m.points)
  const fs = m.fontSize || 8
  const lh = fs * 1.7
  const head = fs * 2.2
  const prices = !!m.legend?.prices && rows.some((r) => r.price)
  return { x: b.x, y: b.y, w: Math.max(160, b.w), h: head + Math.max(1, rows.length) * lh + (prices ? lh : 0) + fs * 0.6, fs, lh, head, prices }
}
