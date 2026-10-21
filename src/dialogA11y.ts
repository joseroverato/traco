import { useCallback, useId, useRef } from 'react'
import type { KeyboardEvent } from 'react'

const FOCUSABLE = 'a[href],button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex]:not([tabindex="-1"])'

/**
 * Acessibilidade de janelas (modais): o foco entra na janela, o Tab não escapa dela, Esc fecha e o foco volta
 * para onde estava. Devolve as propriedades para espalhar no elemento `.modal`.
 */
export function useDialogA11y(onClose: () => void) {
  const node = useRef<HTMLDivElement | null>(null)
  const id = useId()
  // ref com limpeza (React 19): roda quando a janela aparece, mesmo que o componente já estivesse montado e vazio
  const ref = useCallback(
    (el: HTMLDivElement | null) => {
      node.current = el
      if (!el) return
      const prev = document.activeElement as HTMLElement | null
      const h = el.querySelector('h3')
      if (h) {
        h.id = `dlg-${id}`
        el.setAttribute('aria-labelledby', h.id)
      }
      if (!el.contains(document.activeElement)) (el.querySelector<HTMLElement>('input:not([type=checkbox]),select,textarea') ?? el).focus()
      return () => prev?.focus?.()
    },
    [id],
  )
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation()
      onClose()
      return
    }
    if (e.key !== 'Tab' || !node.current) return
    const items = [...node.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((x) => !x.closest('[hidden]'))
    if (!items.length) return e.preventDefault()
    const first = items[0], last = items[items.length - 1]
    if (e.shiftKey && (document.activeElement === first || document.activeElement === node.current)) { e.preventDefault(); last.focus() }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
  }
  return { ref, role: 'dialog' as const, 'aria-modal': true as const, tabIndex: -1, onKeyDown }
}
