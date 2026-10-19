import { describe, expect, it } from 'vitest'
import { DEFAULT_SLAB, DEFAULT_SOLID_HEIGHT, DEFAULT_WALL_THICKNESS, COUNT_SIZE, boundsOf, buildSolids3D, snapHeight, solidMetrics, wallRings } from './solids'
import { measureOf } from './geometry'
import { summarize } from './summary'
import { checkFormula } from './formula'
import { mk, preset, sheet, square } from './testUtils'

const K = { metersPerUnit: 0.01, label: '1:100' } // 1 pt = 1 cm
const scales = { s1: K }

describe('solidMetrics', () => {
  it('volume, área da base, perímetro e área lateral (caixa 2 m × 2 m × 3 m)', () => {
    const m = mk({ kind: 'solid', points: square(200), height: 3, base: 1 })
    const r = solidMetrics(m, K)!
    expect(r.A).toBeCloseTo(4)
    expect(r.P).toBeCloseTo(8)
    expect(r.VOL).toBeCloseTo(12)
    expect(r.AL).toBeCloseTo(24)
    expect(r.top).toBeCloseTo(4)
  })

  it('vazio desconta o volume e soma a área lateral interna', () => {
    const m = mk({ kind: 'solid', points: square(200), holes: [square(100, 50, 50)], height: 2 })
    const r = solidMetrics(m, K)!
    expect(r.A).toBeCloseTo(3)
    expect(r.VOL).toBeCloseTo(6)
    expect(r.AL).toBeCloseTo((8 + 4) * 2)
  })

  it('sem altura usa o pé-direito padrão; sem escala devolve null', () => {
    expect(solidMetrics(mk({ kind: 'solid', points: square(100) }), K)!.height).toBe(DEFAULT_SOLID_HEIGHT)
    expect(solidMetrics(mk({ kind: 'solid', points: square(100) }), undefined)).toBeNull()
  })
})

describe('measureOf com sólido e novas variáveis', () => {
  const solid = mk({ kind: 'solid', points: square(200), height: 3 })

  it('a medida do sólido é o volume em m³', () => {
    const q = measureOf(solid, K)!
    expect(q.raw).toBeCloseTo(12)
    expect(q.value).toBeCloseTo(12)
    expect(q.unit).toBe('m³')
    expect(q.vars).toMatchObject({ A: 4, ALT: 3 })
    expect(q.vars.VOL).toBeCloseTo(12)
    expect(q.vars.AL).toBeCloseTo(24)
  })

  it('área com marcador de espessura: VOL = A × H (concreto de uma laje de 10 cm)', () => {
    const q = measureOf(mk({ kind: 'area', points: square(200) }), K, preset({ measure: 'area', factor: 0.1, formula: 'VOL', resultUnit: 'm³' }))!
    expect(q.value).toBeCloseTo(0.4)
  })

  it('comprimento: AL = L × H (área da parede)', () => {
    const q = measureOf(mk({ kind: 'length', points: [{ x: 0, y: 0 }, { x: 500, y: 0 }] }), K, preset({ factor: 2.8, formula: 'AL', resultUnit: 'm²' }))!
    expect(q.value).toBeCloseTo(14)
  })

  it('dedução inverte o sinal do volume', () => {
    expect(measureOf({ ...solid, deduct: true }, K)!.value).toBeCloseTo(-12)
  })

  it('o verificador de fórmulas aceita VOL, AL e ALT', () => {
    expect(checkFormula('VOL * 1,05')).toBeNull()
    expect(checkFormula('AL + ALT')).toBeNull()
  })
})

describe('quantitativo com sólidos', () => {
  const sheets = [sheet({ id: 's1', label: 'A-01' })]
  it('cada sólido avulso vira uma linha em m³, no grupo Sólidos 3D', () => {
    const a = mk({ kind: 'solid', text: 'Pilar P1', points: square(100), height: 3 })
    const b = mk({ kind: 'solid', text: 'Viga V1', points: square(200), height: 0.5 })
    const rows = summarize([a, b], [], scales, sheets)
    expect(rows.map((r) => [r.name, r.unit, r.group, +r.qty.toFixed(2)])).toEqual([
      ['Pilar P1', 'm³', 'Sólidos 3D', 3],
      ['Viga V1', 'm³', 'Sólidos 3D', 2],
    ])
  })

  it('sólidos de mesmo nome se somam', () => {
    const a = mk({ kind: 'solid', text: 'Pilar', points: square(100), height: 3 })
    const b = mk({ kind: 'solid', text: 'Pilar', points: square(100), height: 3 })
    const [r] = summarize([a, b], [], scales, sheets)
    expect(r.items).toBe(2)
    expect(r.qty).toBeCloseTo(6)
  })
})

