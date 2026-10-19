import type { Markup, PageScale, Preset, Pt } from './types'
import { evalFormula } from './formula'

/** Altura padrão de um sólido novo (pé-direito), em metros. */
export const DEFAULT_SOLID_HEIGHT = 2.8

export const dist = (a: Pt, b: Pt) => Math.hypot(b.x - a.x, b.y - a.y)

export function polyLength(pts: Pt[], closed = false) {
  let s = 0
  for (let i = 1; i < pts.length; i++) s += dist(pts[i - 1], pts[i])
  if (closed && pts.length > 2) s += dist(pts[pts.length - 1], pts[0])
  return s
}

export function polyArea(pts: Pt[]) {
  let s = 0
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]
    const b = pts[(i + 1) % pts.length]
    s += a.x * b.y - b.x * a.y
  }
  return Math.abs(s) / 2
}

export function centroid(pts: Pt[]): Pt {
  if (!pts.length) return { x: 0, y: 0 }
  const x = pts.reduce((s, p) => s + p.x, 0) / pts.length
  const y = pts.reduce((s, p) => s + p.y, 0) / pts.length
  return { x, y }
}

export function bbox(pts: Pt[]) {
  const xs = pts.map((p) => p.x)
  const ys = pts.map((p) => p.y)
  const x = Math.min(...xs)
  const y = Math.min(...ys)
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y }
}

export const inRect = (p: Pt, a: Pt, b: Pt) => {
  const r = bbox([a, b])
  return p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h
}

/** Retângulo → contorno de nuvem de revisão (arcos ao longo do perímetro). */
export function cloudPath(a: Pt, b: Pt, arc = 10) {
  const x0 = Math.min(a.x, b.x), y0 = Math.min(a.y, b.y)
  const x1 = Math.max(a.x, b.x), y1 = Math.max(a.y, b.y)
  const corners: Pt[] = [
    { x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 },
  ]
  let d = `M ${x0} ${y0}`
  for (let i = 0; i < 4; i++) {
    const p = corners[i], q = corners[(i + 1) % 4]
    const len = dist(p, q)
    const n = Math.max(1, Math.round(len / (arc * 2)))
    for (let k = 1; k <= n; k++) {
      const t = k / n
      const x = p.x + (q.x - p.x) * t
      const y = p.y + (q.y - p.y) * t
      const r = len / n / 2
      d += ` A ${r} ${r} 0 0 1 ${x} ${y}`
    }
  }
  return d + ' Z'
}

/** Mesma nuvem como polígono amostrado (para exportar ao PDF). */
export function cloudPoints(a: Pt, b: Pt, arc = 10): Pt[] {
  const x0 = Math.min(a.x, b.x), y0 = Math.min(a.y, b.y)
  const x1 = Math.max(a.x, b.x), y1 = Math.max(a.y, b.y)
  const corners: Pt[] = [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }]
  const out: Pt[] = []
  for (let i = 0; i < 4; i++) {
    const p = corners[i], q = corners[(i + 1) % 4]
    const len = dist(p, q)
    const n = Math.max(1, Math.round(len / (arc * 2)))
    const ux = (q.x - p.x) / len, uy = (q.y - p.y) / len
    // normal para fora (sentido horário em coordenadas de tela)
    const nx = uy, ny = -ux
    for (let k = 0; k < n; k++) {
      const r = len / n / 2
      const cx = p.x + ux * (k * 2 + 1) * r, cy = p.y + uy * (k * 2 + 1) * r
      for (let j = 0; j <= 8; j++) {
        const t = Math.PI - (j / 8) * Math.PI
        out.push({ x: cx + ux * r * Math.cos(t) + nx * r * Math.sin(t), y: cy + uy * r * Math.cos(t) + ny * r * Math.sin(t) })
      }
    }
  }
  return out
}

export function arrowHead(a: Pt, b: Pt, size: number) {
  const ang = Math.atan2(b.y - a.y, b.x - a.x)
  const s = 0.45
  const p1 = { x: b.x - size * Math.cos(ang - s), y: b.y - size * Math.sin(ang - s) }
  const p2 = { x: b.x - size * Math.cos(ang + s), y: b.y - size * Math.sin(ang + s) }
  return [p1, b, p2]
}

/** Restringe a 0/45/90° (Shift). */
export function snapAngle(a: Pt, b: Pt): Pt {
  const ang = Math.atan2(b.y - a.y, b.x - a.x)
  const step = Math.PI / 4
  const r = dist(a, b)
  const s = Math.round(ang / step) * step
  return { x: a.x + r * Math.cos(s), y: a.y + r * Math.sin(s) }
}

