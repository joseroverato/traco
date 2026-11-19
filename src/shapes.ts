import type { Pt } from './types'

/** Formas para desenhar áreas, vazios, ambientes e sólidos: polígono (clique a clique) ou uma forma regular (arrastar). */
export type PolyShape = 'poly' | 'rect' | 'circle' | 'ellipse'
export const SHAPES: PolyShape[] = ['poly', 'rect', 'circle', 'ellipse']

const N = 72 // lados do polígono que representa o círculo/elipse
// raio ligeiramente maior para a ÁREA do polígono ser igual à do círculo exato (a diferença seria de 0,16 %)
const FIT = Math.sqrt(Math.PI / ((N / 2) * Math.sin((2 * Math.PI) / N)))

function ellipsePoints(c: Pt, rx: number, ry: number): Pt[] {
  return Array.from({ length: N }, (_, i) => {
    const a = (i / N) * Math.PI * 2
    return { x: c.x + Math.cos(a) * rx * FIT, y: c.y + Math.sin(a) * ry * FIT }
  })
}

/**
 * Vértices da forma arrastada de `a` até `b`.
 * - retângulo: cantos opostos a e b (com `equal`, quadrado);
 * - círculo: a é o centro e a distância até b é o raio;
 * - elipse: inscrita no retângulo a–b (com `equal`, círculo).
 */
export function shapePoints(shape: Exclude<PolyShape, 'poly'>, a: Pt, b: Pt, equal = false): Pt[] {
  let dx = b.x - a.x, dy = b.y - a.y
  if (shape === 'circle') return ellipsePoints(a, Math.hypot(dx, dy), Math.hypot(dx, dy))
  if (equal) {
    const m = Math.max(Math.abs(dx), Math.abs(dy))
    dx = Math.sign(dx || 1) * m
    dy = Math.sign(dy || 1) * m
  }
  const e = { x: a.x + dx, y: a.y + dy }
  if (shape === 'rect') return [a, { x: e.x, y: a.y }, e, { x: a.x, y: e.y }]
  return ellipsePoints({ x: (a.x + e.x) / 2, y: (a.y + e.y) / 2 }, Math.abs(dx) / 2, Math.abs(dy) / 2)
}
