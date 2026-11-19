/**
 * Comparação de revisões (R3, fase 4): o que o CompareView, a faixa de opções, as paletas e a barra de status dividem.
 *  - `useCompareUi`: escolhas da pessoa (revisão A e B, modo, zoom, PDFs carregados só para comparar). A faixa as muda, a view as lê.
 *  - `publishCompare`: resultado calculado pela view (regiões, aviso de tamanhos, ação Nuvens em B). O cálculo continua na view.
 */
import { useSyncExternalStore } from 'react'
import { create } from 'zustand'
import { useStore } from './store'
import { addSourceOnly } from './project'
import { t, tp } from './i18n'
import type { Sheet } from './types'

export type CompareView = 'overlay' | 'side' | 'diff'
export const ZOOM_MIN = 0.1
export const ZOOM_MAX = 4

interface CompareUi { extra: Sheet[]; aId: string | null; bId: string | null; view: CompareView; zoom: number }
const INITIAL: CompareUi = { extra: [], aId: null, bId: null, view: 'overlay', zoom: 0.5 }
export const useCompareUi = create<CompareUi>(() => INITIAL)
export const resetCompareUi = () => useCompareUi.setState(INITIAL)
export const setCompareView = (view: CompareView) => useCompareUi.setState({ view })
export const setCompareA = (aId: string) => useCompareUi.setState({ aId })
export const setCompareB = (bId: string) => useCompareUi.setState({ bId })
export const compareZoomBy = (f: number) => useCompareUi.setState((u) => ({ zoom: Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, u.zoom * f)) }))

export interface CompareOption { sh: Sheet; ext: boolean }
/** Folhas do conjunto atual e dos PDFs carregados, e as escolhidas como A e B (sem escolha: a 1ª e a 2ª do conjunto). */
export function compareSelection(sheets: Sheet[], ui: Pick<CompareUi, 'extra' | 'aId' | 'bId'>) {
  const options: CompareOption[] = [...sheets.map((sh) => ({ sh, ext: false })), ...ui.extra.map((sh) => ({ sh, ext: true }))]
  const find = (id: string | null | undefined) => options.find((o) => o.sh.id === id)
  const a = find(ui.aId) ?? find(sheets[0]?.id)
  const b = find(ui.bId) ?? find(sheets[1]?.id ?? sheets[0]?.id)
  return { options, a, b, aId: a?.sh.id ?? '', bId: b?.sh.id ?? '' }
}

/** Escolhe um PDF no disco e o oferece como revisão antiga (A). */
export function pickOtherPdf() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.pdf'
  input.onchange = async () => {
    const f = input.files?.[0]
    if (!f) return
    const { sheets } = await addSourceOnly(f)
    const named = sheets.map((x) => ({ ...x, label: `${f.name.replace(/\.pdf$/i, '')} · ${x.label}` }))
    useCompareUi.setState((u) => ({ extra: [...u.extra, ...named], aId: named[0].id }))
    useStore.getState().notify(t('compareview.carregado_para_comparacao', { name: f.name }))
  }
  input.click()
}

/** "Nenhuma região alterada", "1 região alterada", "3 regiões alteradas" (em português o 0 cairia no singular). */
export const regionsLabel = (n: number) => (n === 0 ? t('compareview.nenhuma_regiao') : tp('compareview.regioes_alteradas', n))

export interface RegionInfo { w: number; h: number; px: number }
export interface CompareShare {
  regions: RegionInfo[]
  scale: number
  busy: boolean
  /** as duas folhas têm tamanhos diferentes: a sobreposição pode ficar desalinhada */
  mismatch: boolean
  /** a revisão nova (B) está no conjunto atual: só assim dá para criar nuvens nela */
  bLocal: boolean
  goTo: (i: number) => void
  /** Nuvens em B */
  toClouds: () => void
}

const EMPTY: CompareShare = { regions: [], scale: 1, busy: false, mismatch: false, bLocal: false, goTo: () => {}, toClouds: () => {} }
let cur = EMPTY
const subs = new Set<() => void>()

export const getCompareShare = () => cur
export function publishCompare(next: CompareShare) {
  cur = next
  subs.forEach((f) => f())
}
export const clearCompare = () => publishCompare(EMPTY)
export const useCompareShare = () => useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f) } }, () => cur)
