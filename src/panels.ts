import { useStore } from './store'

/** Mostra/oculta painéis (Ctrl+1 lateral, Ctrl+2 quantitativo, Ctrl+3 propriedades). */
export function togglePanel(k: 'left' | 'bottom' | 'right') {
  const s = useStore.getState()
  if (k === 'left') return s.set({ nav: s.nav && !s.focus ? null : 'pages', focus: false, mode: 'review' })
  s.set({ panels: { ...s.panels, [k]: !s.panels[k] || s.focus }, focus: false, mode: 'review' })
}
