// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { useDialogA11y } from './dialogA11y'
import { labelIconButtons } from './autoLabels'

function Demo({ onClose }: { onClose: () => void }) {
  const [open, setOpen] = useState(false)
  const a11y = useDialogA11y(() => { setOpen(false); onClose() })
  return (
    <>
      <button onClick={() => setOpen(true)}>abrir</button>
      {open && (
        <div {...a11y}>
          <h3>Título</h3>
          <input aria-label="campo" />
          <button>ok</button>
        </div>
      )}
    </>
  )
}

describe('acessibilidade das janelas', () => {
  it('entra no campo, prende o Tab, fecha com Esc e devolve o foco', () => {
    const onClose = vi.fn()
    render(<Demo onClose={onClose} />)
    const opener = screen.getByText('abrir')
    opener.focus()
    fireEvent.click(opener)
    const dlg = screen.getByRole('dialog')
    expect(dlg.getAttribute('aria-modal')).toBe('true')
    expect(dlg.getAttribute('aria-labelledby')).toBeTruthy()
    expect(document.activeElement).toBe(screen.getByLabelText('campo'))

    const ok = screen.getByText('ok')
    ok.focus()
    fireEvent.keyDown(ok, { key: 'Tab' })
    expect(document.activeElement).toBe(screen.getByLabelText('campo')) // do último volta ao primeiro

    fireEvent.keyDown(dlg, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(document.activeElement).toBe(opener)
  })
})

describe('nomes de botões só com ícone', () => {
  it('usa title ou data-tip; não mexe em quem já tem texto ou nome', () => {
    document.body.innerHTML = '<button id=a title="Girar"><svg/></button><button id=b data-tip="Dica"><svg/></button><button id=c title="x">Texto</button><button id=d aria-label="Meu" title="y"><svg/></button><button id=e><svg/></button>'
    labelIconButtons()
    const at = (id: string) => document.getElementById(id)!.getAttribute('aria-label')
    expect(at('a')).toBe('Girar')
    expect(at('b')).toBe('Dica')
    expect(at('c')).toBeNull()
    expect(at('d')).toBe('Meu')
    expect(at('e')).toBeNull()
  })
})

function Radios() {
  const a11y = useDialogA11y(() => {})
  return (
    <div {...a11y}>
      <h3>Opções</h3>
      <input type="radio" name="g" aria-label="a" />
      <input type="radio" name="g" aria-label="b" defaultChecked />
      <input type="radio" name="g" aria-label="c" />
      <button tabIndex={-1}>fora da ordem</button>
      <button>ok</button>
    </div>
  )
}

describe('Tab dentro da janela', () => {
  it('visita só o botão de opção marcado de cada grupo, pula tabindex -1 e dá a volta nos dois sentidos', () => {
    render(<Radios />)
    const dlg = screen.getByRole('dialog')
    const b = screen.getByLabelText('b')
    const ok = screen.getByText('ok')
    b.focus()
    fireEvent.keyDown(b, { key: 'Tab' })
    expect(document.activeElement).toBe(ok) // a e c não entram na ordem; o botão com tabindex -1 também não
    fireEvent.keyDown(ok, { key: 'Tab' })
    expect(document.activeElement).toBe(b) // do último volta ao primeiro
    fireEvent.keyDown(b, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(ok) // e para trás também dá a volta
    expect(dlg.getAttribute('aria-labelledby')).toBeTruthy()
  })
})
