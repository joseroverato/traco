import { useStore } from '../../store'
import type { Markup } from '../../types'
import { centerOf } from './model'

/** Seleciona a medição, abre a folha dela e centraliza a vista (o Viewer escuta `traco:center`). */
export function selectMarkup(m: Markup) {
  const s = useStore.getState()
  const idx = s.sheets.findIndex((x) => x.id === m.page)
  if (idx < 0) return
  const turned = idx !== s.page
  s.set({ page: idx, selected: [m.id], tool: 'select', activePreset: null, focus: false, rightTab: 'props', ...(s.panels.right ? {} : { panels: { ...s.panels, right: true } }) })
  if (s.mode !== 'review') return
  // trocar de folha refaz a página: o ponto só é centralizado depois que a folha nova está na tela
  window.setTimeout(() => window.dispatchEvent(new CustomEvent('traco:center', { detail: centerOf(m) })), turned ? 160 : 0)
}
