import { describe, expect, it } from 'vitest'
import { displayRows, summarize } from './summary'
import { setUnits } from './units'
import { columnValue, levelOf, spaceOf } from './columns'
import { measureOf } from './geometry'
import { mk, preset, sheet, square } from './testUtils'
import type { CustomColumn } from './types'

const K = { metersPerUnit: 0.01, label: '1:100' }
const scales = { s1: K, s2: K }
const sheets = [sheet({ id: 's1', label: 'A-01', level: 'Térreo' }), sheet({ id: 's2', label: 'A-02' })]
const wall = preset({ id: 'wall', name: 'Alvenaria', group: 'Civil', factor: 2.8, resultUnit: 'm²', unitPrice: 10 })
const line = (len: number, o = {}) => mk({ kind: 'length', presetId: 'wall', points: [{ x: 0, y: 0 }, { x: len, y: 0 }], ...o })

describe('summarize', () => {
  it('soma quantidade, aplica fator e preço por marcador', () => {
    const ms = [line(100), line(200)]
    const [r] = summarize(ms, [wall], scales, sheets)
    expect(r.items).toBe(2)
    expect(r.raw).toBeCloseTo(3)
    expect(r.qty).toBeCloseTo(8.4)
    expect(r.unit).toBe('m²')
    expect(r.total).toBeCloseTo(84)
    expect(r.name).toBe('Alvenaria')
  })

  it('dedução subtrai do total', () => {
    const ms = [mk({ kind: 'area', presetId: 'floor', points: square(200) }), mk({ kind: 'area', presetId: 'floor', points: square(100), deduct: true })]
    const floor = preset({ id: 'floor', measure: 'area', resultUnit: 'm²' })
    const [r] = summarize(ms, [floor], scales, sheets)
    expect(r.qty).toBeCloseTo(4 - 1)
    expect(r.raw).toBeCloseTo(3)
  })

  it('marcação sem escala conta em "unscaled" e não entra na soma', () => {
    const ms = [line(100), line(100, { page: 'sX' })]
    const [r] = summarize(ms, [wall], scales, sheets)
    expect(r.unscaled).toBe(1)
    expect(r.qty).toBeCloseTo(2.8)
    expect(r.items).toBe(2)
  })

  it('contagem soma o número de pontos', () => {
    const tomada = preset({ id: 't', name: 'Tomada', measure: 'count', resultUnit: 'un' })
    const ms = [mk({ kind: 'count', presetId: 't', points: [{ x: 0, y: 0 }, { x: 1, y: 1 }] }), mk({ kind: 'count', presetId: 't', points: [{ x: 5, y: 5 }] })]
    const [r] = summarize(ms, [tomada], scales, sheets)
    expect(r.items).toBe(3)
    expect(r.qty).toBe(3)
  })

  it('marcação sem marcador vira linha "avulso" por tipo', () => {
    const ms = [mk({ kind: 'length', points: [{ x: 0, y: 0 }, { x: 100, y: 0 }] }), mk({ kind: 'area', points: square(100) })]
    const rows = summarize(ms, [], scales, sheets)
    expect(rows.map((r) => r.name).sort()).toEqual(['Comprimento avulso', 'Área avulso'])
    expect(rows.every((r) => r.group === 'Sem marcador')).toBe(true)
  })

  it('ignora marcações que não são medida', () => {
    expect(summarize([mk({ kind: 'rect', points: square(10) })], [], scales, sheets)).toEqual([])
  })

  it('agrupa por folha', () => {
    const ms = [line(100), line(100, { page: 's2' })]
    const rows = summarize(ms, [wall], scales, sheets, ms, 'sheet')
    expect(rows.map((r) => [r.bucket, r.qty.toFixed(1)])).toEqual([['A-01', '2.8'], ['A-02', '2.8']])
    expect(rows[0].sheets).toBe('A-01')
  })

  it('agrupa por pavimento e por status', () => {
    const ms = [line(100), line(100, { page: 's2', status: 'resolvido' })]
    const byLevel = summarize(ms, [wall], scales, sheets, ms, 'level')
    expect(byLevel.map((r) => r.bucket)).toEqual(['Sem pavimento', 'Térreo'])
    const byStatus = summarize(ms, [wall], scales, sheets, ms, 'status')
    expect(byStatus.map((r) => r.bucket)).toEqual(['aberto', 'resolvido'])
  })

  it('agrupa por ambiente (marcação dentro do polígono do ambiente)', () => {
    const sala = mk({ id: 'sala', kind: 'space', text: 'Sala', points: square(500) })
    const inside = line(100, { points: [{ x: 10, y: 10 }, { x: 110, y: 10 }] })
    const outside = line(100, { points: [{ x: 600, y: 600 }, { x: 700, y: 600 }] })
    const all = [sala, inside, outside]
    const rows = summarize([inside, outside], [wall], scales, sheets, all, 'space')
    expect(rows.map((r) => r.bucket).sort()).toEqual(['Fora de ambiente', 'Sala'])
  })

  it('preço zero resulta em total zero', () => {
    const [r] = summarize([line(100)], [{ ...wall, unitPrice: 0 }], scales, sheets)
    expect(r.total).toBe(0)
  })

  it('colunas personalizadas: texto concatena sem repetir, número soma', () => {
    const cols: CustomColumn[] = [{ id: 'c1', name: 'Obs', type: 'text' }, { id: 'c2', name: 'Peso', type: 'number' }]
    const ms = [line(100, { fields: { c1: 'a', c2: 1.5 } }), line(100, { fields: { c1: 'a', c2: '2,25' } }), line(100, { fields: { c1: 'b' } })]
    const [r] = summarize(ms, [wall], scales, sheets, ms, 'preset', cols)
    expect(r.fields.c1).toBe('a, b')
    expect(r.fields.c2).toBeCloseTo(3.75)
  })
})

