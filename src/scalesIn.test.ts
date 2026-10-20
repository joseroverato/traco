import { describe, expect, it } from 'vitest'
import { scalesIn } from './pdf'

describe('escala escrita na prancha (todos os idiomas)', () => {
  it.each([
    ['ESCALA 1:50', 50], ['ESC. 1/100', 100], ['Escala: 1:75', 75],
    ['SCALE 1:50', 50], ['Scale = 1:200', 200],
    ['ÉCHELLE 1:20', 20], ['Echelle 1/50', 50],
    ['MASSSTAB 1:100', 100], ['Maßstab 1:25', 25], ['M 1:50', 50], ['M. 1:500', 500],
    ['SCALA 1:100', 100], ['比例 1:50', 50], ['比例：1:100', 100],
  ])('lê "%s" como 1:%i', (txt, n) => expect(scalesIn(txt)).toEqual([n]))

  it('devolve a mais frequente primeiro e ignora absurdos', () => {
    expect(scalesIn('ESCALA 1:50  ESCALA 1:20  SCALE 1:50  ESCALA 1:9999')).toEqual([50, 20])
  })

  it('não confunde texto comum com escala', () => {
    expect(scalesIn('AM 1:50')).toEqual([]) // "M" colado a outra palavra
    expect(scalesIn('PROJETO 1:2 nome')).toEqual([])
    expect(scalesIn('Cota 1:50 no eixo')).toEqual([])
  })
})
