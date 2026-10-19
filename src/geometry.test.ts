import { describe, expect, it } from 'vitest'
import { bbox, centroid, inPoly, inRect, measureOf, paperScale, polyArea, polyLength, scaleFor, snapAngle, stampText } from './geometry'
import { mk, preset, square } from './testUtils'

const K = { metersPerUnit: 0.01, label: '1:100' } // 1 pt = 1 cm

describe('geometria básica', () => {
  it('comprimento de polilinha, aberta e fechada', () => {
    const pts = [{ x: 0, y: 0 }, { x: 3, y: 0 }, { x: 3, y: 4 }]
    expect(polyLength(pts)).toBe(7)
    expect(polyLength(pts, true)).toBe(12)
  })

  it('área independe da orientação do polígono', () => {
    expect(polyArea(square(10))).toBe(100)
    expect(polyArea([...square(10)].reverse())).toBe(100)
  })

  it('centroide, caixa e ponto em retângulo', () => {
    expect(centroid(square(10))).toEqual({ x: 5, y: 5 })
    expect(bbox([{ x: 2, y: 3 }, { x: 8, y: 9 }])).toEqual({ x: 2, y: 3, w: 6, h: 6 })
    expect(inRect({ x: 5, y: 5 }, { x: 10, y: 10 }, { x: 0, y: 0 })).toBe(true)
    expect(inRect({ x: 11, y: 5 }, { x: 0, y: 0 }, { x: 10, y: 10 })).toBe(false)
  })

  it('ponto dentro de polígono', () => {
    expect(inPoly({ x: 5, y: 5 }, square(10))).toBe(true)
    expect(inPoly({ x: 15, y: 5 }, square(10))).toBe(false)
  })

  it('snapAngle trava em múltiplos de 45°', () => {
    const p = snapAngle({ x: 0, y: 0 }, { x: 10, y: 1 })
    expect(p.x).toBeCloseTo(Math.hypot(10, 1))
    expect(p.y).toBeCloseTo(0)
  })

  it('escala de papel 1:N em metros por pt', () => {
    expect(paperScale(100)).toBeCloseTo((0.0254 / 72) * 100)
    // 72 pt = 1 pol = 2,54 cm de papel; em 1:100 vira 2,54 m reais
    expect(72 * paperScale(100)).toBeCloseTo(2.54)
  })
})

describe('measureOf', () => {
  it('comprimento aplica a escala', () => {
    const m = mk({ kind: 'length', points: [{ x: 0, y: 0 }, { x: 100, y: 0 }] })
    const q = measureOf(m, K)!
    expect(q.raw).toBeCloseTo(1)
    expect(q.value).toBeCloseTo(1)
    expect(q.unit).toBe('m')
  })

  it('fator H do marcador multiplica (metro linear → m²)', () => {
    const m = mk({ kind: 'length', points: [{ x: 0, y: 0 }, { x: 100, y: 0 }] })
    const q = measureOf(m, K, preset({ factor: 2.8, resultUnit: 'm²' }))!
    expect(q.raw).toBeCloseTo(1)
    expect(q.value).toBeCloseTo(2.8)
    expect(q.unit).toBe('m²')
  })

  it('área e perímetro; vazios descontam a área', () => {
    const m = mk({ kind: 'area', points: square(100) })
    const q = measureOf(m, K)!
    expect(q.vars.A).toBeCloseTo(1)
    expect(q.vars.P).toBeCloseTo(4)
    const withHole = measureOf(mk({ kind: 'area', points: square(100), holes: [square(50, 10, 10)] }), K)!
    expect(withHole.vars.A).toBeCloseTo(0.75)
    expect(withHole.vars.V).toBeCloseTo(0.25)
    expect(withHole.vars.PV).toBeCloseTo(2)
    expect(withHole.raw).toBeCloseTo(0.75)
  })

  it('fórmula do marcador usa A, P e H', () => {
    const m = mk({ kind: 'area', points: square(100) })
    const q = measureOf(m, K, preset({ measure: 'area', factor: 2.8, formula: 'A + P*H' }))!
    expect(q.value).toBeCloseTo(1 + 4 * 2.8)
    expect(q.error).toBeUndefined()
  })

  it('fórmula inválida devolve erro e mantém raw × H', () => {
    const m = mk({ kind: 'length', points: [{ x: 0, y: 0 }, { x: 100, y: 0 }] })
    const q = measureOf(m, K, preset({ formula: 'L +' }))!
    expect(q.error).toBeTruthy()
    expect(q.value).toBeCloseTo(1)
  })

  it('contagem usa o número de pontos e não precisa de escala', () => {
    const m = mk({ kind: 'count', points: [{ x: 1, y: 1 }, { x: 2, y: 2 }, { x: 3, y: 3 }] })
    const q = measureOf(m, undefined)!
    expect(q.raw).toBe(3)
    expect(q.unit).toBe('un')
  })

  it('sem escala, comprimento e área devolvem null', () => {
    expect(measureOf(mk({ kind: 'length', points: [{ x: 0, y: 0 }, { x: 5, y: 0 }] }), undefined)).toBeNull()
    expect(measureOf(mk({ kind: 'area', points: square(10) }), undefined)).toBeNull()
  })

  it('dedução inverte o sinal do valor', () => {
    const m = mk({ kind: 'area', points: square(100), deduct: true })
    expect(measureOf(m, K)!.value).toBeCloseTo(-1)
  })

  it('tipos que não são medida devolvem null', () => {
    expect(measureOf(mk({ kind: 'rect', points: square(10) }), K)).toBeNull()
  })
})

describe('scaleFor (viewport com escala própria)', () => {
  const vp = mk({ id: 'vp', kind: 'viewport', points: [{ x: 0, y: 0 }, { x: 200, y: 200 }], scale: { metersPerUnit: 0.02, label: '1:200' } })

  it('usa a escala do viewport que contém o primeiro ponto', () => {
    const m = mk({ kind: 'length', points: [{ x: 10, y: 10 }, { x: 500, y: 500 }] })
    expect(scaleFor(m, [vp, m], K)?.metersPerUnit).toBe(0.02)
  })

  it('fora do viewport usa a escala da folha', () => {
    const m = mk({ kind: 'length', points: [{ x: 300, y: 300 }, { x: 400, y: 300 }] })
    expect(scaleFor(m, [vp, m], K)?.metersPerUnit).toBe(0.01)
  })

  it('viewport em outra folha não vale', () => {
    const m = mk({ page: 's2', kind: 'length', points: [{ x: 10, y: 10 }, { x: 50, y: 10 }] })
    expect(scaleFor(m, [vp, m], K)?.metersPerUnit).toBe(0.01)
  })
})

describe('stampText', () => {
  it('substitui as variáveis do carimbo', () => {
    const t = stampText('{folha} {n}/{total} - {arquivo} ({autor})', { n: 2, total: 5, label: 'A-02', file: 'projeto.pdf', author: 'José' })
    expect(t).toBe('A-02 2/5 - projeto (José)')
  })
})
