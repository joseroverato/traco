import { flushSync } from 'react-dom'
import { useStore } from './store'
import type { State } from './store'

/**
 * Movimento do app. Trocas grandes de tela usam a View Transitions API: o navegador guarda uma imagem da tela antiga e anima até a nova.
 * Só a área central ("stage") se move; a barra superior e o menu lateral ficam parados. Sem suporte, ou com "reduzir movimento", troca direto.
 */
type VTDoc = Document & { startViewTransition?: (cb: () => void | Promise<void>) => { finished: Promise<void> } }

export type Dir = 'fwd' | 'back' | 'up' | 'down' | 'fade' | 'theme'

const reduced = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches

export function withTransition(update: () => void, dir: Dir = 'fade') {
  const d = document as VTDoc
  if (!d.startViewTransition || reduced()) return update()
  const root = document.documentElement
  root.dataset.vt = dir
  const vt = d.startViewTransition(() => flushSync(update))
  const clear = () => { delete root.dataset.vt }
  vt.finished.then(clear, clear)
}

/** Ordem dos modos na barra: ir para a direita desliza para a esquerda, e vice-versa. */
const ORDER: State['mode'][] = ['review', 'pages', 'compare', '3d']

/** Troca de modo (Revisar, Pranchas, Comparar, 3D) com a direção certa. `patch` leva o que mais mudar junto. */
export function setModeAnimated(mode: State['mode'], patch: Partial<State> = {}) {
  const st = useStore.getState()
  if (st.mode === mode) return st.set(patch)
  const dir: Dir = ORDER.indexOf(mode) > ORDER.indexOf(st.mode) ? 'fwd' : 'back'
  withTransition(() => useStore.getState().set({ mode, ...patch }), dir)
}

/** Carrega os módulos pesados em segundo plano, para a troca de modo não esperar o download no meio da animação. */
export function preloadViews() {
  const run = () => {
    void import('./components/PagesView')
    void import('./components/CompareView')
    void import('./components/View3D')
  }
  const ric = (window as unknown as { requestIdleCallback?: (cb: () => void) => void }).requestIdleCallback
  if (ric) ric(run)
  else setTimeout(run, 1500)
}
