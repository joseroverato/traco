// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { TitleBar } from './TitleBar'

vi.mock('../project', () => ({ requestCloseProject: vi.fn(), saveProject: vi.fn() })) // a barra importa salvar/fechar projeto (pesado, não é o que se testa aqui)

afterEach(cleanup)

describe('TitleBar: marca', () => {
  // Regra do autor (DESIGN.md › Do's and Don'ts): a barra mostra só o logo. O nome do app escrito ao lado deixa o app genérico
  // e repete o que o sistema já mostra no título da janela.
  it('mostra só o logo, sem o nome do app escrito ao lado', () => {
    const { container } = render(<TitleBar onOpen={() => {}} />)
    const brand = container.querySelector('.brand')
    expect(brand).not.toBeNull()
    expect(brand?.querySelector('svg')).not.toBeNull()
    expect(brand?.textContent?.trim()).toBe('')
    expect(brand?.getAttribute('aria-label')).toBe('Traço')
  })
})
