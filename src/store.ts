import { create } from 'zustand'
import type { CustomColumn, Markup, MarkupKind, OcrResult, Overlay, PageScale, Preset, Sheet, StatusDef, Tool } from './types'
import type { Source } from './pdf'

export const uid = () => Math.random().toString(36).slice(2, 10)

const P = (p: Partial<Preset> & Pick<Preset, 'name' | 'group' | 'measure' | 'color'>): Preset => ({
  id: uid(),
  code: '',
  opacity: 0.25,
  width: 1.5,
  dash: 'solid',
  pattern: 'solid',
  symbol: 'circle',
  letter: '',
  factor: 1,
  factorLabel: '',
  formula: '',
  resultUnit: p.measure === 'length' ? 'm' : p.measure === 'area' ? 'm²' : 'un',
  unitPrice: 0,
  showLabel: true,
  ...p,
})

export const defaultPresets = (): Preset[] => [
  P({ name: 'Alvenaria bloco cerâmico 14 cm', group: 'Civil', measure: 'length', color: '#e5484d', width: 4, pattern: 'hatch', factor: 2.8, factorLabel: 'pé-direito (m)', resultUnit: 'm²' }),
  P({ name: 'Contrapiso e = 4 cm', group: 'Civil', measure: 'area', color: '#8b8d98', pattern: 'dots', opacity: 0.3 }),
  P({ name: 'Revestimento cerâmico piso', group: 'Civil', measure: 'area', color: '#3e63dd', pattern: 'cross', opacity: 0.22 }),
  P({ name: 'Rodapé cerâmico h = 7 cm', group: 'Civil', measure: 'area', color: '#0d74ce', pattern: 'none', opacity: 0.1, formula: 'P', resultUnit: 'm' }),
  P({ name: 'Pintura paredes + teto', group: 'Acabamento', measure: 'area', color: '#12a594', pattern: 'hatch', opacity: 0.18, factor: 2.8, factorLabel: 'pé-direito (m)', formula: 'A + P*H' }),
  P({ name: 'Pintura acrílica parede', group: 'Acabamento', measure: 'length', color: '#12a594', width: 3, dash: 'dash', factor: 2.8, factorLabel: 'altura (m)', resultUnit: 'm²' }),
  P({ name: 'Ponto de tomada', group: 'Elétrica', measure: 'count', color: '#f76b15', symbol: 'circle' }),
  P({ name: 'Ponto de iluminação', group: 'Elétrica', measure: 'count', color: '#ffc53d', symbol: 'letter', letter: 'L' }),
  P({ name: 'Eletroduto PVC 3/4"', group: 'Elétrica', measure: 'length', color: '#d6409f', width: 2, dash: 'dot', formula: 'L * 1,10', factorLabel: '' }),
  P({ name: 'Tubo PVC esgoto 100 mm', group: 'Hidrossanitário', measure: 'length', color: '#8e4ec6', width: 3 }),
]

export const defaultStatuses = (): StatusDef[] => [
  { name: 'aberto', color: '#e5484d' },
  { name: 'em análise', color: '#ffb224' },
  { name: 'resolvido', color: '#30a46c' },
  { name: 'rejeitado', color: '#8b8d98' },
]

const ls = {
  get<T>(k: string, d: T): T {
    try {
      const s = localStorage.getItem(k)
      return s ? (JSON.parse(s) as T) : d
    } catch {
      return d
    }
  },
  set(k: string, v: unknown) {
    try {
      localStorage.setItem(k, JSON.stringify(v))
    } catch {
      /* sem storage */
    }
  },
}

// garante campos novos em bibliotecas salvas antes
const loadPresets = () => ls.get<Preset[]>('traco.presets', defaultPresets()).map((p) => ({ ...p, formula: p.formula ?? '' }))

export type Mode = 'review' | 'pages' | 'compare'
interface Snapshot {
  markups: Markup[]
  sheets: Sheet[]
}

