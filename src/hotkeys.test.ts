// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'

// o módulo guarda o estado em variáveis do módulo: cada teste começa com ele limpo
const fresh = async () => {
  vi.resetModules()
  localStorage.clear()
  return import('./hotkeys')
}

describe('atalhos de ferramentas', () => {
  beforeEach(() => localStorage.clear())

  it('as letras de fábrica não se repetem nem usam a reservada', async () => {
    const h = await fresh()
    const letters = Object.values(h.DEFAULT_KEYS)
    expect(new Set(letters).size).toBe(letters.length)
    for (const k of letters) expect(h.validKey(k), k).toBe(true)
  })

  it('troca a letra, guarda e devolve ao padrão quando volta à letra de fábrica', async () => {
    const h = await fresh()
    expect(h.setKey('stamp', 'f')).toBeNull()
    expect(h.keyOf('stamp')).toBe('F')
    expect(JSON.parse(localStorage.getItem('traco.keys')!)).toEqual({ stamp: 'F' })
    expect(h.setKey('stamp', 'b')).toBeNull()
    expect(h.hasCustomKeys()).toBe(false)
    expect(localStorage.getItem('traco.keys')).toBeNull()
  })

  it('recusa letra de outra ferramenta (e diz de qual), letra reservada e não-letra', async () => {
    const h = await fresh()
    expect(h.setKey('stamp', 'D')).toBe('redact')
    expect(h.keyOf('stamp')).toBe('B')
    expect(h.setKey('stamp', 'w')).toBeNull()
    expect(h.keyOf('stamp')).toBe('B')
    expect(h.setKey('stamp', '1')).toBeNull()
    expect(h.keyOf('stamp')).toBe('B')
  })

  it('a letra liberada pode ser usada por outra ferramenta', async () => {
    const h = await fresh()
    expect(h.setKey('stamp', 'F')).toBeNull()
    expect(h.setKey('redact', 'B')).toBeNull()
    expect(h.toolForKey('b')).toBe('redact')
  })

  it('lê o que foi salvo e ignora dado estragado ou repetido', async () => {
    vi.resetModules()
    localStorage.setItem('traco.keys', JSON.stringify({ stamp: 'D', redact: 'D', invent: 'Z', image: '9' }))
    const h = await import('./hotkeys')
    // "stamp" e "redact" pedem D: a primeira na ordem das ferramentas fica com ela? Nenhuma pode ficar repetida
    const used = Object.keys(h.DEFAULT_KEYS).map((id) => h.keyOf(id))
    expect(new Set(used).size).toBe(used.length)
    expect(h.keyOf('image')).toBe('P')
    expect(h.keyOf('invent')).toBe('')
  })

  it('restaurar volta tudo ao padrão', async () => {
    const h = await fresh()
    h.setKey('stamp', 'F')
    h.setKey('image', 'J')
    h.resetKeys()
    expect(h.keyOf('stamp')).toBe('B')
    expect(h.keyOf('image')).toBe('P')
  })
})
