import { ChevronsLeft, PaintBucket, ScanSearch, SquareDashed, Columns3, Database, TableProperties, Building2, Eraser, FileDown, FilePlus2, FileSpreadsheet, Frame, ImagePlus, LayoutGrid, Magnet, Move, PenLine, Pentagon, RotateCcw, RotateCw, Ruler, Save, SaveAll, Scaling, Scissors, Stamp, Tags, Target, Trash2, Type, Layers } from 'lucide-react'
import { curSheet, useStore } from '../store'
import type { Tool } from '../types'
import { Thumb } from './Thumb'
import { saveProject } from '../project'
import { rotateSheets } from '../sheetOps'
import { LayersPanel } from './LayersPanel'
import { OverlayPanel } from './OverlayPanel'
import { IssuesPanel } from './IssuesPanel'

function Thumbs() {
  const { sheets, page, markups, scales, set } = useStore()
  return (
    <div className="thumbs">
      {sheets.length === 0 && <p className="muted pad">Nenhum documento aberto.</p>}
      {sheets.map((sh, i) => {
        const n = markups.filter((m) => m.page === sh.id && m.kind !== 'viewport').length
        const vps = markups.filter((m) => m.page === sh.id && m.kind === 'viewport').length
        return (
          <button key={sh.id} className={`thumb ${i === page ? 'active' : ''}`} onClick={() => set({ page: i, selected: [] })}>
            <Thumb sheet={sh} width={200} />
            <div className="thumb-meta">
              <span className="thumb-label">{sh.label}</span>
              <span className="chips">
                {scales[sh.id] && <span className="chip">{scales[sh.id].label}</span>}
                {vps > 0 && <span className="chip vp" title="viewports">{vps}▢</span>}
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
      <div className="dock-group">Adicionar conteúdo</div>
      <Action icon={Type} label="Texto" hint="T" active={s.tool === 'text'} onClick={() => tool('text')} />
      <Action icon={ImagePlus} label="Imagem / assinatura" hint="P" active={s.tool === 'image'} onClick={() => tool('image')} />
      <Action icon={Stamp} label="Carimbo" hint="B" active={s.tool === 'stamp'} onClick={() => tool('stamp')} />
      <div className="dock-group">Corrigir o PDF</div>
      <Action icon={Eraser} label="Tarja (ocultar conteúdo)" hint="D" active={s.tool === 'redact' && s.redactFill === '#000000'} onClick={() => tool('redact', { redactFill: '#000000' })} />
      <Action icon={PenLine} label="Corrigir texto (apagar e reescrever)" active={s.tool === 'redact' && s.redactFill === '#ffffff'} onClick={() => tool('redact', { redactFill: '#ffffff' })} />
      <div className="dock-group">Folha atual</div>
      <Action icon={RotateCw} label="Girar à direita" onClick={() => sh && rotateSheets([sh.id], 90)} />
      <Action icon={RotateCcw} label="Girar à esquerda" onClick={() => sh && rotateSheets([sh.id], -90)} />
      <Action icon={Trash2} label="Excluir folha" danger onClick={() => {
        if (!sh || s.sheets.length < 2) return s.notify('Mantenha ao menos uma folha')
        s.setSheets(s.sheets.filter((x) => x.id !== sh.id))
        s.notify('Folha excluída — Ctrl+Z desfaz')
      }} />
      <div className="dock-group">Documento</div>
      <Action icon={Layers} label="Numeração, carimbos e marca d'água" onClick={() => s.set({ dialog: 'stamp' })} />
      <Action icon={FilePlus2} label="Inserir páginas / folha em branco" onClick={() => s.set({ mode: 'pages' })} />
      <Action icon={Tags} label="Renomear folhas" onClick={() => s.set({ mode: 'pages' })} />
      <Action icon={LayoutGrid} label="Organizar páginas" onClick={() => s.set({ mode: 'pages' })} />
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
        <span className="muted small">Escala da folha</span>
        <b>{sc ? sc.label : 'não definida'}</b>
        <div className="row">
          <button className="btn sm" onClick={() => tool('calibrate')}><Scaling size={13} /> Calibrar</button>
          <button className="btn sm ghost" onClick={() => sh && s.set({ calibrating: { page: sh.id, length: 0 } })}>Escolher…</button>
        </div>
      </div>
      <div className="dock-group">Medir</div>
      <Action icon={Scaling} label="Calibrar por cota" hint="S" active={s.tool === 'calibrate'} onClick={() => tool('calibrate')} />
      <Action icon={Ruler} label="Comprimento" hint="L" active={s.tool === 'length'} onClick={() => tool('length')} />
      <Action icon={Pentagon} label="Área (vértice a vértice)" hint="K" active={s.tool === 'area'} onClick={() => tool('area')} />
      <Action icon={PaintBucket} label="Área por clique" hint="G" active={s.tool === 'fill' && s.fillAs === 'area'} onClick={() => s.set({ tool: 'fill', fillAs: 'area', selected: [] })} />
      <Action icon={Target} label="Contagem" hint="N" active={s.tool === 'count'} onClick={() => tool('count')} />
      <Action icon={ScanSearch} label="Contagem automática" hint="Q" active={s.tool === 'symbol'} onClick={() => tool('symbol')} />
      <Action icon={Frame} label="Viewport (outra escala)" hint="X" active={s.tool === 'viewport'} onClick={() => tool('viewport')} />
      <div className="dock-group">Vazios</div>
      <Action icon={SquareDashed} label="Desenhar vazio na área" hint="O" active={s.tool === 'hole'} onClick={() => tool('hole')} />
      <p className="muted small dock-note">Na <b>Área por clique</b>, contornos fechados dentro da área (fosso, shaft) já saem descontados. Para outro vazio: segure <kbd>Shift</kbd> e clique dentro dele, ou desenhe com esta ferramenta.</p>
      <label className="field dock-field"><span>Ignorar vazios menores que (m²)</span>
        <input type="number" min={0} step={0.05} value={s.minHole} onChange={(e) => { const v = Math.max(0, Number(e.target.value)); s.set({ minHole: v }); try { localStorage.setItem('traco.minHole', JSON.stringify(v)) } catch { /* sem storage */ } }} />
      </label>
      <div className="dock-group">Ambientes e pavimentos</div>
      <Action icon={PaintBucket} label="Ambiente por clique" active={s.tool === 'fill' && s.fillAs === 'space'} onClick={() => s.set({ tool: 'fill', fillAs: 'space', selected: [] })} />
      <Action icon={Building2} label="Desenhar ambiente" hint="M" active={s.tool === 'space'} onClick={() => tool('space')} />
      {sh && (
        <label className="field dock-field"><span>Pavimento desta folha</span>
          <input list="levels" value={sh.level ?? ''} placeholder="ex.: Térreo, 1º pavimento" onChange={(e) => useStore.setState({ sheets: s.sheets.map((x) => (x.id === sh.id ? { ...x, level: e.target.value } : x)) })} />
          <datalist id="levels">{Array.from(new Set(s.sheets.map((x) => x.level).filter(Boolean))).map((l) => <option key={l} value={l} />)}</datalist>
        </label>
      )}
      <div className="dock-group">Precisão</div>
      <Action icon={Magnet} label="Snap na geometria" hint="F3" active={s.snap} onClick={() => s.set({ snap: !s.snap })} />
      <Action icon={Move} label="Ortogonal (0° / 90°)" hint="F8" active={s.ortho} onClick={() => s.set({ ortho: !s.ortho })} />
      <label className="field dock-field"><span>Área por clique: fechar aberturas até {s.fillGap} pt</span><input type="range" min={1} max={30} step={1} value={s.fillGap} onChange={(e) => s.set({ fillGap: Number(e.target.value) })} /></label>
      <p className="muted small dock-note">Segure <kbd>Alt</kbd> para desligar o snap momentaneamente e <kbd>Shift</kbd> para travar em 45°.</p>
      <div className="dock-group">Quantitativo e orçamento</div>
      <Action icon={FileSpreadsheet} label={s.panels.bottom ? 'Ocultar tabela' : 'Mostrar tabela'} onClick={() => s.set({ panels: { ...s.panels, bottom: !s.panels.bottom } })} />
      <Action icon={Layers} label="Marcadores de quantitativo" onClick={() => s.set({ rightTab: 'presets', panels: { ...s.panels, right: true }, selected: [] })} />
      <Action icon={Database} label="Base de preços (SINAPI) e BDI" onClick={() => s.set({ dialog: 'prices' })} />
      <Action icon={Columns3} label="Colunas personalizadas" onClick={() => s.set({ dialog: 'columns' })} />
      <Action icon={TableProperties} label="Inserir legenda na prancha" active={s.tool === 'legend'} onClick={() => tool('legend')} />
    </div>
  )
}

function ExportPanel() {
  const s = useStore()
  return (
    <div className="dock-body">
      <div className="dock-group">Arquivos</div>
      <Action icon={FileDown} label="Exportar PDF" hint="Ctrl+E" onClick={() => s.set({ dialog: 'export' })} />
      <Action icon={FileSpreadsheet} label="Exportar quantitativo (Excel)" onClick={async () => (await import('../xlsxExport')).exportXlsx(s.fileName, s.markups.filter((m) => m.kind !== 'viewport'), s.presets, s.scales, s.sheets)} />
      <Action icon={Save} label="Salvar projeto" hint="Ctrl+S" onClick={() => saveProject()} />
      <Action icon={SaveAll} label="Salvar projeto como…" hint="Ctrl+⇧+S" onClick={() => saveProject(true)} />
      <div className="dock-group">Dividir e extrair</div>
      <Action icon={Scissors} label="Dividir em vários PDFs" onClick={() => s.set({ mode: 'pages' })} />
      <Action icon={LayoutGrid} label="Extrair folhas selecionadas" onClick={() => s.set({ mode: 'pages' })} />
    </div>
  )
}

const TITLES = { pages: 'Páginas', edit: 'Editar PDF', measure: 'Medir', export: 'Exportar', layers: 'Camadas do PDF', overlay: 'Sobrepor disciplinas', issues: 'Compatibilização' }

/** Painel à esquerda; o conteúdo muda conforme o item escolhido na barra de navegação. */
export function LeftPanel() {
  const s = useStore()
  const nav = s.nav ?? 'pages'
  return (
    <aside className="panel left dock">
      <header className="panel-head">
        <span>{TITLES[nav]}{nav === 'pages' && s.sheets.length ? <em className="muted"> · {s.sheets.length}</em> : null}</span>
        <button className="icon-btn xs" data-tip="Recolher" onClick={() => s.set({ nav: null })}><ChevronsLeft size={15} /></button>
      </header>
      <div key={nav} className="dock-content">
        {nav === 'pages' ? <Thumbs /> : nav === 'edit' ? <EditPanel /> : nav === 'measure' ? <MeasurePanel /> : nav === 'layers' ? <LayersPanel /> : nav === 'overlay' ? <OverlayPanel /> : nav === 'issues' ? <IssuesPanel /> : <ExportPanel />}
      </div>
    </aside>
  )
}