export interface State {
  fileName: string
  sources: Record<string, Source>
  sheets: Sheet[]
  page: number // índice em sheets
  zoom: number
  tool: Tool
  mode: Mode
  activePreset: string | null
  markups: Markup[]
  presets: Preset[]
  statuses: StatusDef[]
  scales: Record<string, PageScale> // por Sheet.id
  selected: string[]
  theme: 'dark' | 'light'
  author: string
  past: Snapshot[]
  future: Snapshot[]
  calibrating: { page: string; length: number; viewport?: string; prompt?: boolean } | null
  resumeTool: Tool | null
  editingText: string | null
  panels: { left: boolean; right: boolean; bottom: boolean }
  dialog: null | 'export' | 'stamp' | 'statuses' | 'meta' | 'claude-settings' | 'prices' | 'columns' | 'updates' | 'recover' | 'claude-desktop'
  bottomH: number
  rightW: number
  toast: string | null
  fitReq: { mode: 'page' | 'width'; n: number } | null
  pendingImage: string | null
  meta: { title: string; author: string; subject: string; keywords: string }
  projectPath: string | null
  ocr: Record<string, OcrResult>
  rightTab: 'presets' | 'props' | 'claude'
  claudeModel: string
  snap: boolean
  ortho: boolean
  focus: boolean
  redactFill: '#000000' | '#ffffff'
  nav: 'pages' | 'edit' | 'measure' | 'export' | 'layers' | 'overlay' | 'issues' | null
  columns: CustomColumn[]
  bdi: number
  overlays: Record<string, Overlay[]>
  hiddenLayers: Record<string, string[]> // por Source.id: ids de camadas (OCG) ocultas
  groupBy: 'preset' | 'space' | 'level' | 'sheet' | 'status'
  presetDialog: { id: string | null; draft?: Partial<Preset> } | null
  updateReady: string | null
  search: { open: boolean; query: string; hits: { sheet: string; x: number; y: number; w: number; h: number; text: string }[]; index: number }
  dirty: boolean
  fillGap: number // preenchimento: fecha aberturas até N pt
  minHole: number // vazios menores (m²) são ignorados na área por clique
  aligning: { overlay: string; step: number; pts: { x: number; y: number }[] } | null
  fillAs: 'area' | 'space'
  holeTarget: string | null

  set: (p: Partial<State>) => void
  setTool: (t: Tool) => void
  addMarkup: (kind: MarkupKind, page: string, points: Markup['points'], extra?: Partial<Markup>) => Markup
  updateMarkup: (id: string, patch: Partial<Markup>, record?: boolean) => void
  removeMarkups: (ids: string[]) => void
  checkpoint: () => void
  undo: () => void
  redo: () => void
  setPresets: (p: Preset[]) => void
  setStatuses: (s: StatusDef[]) => void
  setStatus: (ids: string[], s: string) => void
  setSheets: (sheets: Sheet[], extra?: Partial<State>) => void
  notify: (msg: string) => void
}

export const curSheet = (s: Pick<State, 'sheets' | 'page'>) => s.sheets[s.page] as Sheet | undefined