/**
 * Escala que vale para uma marcação: a do viewport que contém seu primeiro ponto,
 * senão a escala da folha (lição do Revu: várias escalas na mesma prancha).
 */
export function scaleFor(m: Markup, all: Markup[], sheetScale?: PageScale): PageScale | undefined {
  const p = m.points[0]
  if (p) {
    const vp = all.find((v) => v.kind === 'viewport' && v.page === m.page && v.scale && v.id !== m.id && inRect(p, v.points[0], v.points[1]))
    if (vp?.scale) return vp.scale
  }
  return sheetScale
}

export interface Qty {
  raw: number // medida geométrica principal em m / m² / un
  value: number // resultado (fórmula ou fator), com sinal de dedução
  unit: string
  vars: { L: number; A: number; P: number; N: number; H: number; V: number; PV: number; VOL: number; AL: number; ALT: number }
  error?: string
}

export function measureOf(m: Markup, scale: PageScale | undefined, preset?: Preset): Qty | null {
  const k = scale?.metersPerUnit ?? 0
  const H = preset && preset.factor ? preset.factor : 1
  let L = 0, A = 0, P = 0, N = 0, V = 0, PV = 0, VOL = 0, AL = 0, raw: number, unit: string
  const ALT = m.kind === 'solid' ? m.height ?? DEFAULT_SOLID_HEIGHT : H // altura/espessura usada em VOL e AL
  if (m.kind === 'length') {
    if (!k) return null
    L = polyLength(m.points) * k
    AL = L * ALT // área da parede
    raw = L
    unit = 'm'
  } else if (m.kind === 'area' || m.kind === 'space' || m.kind === 'solid') {
    if (!k) return null
    // vazios (fosso, shaft, pilar…) descontados da área; V = área dos vazios, PV = perímetro deles
    V = (m.holes ?? []).reduce((t, h) => t + polyArea(h), 0) * k * k
    PV = (m.holes ?? []).reduce((t, h) => t + polyLength(h, true), 0) * k
    A = polyArea(m.points) * k * k - V
    P = polyLength(m.points, true) * k
    L = P
    VOL = A * ALT
    AL = (P + PV) * ALT
    // sólido: a medida principal é o volume
    raw = m.kind === 'solid' ? VOL : A
    unit = m.kind === 'solid' ? 'm³' : 'm²'
  } else if (m.kind === 'count') {
    N = m.points.length
    raw = N
    unit = 'un'
  } else return null
  const vars = { L, A, P, N, H, V, PV, VOL, AL, ALT }
  let value = m.kind === 'solid' ? raw : raw * H
  let error: string | undefined
  if (preset?.formula?.trim()) {
    try {
      value = evalFormula(preset.formula, vars)
    } catch (e) {
      error = (e as Error).message
    }
  }
  return { raw, value: value * (m.deduct ? -1 : 1), unit: preset?.resultUnit || unit, vars, error }
}

export const fmt = (n: number, d = 2) =>
  n.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d })

/** Escala de papel 1:N → metros por pt. 1 pt = 1/72 pol. */
export const paperScale = (n: number) => (0.0254 / 72) * n

/** Substitui variáveis de carimbo. */
export function stampText(t: string, ctx: { n: number; total: number; label: string; file: string; author: string }) {
  const d = new Date()
  return t
    .replace(/\{n\}/gi, String(ctx.n))
    .replace(/\{total\}/gi, String(ctx.total))
    .replace(/\{folha\}/gi, ctx.label)
    .replace(/\{arquivo\}/gi, ctx.file.replace(/\.pdf$/i, ''))
    .replace(/\{autor\}/gi, ctx.author)
    .replace(/\{data\}/gi, d.toLocaleDateString('pt-BR'))
    .replace(/\{hora\}/gi, d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }))
}

/** Ponto dentro de polígono (par-ímpar). */
export function inPoly(p: Pt, poly: Pt[]) {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j]
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside
  }
  return inside
}
/** Área com sinal (orientação do anel). */
export const signedArea = (pts: Pt[]) => pts.reduce((s, a, i) => { const b = pts[(i + 1) % pts.length]; return s + a.x * b.y - b.x * a.y }, 0) / 2
/** Caminho SVG de um polígono com vazios (usar fill-rule evenodd). */
export const ringsPath = (outer: Pt[], holes: Pt[][] = [], close = true) =>
  [outer, ...holes].map((r) => r.map((p, i) => `${i ? 'L' : 'M'} ${p.x} ${p.y}`).join(' ') + (close ? ' Z' : '')).join(' ')
