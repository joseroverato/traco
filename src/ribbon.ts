/**
 * Modelo de dados da faixa de opções (R3, fase 1): abas → grupos → botões. Só dados e ações; o desenho está em components/Ribbon.tsx.
 * Cada botão liga a um comando que JÁ existe (ferramenta do store, diálogo, painel, evento de zoom…): nada de lógica nova aqui.
 *
 * FASE 2: as paletas da esquerda (palettes.ts) substituíram o NavBar; os botões de Camadas, Sobrepor e Compatibilização
 * chamam os mesmos comandos das paletas (layerOps.ts, overlayOps.ts, issueOps.ts).
 * Ainda sem ligação (fica para a fase 4 ou para um ponto de ligação novo):
 *  - Contagem automática (Todas as folhas, Contar como): o estado é local do Viewer/SymbolResult, não há nada no store para ligar.
 *  - Claude: Conectar, Testar servidor e Ver registro (cartão do Claude Desktop) continuam dentro das configurações do painel.
 * FASE 4: Pranchas, Comparar e 3D têm os grupos do inventário. Os botões chamam as mesmas funções das views
 * (pagesUi.ts, compareShare.ts, view3dUi.ts); no celular (sem faixa) as views mantêm as barras próprias, ligadas a essas funções.
 *  - Parar (aba Claude): ligado ao estado "respondendo" do painel (claudeCmd.ts); só fica habilitado enquanto o Claude responde.
 *  - Coordenadas X e Y do cursor na barra de status: o Viewer não as publica (calculam-se no onPointerMove local); omitidas.
 */
import { curSheet, useStore } from './store'
import type { RibbonTab, State } from './store'
import type { Tool } from './types'
import { t } from './i18n'
import type { Key } from './i18n'
import { currentZoom } from './liveZoom'
import { viewerCmd } from './contextMenu'
import { exportIssuesPdf, exportIssuesXlsx, hasVisibleIssues, renumberIssues } from './issueOps'
import { hideAllLayers, showAllLayers } from './layerOps'
import { resetOverlay, startAlign, targetOverlay, updateOverlay } from './overlayOps'
import { openPal, togglePal } from './palettes'
import { stateOf } from './palModel'
import type { PalId } from './palModel'
import { claudeCmd, isClaudeBusy } from './claudeCmd'
import { desktop } from './platform'
import { setModeAnimated, toggleTheme } from './motion'
import { SHAPES } from './shapes'
import type { PolyShape } from './shapes'
import ICONS from './ribbonIcons.json'
import { stackTab } from './palettes'
import {
  clearSheetSel, duplicateSel, extractSheets, ocrLang, pagesSelected, pickOcrLang, pickPdfToInsert, removeSel, reverseOrder,
  rotateSel, runOcr, selectAllSheets, setPagesDlg, sortByName,
} from './pagesUi'
import { ZOOM_MAX, ZOOM_MIN, compareSelection, compareZoomBy, getCompareShare, pickOtherPdf, regionsLabel, setCompareA, setCompareB, setCompareView, useCompareUi } from './compareShare'
import type { CompareView } from './compareShare'
import { frame3d, toggleLayer3d, useView3dUi } from './view3dUi'
import { LAYER_LABEL } from './solids'
import type { LayerKind } from './solids'
import { LANGS } from './i18n'

export type RibbonTabId = RibbonTab | 'pranchas' | 'comparar' | '3d'

export interface RibbonBtn {
  id: string
  label: () => string
  /** id do ícone em src/assets/icones-*.svg */
  icon: string
  big?: boolean
  /** ferramenta: ganha a dica rica (RichTip) e o atalho vem do mapa de teclas */
  tool?: Tool
  /** atalho de comandos que não são ferramentas (as ferramentas leem o mapa de teclas) */
  keyHint?: string
  /** dica de uma linha (title) quando não é ferramenta */
  tip?: () => string
  /** botão com lista/diálogo: mostra a seta */
  menu?: boolean
  /** ligado (ferramenta ativa, alternador ligado): no máximo uma ferramenta por faixa */
  active?: (s: State) => boolean
  /** opção escolhida dentro de um grupo de opções (realce fraco) */
  sel?: (s: State) => boolean
  disabled?: (s: State) => boolean
  /** caixa de marcar (Mostrar do 3D): marcada ou não; o botão vira role="checkbox" */
  check?: (s: State) => boolean
  /** número depois do rótulo (contagem de cada camada) */
  count?: () => number | string
  run: () => void
}
/** Lista suspensa da faixa (Revisão A/B, idioma do OCR): o campo fechado mostra `current`; a lista é a nativa do sistema. */
export interface RibbonSel {
  kind: 'sel'
  id: string
  label: () => string
  /** ícone grande à esquerda (revisões) */
  icon?: string
  width: number
  value: string
  current: string
  /** linha de apoio embaixo do campo */
  sub?: string
  tip?: string
  groups: { label?: string; options: { value: string; label: string }[] }[]
  disabled?: boolean
  set: (v: string) => void
}
/** Texto solto na faixa (contador do grupo Resultado). */
export interface RibbonTxt { kind: 'txt'; id: string; text: string }
export interface RibbonNum {
  kind: 'num'
  id: string
  label: () => string
  unit: string
  min: number
  max: number
  step: number
  value: (s: State) => number
  set: (v: number) => void
}
/** botão grande, pilha de até 3 botões pequenos, campo numérico ou divisória fina */
export type RibbonCell = RibbonBtn | RibbonBtn[] | RibbonNum | RibbonSel | RibbonTxt | 'sep'
export interface RibbonGroup {
  id: string
  label: () => string
  cells: RibbonCell[]
  /** grupo contextual: sempre o último, só com a ferramenta que o pede */
  ctx?: boolean
}

