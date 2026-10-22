import { ChevronsLeft, PaintBucket, ScanSearch, SquareDashed, Columns3, Database, TableProperties, Building2, Eraser, FileDown, FilePlus2, FileSpreadsheet, Frame, ImagePlus, LayoutGrid, Magnet, Move, PenLine, Pentagon, RotateCcw, RotateCw, Ruler, Save, SaveAll, Scaling, Scissors, Stamp, Tags, Target, Trash2, Type, Layers } from 'lucide-react'
import { curSheet, useStore } from '../store'
import type { Tool } from '../types'
import { Thumb } from './Thumb'
import { saveProject } from '../project'
import { rotateSheets } from '../sheetOps'
import { LayersPanel } from './LayersPanel'
import { OverlayPanel } from './OverlayPanel'
import { IssuesPanel } from './IssuesPanel'
import { t } from '../i18n'
import { Rich } from './Rich'
import { setModeAnimated, withTransition } from '../motion'
import { TickSlider } from './TickSlider'

function Thumbs() {
  const { sheets, page, markups, scales, set } = useStore()
  return (
    <div className="thumbs">
      {sheets.length === 0 && <p className="muted pad">{t('leftpanel.nenhum_documento_aberto')}</p>}
      {sheets.map((sh, i) => {
        const n = markups.filter((m) => m.page === sh.id && m.kind !== 'viewport').length
        const vps = markups.filter((m) => m.page === sh.id && m.kind === 'viewport').length
        return (
          <button key={sh.id} className={`thumb ${i === page ? 'active' : ''}`} onClick={() => withTransition(() => set({ page: i, selected: [] }), 'fade')}>
            <Thumb sheet={sh} width={200} />
            <div className="thumb-meta">
              <span className="thumb-label">{sh.label}</span>
              <span className="chips">
                {scales[sh.id] && <span className="chip">{scales[sh.id].label}</span>}
                {vps > 0 && <span className="chip vp" title={t('leftpanel.viewports')}>{vps}▢</span>}
                {n > 0 && <span className="chip accent">{n}</span>}
              </span>
            </div>
          </button>
        )
      })}
    </div>
  )
}

function Action({ icon: I, label, hint, onClick, active, danger }: { icon: typeof Type; label: string; hint?: string; onClick: () => void; active?: boolean; danger?: boolean }) {
  return (
    <button className={`dock-action ${active ? 'active' : ''} ${danger ? 'danger' : ''}`} onClick={onClick}>
      <I size={17} strokeWidth={1.7} />
      <span className="grow">{label}</span>
      {hint && <kbd>{hint}</kbd>}
    </button>
  )
}

function EditPanel() {
  const s = useStore()
  const sh = curSheet(s)
  const tool = (t: Tool, extra = {}) => s.set({ tool: t, activePreset: null, selected: [], ...extra })
  return (
    <div className="dock-body">
      <div className="dock-group">{t('leftpanel.adicionar_conteudo')}</div>
      <Action icon={Type} label={t('leftpanel.texto')} hint="T" active={s.tool === 'text'} onClick={() => tool('text')} />
      <Action icon={ImagePlus} label={t('leftpanel.imagem_assinatura')} hint="P" active={s.tool === 'image'} onClick={() => tool('image')} />
      <Action icon={Stamp} label={t('leftpanel.carimbo')} hint="B" active={s.tool === 'stamp'} onClick={() => tool('stamp')} />
      <div className="dock-group">{t('leftpanel.corrigir_o_pdf')}</div>
      <Action icon={Eraser} label={t('leftpanel.tarja_ocultar_conteudo')} hint="D" active={s.tool === 'redact' && s.redactFill === '#000000'} onClick={() => tool('redact', { redactFill: '#000000' })} />
      <Action icon={PenLine} label={t('leftpanel.corrigir_texto_apagar_e_reescrever')} active={s.tool === 'redact' && s.redactFill === '#ffffff'} onClick={() => tool('redact', { redactFill: '#ffffff' })} />
      <div className="dock-group">{t('leftpanel.folha_atual')}</div>
      <Action icon={RotateCw} label={t('leftpanel.girar_a_direita')} onClick={() => sh && rotateSheets([sh.id], 90)} />
      <Action icon={RotateCcw} label={t('leftpanel.girar_a_esquerda')} onClick={() => sh && rotateSheets([sh.id], -90)} />
      <Action icon={Trash2} label={t('leftpanel.excluir_folha')} danger onClick={() => {
        if (!sh || s.sheets.length < 2) return s.notify(t('leftpanel.mantenha_ao_menos_uma_folha'))
        s.setSheets(s.sheets.filter((x) => x.id !== sh.id))
        s.notify(t('leftpanel.folha_excluida_ctrl_z_desfaz'))
      }} />
      <div className="dock-group">{t('leftpanel.documento')}</div>
      <Action icon={Layers} label={t('leftpanel.numeracao_carimbos_e_marca_d')} onClick={() => s.set({ dialog: 'stamp' })} />
      <Action icon={FilePlus2} label={t('leftpanel.inserir_paginas_folha_em_branco')} onClick={() => setModeAnimated('pages')} />
      <Action icon={Tags} label={t('leftpanel.renomear_folhas')} onClick={() => setModeAnimated('pages')} />
      <Action icon={LayoutGrid} label={t('leftpanel.organizar_paginas')} onClick={() => setModeAnimated('pages')} />
    </div>
  )
}

