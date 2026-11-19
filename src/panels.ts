import { useLayoutEffect, useState } from 'react'
import { useStore } from './store'
import { reducedMotion } from './motion'

/** Mostra/oculta painéis (Ctrl+1 paletas da esquerda, Ctrl+2 quantitativo, Ctrl+3 propriedades). */
export function togglePanel(k: 'left' | 'bottom' | 'right') {
  const s = useStore.getState()
  // as paletas existem em todos os modos (Revisar, Pranchas, Comparar, 3D): alternar uma não troca de modo
  s.set({ panels: { ...s.panels, [k]: !s.panels[k] || s.focus }, focus: false })
}

/** Tempo que o painel leva para sair. Tem de ser igual a `--t-med` no index.css. */
export const PANEL_MS = 200
const INSTANT_MS = 80 // o bastante para o React aplicar a troca sem transição

let instant = false

/** Chamado antes de um atalho de teclado mexer nos painéis: a troca seguinte é imediata, sem animação. */
export function panelsInstant() {
  instant = true
  document.body.classList.add('panels-instant')
  window.setTimeout(() => {
    instant = false
    document.body.classList.remove('panels-instant')
  }, INSTANT_MS)
}

/**
 * Devolve `open`, mas ao fechar segura o valor verdadeiro por PANEL_MS. A grade usa este valor e a classe `collapsed` usa o `open`
 * direto: assim o painel sai animando (transform e opacidade) e só depois a coluna fecha, de uma vez. A planta é redimensionada uma
 * única vez, e não a cada quadro. Com teclado ou "reduzir movimento", fecha na hora.
 */
export function useLagClose(open: boolean): boolean {
  const [held, setHeld] = useState(open)
  useLayoutEffect(() => {
    if (open) return setHeld(true)
    if (instant || reducedMotion()) return setHeld(false)
    const timer = window.setTimeout(() => setHeld(false), PANEL_MS)
    return () => window.clearTimeout(timer)
  }, [open])
  return open || held
}