const st = () => useStore.getState()
export const ribbonIcon = (k: string) => (ICONS as Record<string, string>)[k] ?? ''
const icon = ribbonIcon
const noDoc = (s: State) => s.sheets.length === 0
const noSheet = (s: State) => !curSheet(s)

/** Texto sem o atalho: as chaves antigas trazem "Nome  Atalho" (dois espaços). */
export const nameOf = (s: string) => s.split('  ')[0]
export const hintOf = (s: string) => s.split('  ')[1] ?? ''

const persist = (k: string, v: unknown) => {
  try { localStorage.setItem(k, JSON.stringify(v)) } catch { /* sem storage */ }
}

/** A paleta está aberta na pilha da aba atual e a coluna da esquerda está visível (para o botão da faixa aparecer ligado). */
const palOpen = (s: State, id: PalId) => s.panels.left && !s.focus && stateOf(s.palettes, stackTab(s), id) === 'open'
/** Liga/desliga uma paleta da esquerda pelo botão da faixa. */
const palBtn = (s: State, id: PalId) => (palOpen(s, id) ? togglePal(id) : openPal(id))

/** Pavimento…: mostra Propriedades, tira a seleção (para aparecer a folha) e põe o cursor no campo Pavimento. */
function focusLevel() {
  const s = st()
  s.set({ selected: [], rightTab: 'props', panels: { ...s.panels, right: true }, focus: false })
  window.setTimeout(() => document.querySelector<HTMLInputElement>('input[data-focus="pavimento"]')?.focus(), 80)
}

// ---------- botões reaproveitados em mais de uma aba ----------

/** Botão de ferramenta: usa o `setTool` do store, como o trilho de ferramentas fazia. */
function tool(id: string, tl: Tool, label: () => string, big = false, extra: Partial<RibbonBtn> = {}): RibbonBtn {
  return { id, label, icon: icon(id), big, tool: tl, active: (s) => s.tool === tl, disabled: noDoc, run: () => st().setTool(tl), ...extra }
}
const select = () => tool('select', 'select', () => t('railtools.selecionar'), true, { disabled: undefined })
const pan = () => tool('pan', 'pan', () => t('railtools.mover_vista'), false, { disabled: undefined })
const fillArea = () => tool('fill', 'fill', () => t('railtools.area_por_clique'), false, {
  active: (s) => s.tool === 'fill' && s.fillAs === 'area',
  run: () => st().set({ tool: 'fill', fillAs: 'area', activePreset: null, selected: [] }),
})
const fillSpace = () => tool('fillSpace', 'fill', () => t('leftpanel.ambiente_por_clique'), false, {
  active: (s) => s.tool === 'fill' && s.fillAs === 'space',
  run: () => st().set({ tool: 'fill', fillAs: 'space', activePreset: null, selected: [] }),
})
const redact = (white: boolean) => tool(white ? 'fixText' : 'redact', 'redact', () => t(white ? 'ribbon.corrigir_texto' : 'ribbon.tarja'), !white, {
  active: (s) => s.tool === 'redact' && (s.redactFill === '#ffffff') === white,
  run: () => st().set({ tool: 'redact', redactFill: white ? '#ffffff' : '#000000', activePreset: null, selected: [] }),
})
const legend = () => tool('legend', 'legend', () => t('ribbon.legenda'), false, { run: () => st().set({ tool: 'legend', activePreset: null, selected: [] }) })

const searchBtn = (): RibbonBtn => ({
  id: 'search', label: () => nameOf(t('topbar.buscar_texto_ctrl_f')), icon: icon('search'), keyHint: 'Ctrl+F',
  active: (s) => s.search.open, disabled: noDoc,
  run: () => { const s = st(); s.set({ search: { ...s.search, open: !s.search.open }, mode: 'review' }) },
})
const scaleBtn = (): RibbonBtn => ({
  id: 'scale', icon: icon('scale'), menu: true, disabled: noSheet,
  label: () => { const s = st(); const sh = curSheet(s); return t('ribbon.escala_valor', { v: (sh && s.scales[sh.id]?.label) || '—' }) },
  tip: () => t('topbar.escala_da_folha'),
  run: () => { const sh = curSheet(st()); if (sh) st().set({ calibrating: { page: sh.id, length: 0 } }) },
})
const stampBatch = (): RibbonBtn => ({ id: 'stampBatch', label: () => t('topbar.carimbos_e_numeracao_em_lote'), icon: icon('stampBatch'), disabled: noDoc, run: () => st().set({ dialog: 'stamp' }) })
const sheetXlsx = (): RibbonBtn => ({
  id: 'sheet', label: () => t('bottompanel.planilha'), icon: icon('sheet'), big: true, tip: () => t('leftpanel.exportar_quantitativo_excel'),
  disabled: (s) => !s.markups.length,
  run: async () => { const s = st(); (await import('./xlsxExport')).exportXlsx(s.fileName, s.markups.filter((m) => m.kind !== 'viewport'), s.presets, s.scales, s.sheets) },
})