function MeasurePanel() {
  const s = useStore()
  const sh = curSheet(s)
  const sc = sh ? s.scales[sh.id] : undefined
  const tool = (t: Tool) => s.set({ tool: t, activePreset: null, selected: [] })
  return (
    <div className="dock-body">
      <div className={`scale-card ${sc ? '' : 'unset'}`}>
        <span className="muted small">{t('leftpanel.escala_da_folha')}</span>
        <b>{sc ? sc.label : t('leftpanel.nao_definida')}</b>
        <div className="row">
          <button className="btn sm" onClick={() => tool('calibrate')}><Scaling size={13} /> {t('leftpanel.calibrar')}</button>
          <button className="btn sm ghost" onClick={() => sh && s.set({ calibrating: { page: sh.id, length: 0 } })}>{t('leftpanel.escolher')}</button>
        </div>
      </div>
      <div className="dock-group">{t('leftpanel.medir')}</div>
      <Action icon={Scaling} label={t('leftpanel.calibrar_por_cota')} hint="S" active={s.tool === 'calibrate'} onClick={() => tool('calibrate')} />
      <Action icon={Ruler} label={t('leftpanel.comprimento')} hint="L" active={s.tool === 'length'} onClick={() => tool('length')} />
      <Action icon={Pentagon} label={t('leftpanel.area_vertice_a_vertice')} hint="K" active={s.tool === 'area'} onClick={() => tool('area')} />
      <Action icon={PaintBucket} label={t('leftpanel.area_por_clique')} hint="G" active={s.tool === 'fill' && s.fillAs === 'area'} onClick={() => s.set({ tool: 'fill', fillAs: 'area', selected: [] })} />
      <Action icon={Target} label={t('leftpanel.contagem')} hint="N" active={s.tool === 'count'} onClick={() => tool('count')} />
      <Action icon={ScanSearch} label={t('leftpanel.contagem_automatica')} hint="Q" active={s.tool === 'symbol'} onClick={() => tool('symbol')} />
      <Action icon={Frame} label={t('leftpanel.viewport_outra_escala')} hint="X" active={s.tool === 'viewport'} onClick={() => tool('viewport')} />
      <div className="dock-group">{t('leftpanel.vazios')}</div>
      <Action icon={SquareDashed} label={t('leftpanel.desenhar_vazio_na_area')} hint="O" active={s.tool === 'hole'} onClick={() => tool('hole')} />
      <p className="muted small dock-note"><Rich k="leftpanel.nota_vazios" /></p>
      <label className="field dock-field"><span>{t('leftpanel.ignorar_vazios_menores_que_m')}</span>
        <input type="number" min={0} step={0.05} value={s.minHole} onChange={(e) => { const v = Math.max(0, Number(e.target.value)); s.set({ minHole: v }); try { localStorage.setItem('traco.minHole', JSON.stringify(v)) } catch { /* sem storage */ } }} />
      </label>
      <div className="dock-group">{t('leftpanel.ambientes_e_pavimentos')}</div>
      <Action icon={PaintBucket} label={t('leftpanel.ambiente_por_clique')} active={s.tool === 'fill' && s.fillAs === 'space'} onClick={() => s.set({ tool: 'fill', fillAs: 'space', selected: [] })} />
      <Action icon={Building2} label={t('leftpanel.desenhar_ambiente')} hint="M" active={s.tool === 'space'} onClick={() => tool('space')} />
      {sh && (
        <label className="field dock-field"><span>{t('leftpanel.pavimento_desta_folha')}</span>
          <input list="levels" value={sh.level ?? ''} placeholder={t('leftpanel.ex_terreo_1_pavimento')} onChange={(e) => useStore.setState({ sheets: s.sheets.map((x) => (x.id === sh.id ? { ...x, level: e.target.value } : x)) })} />
          <datalist id="levels">{Array.from(new Set(s.sheets.map((x) => x.level).filter(Boolean))).map((l) => <option key={l} value={l} />)}</datalist>
        </label>
      )}
      <div className="dock-group">{t('leftpanel.precisao')}</div>
      <Action icon={Magnet} label={t('leftpanel.snap_na_geometria')} hint="F3" active={s.snap} onClick={() => s.set({ snap: !s.snap })} />
      <Action icon={Move} label={t('leftpanel.ortogonal_0_90')} hint="F8" active={s.ortho} onClick={() => s.set({ ortho: !s.ortho })} />
      <label className="field dock-field"><span>{t('leftpanel.area_por_clique_fechar_aberturas', { fillGap: s.fillGap })}</span><TickSlider min={1} max={30} step={1} value={s.fillGap} unit=" pt" onChange={(v) => s.set({ fillGap: v })} /></label>
      <p className="muted small dock-note"><Rich k="leftpanel.nota_precisao" /></p>
      <div className="dock-group">{t('leftpanel.quantitativo_e_orcamento')}</div>
      <Action icon={FileSpreadsheet} label={s.panels.bottom ? t('leftpanel.ocultar_tabela') : t('leftpanel.mostrar_tabela')} onClick={() => s.set({ panels: { ...s.panels, bottom: !s.panels.bottom } })} />
      <Action icon={Layers} label={t('leftpanel.marcadores_de_quantitativo')} onClick={() => s.set({ rightTab: 'presets', panels: { ...s.panels, right: true }, selected: [] })} />
      <Action icon={Database} label={t('leftpanel.base_de_precos_sinapi_e')} onClick={() => s.set({ dialog: 'prices' })} />
      <Action icon={Columns3} label={t('leftpanel.colunas_personalizadas')} onClick={() => s.set({ dialog: 'columns' })} />
      <Action icon={TableProperties} label={t('leftpanel.inserir_legenda_na_prancha')} active={s.tool === 'legend'} onClick={() => tool('legend')} />
    </div>
  )
}

