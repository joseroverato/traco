/**
 * Sólidos 3D: medidas de um sólido desenhado na planta e a lista de volumes que a vista 3D desenha
 * (sólidos, ambientes, paredes, áreas e contagens). Puro: sem React, sem three.js, testável.
 *
 * Convenção de coordenadas do 3D (em metros): X = x da folha × escala, Z = y da folha × escala
 * (a folha tem y para baixo), Y = altura. Cada volume é um anel de planta + cota de base + altura.
 */
import { DEFAULT_SOLID_HEIGHT, polyArea, polyLength, scaleFor } from './geometry'
import type { Markup, PageScale, Preset, Pt } from './types'

export { DEFAULT_SOLID_HEIGHT }
export const DEFAULT_SLAB = 0.1 // espessura das áreas (piso, contrapiso…)
export const DEFAULT_WALL_THICKNESS = 0.15
export const COUNT_SIZE = 0.3 // lado do cubo que marca cada item de contagem

export type LayerKind = 'solid' | 'space' | 'area' | 'length' | 'count'
export const LAYER_LABEL: Record<LayerKind, string> = { solid: 'Sólidos', space: 'Ambientes', length: 'Paredes / linhas', area: 'Áreas', count: 'Contagens' }

export interface Solid3D {
  id: string // único por volume (uma contagem gera vários)
  markupId: string
  kind: LayerKind
  label: string
  color: string
  ring: Pt[] // metros
  holes: Pt[][]
  base: number
  height: number
  opacity: number
  /** só os sólidos desenhados pelo usuário têm altura editável no 3D */
  editable: boolean
}

export interface SolidMetrics {
  A: number // área da base (m²), já sem os vazios
  P: number // perímetro externo (m)
  AL: number // área lateral (m²) = (perímetro externo + dos vazios) × altura
  VOL: number // volume (m³)
  base: number
  height: number
  top: number // cota do topo
}

const k2 = (s: PageScale) => s.metersPerUnit * s.metersPerUnit

/** Medidas de um sólido (kind 'solid'). Devolve null sem escala. */
export function solidMetrics(m: Markup, scale: PageScale | undefined): SolidMetrics | null {
  if (!scale?.metersPerUnit) return null
  const k = scale.metersPerUnit
  const holes = m.holes ?? []
  const A = polyArea(m.points) * k2(scale) - holes.reduce((t, h) => t + polyArea(h), 0) * k2(scale)
  const P = polyLength(m.points, true) * k
  const PV = holes.reduce((t, h) => t + polyLength(h, true), 0) * k
  const height = m.height ?? DEFAULT_SOLID_HEIGHT
  const base = m.base ?? 0
  return { A, P, AL: (P + PV) * height, VOL: A * height, base, height, top: base + height }
}

const toM = (p: Pt, k: number): Pt => ({ x: p.x * k, y: p.y * k })

/** Paredes: um prisma retangular por trecho da linha, com as pontas prolongadas meia espessura para fechar os cantos. */
export function wallRings(points: Pt[], thickness: number): Pt[][] {
  const out: Pt[][] = []
  const h = thickness / 2
  for (let i = 1; i < points.length; i++) {
    const p = points[i - 1], q = points[i]
    const len = Math.hypot(q.x - p.x, q.y - p.y)
    if (len < 1e-9) continue
    const dx = (q.x - p.x) / len, dy = (q.y - p.y) / len
    const nx = -dy * h, ny = dx * h
    const a = { x: p.x - dx * h, y: p.y - dy * h }, b = { x: q.x + dx * h, y: q.y + dy * h }
    out.push([{ x: a.x + nx, y: a.y + ny }, { x: b.x + nx, y: b.y + ny }, { x: b.x - nx, y: b.y - ny }, { x: a.x - nx, y: a.y - ny }])
  }
  return out
}