// ---------- painéis ----------
const togglePane = (k: 'left' | 'bottom' | 'right') => { const s = st(); s.set({ panels: { ...s.panels, [k]: !s.panels[k] || s.focus }, focus: false }) }
const panelBtns = (): RibbonBtn[] => [
  { id: 'panelLeft', label: () => t('ribbon.navegador'), icon: icon('panelLeft'), keyHint: 'Ctrl+1', tip: () => nameOf(t('topbar.painel_lateral_ctrl_1')), active: (s) => s.panels.left && !s.focus, run: () => togglePane('left') },
  { id: 'panelBottom', label: () => t('bottompanel.quantitativo'), icon: icon('panelBottom'), keyHint: 'Ctrl+2', tip: () => nameOf(t('topbar.quantitativo_ctrl_2')), active: (s) => s.panels.bottom && !s.focus, run: () => togglePane('bottom') },
  { id: 'panelRight', label: () => t('rightpanel.propriedades'), icon: icon('panelRight'), keyHint: 'Ctrl+3', tip: () => nameOf(t('topbar.marcadores_propriedades_e_claude_ctrl')), active: (s) => s.panels.right && !s.focus, run: () => togglePane('right') },
]

// ---------- zoom ----------
const zoomBy = (f: number) => window.dispatchEvent(new CustomEvent('traco:zoom', { detail: f }))
export const zoomIn = () => zoomBy(1.25)
export const zoomOut = () => zoomBy(1 / 1.25)
export const fitPage = () => st().set({ fitReq: { mode: 'page', n: Date.now() } })
export const fitWidth = () => st().set({ fitReq: { mode: 'width', n: Date.now() } })
export const zoom100 = () => zoomBy(1 / (currentZoom() || 1))

// ---------- abas ----------
const inicio = (): RibbonGroup[] => [
  { id: 'select', label: () => t('railtools.selecionar'), cells: [select(), [pan(), searchBtn(), { id: 'copytext', label: () => t('ribbon.copiar_texto'), icon: icon('copytext'), disabled: noSheet, run: () => viewerCmd('copytext') }]] },
  { id: 'scale', label: () => t('ribbon.g_escala'), cells: [
    tool('calibrate', 'calibrate', () => t('railtools.calibrar_escala'), true),
    [scaleBtn(), tool('viewport', 'viewport', () => t('ribbon.viewport')), { id: 'level', label: () => t('ribbon.pavimento'), icon: icon('level'), tip: () => t('leftpanel.pavimento_desta_folha'), disabled: noSheet, run: focusLevel }],
  ] },
  { id: 'measure', label: () => t('leftpanel.medir'), cells: [
    tool('length', 'length', () => t('railtools.comprimento'), true),
    tool('area', 'area', () => t('railtools.area'), true),
    tool('count', 'count', () => t('railtools.contagem'), true),
    [fillArea(), tool('hole', 'hole', () => t('ribbon.vazio'), false, { tip: () => t('railtools.vazio_descontar_da_area') }), tool('symbol', 'symbol', () => t('railtools.contagem_automatica'))],
  ] },
  { id: 'space', label: () => t('ribbon.g_ambientes_3d'), cells: [
    tool('space', 'space', () => t('railtools.ambiente'), true),
    [fillSpace(), tool('solid', 'solid', () => t('ribbon.solido_3d'), false, { tip: () => t('railtools.solido_3d_base_na_planta') })],
  ] },
  { id: 'quant', label: () => t('bottompanel.quantitativo'), cells: [
    sheetXlsx(),
    [legend(), { id: 'prices', label: () => t('ribbon.precos_bdi'), icon: icon('prices'), tip: () => t('dialogs.base_de_precos_e_bdi'), disabled: noDoc, run: () => st().set({ dialog: 'prices' }) },
      { id: 'columns', label: () => t('ribbon.colunas'), icon: icon('columns'), tip: () => t('dialogs.colunas_personalizadas'), disabled: noDoc, run: () => st().set({ dialog: 'columns' }) }],
  ] },
]