describe('wallRings', () => {
  it('um retângulo por trecho, com pontas prolongadas meia espessura', () => {
    const rings = wallRings([{ x: 0, y: 0 }, { x: 2, y: 0 }], 0.2)
    expect(rings).toHaveLength(1)
    const xs = rings[0].map((p) => p.x), ys = rings[0].map((p) => p.y)
    expect(Math.min(...xs)).toBeCloseTo(-0.1)
    expect(Math.max(...xs)).toBeCloseTo(2.1)
    expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(0.2)
  })
  it('trecho de comprimento zero é ignorado', () => {
    expect(wallRings([{ x: 1, y: 1 }, { x: 1, y: 1 }], 0.2)).toEqual([])
  })
})

describe('buildSolids3D', () => {
  const base = { page: 's1', presets: [], scales }
  it('converte para metros e usa a cota/altura do sólido', () => {
    const [s] = buildSolids3D({ ...base, markups: [mk({ id: 'a', kind: 'solid', text: 'P1', points: square(100), base: 0.5, height: 2 })] })
    expect(s).toMatchObject({ markupId: 'a', kind: 'solid', label: 'P1', base: 0.5, height: 2, editable: true })
    expect(s.ring[2]).toEqual({ x: 1, y: 1 })
  })

  it('ambiente vira volume do pé-direito; área vira laje fina; contagem vira cubinhos', () => {
    const out = buildSolids3D({
      ...base,
      markups: [
        mk({ id: 'sp', kind: 'space', points: square(300) }),
        mk({ id: 'ar', kind: 'area', points: square(300) }),
        mk({ id: 'ct', kind: 'count', points: [{ x: 10, y: 10 }, { x: 50, y: 50 }] }),
      ],
    })
    const by = (id: string) => out.filter((s) => s.markupId === id)
    expect(by('sp')[0]).toMatchObject({ kind: 'space', height: DEFAULT_SOLID_HEIGHT, editable: false })
    expect(by('ar')[0]).toMatchObject({ kind: 'area', height: DEFAULT_SLAB })
    expect(by('ct')).toHaveLength(2)
    expect(by('ct')[0].height).toBe(COUNT_SIZE)
  })

  it('parede usa o fator do marcador como altura e a espessura padrão', () => {
    const wall = preset({ id: 'w', name: 'Alvenaria', factor: 2.5 })
    const out = buildSolids3D({ ...base, presets: [wall], markups: [mk({ kind: 'length', presetId: 'w', points: [{ x: 0, y: 0 }, { x: 400, y: 0 }, { x: 400, y: 300 }] })] })
    expect(out).toHaveLength(2)
    expect(out.every((s) => s.height === 2.5 && s.label === 'Alvenaria')).toBe(true)
    const w = out[0].ring.map((p) => p.y)
    expect(Math.max(...w) - Math.min(...w)).toBeCloseTo(DEFAULT_WALL_THICKNESS)
  })

  it('deduções, outras folhas e marcações sem escala ficam de fora', () => {
    const out = buildSolids3D({
      ...base,
      markups: [
        mk({ kind: 'solid', points: square(100), deduct: true }),
        mk({ kind: 'solid', points: square(100), page: 's2' }),
        mk({ kind: 'solid', points: square(100), page: 's1' }),
      ],
      scales: { s1: K },
    })
    expect(out).toHaveLength(1)
    const semEscala = buildSolids3D({ ...base, markups: [mk({ kind: 'solid', points: square(100) })], scales: {} })
    expect(semEscala).toEqual([])
  })

  it('o vazio do sólido segue para o 3D em metros', () => {
    const [s] = buildSolids3D({ ...base, markups: [mk({ kind: 'solid', points: square(200), holes: [square(50, 10, 10)] })] })
    expect(s.holes[0][0]).toEqual({ x: 0.1, y: 0.1 })
  })
})

describe('boundsOf / snapHeight', () => {
  it('caixa e tamanho para enquadrar a câmera', () => {
    const solids = buildSolids3D({ page: 's1', presets: [], scales, markups: [mk({ kind: 'solid', points: square(400), height: 3 })] })
    const b = boundsOf(solids)!
    expect([b.minX, b.maxX, b.cx, b.maxY]).toEqual([0, 4, 2, 3])
    expect(b.size).toBe(4)
    expect(boundsOf([])).toBeNull()
  })
  it('snapHeight arredonda ao passo e nunca zera', () => {
    expect(snapHeight(2.83)).toBeCloseTo(2.85)
    expect(snapHeight(0.001)).toBeCloseTo(0.05)
    expect(snapHeight(-3)).toBeCloseTo(0.05)
    expect(snapHeight(1.26, 0.5)).toBeCloseTo(1.5)
  })
})
