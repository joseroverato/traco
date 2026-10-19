import { Columns2, Settings, Search, FileDown, FolderOpen, Maximize, MoveHorizontal, Moon, PanelBottom, PanelLeft, PanelRight, Redo2, Save, Stamp, Sun, Undo2, ZoomIn, ZoomOut } from 'lucide-react'
import { curSheet, useStore } from '../store'
import type { Mode } from '../store'
import { saveProject } from '../project'
import { IS_DESKTOP } from '../platform'

const MODES: { id: Mode; label: string }[] = [
  { id: 'review', label: 'Revisar' },
  { id: 'pages', label: 'Pranchas' },
  { id: 'compare', label: 'Comparar' },
  { id: '3d', label: '3D' },
]

export function TopBar({ onOpen }: { onOpen: () => void }) {
  const s = useStore()
  const has = s.sheets.length > 0
  const sh = curSheet(s)
  const zoomBy = (f: number) => window.dispatchEvent(new CustomEvent('traco:zoom', { detail: f }))
  const sc = sh ? s.scales[sh.id] : undefined
  const review = s.mode === 'review'
  const toggleTheme = () => {
    const t = s.theme === 'dark' ? 'light' : 'dark'
    try {
      localStorage.setItem('traco.theme', JSON.stringify(t))
    } catch {
      /* sem storage */
    }
    s.set({ theme: t })
  }
  return (
    <header className="topbar">
      <div className="brand">
        <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden>
          <rect x="2" y="2" width="20" height="20" rx="6" fill="var(--accent)" />
          <path d="M7 16.5 L17 7.5 M7 7.5 h5" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
        </svg>
        <span>Traço</span>
        {IS_DESKTOP && <span className="edition" title="App de PC com motor completo (tarja definitiva, OCR, Claude Desktop)">PC</span>}
      </div>
      <div className="tb-group">
        <button className="icon-btn" data-tip="Abrir  Ctrl+O" onClick={onOpen}><FolderOpen size={17} /></button>
        <button className="icon-btn" data-tip="Salvar projeto  Ctrl+S" disabled={!has} onClick={() => saveProject()}><Save size={17} /></button>
        <button className="icon-btn" data-tip="Exportar PDF  Ctrl+E" disabled={!has} onClick={() => s.set({ dialog: 'export' })}><FileDown size={17} /></button>
        <div className="tb-sep" />
        <button className="icon-btn" data-tip="Desfazer  Ctrl+Z" disabled={!s.past.length} onClick={s.undo}><Undo2 size={17} /></button>
        <button className="icon-btn" data-tip="Refazer  Ctrl+Y" disabled={!s.future.length} onClick={s.redo}><Redo2 size={17} /></button>
      </div>
      <div className="modes">
        {MODES.map((m) => (
          <button key={m.id} className={s.mode === m.id ? 'active' : ''} disabled={!has} onClick={() => s.set({ mode: m.id, selected: [], tool: 'select' })}>
            {m.label}
          </button>
        ))}
      </div>
      <div className="doc-title" title={s.fileName}>
        {s.fileName ? (
          <>
            <span className="name">{s.fileName}</span>
            {sh && review && <span className="muted"> · {sh.label}</span>}
          </>
        ) : (
          <span className="muted">Nenhum documento</span>
        )}
      </div>
      <div className="tb-group">
        <button className="icon-btn" data-tip="Carimbos e numeração em lote" disabled={!has} onClick={() => s.set({ dialog: 'stamp' })}><Stamp size={17} /></button>
        <div className="tb-sep" />
        {review && (
          <>
            <button className={`scale-pill ${sc ? '' : 'unset'}`} disabled={!sh} onClick={() => sh && s.set({ calibrating: { page: sh.id, length: 0 } })} data-tip="Escala da folha">
              {sc ? sc.label : 'Sem escala'}
            </button>
            <div className="tb-sep" />
            <button className={`icon-btn ${s.split3d ? 'on' : ''}`} disabled={!has} data-tip={s.split3d ? 'Fechar o 3D ao lado' : 'Dividir a tela: planta e 3D ao vivo'} onClick={() => s.set({ split3d: !s.split3d })}><Columns2 size={17} /></button>
            <button className="icon-btn" disabled={!has} data-tip="Reduzir  −" onClick={() => zoomBy(1 / 1.25)}><ZoomOut size={17} /></button>
            <span className="zoom-val">{Math.round(s.zoom * 100)}%</span>
            <button className="icon-btn" disabled={!has} data-tip="Ampliar  +" onClick={() => zoomBy(1.25)}><ZoomIn size={17} /></button>
            <button className="icon-btn" disabled={!has} data-tip="Folha inteira  0" onClick={() => s.set({ fitReq: { mode: 'page', n: Date.now() } })}><Maximize size={16} /></button>
            <button className="icon-btn" disabled={!has} data-tip="Largura  W" onClick={() => s.set({ fitReq: { mode: 'width', n: Date.now() } })}><MoveHorizontal size={17} /></button>
            <div className="tb-sep" />
            <button className={`icon-btn ${s.nav && !s.focus ? 'on' : ''}`} data-tip="Painel lateral  Ctrl+1" onClick={() => s.set({ nav: s.nav && !s.focus ? null : 'pages', focus: false })}><PanelLeft size={17} /></button>
            <button className={`icon-btn ${s.panels.bottom ? 'on' : ''}`} data-tip="Quantitativo  Ctrl+2" onClick={() => s.set({ panels: { ...s.panels, bottom: !s.panels.bottom || s.focus }, focus: false })}><PanelBottom size={17} /></button>
            <button className={`icon-btn ${s.panels.right ? 'on' : ''}`} data-tip="Marcadores, propriedades e Claude  Ctrl+3" onClick={() => s.set({ panels: { ...s.panels, right: !s.panels.right || s.focus }, focus: false })}><PanelRight size={17} /></button>
            <div className="tb-sep" />
          </>
        )}
        <button className="icon-btn" data-tip="Buscar texto  Ctrl+F" disabled={!has} onClick={() => s.set({ search: { ...s.search, open: !s.search.open }, mode: 'review' })}><Search size={17} /></button>
        <button className={`icon-btn ${s.updateReady ? 'badge' : ''}`} data-tip={s.updateReady ? `Atualização ${s.updateReady} pronta` : 'Configurações e atualizações'} onClick={() => s.set({ dialog: 'updates' })}><Settings size={17} /></button>
        <button className="icon-btn" data-tip={s.theme === 'dark' ? 'Tema claro' : 'Tema escuro'} onClick={toggleTheme}>{s.theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}</button>
      </div>
    </header>
  )
}