const anotar = (): RibbonGroup[] => [
  { id: 'select', label: () => t('railtools.selecionar'), cells: [select(), [pan()]] },
  { id: 'review', label: () => t('ribbon.g_revisao'), cells: [
    tool('cloud', 'cloud', () => t('railtools.nuvem_de_revisao'), true),
    tool('text', 'text', () => t('railtools.texto'), true),
    [tool('rect', 'rect', () => t('railtools.retangulo')), tool('ellipse', 'ellipse', () => t('railtools.elipse')), tool('arrow', 'arrow', () => t('railtools.seta'))],
    [tool('line', 'line', () => t('railtools.linha'))],
  ] },
  { id: 'stamps', label: () => t('ribbon.g_carimbos'), cells: [
    tool('stamp', 'stamp', () => t('railtools.carimbo'), true),
    [tool('image', 'image', () => t('railtools.imagem_assinatura')), stampBatch(), legend()],
  ] },
  { id: 'fix', label: () => t('leftpanel.corrigir_o_pdf'), cells: [redact(false), [redact(true)]] },
  { id: 'issues', label: () => t('leftpanel.compatibilizacao'), cells: [
    { id: 'issues', label: () => t('ribbon.itens'), icon: icon('issues'), big: true, tip: () => t('leftpanel.compatibilizacao'), active: (s) => palOpen(s, 'compat'), disabled: noDoc, run: () => palBtn(st(), 'compat') },
    [{ id: 'report', label: () => t('issuespanel.relatorio_pdf_com_recortes'), icon: icon('report'), disabled: (s) => !hasVisibleIssues(s) || !!s.issuesBusy, run: () => void exportIssuesPdf() },
      { id: 'issuesSheet', label: () => t('issuespanel.planilha_excel'), icon: icon('issuesSheet'), disabled: (s) => !hasVisibleIssues(s) || !!s.issuesBusy, run: () => void exportIssuesXlsx() },
      { id: 'renumber', label: () => t('issuespanel.renumerar_itens'), icon: icon('renumber'), disabled: (s) => !s.markups.length, run: renumberIssues }],
    [{ id: 'statuses', label: () => t('rightpanel.gerenciar_status'), icon: icon('statuses'), disabled: noDoc, run: () => st().set({ dialog: 'statuses' }) }],
  ] },
]

const exibir = (s: State): RibbonGroup[] => [
  { id: 'zoom', label: () => t('ribbon.g_zoom'), cells: [
    { id: 'fitPage', label: () => t('menu.ajustar_a_folha'), icon: icon('fitPage'), big: true, keyHint: '0', disabled: noDoc, run: fitPage },
    [{ id: 'fitWidth', label: () => t('menu.ajustar_a_largura'), icon: icon('fitWidth'), keyHint: 'W', disabled: noDoc, run: fitWidth },
      { id: 'zoom100', label: () => t('menu.zoom_100'), icon: icon('zoom100'), disabled: noSheet, run: zoom100 }],
    [{ id: 'zoomIn', label: () => nameOf(t('topbar.ampliar')), icon: icon('zoomIn'), keyHint: '+', disabled: noDoc, run: zoomIn },
      { id: 'zoomOut', label: () => nameOf(t('topbar.reduzir')), icon: icon('zoomOut'), keyHint: '−', disabled: noDoc, run: zoomOut }],
  ] },
  { id: 'panels', label: () => t('ribbon.g_paineis'), cells: [
    panelBtns(),
    { id: 'focus', label: () => t('ribbon.ampliar_planta'), icon: icon('focus'), big: true, keyHint: 'Tab', active: (s) => s.focus, run: () => { const s = st(); s.set({ focus: !s.focus }) } },
  ] },
  { id: 'view', label: () => t('ribbon.g_vista'), cells: [
    { id: 'split3d', label: () => t('ribbon.planta_3d'), icon: icon('split3d'), big: true, tip: () => (st().split3d ? t('topbar.fechar_o_3d_ao_lado') : t('topbar.dividir_a_tela_planta_e')), active: (s) => s.split3d, disabled: noDoc, run: () => { const s = st(); s.set({ split3d: !s.split3d }) } },
  ] },
  { id: 'layers', label: () => t('navbar.camadas'), cells: [
    { id: 'layers', label: () => t('navbar.camadas'), icon: icon('layers'), big: true, active: (s) => palOpen(s, 'camadas'), disabled: noDoc, run: () => palBtn(st(), 'camadas') },
    [{ id: 'showAll', label: () => t('layerspanel.mostrar_todas'), icon: icon('showAll'), disabled: noSheet, run: showAllLayers },
      { id: 'hideAll', label: () => t('layerspanel.ocultar_todas'), icon: icon('hideAll'), disabled: noSheet, run: () => void hideAllLayers() }],
  ] },
  { id: 'overlay', label: () => t('navbar.sobrepor'), cells: [
    { id: 'overlay', label: () => t('ribbon.adicionar_disciplina'), icon: icon('addDiscipline'), big: true, tip: () => t('overlaypanel.adicionar_disciplina'), active: (s) => palOpen(s, 'sobrepor'), disabled: noDoc, run: () => palBtn(st(), 'sobrepor') },
    [{ id: 'align', label: () => t('overlaypanel.alinhar_por_2_pontos'), icon: icon('align'), active: (s) => !!s.aligning, disabled: (s) => !targetOverlay(s), run: () => { const o = targetOverlay(st()); if (o) startAlign(o.id) } },
      { id: 'resetOverlay', label: () => t('overlaypanel.zerar'), icon: icon('reset'), disabled: (s) => !targetOverlay(s), run: () => { const s = st(); const o = targetOverlay(s); const sh = curSheet(s); if (o && sh) resetOverlay(sh.id, o.id) } }],
    ...(targetOverlay(s) ? [{ kind: 'num' as const, id: 'overlayOpacity', label: () => t('ribbon.intensidade'), unit: '%', min: 10, max: 100, step: 5, value: (x: State) => Math.round((targetOverlay(x)?.opacity ?? 0.85) * 100), set: (v: number) => { const s = st(); const o = targetOverlay(s); const sh = curSheet(s); if (o && sh) updateOverlay(sh.id, o.id, { opacity: v / 100 }) } }] : []),
  ] },
  { id: 'look', label: () => t('dialogs.aparencia'), cells: [[
    { id: 'theme', label: () => (st().theme === 'dark' ? t('topbar.tema_claro') : t('topbar.tema_escuro')), icon: icon('theme'), run: toggleTheme },
    { id: 'settings', label: () => t('dialogs.configuracoes'), icon: icon('settings'), run: () => st().set({ dialog: 'updates' }) },
  ]] },
]

