import { measureOf, scaleFor } from './geometry'
import type { CustomColumn, Markup, PageScale, Preset, Sheet } from './types'
import { columnValue, levelOf, spaceOf } from './columns'

export interface SummaryRow {
  key: string
  group: string
  code: string
  name: string
  color: string
  sheets: string
  items: number
  raw: number
  rawUnit: string
  factor: number
  qty: number
  unit: string
  price: number
  total: number
  unscaled: number
  bucket: string // valor do agrupamento (ambiente, pavimento, folha, status)
  fields: Record<string, string | number>
}

export type GroupBy = 'preset' | 'space' | 'level' | 'sheet' | 'status'

const KIND_UNIT = { length: 'm', area: 'm²', count: 'un' } as const

export function bucketOf(m: Markup, by: GroupBy, all: Markup[], pages: Sheet[]) {
  if (by === 'space') return spaceOf(m, all)?.text || 'Fora de ambiente'
  if (by === 'level') return levelOf(m, pages)
  if (by === 'sheet') return pages.find((s) => s.id === m.page)?.label ?? ''
  if (by === 'status') return m.status
  return ''
}

export function summarize(markups: Markup[], presets: Preset[], scales: Record<string, PageScale>, pages: Sheet[], all: Markup[] = markups, by: GroupBy = 'preset', cols: CustomColumn[] = []): SummaryRow[] {
  const rows = new Map<string, SummaryRow & { _pages: Set<string> }>()
  for (const m of markups) {
    if (m.kind !== 'length' && m.kind !== 'area' && m.kind !== 'count') continue
    const p = presets.find((x) => x.id === m.presetId)
    const bucket = bucketOf(m, by, all, pages)
    const key = `${bucket}|${p ? p.id : `__${m.kind}`}`
    let r = rows.get(key)
    if (!r) {
      r = {
        key, group: p?.group ?? 'Sem marcador', code: p?.code ?? '', name: p?.name ?? `${m.kind === 'length' ? 'Comprimento' : m.kind === 'area' ? 'Área' : 'Contagem'} avulso`,
        color: p?.color ?? m.color, sheets: '', items: 0, raw: 0, rawUnit: KIND_UNIT[m.kind], factor: p?.factor || 1, qty: 0,
        unit: p?.resultUnit || KIND_UNIT[m.kind], price: p?.unitPrice ?? 0, total: 0, unscaled: 0, _pages: new Set(), bucket, fields: {},
      }
      rows.set(key, r)
    }
    const q = measureOf(m, scaleFor(m, all, scales[m.page]), p)
    r._pages.add(m.page)
    r.items += m.kind === 'count' ? m.points.length : 1
    if (!q || q.error) {
      r.unscaled++
      continue
    }
    r.raw += q.raw * (m.deduct ? -1 : 1)
    r.qty += q.value
    for (const c of cols) {
      const v = columnValue(c, m, q, cols)
      if (c.type === 'text') {
        const prev = String(r.fields[c.id] ?? '')
        if (v !== '' && !prev.split(', ').includes(String(v))) r.fields[c.id] = prev ? `${prev}, ${v}` : String(v)
      } else {
        const n = Number(String(v).replace(',', '.'))
        if (Number.isFinite(n)) r.fields[c.id] = Math.round(((Number(r.fields[c.id]) || 0) + n) * 100) / 100
      }
    }
  }
  return Array.from(rows.values())
    .map(({ _pages, ...r }) => ({ ...r, sheets: pages.filter((pg) => _pages.has(pg.id)).map((pg) => pg.label).join(', '), total: r.qty * r.price }))
    .sort((a, b) => a.bucket.localeCompare(b.bucket, 'pt-BR', { numeric: true }) || a.group.localeCompare(b.group) || a.name.localeCompare(b.name))
}

