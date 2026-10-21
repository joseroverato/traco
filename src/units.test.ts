// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { CALIB_UNITS, FT2_PER_M2, FT_PER_M, IMPERIAL_SCALES, YD3_PER_M3, display, fmtQty, lenIn, lenOut, parseLength, setUnits, unitFactor, unitName } from './units'
import { paperScale } from './geometry'

afterEach(() => setUnits('metric'))

describe('conversão de exibição', () => {
  it('métrico não muda nada', () => {
    setUnits('metric')
    expect(unitFactor('m²')).toBe(1)
    expect(display(12.5, 'm³')).toEqual({ value: 12.5, unit: 'm³' })
    expect(lenIn(2.8)).toBe(2.8)
  })

  it('imperial converte m, m² e m³ (para ft, ft², yd³) e deixa o resto', () => {
    setUnits('imperial')
    expect(unitName('m')).toBe('ft')
    expect(unitName('m²')).toBe('ft²')
    expect(unitName('m³')).toBe('yd³')
    expect(display(1, 'm').value).toBeCloseTo(3.28084, 5)
    expect(display(1, 'm²').value).toBeCloseTo(10.76391, 5)
    expect(display(1, 'm³').value).toBeCloseTo(1.307951, 5)
    for (const u of ['un', 'kg', 'h', 'vb']) expect(display(7, u)).toEqual({ value: 7, unit: u })
  })

  it('os fatores são coerentes entre si (área = comprimento², 1 yd³ = 27 ft³)', () => {
    expect(FT2_PER_M2).toBeCloseTo(FT_PER_M ** 2, 9)
    expect(YD3_PER_M3 * 27).toBeCloseTo(FT_PER_M ** 3, 6)
  })

  it('lenIn/lenOut são inversas', () => {
    setUnits('imperial')
    expect(lenOut(lenIn(2.8))).toBeCloseTo(2.8, 12)
    expect(lenIn(0.3048)).toBeCloseTo(1, 12)
  })

  it('fmtQty junta número e unidade', () => {
    setUnits('imperial')
    expect(fmtQty(10, 'm²')).toMatch(/^107[.,]64 ft²$/)
    expect(fmtQty(3, 'un', 0)).toBe('3 un')
  })

  it('o preço por unidade exibida mantém o total (qtd × preço não muda)', () => {
    const qty = 12.5, price = 80
    setUnits('imperial')
    const f = unitFactor('m²')
    expect((qty * f) * (price / f)).toBeCloseTo(qty * price, 9)
  })
})

describe('leitura de medidas em pés e polegadas', () => {
  const ft = (s: string, bare?: 'm' | 'ft' | 'in') => parseLength(s, bare)
  it('formatos de planta', () => {
    expect(ft("12'-6\"")).toBeCloseTo(12.5 * 0.3048, 9)
    expect(ft("12' 6 1/2\"")).toBeCloseTo((12 + 6.5 / 12) * 0.3048, 9)
    expect(ft("12'")).toBeCloseTo(12 * 0.3048, 9)
    expect(ft('12.5 ft')).toBeCloseTo(12.5 * 0.3048, 9)
    expect(ft('150"')).toBeCloseTo(150 * 0.0254, 9)
    expect(ft('3/4"')).toBeCloseTo(0.75 * 0.0254, 9)
    expect(ft('1 1/2 in')).toBeCloseTo(1.5 * 0.0254, 9)
    expect(ft('12 ft 6 in')).toBeCloseTo(12.5 * 0.3048, 9)
  })
  it('número puro vale na unidade padrão; vírgula decimal funciona', () => {
    expect(ft('5,00')).toBe(5)
    expect(ft('5', 'ft')).toBeCloseTo(1.524, 9)
    expect(ft('6', 'in')).toBeCloseTo(0.1524, 9)
  })
  it('lixo devolve null', () => {
    for (const s of ['', 'abc', "12'-x\"", '1/0"']) expect(ft(s), s).toBeNull()
  })
})

describe('escalas e calibração imperiais', () => {
  it('1/4" = 1\'-0" é 1:48 e 1" = 20\' é 1:240', () => {
    const q = IMPERIAL_SCALES.find((s) => s.label === '1/4" = 1\'-0"')!
    expect(q.n).toBe(48)
    expect(IMPERIAL_SCALES.find((s) => s.label === '1" = 20\'')!.n).toBe(240)
  })
  it('cada escala bate com a conta (polegada de papel ÷ medida real)', () => {
    for (const s of IMPERIAL_SCALES) {
      const m = /^(?:(\d+)-)?(?:(\d+)\/(\d+)|(\d+))" = (\d+)'(?:-0")?$/.exec(s.label)!
      const paperIn = (m[1] ? Number(m[1]) : 0) + (m[2] ? Number(m[2]) / Number(m[3]) : 0) + (m[4] ? Number(m[4]) : 0)
      expect(s.n, s.label).toBeCloseTo((Number(m[5]) * 12) / paperIn, 9)
    }
  })
  it('em 1:48, 1 polegada de papel (72 pt) são 4 pés reais', () => {
    // 48 pol = 4 ft = 1,2192 m
    expect(paperScale(48) * 72).toBeCloseTo(1.2192, 6)
  })
  it('unidades de calibração', () => {
    expect(CALIB_UNITS.imperial.map((u) => u.id)).toEqual(['ft', 'in'])
    expect(CALIB_UNITS.metric.map((u) => u.id)).toEqual(['m', 'cm', 'mm'])
  })
})