const claude = (): RibbonGroup[] => [
  { id: 'chat', label: () => t('ribbon.g_conversa'), cells: [
    { id: 'claude', label: () => 'Claude', icon: icon('claude'), big: true, active: (s) => s.panels.right && s.rightTab === 'claude' && !s.focus,
      run: () => { const s = st(); s.set({ rightTab: 'claude', panels: { ...s.panels, right: true }, focus: false }) } },
    [{ id: 'newChat', label: () => t('claudepanel.nova_conversa'), icon: icon('newChat'), run: () => claudeCmd('new') },
      { id: 'stop', label: () => t('claudepanel.parar'), icon: '@parar', disabled: () => !isClaudeBusy(), run: () => claudeCmd('stop') }],
  ] },
  { id: 'suggest', label: () => t('ribbon.g_sugestoes'), cells: [
    [{ id: 'sugQuant', label: () => t('ribbon.sug_quantitativo'), icon: icon('sugQuant'), run: () => claudeCmd({ suggest: 0 }) },
      { id: 'sugScale', label: () => t('ribbon.sug_escala'), icon: icon('sugScale'), run: () => claudeCmd({ suggest: 1 }) }],
    [{ id: 'sugOpen', label: () => t('ribbon.sug_abertas'), icon: icon('sugOpen'), run: () => claudeCmd({ suggest: 2 }) },
      { id: 'sugMarkers', label: () => t('ribbon.sug_marcadores'), icon: icon('sugMarkers'), run: () => claudeCmd({ suggest: 3 }) }],
  ] },
  { id: 'config', label: () => t('ribbon.g_configuracao'), cells: [
    { id: 'claudeConfig', label: () => t('claudepanel.configuracoes_do_claude'), icon: icon('claudeConfig'), big: true, run: () => claudeCmd('settings') },
    ...(desktop ? [[{ id: 'claudeDesktop', label: () => t('claudepanel.claude_desktop_mcp'), icon: icon('claudeDesktop'), run: () => claudeCmd('settings') }]] : []),
  ] },
]

// ---------- Pranchas ----------
/** Botões pequenos/grandes da aba Pranchas. As ações são as de pagesUi.ts (as mesmas da grade). */
const pagesGroups = (s: State): RibbonGroup[] => {
  const marked = pagesSelected()
  const some = marked.length > 0
  const all = some && marked.length === s.sheets.length
  const b = (id: string, label: () => string, big: boolean, run: () => void, extra: Partial<RibbonBtn> = {}): RibbonBtn => ({ id, label, icon: icon(id), big, run, ...extra })
  const noMark = () => !some
  const groups: RibbonGroup[] = [
    { id: 'p-sel', label: () => t('ribbon.g_selecao'), cells: [
      b('selAll', () => t('pagesview.todas'), true, selectAllSheets, { disabled: () => all || !s.sheets.length }),
      [b('selClear', () => t('pagesview.limpar'), false, clearSheetSel, { icon: '@limpar', disabled: noMark })],
    ] },
    { id: 'p-sheet', label: () => t('ribbon.g_folha'), cells: [
      b('duplicate', () => t('pagesview.duplicar'), true, duplicateSel, { disabled: noMark }),
      [b('rotL', () => t('pagesview.girar_a_esquerda'), false, () => rotateSel(-90), { disabled: noMark }),
        b('rotR', () => t('pagesview.girar_a_direita'), false, () => rotateSel(90), { disabled: noMark }),
        b('delete', () => t('pagesview.excluir'), false, removeSel, { disabled: () => !some || s.sheets.length < 2 })],
    ] },
    { id: 'p-insert', label: () => t('ribbon.g_inserir'), cells: [
      b('insertPdf', () => t('pagesview.inserir_pdf'), true, pickPdfToInsert, { tip: () => t('ribbon.dica_inserir_pdf') }),
      b('blank', () => t('pagesview.folha_em_branco'), true, () => setPagesDlg('blank'), { tip: () => t('ribbon.dica_folha_em_branco') }),
    ] },
    { id: 'p-extract', label: () => t('ribbon.g_dividir_extrair'), cells: [
      b('extract', () => (some ? t('pagesview.extrair_selecao') : t('pagesview.extrair_todas')), true, () => void extractSheets()),
      [b('split', () => t('pagesview.dividir'), false, () => setPagesDlg('split'))],
    ] },
    { id: 'p-names', label: () => t('ribbon.g_nomes_ordem'), cells: [
      b('rename', () => t('pagesview.renomear'), true, () => setPagesDlg('rename')),
      [b('sortName', () => t('ribbon.ordenar_pelo_nome'), false, sortByName, { tip: () => t('pagesview.ordenar_pelo_nome_da_folha'), disabled: () => s.sheets.length < 2 }),
        b('reverse', () => t('pagesview.inverter_ordem'), false, reverseOrder, { disabled: () => s.sheets.length < 2 })],
    ] },
  ]
  // OCR só existe no app de PC (o motor roda lá); na web o grupo não aparece
  if (desktop) {
    groups.push({ id: 'p-ocr', label: () => t('ribbon.g_ocr'), cells: [
      b('ocr', () => 'OCR', true, () => void runOcr(), { tip: () => t('pagesview.reconhecer_texto_de_pranchas_escaneadas') }),
      {
        kind: 'sel', id: 'ocrLang', label: () => t('ribbon.idioma_texto'), width: 132, value: ocrLang(), current: LANGS.find((l) => l.id === ocrLang())?.name ?? '',
        tip: t('pagesview.ocr_idioma'), groups: [{ options: LANGS.map((l) => ({ value: l.id, label: l.name })) }], set: (v) => pickOcrLang(v as (typeof LANGS)[number]['id']),
      },
    ] })
  }
  return groups
}