const squareAt = (p: Pt, s: number): Pt[] => [{ x: p.x - s / 2, y: p.y - s / 2 }, { x: p.x + s / 2, y: p.y - s / 2 }, { x: p.x + s / 2, y: p.y + s / 2 }, { x: p.x - s / 2, y: p.y + s / 2 }]

export interface BuildOptions {
  page: string
  markups: Markup[]
  presets: Preset[]
  scales: Record<string, PageScale>
  /** altura dos ambientes e das paredes sem altura própria (pé-direito) */
  ceiling?: number
}

/** Volumes da folha para a vista 3D. Marcações sem escala e deduções ficam de fora. */
export function buildSolids3D({ page, markups, presets, scales, ceiling = DEFAULT_SOLID_HEIGHT }: BuildOptions): Solid3D[] {
  const out: Solid3D[] = []
  const onPage = markups.filter((m) => m.page === page)
  for (const m of onPage) {
    if (m.deduct) continue
    const preset = presets.find((p) => p.id === m.presetId)
    const sc = scaleFor(m, markups, scales[m.page])
    if (!sc?.metersPerUnit) continue
    const k = sc.metersPerUnit
    const color = preset?.color ?? m.color
    const holes = (m.holes ?? []).map((h) => h.map((p) => toM(p, k)))
    const base = { markupId: m.id, color, holes: [] as Pt[][], base: 0, opacity: 1, editable: false }
    if (m.kind === 'solid' && m.points.length >= 3) {
      out.push({ ...base, id: m.id, kind: 'solid', label: m.text || 'Sólido', ring: m.points.map((p) => toM(p, k)), holes, base: m.base ?? 0, height: m.height ?? DEFAULT_SOLID_HEIGHT, opacity: 0.92, editable: true })
    } else if (m.kind === 'space' && m.points.length >= 3) {
      out.push({ ...base, id: m.id, kind: 'space', label: m.text || 'Ambiente', ring: m.points.map((p) => toM(p, k)), holes, height: ceiling, opacity: 0.16 })
    } else if (m.kind === 'area' && m.points.length >= 3) {
      out.push({ ...base, id: m.id, kind: 'area', label: preset?.name ?? 'Área', ring: m.points.map((p) => toM(p, k)), holes, height: DEFAULT_SLAB, opacity: 0.85 })
    } else if (m.kind === 'length' && m.points.length >= 2) {
      const h = preset?.factor && preset.factor !== 1 ? preset.factor : ceiling
      wallRings(m.points.map((p) => toM(p, k)), DEFAULT_WALL_THICKNESS).forEach((ring, i) => out.push({ ...base, id: `${m.id}:${i}`, kind: 'length', label: preset?.name ?? 'Parede', ring, height: h, opacity: 0.9 }))
    } else if (m.kind === 'count') {
      m.points.forEach((p, i) => out.push({ ...base, id: `${m.id}:${i}`, kind: 'count', label: preset?.name ?? 'Item', ring: squareAt(toM(p, k), COUNT_SIZE), height: COUNT_SIZE, opacity: 0.95 }))
    }
  }
  return out
}

/** Caixa que envolve todos os volumes (para enquadrar a câmera). */
export function boundsOf(solids: Solid3D[]) {
  if (!solids.length) return null
  let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity, maxY = 0
  for (const s of solids) {
    for (const p of s.ring) {
      minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x)
      minZ = Math.min(minZ, p.y); maxZ = Math.max(maxZ, p.y)
    }
    maxY = Math.max(maxY, s.base + s.height)
  }
  return { minX, minZ, maxX, maxZ, maxY, cx: (minX + maxX) / 2, cz: (minZ + maxZ) / 2, size: Math.max(maxX - minX, maxZ - minZ, maxY, 1) }
}

/** Altura arredondada para o passo (puxar/empurrar), com mínimo de 1 passo. */
export const snapHeight = (h: number, step = 0.05) => Math.max(step, Math.round(h / step) * step)
