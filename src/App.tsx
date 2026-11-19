import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react'
import { curSheet, useStore } from './store'
import { TitleBar } from './components/TitleBar'
import { Ribbon } from './components/Ribbon'
import { StatusBar } from './components/StatusBar'
import { TabBar } from './components/TabBar'
import { switchTab } from './tabs'
import { TOOLS } from './railTools'
import { PaletteStack, EdgeTabs } from './components/pal/PaletteStack'
import { PropsPalette } from './components/pal/PropsPalette'
import { QuantPalette } from './components/pal/QuantPalette'
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
const SettingsDialog = lazy(() => import('./components/SettingsDialog').then((m) => ({ default: m.SettingsDialog })))
const RecoverDialog = lazy(() => import('./components/Dialogs').then((m) => ({ default: m.RecoverDialog })))
const CloseDialog = lazy(() => import('./components/Dialogs').then((m) => ({ default: m.CloseDialog })))
const PresetDialog = lazy(() => import('./components/PresetDialog').then((m) => ({ default: m.PresetDialog })))
/** Espera de um modo que ainda está carregando: o contorno de uma folha no lugar onde ela vai aparecer, com o texto embaixo. */
const Loading = () => (
  <div className="loading-mod">
    <div className="skel-sheet" aria-hidden />
    <span>{t('app.carregando')}</span>
  </div>
)
import { loadFile, requestCloseProject, saveAllDirty, saveProject } from './project'
import { desktop } from './platform'
import { SearchBar } from './components/SearchBar'
import { MobileShell } from './components/MobileShell'
import { useIsMobile } from './mobile'
import { preloadViews } from './motion'
import { applyPalette, usePalette } from './theme'
import { Resizer } from './components/Resizer'
import { panelsInstant, togglePanel, useLagClose } from './panels'
import { Presence } from './components/Presence'
import { Glyph } from './components/Icon'
import { startTipWarmth } from './tipWarm'
import { readRecoveryInfo, startAutosave } from './autosave'
import { t, useLang } from './i18n'
import { useUnits } from './units'
import { firstRun, markWelcomed, openSample } from './tour'

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
      useStore.getState().notify(t('app.nao_foi_possivel_abrir_o'), 'err')
    }
  }, [])

  handleFileRef.current = handleFile
  const palette = usePalette()
  useEffect(() => {
    document.documentElement.dataset.theme = s.theme
    applyPalette(s.theme, palette)
  }, [s.theme, palette.primary, palette.accent]) // eslint-disable-line react-hooks/exhaustive-deps

  // janela estreita (notebook): recolhe os painéis laterais ao cruzar o limite, para a folha ter espaço. A pessoa pode reabri-los depois.
  // Até 1280 px as paletas laterais têm 232 px (e não 240).
  const [narrow, setNarrow] = useState(() => window.innerWidth <= 1280)
  useEffect(() => {
    if (mobile) return
    let last = Infinity
    const fit = () => {
      const w = window.innerWidth
      const st = useStore.getState()
      setNarrow(w <= 1280)
      if (w < 1180 && last >= 1180 && st.panels.right) st.set({ panels: { ...st.panels, right: false } })
      if (w < 980 && last >= 980 && st.panels.left) st.set({ panels: { ...st.panels, left: false } })
      last = w
    }
    fit()
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [mobile])

  // salvamento automático + oferta de recuperação ao abrir
  useEffect(() => {
    startAutosave()
    preloadViews()
    startTipWarmth()
    readRecoveryInfo().then((info) => {
      if (info && !useStore.getState().sheets.length) useStore.setState({ dialog: 'recover' })
    })
    desktop?.onSaveAndClose?.(async () => {
      if (await saveAllDirty()) desktop?.closeNow?.()
    })
    desktop?.update?.onState((u) => {
      if (u.status === 'available') useStore.getState().notify(t('app.nova_versao_disponivel_configuracoes_atualizacoes', { version: u.version }))
      if (u.status === 'ready') useStore.setState({ updateReady: u.version ?? '' })
    })
  }, [])

  // primeira abertura depois de instalar: abre a planta de exemplo com o passo a passo (a menos que um arquivo tenha sido aberto
  // pelo Windows ou haja trabalho para recuperar). Só acontece uma vez.
  useEffect(() => {
    if (!desktop || mobile || !firstRun()) return
    const timer = setTimeout(() => {
      const st = useStore.getState()
      markWelcomed()
      if (!st.sheets.length && !st.dialog && !st.tabs.length) void openSample()
    }, 1500)
    return () => clearTimeout(timer)
  }, [mobile])

  // app de PC: arquivo aberto pelo Windows (duplo clique em .traco/.pdf)
  useEffect(() => {
    if (!desktop) return
    const open = async (p: string) => handleFileRef.current?.(await desktop!.readPath(p))
    desktop.onOpenPath(open)
    // arquivo com que o Windows iniciou o app ("Abrir com"/duplo clique)
    void desktop.takePending?.().then((p) => {
      if (p) void open(p)
    })
  }, [])

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
      if (mod && !e.shiftKey && ['1', '2', '3'].includes(e.key)) { e.preventDefault(); panelsInstant(); togglePanel(e.key === '1' ? 'left' : e.key === '2' ? 'bottom' : 'right'); return }
      if (mod && k === 'f' && st.sheets.length) { e.preventDefault(); st.set({ search: { ...st.search, open: true }, mode: 'review' }); setTimeout(() => (document.querySelector('.searchbar input') as HTMLInputElement | null)?.select(), 0); return }
      if (target.closest('input,textarea,select,[contenteditable]')) return
      if (mod && k === 'o') { e.preventDefault(); open(); return }
      if (mod && k === 's') { e.preventDefault(); saveProject(e.shiftKey); return }
      if (mod && (e.key === 'Tab' || e.key === 'PageDown' || e.key === 'PageUp') && st.tabs.length > 1) {
        // Ctrl+Tab / Ctrl+Shift+Tab (e Ctrl+PgDn/PgUp): próxima e anterior aba
        e.preventDefault()
        const back = e.key === 'PageUp' || (e.key === 'Tab' && e.shiftKey)
        const i = st.tabs.findIndex((x) => x.id === st.activeTab)
        switchTab(st.tabs[(i + (back ? -1 : 1) + st.tabs.length) % st.tabs.length].id)
        return
      }
      if (mod && k === 'w') { e.preventDefault(); requestCloseProject(); return }
      if (mod && k === 'e') { e.preventDefault(); if (st.sheets.length) st.set({ dialog: 'export' }); return }
      if (mod && k === 'z') { e.preventDefault(); if (e.shiftKey) st.redo(); else st.undo(); return }
      if (mod && k === 'y') { e.preventDefault(); st.redo(); return }
      if (e.key === 'Tab' && !mod && !target.closest('[role="dialog"],[role="alertdialog"]')) { e.preventDefault(); (document.activeElement as HTMLElement | null)?.blur(); panelsInstant(); st.set({ focus: !st.focus }); return }
      if (e.key === 'F3') { e.preventDefault(); st.set({ snap: !st.snap }); st.notify(st.snap ? t('app.snap_desligado') : t('app.snap_ligado')); return }
      if (e.key === 'F8') { e.preventDefault(); st.set({ ortho: !st.ortho }); st.notify(st.ortho ? t('app.ortogonal_desligado') : t('app.ortogonal_ligado')); return }
      if (st.mode === '3d' && (e.key === 'Delete' || e.key === 'Backspace') && st.selected.length && !st.dialog && !mod) { e.preventDefault(); st.removeMarkups(st.selected); return } // 3D: Excluir (Del) do sólido selecionado
      if (st.mode !== 'review' || st.dialog || st.calibrating || st.presetDialog) return // com uma janela aberta, as letras não trocam a ferramenta por trás dela
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
  const showLeft = s.panels.left && !s.focus
  // Pranchas só tem o Navegador à esquerda e a grade no centro (GUIA 3): sem paleta direita nem inferior. A preferência `panels.right` não muda,
  // então ao voltar para Início a coluna reaparece como estava.
  const rightAllowed = !(other && s.mode === 'pages')
  const showRight = s.panels.right && !s.focus && rightAllowed
  // Pranchas e Comparar não têm paleta inferior (GUIA 3); 3D e Revisar têm
  const showBottom = s.panels.bottom && !s.focus && !(other && (s.mode === 'pages' || s.mode === 'compare'))
  const rightW = s.rightTab === 'claude' ? Math.max(390, s.rightW) : narrow && s.rightW <= 240 ? 232 : s.rightW
  const hasTabs = s.tabs.length > 0
  // minmax(0, 1fr): sem isso o conteúdo do meio (quantitativo, barra de ferramentas) alarga a coluna e empurra o painel direito para fora da janela.
  // ao recolher, a coluna só fecha depois que o painel terminou de sair: a planta muda de tamanho uma vez, não a cada quadro (ver panels.ts)
  const colLeft = useLagClose(showLeft)
  const colRight = useLagClose(showRight)
  const rowBottom = useLagClose(showBottom)
  const cols = `${colLeft ? (narrow ? '232px' : '240px') : '0px'} minmax(0, 1fr) ${colRight ? `min(${rightW}px, 36vw)` : '0px'}`
  const rows = `${hasTabs ? '24px ' : ''}minmax(0, 1fr) ${rowBottom ? `min(${s.bottomH}px, 42vh)` : '0px'}`
  return (
    <div className={`app ${mobile ? 'mobile' : ''}`} key={`${lang}-${units}`}>
      {mobile ? <MobileShell onOpen={open} /> : <>
      <div className="rx rx-top">
        <TitleBar onOpen={open} />
        <Ribbon onOpen={open} />
      </div>
      <div className="shell">
        {/* a pilha de paletas, a coluna central e Propriedades ficam em todos os modos; só o miolo da coluna central muda */}
        <div className="workspace" style={{ gridTemplateColumns: cols }}>
          <div className={`slot ${showLeft ? '' : 'collapsed'}`}><PaletteStack /></div>
          <main className="center" style={{ gridTemplateRows: rows }}>
            <TabBar onOpen={open} />
            <div className="stagewrap">
              {/* Revisar nunca é desmontada: voltar dos outros modos não redesenha o PDF (era a "piscada") e mantém zoom e posição */}
              <div className={`split ${s.split3d && s.sheets.length ? 'on' : ''} ${other ? 'is-hidden' : ''}`} aria-hidden={other} inert={other}>
                <Viewer onOpen={open} />
                {s.split3d && s.sheets.length > 0 && !other && <Suspense fallback={<Loading />}><View3D compact /></Suspense>}
              </div>
              {other && (
                <div key={s.mode} className="layer-pane">
                  <Suspense fallback={<Loading />}>{s.mode === 'pages' ? <PagesView /> : s.mode === '3d' ? <View3D /> : <CompareView />}</Suspense>
                </div>
              )}
              {s.search.open && s.sheets.length > 0 && <SearchBar />}
              <EdgeTabs showRight={showRight} showBottom={showBottom} rightAllowed={rightAllowed} />
            </div>
            <div className={`slot ${showBottom ? '' : 'collapsed'}`}>
              {showBottom && <Resizer dir="h" />}
              <QuantPalette />
            </div>
          </main>
          <div className={`slot ${showRight ? '' : 'collapsed'}`}>
            {showRight && <Resizer dir="v" />}
            <PropsPalette />
          </div>
        </div>
      </div>
      <StatusBar />
      </>}
      <ScaleDialog key={s.calibrating ? `${s.calibrating.page}-${s.calibrating.length}-${s.calibrating.viewport}` : 'none'} />
      <Suspense fallback={null}>
        {/* Presence: ao fechar, a janela sai com um fade curto em vez de sumir de uma vez */}
        <Presence>
          {s.dialog === 'export' ? <ExportDialog key="export" />
            : s.dialog === 'stamp' ? <StampDialog key="stamp" />
            : s.dialog === 'statuses' ? <StatusDialog key="statuses" />
            : s.dialog === 'prices' ? <PricesDialog key="prices" />
            : s.dialog === 'columns' ? <ColumnsDialog key="columns" />
            : s.dialog === 'updates' ? <SettingsDialog key="updates" />
            : s.dialog === 'recover' ? <RecoverDialog key="recover" />
            : s.dialog === 'close' ? <CloseDialog key="close" />
            : null}
        </Presence>
        {s.presetDialog && <PresetDialog />}
      </Suspense>
      {!mobile && <Tour />}
      <Presence>{s.toast ? <div className={`rx toast ${s.toastKind === 'err' ? 'er' : ''}`.trim()} role={s.toastKind === 'err' ? 'alert' : 'status'}><Glyph name={s.toastKind === 'err' ? 'alerta' : 'check'} size={12} /><span>{s.toast}</span></div> : null}</Presence>
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