describe('columnValue', () => {
  const cols: CustomColumn[] = [
    { id: 'c1', name: 'Perda', type: 'number' },
    { id: 'c2', name: 'Total', type: 'formula', formula: 'Q * (1 + [Perda]/100)' },
  ]
  const m = line(100, { fields: { c1: 10 } })
  const q = measureOf(m, K, wall)

  it('coluna de fórmula usa Q e referências [nome] a colunas numéricas', () => {
    expect(columnValue(cols[1], m, q, cols)).toBeCloseTo(2.8 * 1.1, 2)
  })

  it('referência a coluna inexistente vale 0', () => {
    const c: CustomColumn = { id: 'x', name: 'X', type: 'formula', formula: 'Q + [Nada]' }
    expect(columnValue(c, m, q, cols)).toBeCloseTo(2.8, 2)
  })

  it('fórmula inválida devolve "erro"; sem medida devolve vazio', () => {
    expect(columnValue({ id: 'x', name: 'X', type: 'formula', formula: 'Q +' }, m, q, cols)).toBe('erro')
    expect(columnValue(cols[1], m, null, cols)).toBe('')
  })

  it('coluna de texto/número devolve o campo da marcação', () => {
    expect(columnValue(cols[0], m, q, cols)).toBe(10)
    expect(columnValue({ id: 'zz', name: 'Z', type: 'text' }, m, q, cols)).toBe('')
  })
})

describe('spaceOf / levelOf', () => {
  const sala = mk({ id: 'sala', kind: 'space', text: 'Sala', points: square(500), holes: [square(50, 200, 200)] })

  it('acha o ambiente que contém a marcação (centroide ou 1º ponto)', () => {
    expect(spaceOf(mk({ kind: 'area', points: square(20, 10, 10) }), [sala])?.text).toBe('Sala')
    expect(spaceOf(mk({ kind: 'count', points: [{ x: 5, y: 5 }] }), [sala])?.text).toBe('Sala')
  })

  it('ponto dentro de um vazio do ambiente não pertence a ele', () => {
    expect(spaceOf(mk({ kind: 'count', points: [{ x: 220, y: 220 }] }), [sala])).toBeUndefined()
  })

  it('ambiente em outra folha não vale; o próprio ambiente não tem ambiente', () => {
    expect(spaceOf(mk({ page: 's2', kind: 'count', points: [{ x: 5, y: 5 }] }), [sala])).toBeUndefined()
    expect(spaceOf(sala, [sala])).toBeUndefined()
  })

  it('levelOf devolve o pavimento da folha ou "Sem pavimento"', () => {
    expect(levelOf(mk({ page: 's1' }), sheets)).toBe('Térreo')
    expect(levelOf(mk({ page: 's2' }), sheets)).toBe('Sem pavimento')
  })
})

describe('displayRows (unidades de exibição)', () => {
  it('métrico devolve as mesmas linhas', () => {
    setUnits('metric')
    const rows = summarize([line(100)], [wall], scales, sheets)
    expect(displayRows(rows)).toEqual(rows)
  })

  it('imperial converte quantidade e unidade, mas o total em dinheiro continua igual', () => {
    const rows = summarize([line(100), line(200)], [wall], scales, sheets)
    setUnits('imperial')
    try {
      const [m] = rows
      const [r] = displayRows(rows)
      expect(r.unit).toBe('ft²')
      expect(r.rawUnit).toBe('ft')
      expect(r.qty).toBeCloseTo(m.qty * 10.7639104, 4)
      expect(r.raw).toBeCloseTo(m.raw * 3.28084, 4)
      expect(r.qty * r.price).toBeCloseTo(m.total, 9)
      expect(r.total).toBe(m.total)
    } finally {
      setUnits('metric')
    }
  })

  it('unidades sem conversão (un, kg) ficam como estão', () => {
    const un = preset({ id: 'un', measure: 'count', resultUnit: 'un', unitPrice: 5 })
    const rows = summarize([mk({ kind: 'count', presetId: 'un', points: [{ x: 1, y: 1 }, { x: 2, y: 2 }] })], [un], scales, sheets)
    setUnits('imperial')
    try {
      expect(displayRows(rows)).toEqual(rows)
    } finally {
      setUnits('metric')
    }
  })
})