// ---------- Comparar ----------
const MODES: { id: CompareView; icon: string; label: () => string; tip: () => string; stack?: boolean }[] = [
  { id: 'overlay', icon: 'cmpOverlay', label: () => t('compareview.sobrepor'), tip: () => t('ribbon.dica_sobrepor') },
  { id: 'diff', icon: 'cmpDiff', label: () => t('compareview.so_diferencas'), tip: () => t('ribbon.dica_so_diferencas') },
  { id: 'side', icon: 'cmpSide', label: () => t('compareview.lado_a_lado'), tip: () => t('ribbon.dica_lado_a_lado') },
]
const compareGroups = (s: State): RibbonGroup[] => {
  const ui = useCompareUi.getState()
  const share = getCompareShare()
  const cs = compareSelection(s.sheets, ui)
  const noSheets = !s.sheets.length
  const revSel = (which: 'a' | 'b'): RibbonSel => {
    const o = which === 'a' ? cs.a : cs.b
    const idx = o && !o.ext ? s.sheets.findIndex((x) => x.id === o.sh.id) : -1
    const local = (o && !o.ext) ?? true
    return {
      kind: 'sel', id: 'rev-' + which, icon: icon(which === 'a' ? 'revA' : 'revB'), width: 250, disabled: noSheets,
      label: () => t(which === 'a' ? 'compareview.revisao_antiga_a' : 'compareview.revisao_nova_b'),
      value: which === 'a' ? cs.aId : cs.bId,
      current: o ? (idx >= 0 ? `${idx + 1}. ${o.sh.label}` : o.sh.label) : '',
      sub: o ? `${local ? t('compareview.conjunto_atual') : t('compareview.outro_pdf')} · ${s.sources[o.sh.src]?.name ?? s.fileName}` : '',
      tip: local ? t('compareview.conjunto_atual') : t('compareview.outro_pdf'),
      groups: [
        { label: t('compareview.conjunto_atual'), options: cs.options.filter((x) => !x.ext).map((x, i) => ({ value: x.sh.id, label: `${i + 1}. ${x.sh.label}` })) },
        ...(ui.extra.length ? [{ label: t('compareview.outro_pdf'), options: cs.options.filter((x) => x.ext).map((x) => ({ value: x.sh.id, label: x.sh.label })) }] : []),
      ],
      set: which === 'a' ? setCompareA : setCompareB,
    }
  }
  const nuvens = (): RibbonBtn => ({
    id: 'cloudsB', label: () => t('compareview.nuvens_em_b'), icon: icon('cloudsB'), big: true,
    tip: () => t('ribbon.dica_nuvens'),
    disabled: () => noSheets || !share.regions.length || !share.bLocal, run: () => share.toClouds(),
  })
  return [
    { id: 'c-rev', label: () => t('ribbon.g_revisoes'), cells: [
      revSel('a'), 'sep', revSel('b'), 'sep',
      { id: 'otherPdf', label: () => t('compareview.carregar_outro_pdf'), icon: icon('otherPdf'), big: true, tip: () => t('ribbon.dica_carregar_pdf'), disabled: () => noSheets, run: pickOtherPdf },
    ] },
    { id: 'c-mode', label: () => t('ribbon.g_modo'), cells: MODES.map((m): RibbonBtn => ({
      id: 'cmp-' + m.id, label: m.label, icon: icon(m.icon), big: true, tip: m.tip, active: () => ui.view === m.id, disabled: () => noSheets, run: () => setCompareView(m.id),
    })) },
    { id: 'c-result', label: () => t('ribbon.g_resultado'), cells: [
      nuvens(),
      { kind: 'txt', id: 'regionCount', text: share.busy ? t('compareview.analisando') : regionsLabel(share.regions.length) },
    ] },
    { id: 'c-zoom', label: () => t('ribbon.g_zoom'), cells: [[
      { id: 'cmpZoomOut', label: () => nameOf(t('topbar.reduzir')), icon: icon('zoomOut'), disabled: () => noSheets || ui.zoom <= ZOOM_MIN + 1e-9, run: () => compareZoomBy(1 / 1.25) },
      { id: 'cmpZoomIn', label: () => nameOf(t('topbar.ampliar')), icon: icon('zoomIn'), disabled: () => noSheets || ui.zoom >= ZOOM_MAX - 1e-9, run: () => compareZoomBy(1.25) },
    ]] },
  ]
}

