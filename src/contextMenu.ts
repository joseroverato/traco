import { Copy, Hand, Magnet, MousePointer2, MoveHorizontal, Maximize, Redo2, Scaling, Search, SlidersHorizontal, SquareDashedMousePointer, Target, TextCursorInput, Trash2, Undo2, Move, X, ZoomIn } from 'lucide-react'
import { curSheet, useStore } from './store'
import { requestCloseProject } from './project'
import { duplicateMarkups } from './viewerActions'
import { t } from './i18n'
import type { MenuItem } from './components/ContextMenu'

/** Comandos que o Viewer entende (ele guarda o estado local: contagem em andamento, modo de copiar texto). */
export type ViewerCmd = 'copytext' | 'count-new'
export const viewerCmd = (cmd: ViewerCmd) => window.dispatchEvent(new CustomEvent('traco:viewer', { detail: cmd }))

/**
 * Itens do botão direito sobre a folha. Primeiro vêm os do contexto (marcação sob o ponteiro, ferramenta ativa, alinhamento),
 * depois os fixos (copiar texto, escala, zoom, snap, desfazer, buscar, fechar projeto).
 */
export function viewerMenu(hitId: string | null): MenuItem[] {
  const st = useStore.getState()
  const sh = curSheet(st)
  const has = st.sheets.length > 0
  const items: MenuItem[] = []
  const sep = () => {
    if (items.length && !('sep' in items[items.length - 1])) items.push({ sep: true })
  }
  const zoomBy = (f: number) => window.dispatchEvent(new CustomEvent('traco:zoom', { detail: f }))

  // ---- contexto: marcação sob o ponteiro ----
  if (hitId && st.selected.includes(hitId)) {
    const n = st.selected.length
    items.push(
      { id: 'props', label: t('menu.propriedades'), icon: SlidersHorizontal, onClick: () => st.set({ rightTab: 'props', panels: { ...st.panels, right: true }, focus: false }) },
      { id: 'dup', label: t('menu.duplicar'), icon: Copy, hint: n > 1 ? `×${n}` : undefined, onClick: () => duplicateMarkups(st.selected) },
      { id: 'del', label: t('menu.excluir'), icon: Trash2, hint: 'Del', danger: true, onClick: () => st.removeMarkups(st.selected) },
    )
  } else if (st.selected.length) {
    items.push({ id: 'clear', label: t('menu.limpar_selecao'), icon: X, hint: 'Esc', onClick: () => st.set({ selected: [] }) })
  }

  // ---- contexto: ferramenta ativa ----
  if (st.aligning) {
    sep()
    items.push({ id: 'alignx', label: t('menu.cancelar_alinhamento'), icon: X, hint: 'Esc', onClick: () => st.set({ aligning: null }) })
  } else if (st.tool === 'count') {
    sep()
    items.push({ id: 'count', label: t('menu.nova_contagem'), icon: Target, hint: 'Esc', onClick: () => viewerCmd('count-new') })
  } else if (st.tool === 'select' && sh) {
    sep()
    items.push({ id: 'all', label: t('menu.selecionar_tudo'), icon: SquareDashedMousePointer, hint: 'Ctrl+A', onClick: () => st.set({ selected: st.markups.filter((m) => m.page === sh.id).map((m) => m.id) }) })
  }
  if (st.tool !== 'select') items.push({ id: 'tsel', label: t('menu.ferramenta_selecionar'), icon: MousePointer2, onClick: () => st.setTool('select') })
  if (st.tool !== 'pan') items.push({ id: 'tpan', label: t('menu.ferramenta_mao'), icon: Hand, onClick: () => st.setTool('pan') })

  // ---- fixos ----
  sep()
  items.push(
    { id: 'copytext', label: t('menu.selecionar_texto'), icon: TextCursorInput, disabled: !sh, onClick: () => viewerCmd('copytext') },
    { id: 'find', label: t('menu.buscar_texto'), icon: Search, hint: 'Ctrl+F', disabled: !has, onClick: () => st.set({ search: { ...st.search, open: true }, mode: 'review' }) },
    { sep: true },
    { id: 'scale', label: t('menu.ajustar_escala'), icon: Scaling, disabled: !sh, onClick: () => sh && st.set({ calibrating: { page: sh.id, length: 0 } }) },
    { id: 'fitp', label: t('menu.ajustar_a_folha'), icon: Maximize, hint: '0', disabled: !sh, onClick: () => st.set({ fitReq: { mode: 'page', n: Date.now() } }) },
    { id: 'fitw', label: t('menu.ajustar_a_largura'), icon: MoveHorizontal, hint: 'W', disabled: !sh, onClick: () => st.set({ fitReq: { mode: 'width', n: Date.now() } }) },
    { id: 'z100', label: t('menu.zoom_100'), icon: ZoomIn, disabled: !sh, onClick: () => zoomBy(1 / (useStore.getState().zoom || 1)) },
    { sep: true },
    { id: 'snap', label: t('menu.snap'), icon: Magnet, hint: 'F3', checked: st.snap, onClick: () => st.set({ snap: !st.snap }) },
    { id: 'ortho', label: t('menu.ortogonal'), icon: Move, hint: 'F8', checked: st.ortho, onClick: () => st.set({ ortho: !st.ortho }) },
    { sep: true },
    { id: 'undo', label: t('menu.desfazer'), icon: Undo2, hint: 'Ctrl+Z', disabled: !st.past.length, onClick: () => st.undo() },
    { id: 'redo', label: t('menu.refazer'), icon: Redo2, hint: 'Ctrl+Y', disabled: !st.future.length, onClick: () => st.redo() },
    { sep: true },
    { id: 'close', label: t('project.fechar_projeto'), icon: X, hint: 'Ctrl+W', disabled: !has, onClick: requestCloseProject },
  )
  return items
}
