import { describe, expect, it } from 'vitest'
import { DEMO_H, DEMO_W, TOOL_INFO } from './toolInfo'
import type { DemoShape, Pt2 } from './toolInfo'
import { TOOLS } from './components/ToolRail'
import { DRAW_FROM, DRAW_TO, appearKeys, cursorTimes } from './demoTiming'

const points = (s: DemoShape): Pt2[] => {
  switch (s.t) {
    case 'path': return s.pts
    case 'dots': return s.pts
    case 'cloud': return [s.a, s.b]
    case 'bar': return [s.a, s.b]
    case 'marquee': return [s.a, s.b]
    case 'image': return [s.a, s.b]
    case 'ellipse': return [[s.c[0] - s.rx, s.c[1] - s.ry], [s.c[0] + s.rx, s.c[1] + s.ry]]
    case 'label': return [s.at]
    case 'typing': return [s.at, [s.at[0] + s.text.length * (s.size ?? 10) * 0.6, s.at[1]]]
    case 'click': return [s.at]
    case 'flood': return [s.from, ...s.poly]
    case 'pop': return [[s.at[0] - s.w / 2, s.at[1] - s.h / 2], [s.at[0] + s.w / 2, s.at[1] + s.h / 2]]
    case 'table': return [s.at, [s.at[0] + s.w, s.at[1] + 9 * (s.rows + 1)]]
    case 'lines': return [s.at, [s.at[0] + s.w, s.at[1] + s.n * 7]]
    case 'box': return [[s.x, s.y], [s.x + s.w + s.d * 0.55, s.y - s.d * 0.45 - Math.max(s.h, s.h2 ?? 0)]]
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

describe('histórias das demonstrações', () => {
  const entries = Object.entries(TOOL_INFO)

  it('cada ferramenta tem cenário e há variedade de cenários (não é tudo na mesma planta)', () => {
    const scenes = new Set(entries.map(([, i]) => i.demo.scene))
    expect(scenes.size).toBeGreaterThanOrEqual(6)
    for (const [id, i] of entries) expect(i.demo.scene, id).toBeTruthy()
  })

  it('as ações não se concentram numa região: usam as quatro partes do quadro', () => {
    const quad = new Set<string>()
    for (const [, i] of entries) {
      const pts = i.demo.shapes.filter((s) => s.t !== 'label' && s.t !== 'lines').flatMap(points)
      if (!pts.length) continue
      const cx = pts.reduce((a, p) => a + p[0], 0) / pts.length
      const cy = pts.reduce((a, p) => a + p[1], 0) / pts.length
      quad.add(`${cx < DEMO_W / 2 ? 'E' : 'D'}${cy < DEMO_H / 2 ? 'C' : 'B'}`)
    }
    expect(quad.size).toBe(4)
  })

  it('os tempos das formas ficam entre 0 e 1, em ordem, e antes do fim do ciclo', () => {
    for (const [id, i] of entries) {
      for (const s of i.demo.shapes) {
        const t0 = s.t0 ?? 0.12, t1 = s.t1 ?? Math.max(0.55, t0)
        expect(t0, `${id}.${s.t}`).toBeGreaterThanOrEqual(0)
        expect(t1, `${id}.${s.t}`).toBeLessThanOrEqual(0.93)
        expect(t1, `${id}.${s.t}`).toBeGreaterThanOrEqual(t0)
      }
    }
  })

  it('o cursor tem um instante para cada ponto, crescentes', () => {
    for (const [id, i] of entries) {
      const { cursor, cursorTimes: ct } = i.demo
      if (!ct) continue
      expect(cursor, id).toBeTruthy()
      expect(ct.length, id).toBe(cursor!.length)
      expect(ct, id).toEqual([...ct].sort((a, b) => a - b))
    }
  })

  it('só "Mover vista" usa um cenário maior que o quadro', () => {
    for (const [id, i] of entries) if (i.demo.panBy) expect(id).toBe('pan')
  })
})

describe('appearKeys', () => {
  it('sempre devolve chaves não decrescentes, de 0 a 1', () => {
    for (const [at, until] of [[0.1, 0.93], [0.9, 0.93], [0.5, 0.56], [0.97, 0.93], [0, 1]] as const) {
      const k = appearKeys(at, until)
      expect(k[0]).toBe(0)
      expect(k[k.length - 1]).toBe(1)
      expect(k, `${at}/${until}`).toEqual([...k].sort((a, b) => a - b))
    }
  })
})
