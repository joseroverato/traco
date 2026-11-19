/**
 * Estado e ações do modo Pranchas (R3, fase 4): seleção de folhas, diálogos abertos e o que estava preso dentro do PagesView.
 * A faixa de opções (ribbon.ts), a grade (PagesView) e a barra de status leem e chamam as MESMAS funções daqui.
 * A parte pesada (gerar PDF, OCR) importa os módulos só quando é usada.
 */
import { create } from 'zustand'
import { useStore } from './store'
import { insertPdf, download } from './project'
import { desktop } from './platform'
import { rotateSheets } from './sheetOps'
import { LANGS, getLang, localeOf, t, tp } from './i18n'
import type { Lang } from './i18n'
import type { Markup, Sheet } from './types'

export type PagesDlg = null | 'rename' | 'split' | 'blank'

interface PagesUi {
  /** folhas marcadas na grade (podem sobrar ids de folhas que já não existem: use `pagesSelected`) */
  sel: string[]
  anchor: string | null
  dlg: PagesDlg
  /** texto do que está sendo feito (gerando PDF, OCR…); null = nada */
  busy: string | null
  /** idioma escolhido para o OCR; null = o do app */
  ocrPick: Lang | null
}

const ocrSaved = (): Lang | null => {
  try { const v = localStorage.getItem('traco.ocrLang'); return LANGS.some((l) => l.id === v) ? (v as Lang) : null } catch { return null }
}

export const usePagesUi = create<PagesUi>(() => ({ sel: [], anchor: null, dlg: null, busy: null, ocrPick: ocrSaved() }))
const ui = () => usePagesUi.getState()
const setUi = (p: Partial<PagesUi>) => usePagesUi.setState(p)
const uid = () => Math.random().toString(36).slice(2, 10)

/** Ids marcados que ainda existem no conjunto. */
export function pagesSelected(sel = ui().sel): string[] {
  const ids = new Set(useStore.getState().sheets.map((x) => x.id))
  return sel.filter((id) => ids.has(id))
}
export const usePagesSelected = () => {
  const sel = usePagesUi((u) => u.sel)
  const sheets = useStore((s) => s.sheets)
  return sel.filter((id) => sheets.some((x) => x.id === id))
}
/** Índice da última folha marcada (ou da última do conjunto): onde entram as folhas inseridas. */
export function lastSelectedIndex(): number {
  const { sheets } = useStore.getState()
  const sel = pagesSelected()
  return sel.length ? Math.max(...sel.map((id) => sheets.findIndex((x) => x.id === id))) : sheets.length - 1
}
export const ocrLang = (): Lang => ui().ocrPick ?? getLang()

export const setPagesDlg = (dlg: PagesDlg) => setUi({ dlg })
export const setPagesBusy = (busy: string | null) => setUi({ busy })
export const setPagesSel = (sel: string[], anchor?: string | null) => setUi(anchor === undefined ? { sel } : { sel, anchor })
export function pickOcrLang(l: Lang) {
  setUi({ ocrPick: l })
  try { localStorage.setItem('traco.ocrLang', l) } catch { /* sem armazenamento: vale só nesta sessão */ }
}
/** Sai do modo: fecha diálogo e aviso de andamento (a seleção fica, como antes). */
export const resetPagesTransient = () => setUi({ dlg: null })

/** Clique numa folha da grade: Shift marca o intervalo, Ctrl/Cmd soma ou tira, simples troca a seleção. */
export function clickSheet(e: { shiftKey: boolean; ctrlKey: boolean; metaKey: boolean }, id: string) {
  const { sheets } = useStore.getState()
  const { sel, anchor } = ui()
  if (e.shiftKey && anchor) {
    const a = sheets.findIndex((x) => x.id === anchor), b = sheets.findIndex((x) => x.id === id)
    const [lo, hi] = a < b ? [a, b] : [b, a]
    setUi({ sel: sheets.slice(lo, hi + 1).map((x) => x.id) })
  } else if (e.ctrlKey || e.metaKey) {
    setUi({ sel: sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id], anchor: id })
  } else {
    setUi({ sel: [id], anchor: id })
  }
}

export const selectAllSheets = () => setUi({ sel: useStore.getState().sheets.map((x) => x.id) })
export const clearSheetSel = () => setUi({ sel: [] })

export function rotateSel(dir: 90 | -90) {
  const ids = pagesSelected()
  if (ids.length) rotateSheets(ids, dir)
}

export function removeSel() {
  const s = useStore.getState()
  const ids = pagesSelected()
  if (!ids.length || ids.length === s.sheets.length) return s.notify(t('pagesview.mantenha_ao_menos_uma_folha'), 'err')
  const gone = new Set(ids)
  s.setSheets(s.sheets.filter((x) => !gone.has(x.id)))
  setUi({ sel: [] })
  s.notify(tp('pagesview.removidas', gone.size))
}

