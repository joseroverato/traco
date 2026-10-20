import { describe, expect, it } from 'vitest'
import { findPreset } from './presetLookup'
import { preset } from './testUtils'

const lista = [
  preset({ id: 'a1', name: 'Contrapiso e = 4 cm' }),
  preset({ id: 'a2', name: 'Piso' }),
  preset({ id: 'a3', name: 'Piso cerâmico' }),
  preset({ id: 'a4', name: 'Rodapé' }),
]

describe('findPreset', () => {
  it('id tem prioridade', () => expect(findPreset(lista, 'a4')?.name).toBe('Rodapé'))
  it('nome exato vence nomes que só contêm o texto ("Piso" não vira "Contrapiso")', () => expect(findPreset(lista, 'piso')?.id).toBe('a2'))
  it('parte do nome serve quando é única', () => expect(findPreset(lista, 'rodap')?.id).toBe('a4'))
  it('parte do nome ambígua avisa em vez de escolher', () => {
    expect(findPreset(lista, 'cer')?.id).toBe('a3') // só "Piso cerâmico" contém "cer"
    expect(() => findPreset(lista, 'pis')).toThrow(/3 marcadores/) // Contrapiso, Piso, Piso cerâmico
  })
  it('sem resultado devolve undefined; vazio também', () => {
    expect(findPreset(lista, 'xyz')).toBeUndefined()
    expect(findPreset(lista, '')).toBeUndefined()
    expect(findPreset(lista, undefined)).toBeUndefined()
  })
})
