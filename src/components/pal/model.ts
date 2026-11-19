/** Nomes, ícones e valores das marcações para a árvore e para Propriedades (puro: sem React). */
import type { Markup, MarkupKind, PageScale, Preset, Sheet } from '../../types'
import { measureOf, scaleFor, fmt, bbox } from '../../geometry'
import { display } from '../../units'
import { KIND_LABEL } from '../../kinds'
import { t } from '../../i18n'
import ICONS from '../../ribbonIcons.json'

/** id do ícone no sprite a partir da chave de comando (ribbonIcons.json). */
export const iconOf = (k: string) => (ICONS as Record<string, string>)[k] ?? ''

export const KIND_ICON: Record<MarkupKind, string> = {
  length: 'comprimento', area: 'area', count: 'contagem', space: iconOf('space'), solid: 'solido', cloud: 'nuvem', rect: 'retangulo',
  ellipse: 'elipse', arrow: 'seta', line: 'linha', text: 'texto', stamp: 'carimbo', image: 'imagem', redact: 'tarja', viewport: 'viewport', legend: 'legenda',
}

export const isMeasureKind = (k: MarkupKind) => k === 'length' || k === 'area' || k === 'count'
/** Medidas que têm valor (marcador, área, comprimento, contagem, ambiente, sólido). */
export const hasValue = (k: MarkupKind) => isMeasureKind(k) || k === 'space' || k === 'solid'

/** "Área 3": o tipo e o número da marcação entre as do mesmo tipo na folha (ordem de criação). Ambientes, sólidos e textos usam o próprio nome. */
export function markupName(m: Markup, markups: Markup[]): string {
  const own = (m.kind === 'space' || m.kind === 'solid' || m.kind === 'text' || m.kind === 'stamp') && m.text.trim()
  if (own) return m.text.split('\n')[0].trim()
  let n = 0
  for (const x of markups) {
    if (x.page === m.page && x.kind === m.kind) n++
    if (x === m) break
  }
  return `${KIND_LABEL[m.kind]} ${n}`
}

/** Nomes de todas as marcações de uma vez (uma passada só): o número é a ordem entre as do mesmo tipo na mesma folha. */
export function markupNames(markups: Markup[]): Map<string, string> {
  const out = new Map<string, string>()
  const seen = new Map<string, number>()
  for (const m of markups) {
    const own = (m.kind === 'space' || m.kind === 'solid' || m.kind === 'text' || m.kind === 'stamp') && m.text.trim()
    const k = `${m.page}|${m.kind}`
    const n = (seen.get(k) ?? 0) + 1
    seen.set(k, n)
    out.set(m.id, own ? m.text.split('\n')[0].trim() : `${KIND_LABEL[m.kind]} ${n}`)
  }
  return out
}

export interface ValueText { text: string; unit: string; ok: boolean }

/** Valor medido de uma marcação, já na unidade do sistema (m ↔ ft). `ok` é falso sem escala ou com erro de fórmula. */
export function valueOf(m: Markup, markups: Markup[], scales: Record<string, PageScale>, presets: Preset[]): ValueText | null {
  if (!hasValue(m.kind)) return null
  const q = measureOf(m, scaleFor(m, markups, scales[m.page]), presets.find((p) => p.id === m.presetId))
  if (!q || q.error) return { text: '—', unit: '', ok: false }
  const d = display(q.value, q.unit)
  return { text: fmt(d.value), unit: d.unit, ok: true }
}

/** Centro da marcação em pt da folha, para centralizar a vista nela. */
export function centerOf(m: Markup) {
  const b = bbox(m.points)
  return { x: b.x + b.w / 2, y: b.y + b.h / 2 }
}

export const sheetNumber = (sheets: Sheet[], id: string) => String(sheets.findIndex((s) => s.id === id) + 1).padStart(2, '0')

/** "01 · Folha 1" */
export const sheetTitle = (sheets: Sheet[], sh: Sheet) => `${sheetNumber(sheets, sh.id)} · ${sh.label}`

export const noScaleLabel = () => t('pal.sem_escala')

/** Marcações da folha atual, sem os viewports. */
export const markCount = (s: { markups: Markup[]; sheets: Sheet[]; page: number }) => { const id = s.sheets[s.page]?.id; return s.markups.filter((m) => m.page === id && m.kind !== 'viewport').length }

/** Folha em A0–A4 (lados em mm, em qualquer ordem), ou só as medidas. */
export function formatOf(sh: Sheet) {
  const w = Math.round((sh.width * 25.4) / 72), h = Math.round((sh.height * 25.4) / 72)
  const [a, b] = w < h ? [w, h] : [h, w]
  const iso: [string, number, number][] = [['A0', 841, 1189], ['A1', 594, 841], ['A2', 420, 594], ['A3', 297, 420], ['A4', 210, 297]]
  const hit = iso.find(([, x, y]) => Math.abs(x - a) <= 4 && Math.abs(y - b) <= 4)
  return { name: hit?.[0] ?? '', dims: `${w} × ${h} mm` }
}
