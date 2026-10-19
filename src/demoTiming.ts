/** Tempo das mini animações das ferramentas e vídeos opcionais (puro, testável). */
import type { Pt2 } from './toolInfo'

export const DUR = 5 // segundos por ciclo
export const DRAW_FROM = 0.12 // fração do ciclo em que um desenho (sem tempos próprios) começa
export const DRAW_TO = 0.55 // ... e termina
export const HOLD = 0.93 // até aqui o resultado fica visível; depois some e o ciclo recomeça

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

/** Chaves de tempo de um "aparece e some": 0, início, início+rampa, fim, fim+rampa, 1 (sempre não decrescentes, até 1). */
export function appearKeys(at: number, until = HOLD, ramp = 0.05): number[] {
  const a = Math.min(at, 0.98)
  const b = Math.min(a + ramp, 1)
  const u = Math.max(Math.min(until, 1), b)
  return [0, a, b, u, Math.min(u + 0.04, 1), 1]
}
