import { Suspense, lazy, useCallback, useEffect, useRef } from 'react'
import { curSheet, useStore } from './store'
import { TopBar } from './components/TopBar'
import { ToolRail } from './components/ToolRail'
import { TOOLS } from './railTools'
import { LeftPanel } from './components/LeftPanel'
import { NavBar } from './components/NavBar'
import { RightPanel } from './components/RightPanel'
import { BottomPanel } from './components/BottomPanel'
import { Viewer } from './components/Viewer'
import { ScaleDialog } from './components/ScaleDialog'
import { Tour } from './components/Tour'
// módulos pesados (pdf-lib, comparação, diálogos) só carregam quando usados
const PagesView = lazy(() => import('./components/PagesView').then((m) => ({ default: m.PagesView })))
const View3D = lazy(() => import('./components/View3D').then((m) => ({ default: m.View3D })))
const CompareView = lazy(() => import('./components/CompareView').then((m) => ({ default: m.CompareView })))
const ExportDialog = lazy(() => import('./components/Dialogs').then((m) => ({ default: m.ExportDialog })))
const StampDialog = lazy(() => import('./components/Dialogs').then((m) => ({ default: m.StampDialog })))
const StatusDialog = lazy(() => import('./components/Dialogs').then((m) => ({ default: m.StatusDialog })))
const PricesDialog = lazy(() => import('./components/Dialogs').then((m) => ({ default: m.PricesDialog })))
const ColumnsDialog = lazy(() => import('./components/Dialogs').then((m) => ({ default: m.ColumnsDialog })))
const SettingsDialog = lazy(() => import('./components/Dialogs').then((m) => ({ default: m.SettingsDialog })))
const RecoverDialog = lazy(() => import('./components/Dialogs').then((m) => ({ default: m.RecoverDialog })))
const CloseDialog = lazy(() => import('./components/Dialogs').then((m) => ({ default: m.CloseDialog })))
const PresetDialog = lazy(() => import('./components/PresetDialog').then((m) => ({ default: m.PresetDialog })))
const Loading = () => <div className="loading-mod">{t('app.carregando')}</div>
import { loadFile, requestCloseProject, saveProject } from './project'
import { desktop } from './platform'
import { SearchBar } from './components/SearchBar'
import { MobileShell } from './components/MobileShell'
import { useIsMobile } from './mobile'
import { preloadViews } from './motion'
import { applyPalette, usePalette } from './theme'
import { Resizer } from './components/Resizer'
import { togglePanel } from './panels'
import { ChevronLeft, ChevronUp } from 'lucide-react'
import { readRecoveryInfo, startAutosave } from './autosave'
import { t, useLang } from './i18n'
import { useUnits } from './units'

