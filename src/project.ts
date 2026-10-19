import { openSource, sheetsOf } from './pdf'
import type { Source } from './pdf'
import { useStore } from './store'
import { desktop } from './platform'
import { decodeProject, encodeProject } from './projectFormat'
import type { ProjectData } from './projectFormat'
import type { Sheet } from './types'

const toBuffer = (u: Uint8Array) => u.buffer.slice(u.byteOffset, u.byteOffset + u.byteLength) as ArrayBuffer

const FILTERS: Record<string, { name: string; extensions: string[] }> = {
  pdf: { name: 'PDF', extensions: ['pdf'] },
  traco: { name: 'Projeto Traço', extensions: ['traco'] },
  xlsx: { name: 'Excel', extensions: ['xlsx'] },
  zip: { name: 'ZIP', extensions: ['zip'] },
  json: { name: 'JSON', extensions: ['json'] },
}

/** Salva um arquivo: diálogo nativo no app de PC, download no navegador. Retorna o caminho (PC) ou null. */
export async function download(data: Uint8Array | ArrayBuffer | string, name: string, type = 'application/octet-stream', path?: string): Promise<string | null> {
  if (desktop) {
    const ext = name.split('.').pop()!.toLowerCase()
    const bytes = typeof data === 'string' ? data : data instanceof Uint8Array ? data : new Uint8Array(data)
    return desktop.saveFile({ defaultName: name, data: bytes, filters: FILTERS[ext] ? [FILTERS[ext]] : undefined, path })
  }
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([data as BlobPart], { type }))
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 4000)
  return null
}

const destroyAll = () => Object.values(useStore.getState().sources).forEach((s) => s.doc.destroy())

export async function loadFile(file: File | { name: string; data: ArrayBuffer; path?: string }) {
  const buf = 'data' in file ? file.data : await file.arrayBuffer()
  const path = 'path' in file ? file.path : undefined
  if (file.name.toLowerCase().endsWith('.traco')) {
    await loadProject(buf)
    useStore.setState({ projectPath: path ?? null })
    return
  }
  const src = await openSource(buf, file.name)
  const sheets = await sheetsOf(src)
  destroyAll()
  useStore.setState({
    sources: { [src.id]: src }, sheets, page: 0, fileName: file.name, markups: [], scales: {}, selected: [], past: [], future: [], mode: 'review', projectPath: null, ocr: {},
    overlays: {}, hiddenLayers: {}, dirty: false, search: { open: false, query: '', hits: [], index: 0 },
    meta: { title: file.name.replace(/\.pdf$/i, ''), author: '', subject: '', keywords: '' },
  })
}

/** Acrescenta as páginas de outro PDF ao conjunto (após a posição indicada). */
export async function insertPdf(file: File, at?: number) {
  const st = useStore.getState()
  const src = await openSource(await file.arrayBuffer(), file.name)
  const add = await sheetsOf(src)
  const pos = at ?? st.sheets.length
  const sheets = [...st.sheets.slice(0, pos), ...add, ...st.sheets.slice(pos)]
  st.setSheets(sheets, { sources: { ...st.sources, [src.id]: src }, fileName: st.fileName || file.name })
  return add.length
}

/** Abre um PDF só como fonte (sem acrescentar folhas) — usado na comparação. */
export async function addSourceOnly(file: File): Promise<{ src: Source; sheets: Sheet[] }> {
  const st = useStore.getState()
  const src = await openSource(await file.arrayBuffer(), file.name)
  const sheets = await sheetsOf(src)
  useStore.setState({ sources: { ...st.sources, [src.id]: src } })
  return { src, sheets }
}

export async function loadProject(buf: ArrayBuffer | Uint8Array) {
  const st = useStore.getState()
  const { data: pf, sources: srcs } = decodeProject(buf)
  const sources: Record<string, Source> = {}
  for (const s of srcs) sources[s.id] = await openSource(toBuffer(s.bytes), s.name, s.id)
  const known = new Set(st.presets.map((p) => p.id))
  st.setPresets([...st.presets, ...pf.presets.filter((p) => !known.has(p.id)).map((p) => ({ ...p, formula: p.formula ?? '' }))])
  if (pf.statuses?.length) st.setStatuses(pf.statuses)
  destroyAll()
  useStore.setState({
    sources, sheets: pf.sheets, page: 0, fileName: pf.fileName, markups: pf.markups, scales: pf.scales, selected: [], past: [], future: [], mode: 'review', ocr: pf.ocr ?? {},
    columns: pf.columns ?? st.columns, bdi: pf.bdi ?? st.bdi, overlays: pf.overlays ?? {}, hiddenLayers: pf.hiddenLayers ?? {}, dirty: false,
    search: { open: false, query: '', hits: [], index: 0 },
    meta: pf.meta ?? { title: pf.fileName, author: '', subject: '', keywords: '' },
  })
}

/** Projeto completo em bytes (.traco v3: ZIP). Usado ao salvar e no salvamento automático. */
export function serializeProject(): Uint8Array | null {
  const st = useStore.getState()
  if (!st.sheets.length) return null
  const usedSrc = new Set([...st.sheets.map((s) => s.src), ...Object.values(st.overlays).flat().map((o) => o.src)])
  const usedPreset = new Set(st.markups.map((m) => m.presetId))
  const data: ProjectData = {
    app: 'traco',
    version: 0, // encodeProject grava a versão atual
    fileName: st.fileName,
    sources: [],
    sheets: st.sheets,
    markups: st.markups,
    presets: st.presets.filter((p) => usedPreset.has(p.id)),
    statuses: st.statuses,
    scales: st.scales,
    meta: st.meta,
    ocr: st.ocr,
    columns: st.columns,
    bdi: st.bdi,
    overlays: st.overlays,
    hiddenLayers: st.hiddenLayers,
  }
  const sources = Object.values(st.sources).filter((s) => usedSrc.has(s.id)).map((s) => ({ id: s.id, name: s.name, bytes: new Uint8Array(s.bytes) }))
  return encodeProject({ data, sources })
}

export async function saveProject(saveAs = false) {
  const st = useStore.getState()
  const bytes = serializeProject()
  if (!bytes) return false
  const path = await download(bytes, `${st.fileName.replace(/\.pdf$/i, '')}.traco`, 'application/zip', saveAs ? undefined : st.projectPath ?? undefined)
  if (desktop && !path) return false // cancelado
  useStore.setState({ dirty: false, ...(path ? { projectPath: path } : {}) })
  st.notify(path ? `Projeto salvo em ${path}` : 'Projeto salvo')
  ;(await import('./autosave')).clearRecovery()
  return true
}
