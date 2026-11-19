/**
 * Abas: vários PDFs/projetos abertos ao mesmo tempo.
 *
 * O documento ativo continua nos campos de sempre do store (assim nenhum componente precisou mudar).
 * Ao trocar de aba, o estado do documento que sai é guardado aqui e o do que entra volta para o store.
 * Só as abas inativas ficam no mapa `saved`.
 */
import { useStore, uid } from './store'
import type { State } from './store'
import type { Source } from './pdf'
import { desktop } from './platform'

/** Campos do store que pertencem a um documento: cada aba guarda os seus. */
export const DOC_KEYS = ['fileName', 'sources', 'sheets', 'page', 'zoom', 'markups', 'scales', 'selected', 'past', 'future', 'ocr', 'meta', 'projectPath', 'overlays', 'hiddenLayers', 'dirty', 'search', 'columns', 'bdi'] as const
export type DocState = Pick<State, (typeof DOC_KEYS)[number]>

const saved = new Map<string, DocState>()
let switching = false

/** Verdadeiro enquanto uma aba é aberta/trocada: o salvamento automático não deve tratar isso como edição. */
export const isSwitching = () => switching

/** Estado transitório que não vale de um documento para outro. */
const RESET_UI: Partial<State> = { mode: 'review', tool: 'select', calibrating: null, resumeTool: null, editingText: null, aligning: null, pendingImage: null, holeTarget: null, split3d: false }

export const emptyDoc = (keep?: Pick<State, 'columns' | 'bdi'>): DocState => ({
  fileName: '', sources: {}, sheets: [], page: 0, zoom: 1, markups: [], scales: {}, selected: [], past: [], future: [], ocr: {},
  meta: { title: '', author: '', subject: '', keywords: '' }, projectPath: null, overlays: {}, hiddenLayers: {}, dirty: false,
  search: { open: false, query: '', hits: [], index: 0 }, columns: keep?.columns ?? [], bdi: keep?.bdi ?? 0,
})

const pick = (s: State): DocState => Object.fromEntries(DOC_KEYS.map((k) => [k, s[k]])) as unknown as DocState
const titleOf = (d: Pick<DocState, 'fileName' | 'meta'>) => d.fileName || d.meta.title || '—'

function apply(patch: Partial<State>) {
  switching = true
  try {
    useStore.setState(patch)
  } finally {
    switching = false
  }
  syncDirty()
}

/** Há alguma aba com alterações não salvas? (o app de PC pergunta antes de fechar a janela) */
export const anyDirty = () => useStore.getState().dirty || [...saved.values()].some((d) => d.dirty)
export const syncDirty = () => desktop?.setDirty?.(anyDirty())

/** Guarda o documento ativo no mapa (antes de sair dele). */
function stash() {
  const s = useStore.getState()
  if (s.activeTab && s.sheets.length) saved.set(s.activeTab, pick(s))
}

/** O que a aba mostra no título: o nome atual do arquivo da aba. */
const tabsWithTitle = (s: State) => s.tabs.map((t) => (t.id === s.activeTab ? { ...t, title: titleOf(s) } : t))

/**
 * Abre um documento numa aba nova (ou na primeira, se não há nada aberto). Se o mesmo projeto (.traco) já está aberto,
 * apenas volta para a aba dele e devolve false.
 */
export function openInTab(doc: Partial<DocState> & Pick<DocState, 'sheets' | 'sources' | 'fileName'>): boolean {
  const s = useStore.getState()
  if (doc.projectPath) {
    const hit = s.tabs.find((t) => (t.id === s.activeTab ? s.projectPath : saved.get(t.id)?.projectPath) === doc.projectPath)
    if (hit) {
      switchTab(hit.id)
      return false
    }
  }
  const id = uid()
  const base = emptyDoc(s)
  const next: DocState = { ...base, ...doc, meta: doc.meta ?? { ...base.meta, title: doc.fileName.replace(/\.pdf$/i, '') } }
  if (s.sheets.length && s.activeTab) {
    stash()
    apply({ ...next, ...RESET_UI, tabs: [...tabsWithTitle(s), { id, title: titleOf(next) }], activeTab: id })
  } else {
    // nada aberto (ou documento antigo sem aba): esta passa a ser a única
    apply({ ...next, ...RESET_UI, tabs: [{ id, title: titleOf(next) }], activeTab: id })
  }
  return true
}

export function switchTab(id: string) {
  const s = useStore.getState()
  if (id === s.activeTab) return
  const target = saved.get(id)
  if (!target) return
  stash()
  saved.delete(id)
  apply({ ...target, ...RESET_UI, tabs: tabsWithTitle(s), activeTab: id })
}

const destroySources = (src: Record<string, Source>) => Object.values(src).forEach((x) => { try { x.doc.destroy() } catch { /* já destruído */ } })

/**
 * Fecha a aba ativa (as alterações já foram tratadas por quem chamou). Mostra a vizinha; sem nenhuma, o app volta ao estado vazio.
 */
export function closeActiveTab() {
  const s = useStore.getState()
  destroySources(s.sources)
  const idx = s.tabs.findIndex((t) => t.id === s.activeTab)
  const rest = s.tabs.filter((t) => t.id !== s.activeTab)
  const nextTab = rest[Math.min(Math.max(idx, 0), rest.length - 1)]
  const doc = nextTab && saved.get(nextTab.id)
  if (nextTab && doc) {
    saved.delete(nextTab.id)
    apply({ ...doc, ...RESET_UI, dialog: null, tabs: rest, activeTab: nextTab.id })
  } else {
    apply({ ...emptyDoc(s), ...RESET_UI, activePreset: null, dialog: null, tabs: [], activeTab: null })
  }
}

/** Ordem das abas (arrastar). */
export function moveTab(id: string, to: number) {
  const s = useStore.getState()
  const from = s.tabs.findIndex((t) => t.id === id)
  if (from < 0 || to < 0 || to >= s.tabs.length || from === to) return
  const tabs = s.tabs.slice()
  tabs.splice(to, 0, tabs.splice(from, 1)[0])
  useStore.setState({ tabs })
}

/** Abas (na ordem) com alterações pendentes. */
export const dirtyTabIds = () => {
  const s = useStore.getState()
  return s.tabs.filter((t) => (t.id === s.activeTab ? s.dirty : saved.get(t.id)?.dirty)).map((t) => t.id)
}

export const tabDirty = (id: string) => (id === useStore.getState().activeTab ? useStore.getState().dirty : !!saved.get(id)?.dirty)

/** Aba que já tem este arquivo de projeto aberto, se houver. */
export function tabForPath(path: string): string | null {
  const s = useStore.getState()
  for (const t of s.tabs) if ((t.id === s.activeTab ? s.projectPath : saved.get(t.id)?.projectPath) === path) return t.id
  return null
}