export default function App() {
  const s = useStore()
  const units = useUnits() // idem para as unidades (m ↔ ft)
  const lang = useLang() // trocar o idioma refaz a tela inteira (textos que ficaram em cache dentro de componentes)
  const mobile = useIsMobile()
  const input = useRef<HTMLInputElement>(null)
  const imgInput = useRef<HTMLInputElement>(null)
  const open = useCallback(async () => {
    if (!desktop) return input.current?.click()
    const f = await desktop.openFile()
    if (f) handleFileRef.current?.(f)
  }, [])
  const handleFileRef = useRef<((f: File | { name: string; data: ArrayBuffer; path?: string }) => void) | null>(null)

  const handleFile = useCallback(async (f: File | { name: string; data: ArrayBuffer; path?: string }) => {
    try {
      if (await loadFile(f)) useStore.getState().notify(t('app.aberto', { name: f.name }))
    } catch (e) {
      console.error(e)
      useStore.getState().notify(t('app.nao_foi_possivel_abrir_o'))
    }
  }, [])

  handleFileRef.current = handleFile
  const palette = usePalette()
  useEffect(() => {
    document.documentElement.dataset.theme = s.theme
    applyPalette(s.theme, palette)
  }, [s.theme, palette.primary, palette.accent]) // eslint-disable-line react-hooks/exhaustive-deps

  // salvamento automático + oferta de recuperação ao abrir
  useEffect(() => {
    startAutosave()
    preloadViews()
    readRecoveryInfo().then((info) => {
      if (info && !useStore.getState().sheets.length) useStore.setState({ dialog: 'recover' })
    })
    desktop?.onSaveAndClose?.(async () => {
      if (await saveProject()) desktop?.closeNow?.()
    })
    desktop?.update?.onState((u) => {
      if (u.status === 'available') useStore.getState().notify(t('app.nova_versao_disponivel_configuracoes_atualizacoes', { version: u.version }))
      if (u.status === 'ready') useStore.setState({ updateReady: u.version ?? '' })
    })
  }, [])

  // app de PC: arquivo aberto pelo Windows (duplo clique em .traco/.pdf)
  useEffect(() => {
    desktop?.onOpenPath(async (p) => handleFile(await desktop!.readPath(p)))
  }, [handleFile])

  useEffect(() => {
    const h = (e: Event) => handleFile((e as CustomEvent<File>).detail)
    const pick = () => imgInput.current?.click()
    window.addEventListener('traco:file', h)
    window.addEventListener('traco:pick-image', pick)
    return () => {
      window.removeEventListener('traco:file', h)
      window.removeEventListener('traco:pick-image', pick)
    }
  }, [handleFile])

  // atalhos globais
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      const st = useStore.getState()
      const mod = e.ctrlKey || e.metaKey
      const k = e.key.toLowerCase()
      if (mod && !e.shiftKey && ['1', '2', '3'].includes(e.key)) { e.preventDefault(); togglePanel(e.key === '1' ? 'left' : e.key === '2' ? 'bottom' : 'right'); return }
      if (mod && k === 'f' && st.sheets.length) { e.preventDefault(); st.set({ search: { ...st.search, open: true }, mode: 'review' }); setTimeout(() => (document.querySelector('.searchbar input') as HTMLInputElement | null)?.select(), 0); return }
      if (target.closest('input,textarea,select,[contenteditable]')) return
      if (mod && k === 'o') { e.preventDefault(); open(); return }
      if (mod && k === 's') { e.preventDefault(); saveProject(e.shiftKey); return }
      if (mod && k === 'w') { e.preventDefault(); requestCloseProject(); return }
      if (mod && k === 'e') { e.preventDefault(); if (st.sheets.length) st.set({ dialog: 'export' }); return }
      if (mod && k === 'z') { e.preventDefault(); if (e.shiftKey) st.redo(); else st.undo(); return }
      if (mod && k === 'y') { e.preventDefault(); st.redo(); return }
      if (e.key === 'Tab' && !mod) { e.preventDefault(); (document.activeElement as HTMLElement | null)?.blur(); st.set({ focus: !st.focus }); return }
      if (e.key === 'F3') { e.preventDefault(); st.set({ snap: !st.snap }); st.notify(st.snap ? t('app.snap_desligado') : t('app.snap_ligado')); return }
      if (e.key === 'F8') { e.preventDefault(); st.set({ ortho: !st.ortho }); st.notify(st.ortho ? t('app.ortogonal_desligado') : t('app.ortogonal_ligado')); return }
      if (st.mode !== 'review' || st.dialog) return
      const sh = curSheet(st)
      if (mod && k === 'a') { e.preventDefault(); st.set({ selected: st.markups.filter((m) => m.page === sh?.id).map((m) => m.id) }); return }
      if (mod) return
      if ((e.key === 'Delete' || e.key === 'Backspace') && st.selected.length) { e.preventDefault(); st.removeMarkups(st.selected); return }
      if (e.key === 'Escape' && !['length', 'area', 'count'].includes(st.tool)) { st.set({ selected: [], tool: 'select', activePreset: null }); return }
      if (!st.sheets.length) return
      if (e.key === '+' || e.key === '=') return void window.dispatchEvent(new CustomEvent('traco:zoom', { detail: 1.25 }))
      if (e.key === '-') return void window.dispatchEvent(new CustomEvent('traco:zoom', { detail: 0.8 }))
      if (e.key === '0') return st.set({ fitReq: { mode: 'page', n: Date.now() } })
      if (k === 'w') return st.set({ fitReq: { mode: 'width', n: Date.now() } })
      if (e.key === 'PageDown') return st.set({ page: Math.min(st.sheets.length - 1, st.page + 1), selected: [] })
      if (e.key === 'PageUp') return st.set({ page: Math.max(0, st.page - 1), selected: [] })
      const tool = TOOLS.find((x) => x.key.toLowerCase() === k)
      if (tool) st.set({ tool: tool.id, activePreset: null, selected: tool.id === 'select' ? st.selected : [] })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const other = s.mode !== 'review' && s.sheets.length > 0 // Pranchas, Comparar ou 3D
  const showLeft = !!s.nav && !s.focus
  const showRight = s.panels.right && !s.focus
  const showBottom = s.panels.bottom && !s.focus
  const rightW = s.rightTab === 'claude' ? Math.max(390, s.rightW) : s.rightW
  const cols = `${showLeft ? '240px' : '0px'} 48px 1fr ${showRight ? `${rightW}px` : '0px'}`
  return (
    <div className={`app ${mobile ? 'mobile' : ''}`} key={`${lang}-${units}`}>
      {mobile ? <MobileShell onOpen={open} /> : <>
      <TopBar onOpen={open} />
      <div className="shell">
        <NavBar />
        <div className="stagewrap">
        {/* Revisar nunca é desmontada: voltar dos outros modos não redesenha o PDF (era a "piscada") e mantém zoom e posição */}
        <div className={`workspace ${other ? 'is-hidden' : ''}`} aria-hidden={other} inert={other} style={{ gridTemplateColumns: cols }}>
          <div className={`slot ${showLeft ? '' : 'collapsed'}`}><LeftPanel /></div>
          <ToolRail />
          <main className="center" style={{ gridTemplateRows: showBottom ? `1fr ${s.bottomH}px` : '1fr 0px' }}>
            <div className={`split ${s.split3d && s.sheets.length ? 'on' : ''}`}>
              <Viewer onOpen={open} />
              {s.split3d && s.sheets.length > 0 && !other && <Suspense fallback={<Loading />}><View3D compact /></Suspense>}
            </div>
            {s.search.open && s.sheets.length > 0 && <SearchBar />}
            {!showBottom && !s.focus && s.sheets.length > 0 && (
              <button className="edge-tab bottom" data-tip={t('app.mostrar_quantitativo_ctrl_2')} onClick={() => togglePanel('bottom')}><ChevronUp size={13} /> {t('app.quantitativo')}</button>
            )}
            {!showRight && !s.focus && (
              <button className="edge-tab right" data-tip={t('app.mostrar_marcadores_propriedades_e_claude')} onClick={() => togglePanel('right')}><ChevronLeft size={13} /><span>{t('app.painel')}</span></button>
            )}
            <div className={`slot ${showBottom ? '' : 'collapsed'}`}>
              {showBottom && <Resizer dir="h" />}
              <BottomPanel />
            </div>
          </main>
          <div className={`slot ${showRight ? '' : 'collapsed'}`}>
            {showRight && <Resizer dir="v" />}
            <RightPanel />
          </div>
        </div>
        {other && (
          <div key={s.mode} className="workspace single layer">
            <Suspense fallback={<Loading />}>{s.mode === 'pages' ? <PagesView /> : s.mode === '3d' ? <View3D /> : <CompareView />}</Suspense>
          </div>
        )}
        </div>
      </div>
      </>}
      <ScaleDialog key={s.calibrating ? `${s.calibrating.page}-${s.calibrating.length}-${s.calibrating.viewport}` : 'none'} />
      <Suspense fallback={null}>
        {s.dialog === 'export' && <ExportDialog />}
        {s.dialog === 'stamp' && <StampDialog />}
        {s.dialog === 'statuses' && <StatusDialog />}
        {s.dialog === 'prices' && <PricesDialog />}
        {s.dialog === 'columns' && <ColumnsDialog />}
        {s.dialog === 'updates' && <SettingsDialog />}
        {s.dialog === 'recover' && <RecoverDialog />}
        {s.dialog === 'close' && <CloseDialog />}
        {s.presetDialog && <PresetDialog />}
      </Suspense>
      {!mobile && <Tour />}
      {s.toast && <div className="toast">{s.toast}</div>}
      <input
        ref={input}
        type="file"
        accept=".pdf,.traco"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) handleFile(f)
          e.target.value = ''
        }}
      />
      <input
        ref={imgInput}
        type="file"
        accept="image/png,image/jpeg"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0]
          e.target.value = ''
          if (!f) return
          const r = new FileReader()
          r.onload = () => {
            useStore.setState({ pendingImage: String(r.result), tool: 'image' })
            useStore.getState().notify(t('app.clique_na_folha_para_posicionar'))
          }
          r.readAsDataURL(f)
        }}
      />
    </div>
  )
}
