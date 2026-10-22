/**
 * Ações do visualizador que só dependem do store (sem React, sem DOM): o que acontece quando um
 * desenho termina ou uma ferramenta é clicada. O Viewer.tsx decide QUANDO chamar; aqui está O QUÊ.
 */
import { useStore } from './store'
import { dist, inRect } from './geometry'
import { pickHoleTarget, redactFontSize } from './viewerLogic'
import type { Markup, MarkupKind, Pt } from './types'
import { t } from './i18n'

export type PolyKind = 'length' | 'area' | 'hole' | 'space' | 'solid'

/** Abre as propriedades do item selecionado (responsável, prazo, respostas, texto de substituição…). */
const openProps = (id: string) => {
  const st = useStore.getState()
  st.set({ selected: [id], rightTab: 'props', panels: { ...st.panels, right: true } })
}

/** Mínimo de vértices para fechar o polígono/linha. */
export const minVertices = (kind: PolyKind) => (kind === 'length' ? 2 : 3)

/** Acrescenta um vazio à área/ambiente que contém o polígono (ou à selecionada). */
export function addHole(page: string, pts: Pt[]) {
  const st = useStore.getState()
  const target = pickHoleTarget(st.markups, page, pts, st.holeTarget, st.selected)
  if (!target) return st.notify(t('vieweractions.desenhe_o_vazio_dentro_de'))
  st.updateMarkup(target.id, { holes: [...(target.holes ?? []), pts] })
  st.set({ selected: [target.id] })
  st.notify(t('vieweractions.vazio_descontado_da_area'))
}

const nextSpaceName = () => t('vieweractions.ambiente_n', { n: useStore.getState().markups.filter((m) => m.kind === 'space').length + 1 })

/** Finaliza uma polilinha/polígono já validado (comprimento, área, ambiente ou vazio). */
export function commitPolygon(kind: PolyKind, page: string, points: Pt[]) {
  const st = useStore.getState()
  if (kind === 'hole') return addHole(page, points)
  if (kind === 'space') {
    const m = st.addMarkup('space', page, points, { text: nextSpaceName(), color: '#8e4ec6' })
    return openProps(m.id)
  }
  if (kind === 'solid') {
    const n = st.markups.filter((m) => m.kind === 'solid').length + 1
    const m = st.addMarkup('solid', page, points, { text: t('vieweractions.solido', { n }), color: st.solidDefaults.color, fill: st.solidDefaults.color, base: 0, height: st.solidDefaults.height })
    return openProps(m.id)
  }
  st.addMarkup(kind, page, points)
}

/** Resultado da "área por clique": vira vazio, ambiente ou área conforme a ferramenta. */
export function commitFill(page: string, outer: Pt[], holes: Pt[][], asHole: boolean) {
  const st = useStore.getState()
  if (asHole) return addHole(page, outer)
  if (st.fillAs === 'space') {
    const m = st.addMarkup('space', page, outer, { text: nextSpaceName(), color: '#8e4ec6', holes })
    return openProps(m.id)
  }
  const m = st.addMarkup('area', page, outer, holes.length ? { holes } : {})
  st.set({ selected: [m.id] })
  if (holes.length) st.notify(t('vieweractions.area_criada_com_vazio_s', { length: holes.length }))
}

/** Fim do arrasto de uma forma de dois pontos: calibrar, viewport, tarja ou marcação de revisão. */
export function commitDraw(kind: MarkupKind | 'calibrate', page: string, a: Pt, b: Pt) {
  const st = useStore.getState()
  if (kind === 'calibrate') {
    // calibrar dentro de um viewport define a escala daquele viewport
    const vp = st.markups.find((v) => v.kind === 'viewport' && v.page === page && inRect(a, v.points[0], v.points[1]))
    return st.set({ calibrating: { page, length: dist(a, b), viewport: vp?.id }, tool: 'select' })
  }
  if (kind === 'viewport') {
    const n = st.markups.filter((v) => v.kind === 'viewport' && v.page === page).length + 1
    const m = st.addMarkup('viewport', page, [a, b], { text: t('vieweractions.viewport', { n }), color: '#0090ff' })
    return st.set({ calibrating: { page, length: 0, viewport: m.id }, tool: 'select' })
  }
  if (kind === 'redact') {
    const m = st.addMarkup('redact', page, [a, b], { fill: st.redactFill, color: st.redactFill, fillOpacity: 1, fontSize: redactFontSize(a, b) })
    // tarja branca = "corrigir texto": já abre o campo do texto de substituição
    if (st.redactFill === '#ffffff') openProps(m.id)
    return
  }
  const m = st.addMarkup(kind, page, [a, b])
  // itens de revisão (nuvem, retângulo, seta…) já abrem as propriedades: responsável, prazo, respostas
  if (['cloud', 'rect', 'ellipse', 'arrow', 'line'].includes(kind)) openProps(m.id)
}

/** Clique com uma ferramenta de "colocar": carimbo, texto ou legenda. */
export function placeAt(tool: 'stamp' | 'text' | 'legend', page: string, p: Pt) {
  const st = useStore.getState()
  if (tool === 'legend') {
    const m = st.addMarkup('legend', page, [p, { x: p.x + 260, y: p.y + 120 }], { legend: { scope: 'sheet', prices: false }, color: '#1f2937', fontSize: 8 })
    st.set({ tool: 'select' })
    return openProps(m.id)
  }
  if (tool === 'stamp') {
    const m = st.addMarkup('stamp', page, [{ x: p.x - 90, y: p.y - 22 }, { x: p.x + 90, y: p.y + 22 }], { text: t('vieweractions.revisado'), color: '#e5484d', width: 2, fontSize: 14 })
    return st.set({ editingText: m.id, tool: 'select' })
  }
  const m = st.addMarkup('text', page, [p, { x: p.x + 160, y: p.y + 42 }], { color: '#e5484d', width: 1 })
  st.set({ editingText: m.id, tool: 'select' })
}

/** Marcação provisória mostrada enquanto o usuário desenha (usa o marcador ativo para cor e espessura). */
export function buildDraft(kind: MarkupKind | 'calibrate', pts: Pt[], page: string, zoom: number): Markup {
  const st = useStore.getState()
  const pr = st.presets.find((p) => p.id === st.activePreset && p.measure === kind)
  const color = kind === 'calibrate' ? '#0090ff' : pr?.color ?? '#e5484d'
  return {
    id: '__draft', page, kind: kind === 'calibrate' ? 'line' : kind, points: pts, text: '', comment: '', status: 'aberto',
    author: '', createdAt: 0, presetId: pr?.id ?? null, deduct: false, color, width: kind === 'calibrate' ? 1.5 / zoom : pr?.width ?? 1.5,
    fill: color, fillOpacity: pr?.opacity ?? (kind === 'area' ? 0.2 : 0), fontSize: 12,
  }
}

/** Duplica marcações (deslocadas um pouco, para a cópia não ficar escondida) e seleciona as cópias. */
export function duplicateMarkups(ids: string[]) {
  const st = useStore.getState()
  const off = 14
  const made: string[] = []
  st.checkpoint()
  for (const m of st.markups.filter((x) => ids.includes(x.id))) {
    const { id: _id, points, holes, ...rest } = m
    void _id
    const c = st.addMarkup(m.kind, m.page, points.map((p) => ({ x: p.x + off, y: p.y + off })), { ...rest, ...(holes ? { holes: holes.map((h) => h.map((p) => ({ x: p.x + off, y: p.y + off }))) } : {}) })
    made.push(c.id)
  }
  st.set({ selected: made })
}
