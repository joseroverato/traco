// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { Glyph, Icon } from './Icon'
import { installSprite } from '../sprite'

afterEach(() => {
  cleanup()
  document.getElementById('traco-sprite')?.remove()
  delete document.documentElement.dataset.theme
})

describe('Icon: sprite do tema atual', () => {
  it('desenha o ícone de função por referência ao sprite', () => {
    const { container } = render(<Icon name="area" size={32} />)
    const svg = container.querySelector('svg.ic')
    expect(svg?.getAttribute('width')).toBe('32')
    expect(svg?.querySelector('use')?.getAttribute('href')).toBe('#i-area')
  })

  it('desenha o glifo de interface', () => {
    const { container } = render(<Glyph name="down" />)
    expect(container.querySelector('svg.gl use')?.getAttribute('href')).toBe('#g-down')
  })

  it('instala o sprite uma vez só e ele traz os ids usados', () => {
    installSprite()
    installSprite()
    expect(document.querySelectorAll('#traco-sprite')).toHaveLength(1)
    for (const id of ['i-area', 'i-selecionar', 'i-claude', 'g-down', 'g-x']) expect(document.getElementById(id), id).not.toBeNull()
  })

  it('troca o sprite quando o tema muda (mesmos ids, cores do tema claro)', async () => {
    installSprite()
    const escuro = document.getElementById('i-selecionar')?.innerHTML
    document.documentElement.dataset.theme = 'light'
    await new Promise((r) => setTimeout(r, 0)) // o MutationObserver roda em microtarefa
    const claro = document.getElementById('i-selecionar')?.innerHTML
    expect(claro).toBeTruthy()
    expect(claro).not.toBe(escuro)
    expect(document.querySelectorAll('#i-selecionar')).toHaveLength(1)
  })
})
