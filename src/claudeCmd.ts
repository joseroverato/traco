import { useSyncExternalStore } from 'react'
import { useStore } from './store'

/** Comandos do painel do Claude que a faixa de opções (aba Claude) dispara. O estado da conversa é local do ClaudePanel, que escuta este evento. */
export type ClaudeCmd = 'new' | 'stop' | 'settings' | { suggest: number }

export const CLAUDE_EVENT = 'traco:claude'

/**
 * Entrega um comando ao painel do Claude. Se o painel não está à vista (fechado, outra aba da paleta direita, painéis recolhidos),
 * abre a aba Claude primeiro e só então dispara, para o painel já estar montado e escutando.
 */
export function claudeCmd(cmd: ClaudeCmd) {
  const st = useStore.getState()
  const visible = st.mode === 'review' && st.panels.right && st.rightTab === 'claude' && !st.focus
  if (!visible) st.set({ mode: 'review', rightTab: 'claude', panels: { ...st.panels, right: true }, focus: false })
  window.setTimeout(() => window.dispatchEvent(new CustomEvent<ClaudeCmd>(CLAUDE_EVENT, { detail: cmd })), visible ? 0 : 150)
}

/** O painel está respondendo? (o botão Parar da faixa só vale nesse caso). Espelha o estado local do ClaudePanel. */
let responding = false
const subs = new Set<() => void>()
export const isClaudeBusy = () => responding
export function setClaudeBusy(b: boolean) {
  if (b === responding) return
  responding = b
  subs.forEach((f) => f())
}
export const useClaudeBusy = () => useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f) } }, () => responding)
