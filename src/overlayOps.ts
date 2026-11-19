/** Sobreposição de disciplinas sobre a folha atual: comandos usados pela paleta Sobrepor e pelos botões da faixa. */
import { curSheet, uid, useStore } from './store'
import type { State } from './store'
import type { Overlay } from './types'
import { t } from './i18n'

export const OVERLAY_COLORS = ['#e5484d', '#0090ff', '#30a46c', '#f76b15', '#8e4ec6', '#d6409f']

/** Sobreposições da folha atual. */
export const overlaysOf = (s: Pick<State, 'sheets' | 'page' | 'overlays'>): Overlay[] => {
  const sh = curSheet(s)
  return (sh && s.overlays[sh.id]) || []
}

/**
 * Sobreposição que os botões da faixa (Alinhar por 2 pontos, Zerar, Intensidade) afetam: a que está sendo alinhada agora;
 * senão, a última adicionada à folha. Sem sobreposição, os botões ficam indisponíveis.
 */
export function targetOverlay(s: Pick<State, 'sheets' | 'page' | 'overlays' | 'aligning'>): Overlay | undefined {
  const list = overlaysOf(s)
  return list.find((o) => o.id === s.aligning?.overlay) ?? list[list.length - 1]
}

export function saveOverlays(sheetId: string, next: Overlay[]) {
  const s = useStore.getState()
  s.set({ overlays: { ...s.overlays, [sheetId]: next } })
}

export function updateOverlay(sheetId: string, id: string, patch: Partial<Overlay>) {
  const s = useStore.getState()
  saveOverlays(sheetId, (s.overlays[sheetId] ?? []).map((o) => (o.id === id ? { ...o, ...patch } : o)))
}

export interface OverlayOption { key: string; label: string; src: string; srcIndex: number; rot: number }

/** Sobrepõe uma folha (ou página de outro PDF) à folha atual. */
export function addOverlay(opt: OverlayOption) {
  const s = useStore.getState()
  const sh = curSheet(s)
  if (!sh) return
  const list = s.overlays[sh.id] ?? []
  const ov: Overlay = { id: uid(), src: opt.src, srcIndex: opt.srcIndex, rot: opt.rot, label: opt.label, color: OVERLAY_COLORS[list.length % OVERLAY_COLORS.length], opacity: 0.85, visible: true, matrix: [1, 0, 0, 1, 0, 0] }
  saveOverlays(sh.id, [...list, ov])
  s.notify(t('overlaypanel.sobreposta_se_nao_coincidir_use', { label: opt.label }))
}

export const startAlign = (overlayId: string) => useStore.getState().set({ aligning: { overlay: overlayId, step: 0, pts: [] }, tool: 'select', mode: 'review' })
export const resetOverlay = (sheetId: string, id: string) => updateOverlay(sheetId, id, { matrix: [1, 0, 0, 1, 0, 0] })
