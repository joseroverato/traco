import { Suspense, lazy, useCallback, useEffect, useRef } from 'react'
import { curSheet, useStore } from './store'
import { TopBar } from './components/TopBar'
import { ToolRail, TOOLS } from './components/ToolRail'
import { LeftPanel } from './components/LeftPanel'
import { NavBar } from './components/NavBar'
import { RightPanel } from './components/RightPanel'
import { BottomPanel } from './components/BottomPanel'
import { Viewer } from './components/Viewer'
import { ScaleDialog } from './components/ScaleDialog'
// módulos pesados (pdf-lib, comparação, diálogos) só carregam quando usados
const PagesView = lazy(() => import('./components/PagesView').then((m) => ({ default: m.PagesView })))
const CompareView = lazy(() => import('./components/CompareView').then((m) => ({ default: m.CompareView })))
const ExportDialog = lazy(() => import('./components/Dialogs').then((m) => ({ default: m.ExportDialog })))
const StampDialog = lazy(() => import('./components/Dialogs').then((m) => ({ default: m.StampDialog })))
const StatusDialog = lazy(() => import('./components/Dialogs').then((m) => ({ default: m.StatusDialog })))
const PricesDialog = lazy(() => import('./components/Dialogs').then((m) => ({ default: m.PricesDialog })))
const ColumnsDialog = lazy(() => import('./components/Dialogs').then((m) => ({ default: m.ColumnsDialog })))
const SettingsDialog = lazy(() => import('./components/Dialogs').then((m) => ({ default: m.SettingsDialog })))
const RecoverDialog = lazy(() => import('./components/Dialogs').then((m) => ({ default: m.RecoverDialog })))
const PresetDialog = lazy(() => import('./components/PresetDialog').then((m) => ({ default: m.PresetDialog })))
const Loading = () => <div className="loading-mod">Carregando…</div>
import { loadFile, saveProject } from './project'
import { desktop } from './platform'
import { SearchBar } from './components/SearchBar'
import { readRecoveryInfo, startAutosave } from './autosave'

export default function App() {
  const s = useStore()
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
      await loadFile(f)
      useStore.getState().notify(`${f.name} aberto`)
    } catch (e) {
      console.error(e)
      useStore.getState().notify('Não foi possível abrir o arquivo')
    }
  }, [])

  handleFileRef.current = handleFile
  useEffect(() => {
    document.documentElement.dataset.theme = s.theme
  }, [s.theme])

  // salvamento automático + oferta de recuperação ao abrir
  useEffect(() => {
    startAutosave()
    readRecoveryInfo().then((info) => {
      if (info && !useStore.getState().sheets.length) useStore.setState({ dialog: 'recover' })
    })
    desktop?.onSaveAndClose?.(async () => {
      if (await saveProject()) desktop?.closeNow?.()
    })
    desktop?.update?.onState((u) => {
      if (u.status === 'available') useStore.getState().notify(`Nova versão ${u.version} disponível — Configurações › Atualizações`)
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
      const t = e.target as HTMLElement
      const st = useStore.getState()
      const mod = e.ctrlKey || e.metaKey
      const k = e.key.toLowerCase()
      if (mod && k === 'f' && st.sheets.length) { e.preventDefault(); st.set({ search: { ...st.search, open: true }, mode: 'review' }); setTimeout(() => (document.querySelector('.searchbar input') as HTMLInputElement | null)?.select(), 0); return }
      if (t.closest('input,textarea,select,[contenteditable]')) return
      if (mod && k === 'o') { e.preventDefault(); open(); return }
      if (mod && k === 's') { e.preventDefault(); saveProject(e.shiftKey); return }
      if (mod && k === 'e') { e.preventDefault(); if (st.sheets.length) st.set({ dialog: 'export' }); return }
      if (mod && k === 'z') { e.preventDefault(); if (e.shiftKey) st.redo(); else st.undo(); return }
      if (mod && k === 'y') { e.preventDefault(); st.redo(); return }
      if (e.key === 'Tab' && !mod) { e.preventDefault(); (document.activeElement as HTMLElement | null)?.blur(); st.set({ focus: !st.focus }); return }
      if (e.key === 'F3') { e.preventDefault(); st.set({ snap: !st.snap }); st.notify(st.snap ? 'Snap desligado' : 'Snap ligado'); return }
      if (e.key === 'F8') { e.preventDefault(); st.set({ ortho: !st.ortho }); st.notify(st.ortho ? 'Ortogonal desligado' : 'Ortogonal ligado'); return }
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

  const showLeft = !!s.nav && !s.focus
  const showRight = s.panels.right && !s.focus
  const showBottom = s.panels.bottom && !s.focus
  const cols = `${showLeft ? '240px' : '0px'} 48px 1fr ${showRight ? (s.rightTab === 'claude' ? '390px' : '300px') : '0px'}`
  return (
    <div className="app">
      <TopBar onOpen={open} />
      <div className="shell">
        <NavBar />
        {s.mode === 'review' || !s.sheets.length ? (
        <div key="review" className="workspace mode-in" style={{ gridTemplateColumns: cols }}>
          <div className={`slot ${showLeft ? '' : 'collapsed'}`}><LeftPanel /></div>
          <ToolRail />
          <main className="center" style={{ gridTemplateRows: showBottom ? '1fr 240px' : '1fr 0px' }}>
            <Viewer onOpen={open} />
            {s.search.open && s.sheets.length > 0 && <SearchBar />}
            <div className={`slot ${showBottom ? '' : 'collapsed'}`}><BottomPanel /></div>
          </main>
          <div className={`slot ${showRight ? '' : 'collapsed'}`}><RightPanel /></div>
        </div>
      ) : s.mode === 'pages' ? (
        <div key="pages" className="workspace single mode-in"><Suspense fallback={<Loading />}><PagesView /></Suspense></div>
      ) : (
        <div key="compare" className="workspace single mode-in"><Suspense fallback={<Loading />}><CompareView /></Suspense></div>
      )}
      </div>
      <ScaleDialog key={s.calibrating ? `${s.calibrating.page}-${s.calibrating.length}-${s.calibrating.viewport}` : 'none'} />
      <Suspense fallback={null}>
        {s.dialog === 'export' && <ExportDialog />}
        {s.dialog === 'stamp' && <StampDialog />}
        {s.dialog === 'statuses' && <StatusDialog />}
        {s.dialog === 'prices' && <PricesDialog />}
        {s.dialog === 'columns' && <ColumnsDialog />}
        {s.dialog === 'updates' && <SettingsDialog />}
        {s.dialog === 'recover' && <RecoverDialog />}
        {s.presetDialog && <PresetDialog />}
      </Suspense>
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
            useStore.getState().notify('Clique na folha para posicionar a imagem')
          }
          r.readAsDataURL(f)
        }}
      />
    </div>
  )
}