function ExportPanel() {
  const s = useStore()
  return (
    <div className="dock-body">
      <div className="dock-group">{t('leftpanel.arquivos')}</div>
      <Action icon={FileDown} label={t('leftpanel.exportar_pdf')} hint={t('leftpanel.ctrl_e')} onClick={() => s.set({ dialog: 'export' })} />
      <Action icon={FileSpreadsheet} label={t('leftpanel.exportar_quantitativo_excel')} onClick={async () => (await import('../xlsxExport')).exportXlsx(s.fileName, s.markups.filter((m) => m.kind !== 'viewport'), s.presets, s.scales, s.sheets)} />
      <Action icon={Save} label={t('leftpanel.salvar_projeto')} hint={t('leftpanel.ctrl_s')} onClick={() => saveProject()} />
      <Action icon={SaveAll} label={t('leftpanel.salvar_projeto_como')} hint={t('leftpanel.ctrl_s_2')} onClick={() => saveProject(true)} />
      <div className="dock-group">{t('leftpanel.dividir_e_extrair')}</div>
      <Action icon={Scissors} label={t('leftpanel.dividir_em_varios_pdfs')} onClick={() => setModeAnimated('pages')} />
      <Action icon={LayoutGrid} label={t('leftpanel.extrair_folhas_selecionadas')} onClick={() => setModeAnimated('pages')} />
    </div>
  )
}

const TITLES = { get pages() { return t('leftpanel.paginas') }, get edit() { return t('leftpanel.editar_pdf') }, get measure() { return t('leftpanel.medir') }, get export() { return t('leftpanel.exportar') }, get layers() { return t('leftpanel.camadas_do_pdf') }, get overlay() { return t('leftpanel.sobrepor_disciplinas') }, get issues() { return t('leftpanel.compatibilizacao') } }

/** Painel à esquerda; o conteúdo muda conforme o item escolhido na barra de navegação. */
export function LeftPanel() {
  const s = useStore()
  const nav = s.nav ?? 'pages'
  return (
    <aside className="panel left dock">
      <header className="panel-head">
        <span>{TITLES[nav]}{nav === 'pages' && s.sheets.length ? <em className="muted"> · {s.sheets.length}</em> : null}</span>
        <button className="icon-btn xs" data-tip={t('leftpanel.recolher')} onClick={() => s.set({ nav: null })}><ChevronsLeft size={15} /></button>
      </header>
      <div key={nav} className="dock-content">
        {nav === 'pages' ? <Thumbs /> : nav === 'edit' ? <EditPanel /> : nav === 'measure' ? <MeasurePanel /> : nav === 'layers' ? <LayersPanel /> : nav === 'overlay' ? <OverlayPanel /> : nav === 'issues' ? <IssuesPanel /> : <ExportPanel />}
      </div>
    </aside>
  )
}
