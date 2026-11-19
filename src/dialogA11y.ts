import { useCallback, useId, useRef } from 'react'
import type { KeyboardEvent } from 'react'

const FOCUSABLE = 'a[href],button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex]:not([tabindex="-1"])'

const esc = (v: string) => (typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(v) : v.replace(/["\\]/g, '\\$&'))

/** Controles que o Tab visita: sem os ocultos, os de tabindex -1 e, em cada grupo de botões de opção, só o marcado (ou o primeiro). */
function tabbables(root: HTMLElement): HTMLElement[] {
  const all = [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((x) => !x.closest('[hidden]') && x.getAttribute('tabindex') !== '-1')
  const seen = new Set<string>()
  return all.filter((x) => {
    if (!(x instanceof HTMLInputElement) || x.type !== 'radio' || !x.name) return true
    const checked = root.querySelector<HTMLInputElement>(`input[type=radio][name="${esc(x.name)}"]:checked`)
    if (checked) return checked === x
    if (seen.has(x.name)) return false
    seen.add(x.name)
    return true
  })
}

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
      const h = el.querySelector('[data-dlg-title]') ?? el.querySelector('h3')
      if (h) {
        h.id = `dlg-${id}`
        el.setAttribute('aria-labelledby', h.id)
      }
      if (!el.contains(document.activeElement)) (el.querySelector<HTMLElement>('input:not([type=checkbox]):not([type=radio]):not([type=color]),select,textarea') ?? el).focus()
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
    // o Tab é conduzido aqui (e não pelo navegador): sempre cai num controle da janela, sem depender da ordem do documento
    const items = tabbables(node.current)
    e.preventDefault()
    if (!items.length) return
    const at = items.indexOf(document.activeElement as HTMLElement)
    const next = at < 0 ? (e.shiftKey ? items[items.length - 1] : items[0]) : items[(at + (e.shiftKey ? -1 : 1) + items.length) % items.length]
    next.focus()
  }
  return { ref, role: 'dialog' as const, 'aria-modal': true as const, tabIndex: -1, onKeyDown }
}
