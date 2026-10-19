/** Tempo das mini animações das ferramentas e vídeos opcionais (puro, testável). */
import type { Pt2 } from './toolInfo'

export const DUR = 4 // segundos por ciclo
export const DRAW_FROM = 0.12 // fração do ciclo em que o desenho começa
export const DRAW_TO = 0.6 // ... e termina
export const HOLD = 0.92 // até aqui fica visível; depois some e o ciclo recomeça

// vídeos gravados (opcionais): src/assets/tools/<id>.mp4|webm
const VIDEOS = import.meta.glob('./assets/tools/*.{mp4,webm}', { query: '?url', import: 'default', eager: true }) as Record<string, string>

/** Vídeo gravado da ferramenta, se existir em src/assets/tools. */
export const toolVideo = (id: string) => Object.entries(VIDEOS).find(([p]) => new RegExp(`/${id}\\.(mp4|webm)$`).test(p))?.[1]

const dist = (a: Pt2, b: Pt2) => Math.hypot(b[0] - a[0], b[1] - a[1])

/** Instantes (0..1 do ciclo) em que o cursor chega a cada ponto, proporcionais ao comprimento do trajeto. */
export function cursorTimes(pts: Pt2[], from = DRAW_FROM, to = DRAW_TO): number[] {
  if (pts.length < 2) return [from]
  const seg = pts.slice(1).map((p, i) => dist(pts[i], p))
  const total = seg.reduce((a, b) => a + b, 0) || 1
  let acc = 0
  return [from, ...seg.map((s) => from + ((acc += s) / total) * (to - from))]
}
