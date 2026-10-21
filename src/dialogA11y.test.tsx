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
