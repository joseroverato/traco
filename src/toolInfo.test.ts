import { describe, expect, it } from 'vitest'
import { DEMO_H, DEMO_W, TOOL_INFO } from './toolInfo'
import type { DemoShape, Pt2 } from './toolInfo'
import { TOOLS } from './components/ToolRail'
import { DRAW_FROM, DRAW_TO, cursorTimes } from './demoTiming'

const points = (s: DemoShape): Pt2[] => {
  switch (s.t) {
    case 'path': return s.pts
    case 'dots': return s.pts
    case 'cloud': return [s.a, s.b]
    case 'bar': return [s.a, s.b]
    case 'ellipse': return [[s.c[0] - s.rx, s.c[1] - s.ry], [s.c[0] + s.rx, s.c[1] + s.ry]]
    case 'label': return [s.at]
    case 'table': return [s.at, [s.at[0] + s.w, s.at[1] + 9 * (s.rows + 1)]]
    case 'lines': return [s.at, [s.at[0] + s.w, s.at[1] + s.n * 7]]
    case 'box': return [[s.x, s.y], [s.x + s.w + s.d * 0.55, s.y - s.d * 0.45 - s.h]]
  }
}

describe('dicas das ferramentas', () => {
  it('toda ferramenta da barra tem nome, descrição e demonstração', () => {
    for (const t of TOOLS) {
      const info = TOOL_INFO[t.id]
      expect(info, t.id).toBeTruthy()
      expect(info.title.length, t.id).toBeGreaterThan(2)
      expect(info.desc.length, t.id).toBeGreaterThan(20)
    }
  })

  it('as demonstrações cabem no quadro de 200×120', () => {
    for (const [id, info] of Object.entries(TOOL_INFO)) {
      const all = [...info.demo.shapes.flatMap(points), ...(info.demo.cursor ?? [])]
      for (const [x, y] of all) {
        expect(x, `${id} x=${x}`).toBeGreaterThanOrEqual(0)
        expect(x, `${id} x=${x}`).toBeLessThanOrEqual(DEMO_W)
        expect(y, `${id} y=${y}`).toBeGreaterThanOrEqual(0)
        expect(y, `${id} y=${y}`).toBeLessThanOrEqual(DEMO_H)
      }
    }
  })

  it('a ferramenta de sólido explica que a altura se puxa no 3D', () => {
    expect(TOOL_INFO.solid.desc).toMatch(/3D/)
  })
})

describe('cursorTimes', () => {
  it('começa no início do desenho, termina no fim e é crescente', () => {
    const t = cursorTimes([[0, 0], [10, 0], [10, 30]])
    expect(t[0]).toBeCloseTo(DRAW_FROM)
    expect(t[t.length - 1]).toBeCloseTo(DRAW_TO)
    expect(t).toEqual([...t].sort((a, b) => a - b))
  })
  it('é proporcional ao comprimento de cada trecho', () => {
    const t = cursorTimes([[0, 0], [10, 0], [10, 30]])
    expect((t[1] - t[0]) / (t[2] - t[1])).toBeCloseTo(10 / 30)
  })
  it('um ponto só (ou trajeto de comprimento zero) não quebra', () => {
    expect(cursorTimes([[5, 5]])).toEqual([DRAW_FROM])
    expect(cursorTimes([[5, 5], [5, 5]]).every(Number.isFinite)).toBe(true)
  })
})
