import { describe, expect, it } from 'vitest'
import { checkFormula, evalFormula } from './formula'

const V = { L: 10, A: 20, P: 18, N: 7, H: 2.8, V: 0, PV: 0 }

describe('evalFormula', () => {
  it('opera com variáveis e precedência', () => {
    expect(evalFormula('A + P*H', V)).toBeCloseTo(20 + 18 * 2.8)
    expect(evalFormula('(A + P) * 2', V)).toBe(76)
    expect(evalFormula('2 + 3 * 4', V)).toBe(14)
  })

  it('aceita vírgula decimal e variáveis em minúsculas', () => {
    expect(evalFormula('L * 1,10', V)).toBeCloseTo(11)
    expect(evalFormula('l * 1.5', V)).toBe(15)
  })

  it('potência é associativa à direita', () => {
    expect(evalFormula('2^3^2', V)).toBe(512)
  })

  it('menos unário tem precedência menor que potência', () => {
    expect(evalFormula('-2^2', V)).toBe(-4)
    expect(evalFormula('3 - -2', V)).toBe(5)
    expect(evalFormula('2^-1', V)).toBe(0.5)
  })

  it('funções: ceil, floor, round, min, max, abs, sqrt', () => {
    expect(evalFormula('ceil(N/10)', V)).toBe(1)
    expect(evalFormula('floor(N/2)', V)).toBe(3)
    expect(evalFormula('round(2,456; 2)', V)).toBe(2.46)
    expect(evalFormula('max(L; 50)', V)).toBe(50)
    expect(evalFormula('min(L, A)', V)).toBe(10)
    expect(evalFormula('abs(0-4)', V)).toBe(4)
    expect(evalFormula('sqrt(16)', V)).toBe(4)
  })

  it('rejeita variável e função desconhecidas', () => {
    expect(() => evalFormula('Z + 1', V)).toThrow(/variável desconhecida/)
    expect(() => evalFormula('foo(1)', V)).toThrow(/função desconhecida/)
  })

  it('rejeita fórmula vazia, parêntese aberto e lixo no final', () => {
    expect(() => evalFormula('', V)).toThrow()
    expect(() => evalFormula('(1+2', V)).toThrow()
    expect(() => evalFormula('1 + 2 )', V)).toThrow()
    expect(() => evalFormula('1 + ', V)).toThrow()
  })

  it('rejeita resultado não finito (divisão por zero)', () => {
    expect(() => evalFormula('1/0', V)).toThrow(/inválido/)
  })

  it('não executa código (sem eval)', () => {
    expect(() => evalFormula('process.exit()', V)).toThrow()
    expect(() => evalFormula('constructor', V)).toThrow()
  })
})

describe('checkFormula', () => {
  it('devolve null para fórmula válida e a mensagem para inválida', () => {
    expect(checkFormula('A + P*H')).toBeNull()
    expect(checkFormula('Q * 2')).toBeNull()
    expect(checkFormula('A +')).toMatch(/inesperado/)
  })
})
