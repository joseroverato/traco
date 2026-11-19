/** Ações e leituras das paletas da esquerda sobre o store (o modelo puro está em palModel.ts). */
import { useStore } from './store'
import type { State } from './store'
import { STACKS, savePalPrefs, stateOf, withPin, withState } from './palModel'
import type { PalId, PalState, StackTab } from './palModel'

/** Pilha da aba da faixa mostrada agora: a escolhida no modo Revisar; nos outros modos, a do próprio modo. */
export const stackTab = (s: Pick<State, 'mode' | 'ribbonTab'>): StackTab => (s.mode === 'review' ? s.ribbonTab : s.mode === 'pages' ? 'pranchas' : s.mode === 'compare' ? 'comparar' : '3d')

const commit = (palettes: State['palettes']) => {
  savePalPrefs(palettes)
  useStore.getState().set({ palettes })
}

/** Muda o estado de uma paleta na aba atual. */
export function setPal(id: PalId, state: PalState) {
  const s = useStore.getState()
  commit(withState(s.palettes, stackTab(s), id, state))
}

/** Abre a paleta (e mostra a coluna da esquerda, que pode estar recolhida ou em foco). */
export function openPal(id: PalId) {
  setPal(id, 'open')
  const s = useStore.getState()
  if (!s.panels.left || s.focus) s.set({ panels: { ...s.panels, left: true }, focus: false })
}

/** Aberta ↔ recolhida (a fechada volta aberta). */
export function togglePal(id: PalId) {
  const s = useStore.getState()
  if (stateOf(s.palettes, stackTab(s), id) === 'open') setPal(id, 'collapsed')
  else openPal(id)
}

export function pinPal(id: PalId, pin: boolean) {
  const s = useStore.getState()
  commit(withPin(s.palettes, stackTab(s), id, pin))
}

/** Estado e fixação de uma paleta na aba atual. */
export function usePal(id: PalId): { state: PalState; pinned: boolean } {
  const state = useStore((s) => stateOf(s.palettes, stackTab(s), id))
  const pinned = useStore((s) => s.palettes.pinned[id] !== undefined)
  return { state, pinned }
}

/** Paletas da aba atual, na ordem do GUIA, com o estado de cada uma. */
export function useStack(): { id: PalId; state: PalState }[] {
  const tab = useStore((s) => stackTab(s))
  const prefs = useStore((s) => s.palettes)
  return STACKS[tab].map(([id]) => ({ id, state: stateOf(prefs, tab, id) }))
}