export function duplicateSel() {
  const s = useStore.getState()
  const ids = pagesSelected()
  if (!ids.length) return
  const out: Sheet[] = []
  const extra: Markup[] = []
  const scales = { ...s.scales }
  for (const sh of s.sheets) {
    out.push(sh)
    if (ids.includes(sh.id)) {
      const copy = { ...sh, id: uid(), label: t('pagesview.copia', { label: sh.label }) }
      out.push(copy)
      if (s.scales[sh.id]) scales[copy.id] = s.scales[sh.id]
      s.markups.filter((m) => m.page === sh.id).forEach((m) => extra.push({ ...m, id: uid(), page: copy.id }))
    }
  }
  s.setSheets(out, { markups: [...s.markups, ...extra], scales })
}

/** Arrastar para reordenar: leva `ids` para a posição `at` (índice entre as folhas atuais). */
export function moveSheets(ids: string[], at: number) {
  const s = useStore.getState()
  const moving = s.sheets.filter((x) => ids.includes(x.id))
  const rest = s.sheets.filter((x) => !ids.includes(x.id))
  const before = s.sheets.slice(0, at).filter((x) => !ids.includes(x.id)).length
  s.setSheets([...rest.slice(0, before), ...moving, ...rest.slice(before)])
}

export const sortByName = () => { const s = useStore.getState(); s.setSheets([...s.sheets].sort((a, b) => a.label.localeCompare(b.label, localeOf(), { numeric: true }))) }
export const reverseOrder = () => { const s = useStore.getState(); s.setSheets([...s.sheets].reverse()) }
export function renameSheet(id: string, label: string) {
  const s = useStore.getState()
  s.setSheets(s.sheets.map((x) => (x.id === id ? { ...x, label } : x)))
}

/** Extrai as folhas marcadas (ou todas, se nada estiver marcado) para um PDF novo. */
export async function extractSheets() {
  const s = useStore.getState()
  const marked = pagesSelected()
  const ids = marked.length ? s.sheets.filter((x) => marked.includes(x.id)).map((x) => x.id) : s.sheets.map((x) => x.id)
  setUi({ busy: t('pagesview.gerando_pdf') })
  try {
    const { buildPdf } = await import('./pdfexport')
    const bytes = await buildPdf({ sheetIds: ids, flatten: false, bookmarks: true, pageLabels: true, removeAnnots: false, meta: true })
    download(bytes, tp('pagesview.nome_extraido', ids.length, { nome: s.fileName.replace(/\.pdf$/i, '') }), 'application/pdf')
  } finally {
    setUi({ busy: null })
  }
}

/** OCR das folhas marcadas (ou de todas). Só no app de PC. */
export async function runOcr() {
  if (!desktop) return
  const lang = ocrLang()
  const st = await desktop.engine.ocrStatus(lang)
  if (!st.ready && !window.confirm(t('pagesview.ocr_baixar_idioma', { idioma: LANGS.find((l) => l.id === lang)!.name, mb: st.size }))) return
  const s = useStore.getState()
  const marked = pagesSelected()
  const list = s.sheets.filter((x) => (marked.length ? marked.includes(x.id) : true))
  const ocr = { ...s.ocr }
  try {
    const { renderSheet } = await import('./pdf')
    for (const [i, sh] of list.entries()) {
      setUi({ busy: t('pagesview.ocr_progresso', { i: i + 1, total: list.length, label: sh.label }) })
      const k = 220 / 72 // ~220 dpi
      const c = await renderSheet(s.sources[sh.src], sh, k)
      const png = new Uint8Array(await (await new Promise<Blob>((r) => c.toBlob((b) => r(b!), 'image/png'))).arrayBuffer())
      const res = await desktop.engine.ocr(png, lang)
      ocr[sh.id] = { text: res.text, words: res.words.map((w) => ({ ...w, x: w.x / k, y: w.y / k, w: w.w / k, h: w.h / k })) }
    }
    useStore.setState({ ocr })
    s.notify(tp('pagesview.ocr_concluido', list.length))
  } catch {
    useStore.setState({ ocr }) // o que já foi lido fica
    s.notify(t('pagesview.ocr_sem_internet'), 'err')
  } finally {
    setUi({ busy: null })
  }
}

/** Escolhe um PDF no disco e o insere depois da última folha marcada. */
export function pickPdfToInsert() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.pdf'
  input.onchange = async () => {
    const f = input.files?.[0]
    if (!f) return
    setUi({ busy: t('pagesview.inserindo_pdf') })
    try {
      const n = await insertPdf(f, lastSelectedIndex() + 1)
      useStore.getState().notify(tp('pagesview.inseridas_de', n, { name: f.name }))
    } catch {
      useStore.getState().notify(t('pagesview.nao_foi_possivel_ler_o'), 'err')
    } finally {
      setUi({ busy: null })
    }
  }
  input.click()
}