export const useStore = create<State>((set, get) => ({
  fileName: '',
  sources: {},
  sheets: [],
  page: 0,
  zoom: 1,
  tool: 'select',
  mode: 'review',
  activePreset: null,
  markups: [],
  presets: loadPresets(),
  statuses: ls.get('traco.statuses', defaultStatuses()),
  scales: {},
  selected: [],
  theme: ls.get<'dark' | 'light'>('traco.theme', 'dark'),
  author: ls.get('traco.author', 'José'),
  past: [],
  future: [],
  calibrating: null,
  resumeTool: null,
  editingText: null,
  panels: { left: true, right: true, bottom: true },
  dialog: null,
  bottomH: ls.get('traco.bottomH', 240),
  rightW: ls.get('traco.rightW', 300),
  toast: null,
  fitReq: null,
  pendingImage: null,
  meta: { title: '', author: '', subject: '', keywords: '' },
  projectPath: null,
  ocr: {},
  rightTab: 'presets',
  claudeModel: ls.get('traco.model', 'claude-sonnet-5-5'),
  snap: ls.get('traco.snap', true),
  ortho: false,
  focus: false,
  redactFill: '#000000',
  nav: 'pages',
  columns: [],
  bdi: 0,
  overlays: {},
  hiddenLayers: {},
  groupBy: 'preset',
  presetDialog: null,
  updateReady: null,
  search: { open: false, query: '', hits: [], index: 0 },
  dirty: false,
  fillGap: 2,
  minHole: ls.get('traco.minHole', 0.25),
  aligning: null,
  fillAs: 'area',
  holeTarget: null,

  set: (p) => set(p),
  setTool: (t) => set({ tool: t, selected: t === 'select' ? get().selected : [] }),

  addMarkup: (kind, page, points, extra = {}) => {
    const s = get()
    const preset = s.presets.find((p) => p.id === s.activePreset)
    const usePreset = preset && preset.measure === kind
    const color = usePreset ? preset.color : kind === 'viewport' ? '#0090ff' : '#e5484d'
    const m: Markup = {
      id: uid(),
      page,
      kind,
      points,
      text: '',
      comment: '',
      status: s.statuses[0]?.name ?? 'aberto',
      author: s.author,
      createdAt: Date.now(),
      presetId: usePreset ? preset.id : null,
      deduct: false,
      color,
      width: usePreset ? preset.width : 1.5,
      fill: color,
      fillOpacity: usePreset ? preset.opacity : kind === 'area' ? 0.2 : 0,
      fontSize: 12,
      ...extra,
    }
    const sel = kind === 'text' || kind === 'stamp' || kind === 'image' || kind === 'viewport' ? [m.id] : []
    set({ past: [...s.past, { markups: s.markups, sheets: s.sheets }], future: [], markups: [...s.markups, m], selected: sel })
    return m
  },
  updateMarkup: (id, patch, record = true) => {
    const s = get()
    set({
      ...(record ? { past: [...s.past, { markups: s.markups, sheets: s.sheets }], future: [] } : {}),
      markups: s.markups.map((m) => (m.id === id ? { ...m, ...patch } : m)),
    })
  },
  removeMarkups: (ids) => {
    const s = get()
    set({ past: [...s.past, { markups: s.markups, sheets: s.sheets }], future: [], markups: s.markups.filter((m) => !ids.includes(m.id)), selected: [] })
  },
  checkpoint: () => {
    const s = get()
    set({ past: [...s.past.slice(-80), { markups: s.markups, sheets: s.sheets }], future: [] })
  },
  undo: () => {
    const s = get()
    const last = s.past[s.past.length - 1]
    if (!last) return
    set({ ...last, past: s.past.slice(0, -1), future: [{ markups: s.markups, sheets: s.sheets }, ...s.future], selected: [], page: Math.min(s.page, Math.max(0, last.sheets.length - 1)) })
  },
  redo: () => {
    const s = get()
    const next = s.future[0]
    if (!next) return
    set({ ...next, future: s.future.slice(1), past: [...s.past, { markups: s.markups, sheets: s.sheets }], selected: [], page: Math.min(s.page, Math.max(0, next.sheets.length - 1)) })
  },
  setPresets: (p) => {
    ls.set('traco.presets', p)
    set({ presets: p })
  },
  setStatuses: (st) => {
    ls.set('traco.statuses', st)
    set({ statuses: st })
  },
  setStatus: (ids, st) => {
    const s = get()
    set({ past: [...s.past, { markups: s.markups, sheets: s.sheets }], future: [], markups: s.markups.map((m) => (ids.includes(m.id) ? { ...m, status: st } : m)) })
  },
  setSheets: (sheets, extra = {}) => {
    const s = get()
    const alive = new Set(sheets.map((x) => x.id))
    set({
      past: [...s.past, { markups: s.markups, sheets: s.sheets }],
      future: [],
      sheets,
      markups: s.markups.filter((m) => alive.has(m.page)),
      page: Math.min(s.page, Math.max(0, sheets.length - 1)),
      ...extra,
    })
  },
  notify: (msg) => {
    set({ toast: msg })
    setTimeout(() => get().toast === msg && set({ toast: null }), 2800)
  },
}))
