import { describe, expect, it } from 'vitest'
import { measureOf, paperScale, polyArea, polyLength, scaleFor } from './geometry'
import { solidMetrics, wallRings } from './solids'
import { summarize } from './summary'
import { mk, preset, sheet } from './testUtils'
import type { Pt } from './types'

/**
 * Casos de referência: cada número esperado foi calculado à mão (comentado ao lado),
 * sem usar as funções do app. Se um deles mudar, o cálculo mudou, e isso tem de ser decisão consciente.
 */

const K50 = { metersPerUnit: paperScale(50), label: '1:50' }
/** metros reais → pontos do PDF na escala 1:50 */
const pt = (xm: number, ym: number): Pt => ({ x: xm / K50.metersPerUnit, y: ym / K50.metersPerUnit })
const rect = (w: number, h: number): Pt[] => [pt(0, 0), pt(w, 0), pt(w, h), pt(0, h)]

describe('escala de papel', () => {
  it('1:100: 1 pol (72 pt) no papel vale 2,54 m na obra', () => {
    expect(72 * paperScale(100)).toBeCloseTo(2.54, 6)
  })
  it('1:50: uma folha A1 (841 mm de largura) cobre 42,05 m', () => {
    const pts = (841 / 25.4) * 72 // largura da folha em pontos
    expect(pts * paperScale(50)).toBeCloseTo(42.05, 2)
  })
  it('escala maior (1:25) dá metade da medida de 1:50 para os mesmos pontos', () => {
    expect(paperScale(25) * 2).toBeCloseTo(paperScale(50), 12)
  })
})

