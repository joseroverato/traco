// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { ReleaseNotes } from './ReleaseNotes'

afterEach(cleanup)

describe('notas da versão', () => {
  it('mostra o HTML da release como título e lista, sem as marcas na tela', () => {
    const { container } = render(<ReleaseNotes source="<h2>Traço 1.5.0</h2><ul><li><strong>OCR no idioma do app:</strong> escolha o idioma.</li><li>Unidades imperiais</li></ul>" />)
    expect(container.querySelector('h5')?.textContent).toBe('Traço 1.5.0')
    expect(container.querySelectorAll('li')).toHaveLength(2)
    expect(container.querySelector('li strong')?.textContent).toBe('OCR no idioma do app:')
    expect(container.textContent).not.toContain('<')
  })

  it('descarta scripts, estilos, imagens e atributos de evento', () => {
    const { container } = render(<ReleaseNotes source={'<p onclick="x()">oi</p><script>alert(1)</script><img src=x onerror="alert(1)"><style>p{}</style>'} />)
    expect(container.querySelector('script, img, style')).toBeNull()
    expect(container.querySelector('p')?.getAttribute('onclick')).toBeNull()
    expect(container.textContent).toBe('oi')
  })

  it('só aceita links http/https', () => {
    const { container } = render(<ReleaseNotes source={'<a href="https://github.com/x">ok</a> <a href="javascript:alert(1)">mau</a>'} />)
    const links = container.querySelectorAll('a')
    expect(links).toHaveLength(1)
    expect(links[0].getAttribute('href')).toBe('https://github.com/x')
    expect(container.textContent).toContain('mau')
  })

  it('aceita Markdown simples', () => {
    const { container } = render(<ReleaseNotes source={'## Novidades\n- **Mira** para medir\n- `Ctrl+Z` desfaz\n\nTexto solto'} />)
    expect(container.querySelector('h5')?.textContent).toBe('Novidades')
    expect(container.querySelectorAll('li')).toHaveLength(2)
    expect(container.querySelector('li strong')?.textContent).toBe('Mira')
    expect(container.querySelector('li code')?.textContent).toBe('Ctrl+Z')
    expect(container.querySelector('p')?.textContent).toBe('Texto solto')
  })
})
