import { evalFormula } from './formula'
import { centroid, inPoly } from './geometry'
import type { CustomColumn, Markup, Sheet } from './types'
import type { Qty } from './geometry'
import { t } from './i18n'

/** Valor de uma coluna personalizada para uma marcação. */
export function columnValue(c: CustomColumn, m: Markup, q: Qty | null, cols: CustomColumn[]): string | number {
  if (c.type !== 'formula') return m.fields?.[c.id] ?? ''
  if (!c.formula?.trim() || !q) return ''
  try {
    const expr = c.formula.replace(/\[([^\]]+)\]/g, (_, name: string) => {
      const ref = cols.find((x) => x.name.trim().toLowerCase() === name.trim().toLowerCase() && x.type !== 'formula')
      const v = Number(String(ref ? m.fields?.[ref.id] ?? 0 : 0).replace(',', '.'))
      return String(Number.isFinite(v) ? v : 0)
    })
    return Math.round(evalFormula(expr, { ...q.vars, Q: q.value }) * 100) / 100
  } catch {
    return t('columns.erro')
  }
}

/** Ambiente (markup 'space') que contém a marcação. */
export function spaceOf(m: Markup, all: Markup[]): Markup | undefined {
  if (m.kind === 'space' || !m.points.length) return undefined
  const p = m.kind === 'count' ? m.points[0] : centroid(m.points)
  return all.find((s) => s.kind === 'space' && s.page === m.page && inPoly(p, s.points) && !(s.holes ?? []).some((h) => inPoly(p, h)))
}

export const levelOf = (m: Markup, sheets: Sheet[]) => sheets.find((s) => s.id === m.page)?.level || t('columns.sem_pavimento')
