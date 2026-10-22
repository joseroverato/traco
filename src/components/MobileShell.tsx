import { Suspense, lazy, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { ArrowLeft, Box, Check, ClipboardList, Columns2, Ellipsis, FileDown, FilePenLine, FolderOpen, Files, Layers3, LayoutGrid, Maximize, Minus, Moon, Plus, Redo2, Ruler, Save, Search, Settings, SlidersHorizontal, SquareStack, Stamp, Sun, Sparkles, Table2, Tags, Trash2, Undo2, X } from 'lucide-react'
import { curSheet, useStore } from '../store'
import type { State } from '../store'
import { saveProject } from '../project'
import { TOOLS } from '../railTools'
import { Viewer } from './Viewer'
import { LeftPanel } from './LeftPanel'
import { RightPanel } from './RightPanel'
import { BottomPanel } from './BottomPanel'
import { SearchBar } from './SearchBar'
import { isMiraTool, miraCmd, useMira } from '../mira'
import { t, useLang } from '../i18n'
import { setModeAnimated, withTransition } from '../motion'
import { applyPalette } from '../theme'
import { Logo } from './Logo'

const PagesView = lazy(() => import('./PagesView').then((m) => ({ default: m.PagesView })))
const View3D = lazy(() => import('./View3D').then((m) => ({ default: m.View3D })))
const CompareView = lazy(() => import('./CompareView').then((m) => ({ default: m.CompareView })))

type Nav = NonNullable<State['nav']>
type Sheet = 'left' | 'right' | 'bottom' | 'more' | null

/** Os rótulos de atalho do PC ("Salvar projeto  Ctrl+S") trazem a tecla depois de dois espaços; no celular só interessa o nome. */
const plain = (s: string) => s.split('  ')[0]

const zoomBy = (f: number) => window.dispatchEvent(new CustomEvent('traco:zoom', { detail: f }))

/** Layout de celular: folha em tela cheia, ferramentas numa faixa e painéis como gavetas que sobem de baixo. */
export function MobileShell({ onOpen }: { onOpen: () => void }) {
  useLang()
  const s = useStore()
  const [sheet, setSheet] = useState<Sheet>(null)
  const [closing, setClosing] = useState(false)
  const strip = useRef<HTMLElement>(null)
  const has = s.sheets.length > 0
  const sh = curSheet(s)
  const sc = sh ? s.scales[sh.id] : undefined
  const review = s.mode === 'review' || !has
  const mira = review && has && isMiraTool(s.tool)
  const miraN = useMira((m) => m.n)
  const miraMin = useMira((m) => m.min)

  // ao abrir um documento a mão já vem selecionada: arrastar move a folha
  useEffect(() => {
    if (has) useStore.getState().setTool('pan')
  }, [has])

  // o Safari do iPhone dá zoom na página com a pinça; aqui a pinça é do visor
  useEffect(() => {
    const stop = (e: Event) => e.preventDefault()
    for (const ev of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(ev, stop, { passive: false })
    return () => {
      for (const ev of ['gesturestart', 'gesturechange', 'gestureend']) document.removeEventListener(ev, stop)
    }
  }, [])

  // escolheu um marcador ou uma folha: a gaveta fecha para a pessoa trabalhar na planta
  useEffect(() => {
    if (s.activePreset) setSheet((v) => (v === 'right' ? null : v))
  }, [s.activePreset])
  useEffect(() => {
    setSheet((v) => (v === 'left' && (s.nav ?? 'pages') === 'pages' ? null : v))
  }, [s.page]) // eslint-disable-line react-hooks/exhaustive-deps

  // a ferramenta ativa sempre aparece na faixa (escolher um marcador pode ativar uma que está fora da tela)
  useEffect(() => {
    strip.current?.querySelector('.m-tool.active')?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' })
  }, [s.tool, has, review])

  const toggleTheme = () => {
    const next = s.theme === 'dark' ? 'light' : 'dark'
    try {
      localStorage.setItem('traco.theme', JSON.stringify(next))
    } catch {
      /* sem storage */
    }
    withTransition(() => {
      document.documentElement.dataset.theme = next
      applyPalette(next)
      s.set({ theme: next })
    }, 'theme')
  }
  const openLeft = (nav: Nav) => {
    s.set({ nav, mode: 'review', focus: false })
    setSheet('left')
  }
  const openRight = (tab: State['rightTab']) => {
    s.set({ rightTab: tab, mode: 'review', focus: false, panels: { ...s.panels, right: true } })
    setSheet('right')
  }
  const goMode = (mode: State['mode']) => {
    setSheet(null)
    setModeAnimated(mode, { selected: [], tool: 'select' })
  }
  /** Fecha a gaveta com a animação de descida (a troca de gaveta pelas abas continua direta). */
  const closeSheet = () => {
    if (!sheet || closing) return
    setClosing(true)
    setTimeout(() => {
      setSheet(null)
      setClosing(false)
    }, 200)
  }
  const act = (fn: () => void) => () => {
    closeSheet()
    fn()
  }

  let last = -1
  const tabs: { id: Exclude<Sheet, null>; icon: typeof Files; label: string; run: () => void }[] = [
    { id: 'left', icon: Files, label: t('navbar.paginas'), run: () => openLeft('pages') },
    { id: 'right', icon: Tags, label: t('rightpanel.marcadores'), run: () => openRight('presets') },
    { id: 'bottom', icon: Table2, label: t('app.quantitativo'), run: () => { s.set({ mode: 'review', panels: { ...s.panels, bottom: true } }); setSheet('bottom') } },
    { id: 'more', icon: Ellipsis, label: t('mobile.mais'), run: () => setSheet('more') },
  ]

  const row = (icon: ReactNode, label: string, run: () => void, disabled = false) => (
    <button key={label} className="m-row" disabled={disabled} onClick={run}>
      {icon}
      <span>{label}</span>
    </button>
  )

  return (
    <div className="m-app">
      <header className="m-top">
        <Logo size={28} className="m-logo" />
        <div className="m-title">
          {s.fileName ? (
            <>
              <b>{s.fileName}</b>
              {sh && review && <small>{sh.label}</small>}
            </>
          ) : (
            <b>Traço</b>
          )}
        </div>
        {has && review && (
          <button className={`scale-pill ${sc ? '' : 'unset'}`} disabled={!sh} onClick={() => sh && s.set({ calibrating: { page: sh.id, length: 0 } })}>
            {sc ? sc.label : t('topbar.sem_escala')}
          </button>
        )}
        <button className="m-ico" aria-label={plain(t('topbar.desfazer_ctrl_z'))} disabled={!s.past.length} onClick={s.undo}><Undo2 size={20} /></button>
        <button className="m-ico" aria-label={plain(t('topbar.refazer_ctrl_y'))} disabled={!s.future.length} onClick={s.redo}><Redo2 size={20} /></button>
      </header>

      <main className="m-stage">
        {review ? (
          <>
            <Viewer onOpen={onOpen} />
            {s.search.open && has && <SearchBar />}
            {has && (
              <div className="m-zoom">
                <button aria-label={t('topbar.ampliar')} onClick={() => zoomBy(1.25)}><Plus size={20} /></button>
                <button aria-label={t('topbar.reduzir')} onClick={() => zoomBy(1 / 1.25)}><Minus size={20} /></button>
                <button aria-label={t('topbar.folha_inteira_0')} onClick={() => s.set({ fitReq: { mode: 'page', n: Date.now() } })}><Maximize size={18} /></button>
              </div>
            )}
          </>
        ) : (
          <>
            <button className="m-back" onClick={() => setModeAnimated('review')}><ArrowLeft size={18} /> {t('mobile.voltar_a_folha')}</button>
            <Suspense fallback={<div className="loading-mod">{t('app.carregando')}</div>}>
              {s.mode === 'pages' ? <PagesView /> : s.mode === '3d' ? <View3D /> : <CompareView />}
            </Suspense>
          </>
        )}
      </main>

      {mira && (
        <div className="m-mira">
          <p>{t('mobile.dica_mira')}</p>
          <div className="m-mira-row">
            <button className="m-mira-btn" disabled={miraN === 0} onClick={() => miraCmd('undo')}><Undo2 size={20} /><span>{t('mobile.desfazer_ponto')}</span></button>
            <button className="m-mira-btn primary" onClick={() => miraCmd('add')}><Plus size={22} /><span>{t('mobile.adicionar_ponto')}</span></button>
            <button className="m-mira-btn ok" disabled={miraN < miraMin} onClick={() => miraCmd('done')}><Check size={20} /><span>{t('dialogs.concluir')}</span></button>
            <button className="m-mira-btn" aria-label={miraN ? t('dialogs.cancelar') : t('mobile.sair_da_medicao')} onClick={() => (miraN ? miraCmd('cancel') : s.setTool('pan'))}><X size={20} /></button>
          </div>
        </div>
      )}

      {has && review && !mira && s.selected.length > 0 && (
        <div className="m-sel">
          <b>{s.selected.length}</b>
          <button aria-label={t('rightpanel.propriedades')} onClick={() => openRight('props')}><SlidersHorizontal size={20} /></button>
          <button className="danger" aria-label={t('rightpanel.excluir')} onClick={() => s.removeMarkups(s.selected)}><Trash2 size={20} /></button>
          <button aria-label={t('dialogs.fechar')} onClick={() => s.set({ selected: [] })}><X size={20} /></button>
        </div>
      )}

      {has && review && !mira && (
        <nav className="m-tools" ref={strip} aria-label={t('mobile.ferramentas')}>
          {TOOLS.map((tl) => {
            const sep = last !== -1 && tl.group !== last
            last = tl.group
            const I = tl.icon
            return (
              <span key={tl.id} className="m-tool-wrap">
                {sep && <i className="m-tool-sep" />}
                <button className={`m-tool ${s.tool === tl.id ? 'active' : ''}`} aria-label={tl.label} aria-pressed={s.tool === tl.id} onClick={() => s.setTool(tl.id)}>
                  <I size={21} strokeWidth={1.8} />
                </button>
              </span>
            )
          })}
        </nav>
      )}

      <nav className="m-tabs">
        {tabs.map((tb) => {
          const I = tb.icon
          return (
            <button key={tb.id} className={sheet === tb.id ? 'active' : ''} disabled={!has && tb.id !== 'more' && tb.id !== 'left'} onClick={() => (sheet === tb.id ? closeSheet() : tb.run())}>
              <I size={22} strokeWidth={1.7} />
              <span>{tb.label}</span>
            </button>
          )
        })}
      </nav>

      {sheet && (
        <div className={`m-sheet-back ${closing ? "closing" : ""}`} onClick={closeSheet}>
          <section className={`m-sheet ${sheet}`} role="dialog" onClick={(e) => e.stopPropagation()}>
            <button className="m-sheet-close" aria-label={t('dialogs.fechar')} onClick={closeSheet}><X size={20} /></button>
            <div className="m-sheet-body">
              {sheet === 'left' && <LeftPanel />}
              {sheet === 'right' && <RightPanel />}
              {sheet === 'bottom' && <BottomPanel />}
              {sheet === 'more' && (
                <div className="m-more">
                  {row(<FolderOpen size={20} />, t('viewerempty.abrir_pdf'), act(onOpen))}
                  {row(<Save size={20} />, plain(t('topbar.salvar_projeto_ctrl_s')), act(() => void saveProject()), !has)}
                  {row(<FileDown size={20} />, plain(t('topbar.exportar_pdf_ctrl_e')), act(() => s.set({ dialog: 'export' })), !has)}
                  {row(<Search size={20} />, plain(t('topbar.buscar_texto_ctrl_f')), act(() => s.set({ search: { ...s.search, open: true }, mode: 'review' })), !has)}
                  <div className="m-more-sep" />
                  {row(<Ruler size={20} />, t('navbar.medir'), () => openLeft('measure'), !has)}
                  {row(<FilePenLine size={20} />, t('navbar.editar_pdf'), () => openLeft('edit'), !has)}
                  {row(<Layers3 size={20} />, t('navbar.camadas'), () => openLeft('layers'), !has)}
                  {row(<SquareStack size={20} />, t('navbar.sobrepor'), () => openLeft('overlay'), !has)}
                  {row(<ClipboardList size={20} />, t('navbar.compatib'), () => openLeft('issues'), !has)}
                  {row(<Stamp size={20} />, t('topbar.carimbos_e_numeracao_em_lote'), act(() => s.set({ dialog: 'stamp' })), !has)}
                  <div className="m-more-sep" />
                  {row(<LayoutGrid size={20} />, t('navbar.organizar'), () => goMode('pages'), !has)}
                  {row(<Columns2 size={20} />, t('navbar.comparar'), () => goMode('compare'), !has)}
                  {row(<Box size={20} />, '3D', () => goMode('3d'), !has)}
                  {row(<Sparkles size={20} />, t('navbar.claude'), () => openRight('claude'))}
                  <div className="m-more-sep" />
                  {row(<Settings size={20} />, t('topbar.configuracoes_e_atualizacoes'), act(() => s.set({ dialog: 'updates' })))}
                  {row(s.theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />, s.theme === 'dark' ? t('topbar.tema_claro') : t('topbar.tema_escuro'), toggleTheme)}
                </div>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