describe('casa de referência (1:50)', () => {
  const sheets = [sheet({ id: 's1', label: 'A-01' })]
  const scales = { s1: K50 }

  // paredes externas: retângulo 10 × 6 m fechado → 2×10 + 2×6 = 32 m
  const paredes = mk({ kind: 'length', presetId: 'par', points: [...rect(10, 6), pt(0, 0)] })
  const par = preset({ id: 'par', name: 'Alvenaria', measure: 'length', factor: 2.8, resultUnit: 'm²' })

  it('comprimento: 32 m de parede × pé-direito 2,8 = 89,60 m²', () => {
    const q = measureOf(paredes, K50, par)!
    expect(q.raw).toBeCloseTo(32, 6)
    expect(q.value).toBeCloseTo(89.6, 6) // 32 × 2,8
    expect(q.unit).toBe('m²')
  })

  it('porta descontada: 0,90 m de vão × 2,8 = 2,52 m² a menos → 87,08 m²', () => {
    const porta = mk({ kind: 'length', presetId: 'par', deduct: true, points: [pt(2, 0), pt(2.9, 0)] })
    const [r] = summarize([paredes, porta], [par], scales, sheets)
    expect(r.qty).toBeCloseTo(87.08, 6) // 89,60 − 2,52
    expect(r.items).toBe(2)
  })

  it('piso com shaft: 10 × 6 = 60 m² menos 1 × 1,5 = 1,5 m² → 58,50 m²', () => {
    const laje = mk({ kind: 'area', presetId: 'piso', points: rect(10, 6), holes: [[pt(1, 1), pt(2, 1), pt(2, 2.5), pt(1, 2.5)]] })
    const piso = preset({ id: 'piso', name: 'Piso', measure: 'area', resultUnit: 'm²' })
    const q = measureOf(laje, K50, piso)!
    expect(q.raw).toBeCloseTo(58.5, 6)
    expect(q.vars.V).toBeCloseTo(1.5, 6) // área do vazio
    expect(q.vars.PV).toBeCloseTo(5, 6) // perímetro do vazio: 2×(1+1,5)
    expect(q.vars.P).toBeCloseTo(32, 6)
  })

  it('fórmula AL: (perímetro 32 + perímetro do vazio 5) × 2,8 = 103,60 m² de revestimento', () => {
    const sala = mk({ kind: 'space', presetId: 'rev', points: rect(10, 6), holes: [[pt(1, 1), pt(2, 1), pt(2, 2.5), pt(1, 2.5)]] })
    const rev = preset({ id: 'rev', measure: 'area', factor: 2.8, formula: 'AL', resultUnit: 'm²' })
    expect(measureOf(sala, K50, rev)!.value).toBeCloseTo(103.6, 6)
  })

  it('laje como sólido: 58,5 m² × 0,12 m = 7,02 m³; lateral (32+5) × 0,12 = 4,44 m²', () => {
    const s = mk({ kind: 'solid', points: rect(10, 6), holes: [[pt(1, 1), pt(2, 1), pt(2, 2.5), pt(1, 2.5)]], height: 0.12, base: 2.8 })
    const m = solidMetrics(s, K50)!
    expect(m.VOL).toBeCloseTo(7.02, 6)
    expect(m.AL).toBeCloseTo(4.44, 6)
    expect(m.top).toBeCloseTo(2.92, 6) // base 2,80 + 0,12
    // o quantitativo usa o mesmo número do 3D
    expect(measureOf(s, K50)!.value).toBeCloseTo(7.02, 6)
  })

  it('pilar 0,2 × 0,5 × 2,8 m = 0,28 m³', () => {
    const p = mk({ kind: 'solid', points: [pt(0, 0), pt(0.2, 0), pt(0.2, 0.5), pt(0, 0.5)], height: 2.8 })
    expect(measureOf(p, K50)!.raw).toBeCloseTo(0.28, 6)
  })

  it('contagem: 7 pontos de tomada = 7 un, sem depender de escala', () => {
    const t = mk({ kind: 'count', presetId: 'tom', points: Array.from({ length: 7 }, (_, i) => pt(i, 1)) })
    const tom = preset({ id: 'tom', measure: 'count', resultUnit: 'un' })
    expect(measureOf(t, undefined, tom)!.value).toBe(7)
  })

  it('sem escala não há medida (nunca assume 1:1 em silêncio)', () => {
    expect(measureOf(paredes, undefined, par)).toBeNull()
    const [r] = summarize([paredes], [par], {}, sheets)
    expect(r.qty).toBe(0)
    expect(r.unscaled).toBe(1)
  })

  it('viewport com outra escala: o detalhe 1:25 mede metade do mesmo desenho em pontos', () => {
    const K25 = { metersPerUnit: paperScale(25), label: '1:25' }
    const vp = mk({ id: 'vp', kind: 'viewport', points: [{ x: 500, y: 500 }, { x: 900, y: 900 }], scale: K25 })
    const dentro = mk({ kind: 'length', points: [{ x: 600, y: 600 }, { x: 800, y: 600 }] })
    const fora = mk({ kind: 'length', points: [{ x: 10, y: 10 }, { x: 210, y: 10 }] })
    const a = measureOf(dentro, scaleFor(dentro, [vp, dentro], K50), undefined)!.raw
    const b = measureOf(fora, scaleFor(fora, [vp, fora], K50), undefined)!.raw
    expect(a / b).toBeCloseTo(0.5, 9)
  })
})

describe('geometria básica', () => {
  const sq = [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 3 }, { x: 0, y: 3 }]
  it('área e perímetro do retângulo 4 × 3', () => {
    expect(polyArea(sq)).toBe(12)
    expect(polyLength(sq, true)).toBe(14)
  })
  it('área independe do sentido de desenho', () => {
    expect(polyArea([...sq].reverse())).toBe(12)
  })
  it('triângulo 3-4-5: área 6, perímetro 12', () => {
    const t = [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 0, y: 3 }]
    expect(polyArea(t)).toBe(6)
    expect(polyLength(t, true)).toBe(12)
  })
  it('L côncavo (6 − 2 = 4): área 12 − 2 × 2 = 8', () => {
    const l = [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 1 }, { x: 2, y: 1 }, { x: 2, y: 3 }, { x: 0, y: 3 }]
    expect(polyArea(l)).toBe(8) // 4×1 + 2×2
  })
})

describe('paredes em 3D', () => {
  it('parede de 10 m com 0,15 m de espessura ocupa 10,15 × 0,15 (pontas fecham o canto)', () => {
    const [r] = wallRings([{ x: 0, y: 0 }, { x: 10, y: 0 }], 0.15)
    expect(polyArea(r)).toBeCloseTo(10.15 * 0.15, 9)
  })
  it('ponto repetido (trecho de comprimento zero) não gera sólido', () => {
    expect(wallRings([{ x: 1, y: 1 }, { x: 1, y: 1 }], 0.15)).toHaveLength(0)
  })
})