// ---------- 3D ----------
const LAYER_ORDER: LayerKind[] = ['solid', 'space', 'length', 'area', 'count']
const view3dGroups = (s: State): RibbonGroup[] => {
  const { visible, totals } = useView3dUi.getState()
  const noSheets = !s.sheets.length
  const view = (id: string, label: () => string, name: 'iso' | 'top' | 'front' | 'right', big = false): RibbonBtn => ({
    id, label, icon: icon(id), big, disabled: () => noSheets, run: () => frame3d(name), ...(big ? { tip: () => t('view3d.enquadrar_tudo_vista_isometrica') } : {}),
  })
  const layer = (k: LayerKind): RibbonBtn => ({
    id: 'layer-' + k, label: () => LAYER_LABEL[k], icon: '', check: () => visible[k], count: () => totals?.[k].n ?? 0, disabled: () => noSheets, run: () => toggleLayer3d(k),
  })
  return [
    { id: 'v-views', label: () => t('ribbon.g_vistas'), cells: [
      view('frame', () => t('view3d.enquadrar'), 'iso', true),
      [view('viewTop', () => t('view3d.topo'), 'top'), view('viewFront', () => t('view3d.frente'), 'front'), view('viewRight', () => t('view3d.direita'), 'right')],
    ] },
    { id: 'v-show', label: () => t('ribbon.g_mostrar'), cells: [LAYER_ORDER.slice(0, 3).map(layer), LAYER_ORDER.slice(3).map(layer)] },
    { id: 'v-solid', label: () => t('ribbon.g_solido'), cells: [{
      // no 3D a ferramenta não tem onde agir: o botão leva à planta com Sólido 3D já escolhida
      id: 'solid', label: () => t('ribbon.solido_3d'), icon: icon('solid'), big: true, tool: 'solid', tip: () => t('ribbon.dica_solido_3d'), disabled: () => noSheets,
      run: () => setModeAnimated('review', { ribbonTab: 'inicio', tool: 'solid', activePreset: null, selected: [] }),
    }] },
    { id: 'v-plan', label: () => t('ribbon.g_planta'), cells: [
      { id: 'split3d', label: () => t('ribbon.planta_3d'), icon: icon('split3d'), big: true, tip: () => t('ribbon.dica_planta_e_3d'), disabled: () => noSheets, run: () => setModeAnimated('review', { split3d: true, tool: 'select', selected: [] }) },
      [{ id: 'toPlan', label: () => t('view3d.ir_para_a_planta'), icon: icon('toPlan'), disabled: () => noSheets, run: () => setModeAnimated('review', { tool: 'select', selected: [] }) }],
    ] },
  ]
}

// ---------- grupos contextuais (sempre os últimos) ----------
const SHAPE_KEY: Record<PolyShape, Key> = { poly: 'shape.poligono', rect: 'shape.retangulo', circle: 'shape.circulo', ellipse: 'shape.elipse' }
const SHAPE_ICON: Record<PolyShape, string> = { poly: 'shapePoly', rect: 'shapeRect', circle: 'shapeCircle', ellipse: 'shapeEllipse' }
const shapeBtn = (v: PolyShape): RibbonBtn => ({
  id: 'shape-' + v, label: () => t(SHAPE_KEY[v]), icon: icon(SHAPE_ICON[v]), sel: (s) => s.polyShape === v,
  run: () => { useStore.setState({ polyShape: v }); persist('traco.polyShape', v) },
})
const modeBtn = (m: 'click' | 'drag'): RibbonBtn => ({
  id: 'mode-' + m, label: () => t(m === 'click' ? 'leftpanel.modo_clique' : 'leftpanel.modo_arrastar'), icon: icon(m === 'click' ? 'modeClick' : 'modeDrag'), sel: (s) => s.drawMode === m,
  run: () => { st().set({ drawMode: m }); persist('traco.drawMode', m) },
})
const POLY_TOOLS: Tool[] = ['area', 'hole', 'space', 'solid']
const TOOL_NAME: Partial<Record<Tool, () => string>> = {
  area: () => t('railtools.area'), hole: () => t('ribbon.vazio'), space: () => t('railtools.ambiente'), solid: () => t('ribbon.solido_3d'), length: () => t('railtools.comprimento'),
  fill: () => t('railtools.area_por_clique'),
}

