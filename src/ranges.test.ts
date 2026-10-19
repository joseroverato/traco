import { describe, expect, it } from 'vitest'
import { parseRanges } from './ranges'

describe('parseRanges', () => {
  it('interpreta intervalos e páginas soltas', () => {
    expect(parseRanges('1-3, 5, 8-10', 10)).toEqual([[1, 2, 3], [5], [8, 9, 10]])
  })

  it('aceita ponto e vírgula e ignora itens vazios', () => {
    expect(parseRanges('2;4,,', 5)).toEqual([[2], [4]])
  })

  it('rejeita fora do limite, invertido e texto inválido', () => {
    expect(() => parseRanges('0-2', 5)).toThrow(/fora do intervalo/)
    expect(() => parseRanges('3-9', 5)).toThrow(/fora do intervalo/)
    expect(() => parseRanges('4-2', 5)).toThrow(/fora do intervalo/)
    expect(() => parseRanges('a', 5)).toThrow(/inválido/)
  })
})
