/**
 * Regras do visualizador sem dependência de tela/React: layout, zoom, seleção e ajuste de caixas.
 * Ficam aqui para serem testadas e para o Viewer.tsx só cuidar de ligar eventos.
 */
import { bbox, inPoly, polyArea } from './geometry'
import type { Markup, Pt } from './types'

export const PAD = 48
export const MIN_ZOOM = 0.05
export const MAX_ZOOM = 40

export interface Layout { pw: number; ph: number; sw: number; sh: number; left: number; top: number }

/** Posição e tamanho da folha dentro da área rolável, para um zoom. */
export function computeLayout(sheet: { width: number; height: number } | undefined, area: { w: number; h: number }, zoom: number): Layout {
  const pw = (sheet?.width ?? 0) * zoom
  const ph = (sheet?.height ?? 0) * zoom
  const sw = Math.max(area.w, pw + PAD * 2)
  const sh = Math.max(area.h, ph + PAD * 2)
  return { pw, ph, sw, sh, left: (sw - pw) / 2, top: (sh - ph) / 2 }
}

/** Zoom que encaixa a folha na área (folha inteira ou só a largura). */
export function fitZoom(mode: 'page' | 'width', area: { w: number; h: number }, sheet: { width: number; height: number }): number {
  const zw = (area.w - PAD * 2 - 16) / sheet.width
  const zh = (area.h - PAD * 2 - 16) / sheet.height
  return Math.max(MIN_ZOOM, mode === 'width' ? zw : Math.min(zw, zh))
}

/** Fator de zoom de um evento de roda: mouse (~100 por clique) e touchpad (valores pequenos); Ctrl acelera (pinça). */
export function wheelFactor(deltaY: number, deltaMode: number, ctrlKey: boolean): number {
  const dy = deltaMode === 1 ? deltaY * 33 : deltaY
  return Math.exp(-Math.max(-300, Math.min(300, dy)) * (ctrlKey ? 0.012 : 0.0016))
}

export const clampZoom = (z: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z))

/** Um passo da animação de zoom (interpolação em escala logarítmica). `done` quando chegou perto do alvo. */
export function zoomStep(current: number, target: number): { zoom: number; done: boolean } {
  const lz = Math.log(current), lt = Math.log(target)
  const done = Math.abs(lt - lz) < 0.004
  return { zoom: done ? target : Math.exp(lz + (lt - lz) * 0.32), done }
}

/** Marcações da folha cuja caixa toca o retângulo (seleção por arrasto). */
export function markupsInRect(markups: Markup[], page: string, r: { x: number; y: number; w: number; h: number }): string[] {
  return markups
    .filter((m) => m.page === page && m.points.length)
    .filter((m) => {
      const b = bbox(m.points)
      return b.x <= r.x + r.w && b.x + b.w >= r.x && b.y <= r.y + r.h && b.y + b.h >= r.y
    })
    .map((m) => m.id)
}

/**
 * Área/ambiente que recebe um vazio recém-desenhado: o alvo explícito, senão a selecionada,
 * senão a menor que contém o centro do vazio.
 */
export function pickHoleTarget(markups: Markup[], page: string, hole: Pt[], holeTarget: string | null, selected: string[]): Markup | undefined {
  const c = { x: hole.reduce((t, p) => t + p.x, 0) / hole.length, y: hole.reduce((t, p) => t + p.y, 0) / hole.length }
  const cands = markups.filter((m) => m.page === page && (m.kind === 'area' || m.kind === 'space') && inPoly(c, m.points))
  return cands.find((m) => m.id === holeTarget) ?? cands.find((m) => selected.includes(m.id)) ?? [...cands].sort((a, b) => polyArea(a.points) - polyArea(b.points))[0]
}

/** Caixa do carimbo ajustada ao texto digitado, mantendo o centro. */
export function fitStampBox(text: string, fontSize: number, points: Pt[]): [Pt, Pt] {
  const lines = text.split('\n')
  const longest = Math.max(...lines.map((l) => l.replace(/\{data\}/g, '00/00/0000').replace(/\{(n|total)\}/g, '00').length))
  const b = bbox(points)
  const w = Math.max(60, longest * fontSize * 0.62 + 16)
  const h = lines.length * fontSize * 1.25 + 12
  const cx = b.x + b.w / 2, cy = b.y + b.h / 2
  return [{ x: cx - w / 2, y: cy - h / 2 }, { x: cx + w / 2, y: cy + h / 2 }]
}

/** Tamanho da fonte do texto de substituição de uma tarja, proporcional à altura. */
export const redactFontSize = (a: Pt, b: Pt) => Math.max(6, Math.min(24, Math.round(Math.hypot(b.x - a.x, b.y - a.y) > 0 ? Math.abs(b.y - a.y) * 0.6 : 9)))

/** Ferramentas em que o ponteiro desenha e, por isso, procura snap. */
export const DRAWING_TOOLS: readonly string[] = ['length', 'area', 'count', 'calibrate', 'rect', 'ellipse', 'cloud', 'arrow', 'line', 'viewport', 'redact', 'hole', 'space', 'solid', 'align']

/**
 * Se o ponteiro deve "grudar" na geometria do PDF. A tarja não gruda: ela precisa cobrir exatamente o que
 * o usuário traçou, e o raio do snap (em pontos da folha) fica enorme com o zoom afastado.
 */
export const snapAllowed = (tool: string, snapOn: boolean, altKey: boolean) => snapOn && !altKey && tool !== 'redact'