function contextGroups(s: State): RibbonGroup[] {
  const out: RibbonGroup[] = []
  const name = () => (s.tool === 'fill' && s.fillAs === 'space' ? t('leftpanel.ambiente_por_clique') : (TOOL_NAME[s.tool] ?? (() => ''))())
  const opts = (id: string, cells: RibbonCell[]) => out.push({ id, ctx: true, label: () => t('ribbon.opcoes_ferramenta', { tool: name() }), cells })
  if (POLY_TOOLS.includes(s.tool)) {
    const cells: RibbonCell[] = [[shapeBtn(SHAPES[0]), shapeBtn(SHAPES[1])], [shapeBtn(SHAPES[2]), shapeBtn(SHAPES[3])], 'sep', [modeBtn('click'), modeBtn('drag')]]
    if (s.tool === 'hole') cells.push('sep', { kind: 'num', id: 'minHole', label: () => t('leftpanel.ignorar_vazios_menores_que_m'), unit: 'm²', min: 0, max: 100, step: 0.05, value: (x) => x.minHole, set: (v) => { st().set({ minHole: v }); persist('traco.minHole', v) } })
    opts('opt-shape', cells)
  } else if (s.tool === 'length') {
    opts('opt-length', [[modeBtn('click'), modeBtn('drag')]])
  } else if (s.tool === 'fill') {
    // o limite de vazios filtra o que a área por clique detecta (auditoria F081): o campo vale aqui e na ferramenta Vazio
    opts('opt-fill', [
      { kind: 'num', id: 'fillGap', label: () => t('ribbon.fechar_aberturas'), unit: 'pt', min: 1, max: 30, step: 1, value: (x) => x.fillGap, set: (v) => st().set({ fillGap: v }) },
      { kind: 'num', id: 'minHoleFill', label: () => t('leftpanel.ignorar_vazios_menores_que_m'), unit: 'm²', min: 0, max: 100, step: 0.05, value: (x) => x.minHole, set: (v) => { st().set({ minHole: v }); persist('traco.minHole', v) } },
    ])
  } else if (s.tool === 'redact') {
    const fillBtn = (white: boolean): RibbonBtn => ({
      id: white ? 'redact-white' : 'redact-black', label: () => t(white ? 'rightpanel.apagar_branco' : 'rightpanel.tarja_preta'), icon: icon(white ? 'fixText' : 'redact'),
      sel: (x) => (x.redactFill === '#ffffff') === white, run: () => st().set({ redactFill: white ? '#ffffff' : '#000000' }),
    })
    out.push({ id: 'opt-redact', ctx: true, label: () => t('ribbon.opcoes_ferramenta', { tool: t('ribbon.tarja') }), cells: [[fillBtn(false), fillBtn(true)]] })
  }
  if (s.aligning) {
    out.push({ id: 'align', ctx: true, label: () => t('ribbon.g_alinhar'), cells: [[{ id: 'cancelAlign', label: () => t('menu.cancelar_alinhamento'), icon: icon('cancelAlign'), keyHint: 'Esc', run: () => st().set({ aligning: null }) }]] })
  }
  return out
}

/** Aba mostrada agora: a escolhida no modo Revisar; nos outros modos, a do próprio modo. */
export const activeTab = (s: Pick<State, 'mode' | 'ribbonTab'>): RibbonTabId => stackTab(s)

export const RIBBON_TABS: { id: RibbonTabId; label: () => string }[] = [
  { id: 'inicio', label: () => t('ribbon.t_inicio') },
  { id: 'anotar', label: () => t('ribbon.t_anotar') },
  { id: 'pranchas', label: () => t('topbar.pranchas') },
  { id: 'comparar', label: () => t('topbar.comparar') },
  { id: '3d', label: () => '3D' },
  { id: 'exibir', label: () => t('ribbon.t_exibir') },
  { id: 'claude', label: () => 'Claude' },
]

/** Grupos da aba, com os contextuais no fim (só nas abas de revisão). */
export function groupsFor(tab: RibbonTabId, s: State): RibbonGroup[] {
  if (tab === 'inicio') return [...inicio(), ...contextGroups(s)]
  if (tab === 'anotar') return [...anotar(), ...contextGroups(s)]
  if (tab === 'exibir') return [...exibir(s), ...contextGroups(s)]
  if (tab === 'claude') return claude()
  if (tab === 'pranchas') return pagesGroups(s)
  if (tab === 'comparar') return compareGroups(s)
  return view3dGroups(s)
}

/** Clique numa aba: modos (Pranchas, Comparar, 3D) trocam com a animação de modo; as demais voltam a Revisar. */
export function selectTab(id: RibbonTabId) {
  const s = st()
  if (id === 'pranchas' || id === 'comparar' || id === '3d') {
    if (!s.sheets.length) return
    return setModeAnimated(id === 'pranchas' ? 'pages' : id === 'comparar' ? 'compare' : '3d', { selected: [], tool: 'select' })
  }
  if (id === 'claude') return setModeAnimated('review', { ribbonTab: 'claude', rightTab: 'claude', panels: { ...s.panels, right: true }, focus: false })
  if (s.mode !== 'review') return setModeAnimated('review', { ribbonTab: id, selected: [], tool: 'select' })
  s.set({ ribbonTab: id })
}
