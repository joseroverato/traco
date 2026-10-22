import { Columns2, Settings, Search, FileDown, FolderOpen, Maximize, MoveHorizontal, Moon, PanelBottom, PanelLeft, PanelRight, Redo2, Save, Stamp, Sun, Undo2, X, ZoomIn, ZoomOut } from 'lucide-react'
import { useLayoutEffect, useRef, useState } from 'react'
import { curSheet, useStore } from '../store'
import type { Mode } from '../store'
import { setModeAnimated, withTransition } from '../motion'
import { applyPalette } from '../theme'
import { Logo } from './Logo'
import { requestCloseProject, saveProject } from '../project'
import { IS_DESKTOP } from '../platform'
import { t } from '../i18n'

const MODES: { id: Mode; label: string }[] = [
  { id: 'review', get label() { return t('topbar.revisar') } },
  { id: 'pages', get label() { return t('topbar.pranchas') } },
  { id: 'compare', get label() { return t('topbar.comparar') } },
  { id: '3d', label: '3D' },
]

/** Botões de modo com um indicador que desliza até o escolhido. */
function ModeSwitch({ has, mode }: { has: boolean; mode: Mode }) {
  const box = useRef<HTMLDivElement>(null)
  const [pill, setPill] = useState<{ x: number; w: number } | null>(null)
  useLayoutEffect(() => {
    const el = box.current
    if (!el) return
    const place = () => {
      const b = el.querySelector<HTMLElement>('button.active')
      setPill(b ? { x: b.offsetLeft, w: b.offsetWidth } : null)
    }
    place()
    const ro = new ResizeObserver(place)
    ro.observe(el)
    return () => ro.disconnect()
  }, [mode, has])
  return (
    <div className="modes" ref={box}>
      {pill && <i className="modes-pill" style={{ transform: `translateX(${pill.x}px)`, width: pill.w }} />}
      {MODES.map((m) => (
        <button key={m.id} className={mode === m.id ? 'active' : ''} disabled={!has} onClick={() => setModeAnimated(m.id, { selected: [], tool: 'select' })}>
          {m.label}
        </button>
      ))}
    </div>
  )
}

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
    withTransition(() => {
      applyPalette(t)
      document.documentElement.dataset.theme = t // já dentro da transição, para o navegador guardar o "depois" com o tema novo
      s.set({ theme: t })
    }, 'theme')
  }
  return (
    <header className="topbar">
      <div className="brand">
        <Logo size={24} />
        <span>Traço</span>
        {IS_DESKTOP && <span className="edition" title={t('topbar.app_de_pc_com_motor')}>PC</span>}
      </div>
      <div className="tb-group">
        <button className="icon-btn" data-tip={t('topbar.abrir_ctrl_o')} onClick={onOpen}><FolderOpen size={17} /></button>
        <button className="icon-btn" data-tip={t('topbar.salvar_projeto_ctrl_s')} disabled={!has} onClick={() => saveProject()}><Save size={17} /></button>
        <button className="icon-btn" data-tip={t('topbar.exportar_pdf_ctrl_e')} disabled={!has} onClick={() => s.set({ dialog: 'export' })}><FileDown size={17} /></button>
        <div className="tb-sep" />
        <button className="icon-btn" data-tip={t('topbar.desfazer_ctrl_z')} disabled={!s.past.length} onClick={s.undo}><Undo2 size={17} /></button>
        <button className="icon-btn" data-tip={t('topbar.refazer_ctrl_y')} disabled={!s.future.length} onClick={s.redo}><Redo2 size={17} /></button>
      </div>
      <ModeSwitch has={has} mode={s.mode} />

      <div className="doc-title" title={s.fileName}>
        {s.fileName ? (
          <>
            <span className="name">{s.fileName}</span>
            {sh && review && <span className="muted"> · {sh.label}</span>}
            <button className="icon-btn xs doc-close" data-tip={t('project.fechar_projeto') + '  Ctrl+W'} aria-label={t('project.fechar_projeto')} onClick={requestCloseProject}><X size={13} /></button>
          </>
        ) : (
          <span className="muted">{t('topbar.nenhum_documento')}</span>
        )}
      </div>
      <div className="tb-group">
        <button className="icon-btn" data-tip={t('topbar.carimbos_e_numeracao_em_lote')} disabled={!has} onClick={() => s.set({ dialog: 'stamp' })}><Stamp size={17} /></button>
        <div className="tb-sep" />
        {review && (
          <>
            <button className={`scale-pill ${sc ? '' : 'unset'}`} disabled={!sh} onClick={() => sh && s.set({ calibrating: { page: sh.id, length: 0 } })} data-tip={t('topbar.escala_da_folha')}>
              {sc ? sc.label : t('topbar.sem_escala')}
            </button>
            <div className="tb-sep" />
            <button className={`icon-btn ${s.split3d ? 'on' : ''}`} disabled={!has} data-tip={s.split3d ? t('topbar.fechar_o_3d_ao_lado') : t('topbar.dividir_a_tela_planta_e')} onClick={() => s.set({ split3d: !s.split3d })}><Columns2 size={17} /></button>
            <button className="icon-btn" disabled={!has} data-tip={t('topbar.reduzir')} onClick={() => zoomBy(1 / 1.25)}><ZoomOut size={17} /></button>
            <span className="zoom-val">{Math.round(s.zoom * 100)}%</span>
            <button className="icon-btn" disabled={!has} data-tip={t('topbar.ampliar')} onClick={() => zoomBy(1.25)}><ZoomIn size={17} /></button>
            <button className="icon-btn" disabled={!has} data-tip={t('topbar.folha_inteira_0')} onClick={() => s.set({ fitReq: { mode: 'page', n: Date.now() } })}><Maximize size={16} /></button>
            <button className="icon-btn" disabled={!has} data-tip={t('topbar.largura_w')} onClick={() => s.set({ fitReq: { mode: 'width', n: Date.now() } })}><MoveHorizontal size={17} /></button>
            <div className="tb-sep" />
            <button className={`icon-btn ${s.nav && !s.focus ? 'on' : ''}`} data-tip={t('topbar.painel_lateral_ctrl_1')} onClick={() => s.set({ nav: s.nav && !s.focus ? null : 'pages', focus: false })}><PanelLeft size={17} /></button>
            <button className={`icon-btn ${s.panels.bottom ? 'on' : ''}`} data-tip={t('topbar.quantitativo_ctrl_2')} onClick={() => s.set({ panels: { ...s.panels, bottom: !s.panels.bottom || s.focus }, focus: false })}><PanelBottom size={17} /></button>
            <button className={`icon-btn ${s.panels.right ? 'on' : ''}`} data-tip={t('topbar.marcadores_propriedades_e_claude_ctrl')} onClick={() => s.set({ panels: { ...s.panels, right: !s.panels.right || s.focus }, focus: false })}><PanelRight size={17} /></button>
            <div className="tb-sep" />
          </>
        )}
        <button className="icon-btn" data-tip={t('topbar.buscar_texto_ctrl_f')} disabled={!has} onClick={() => s.set({ search: { ...s.search, open: !s.search.open }, mode: 'review' })}><Search size={17} /></button>
        <button className={`icon-btn ${s.updateReady ? 'badge' : ''}`} data-tip={s.updateReady ? t('topbar.atualizacao_pronta', { updateReady: s.updateReady }) : t('topbar.configuracoes_e_atualizacoes')} onClick={() => s.set({ dialog: 'updates' })}><Settings size={17} /></button>
        <button className="icon-btn" data-tip={s.theme === 'dark' ? t('topbar.tema_claro') : t('topbar.tema_escuro')} onClick={toggleTheme}>{s.theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}</button>
      </div>
    </header>
  )
}
