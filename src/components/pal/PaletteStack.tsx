import { useMemo } from 'react'
import type { ComponentType } from 'react'
import { useStore } from '../../store'
import { isIssue } from '../../issues'
import { overlaysOf } from '../../overlayOps'
import { useLayers } from '../../layerOps'
import { useCompareShare } from '../../compareShare'
import { openPal, pinPal, setPal, togglePal, useStack, usePal } from '../../palettes'
import type { PalId } from '../../palModel'
import { CollapsedRow, PalHeader } from './PalFrame'
import { NavigatorPalette } from './NavigatorPalette'
import { MarkersPalette } from './MarkersPalette'
import { LayersPalette } from './LayersPalette'
import { OverlayPalette } from './OverlayPalette'
import { IssuesPalette } from './IssuesPalette'
import { LegendPalette, RegionsPalette } from './ComparePalettes'
import { SummaryPalette } from './SummaryPalette'
import { t } from '../../i18n'

/** Contadores (GUIA 4b-d): "Marcadores N" sempre; as demais só quando N > 0. null = sem contador. */
const useNone = () => null
const useMarkerCount = () => useStore((s) => s.presets.length)
const useLayerCount = () => { const n = useLayers().layers?.length ?? 0; return n > 0 ? n : null }
const useOverlayCount = () => { const n = useStore((s) => overlaysOf(s).length); return n > 0 ? n : null }
const useIssueCount = () => { const markups = useStore((s) => s.markups); const n = useMemo(() => markups.filter(isIssue).length, [markups]); return n > 0 ? n : null }
const useRegionCount = () => { const n = useCompareShare().regions.length; return n > 0 ? n : null }

interface Meta { title: () => string; icon: string; Body: ComponentType; useCount: () => number | null }
const META: Record<PalId, Meta> = {
  nav: { title: () => t('pal.navegador_do_projeto'), icon: 'pasta', Body: NavigatorPalette, useCount: useNone },
  marc: { title: () => t('rightpanel.marcadores'), icon: 'marcadores', Body: MarkersPalette, useCount: useMarkerCount },
  camadas: { title: () => t('navbar.camadas'), icon: 'camadas', Body: LayersPalette, useCount: useLayerCount },
  sobrepor: { title: () => t('navbar.sobrepor'), icon: 'sobrepor', Body: OverlayPalette, useCount: useOverlayCount },
  compat: { title: () => t('leftpanel.compatibilizacao'), icon: 'itens', Body: IssuesPalette, useCount: useIssueCount },
  regioes: { title: () => t('pal.regioes_alteradas'), icon: 'comparar', Body: RegionsPalette, useCount: useRegionCount },
  legenda: { title: () => t('pal.legenda'), icon: 'legenda', Body: LegendPalette, useCount: useNone },
  resumo: { title: () => t('view3d.resumo_da_folha'), icon: 'tabela', Body: SummaryPalette, useCount: useNone },
}

function OpenPalette({ id, fill }: { id: PalId; fill: boolean }) {
  const m = META[id]
  const { pinned } = usePal(id)
  const count = m.useCount()
  return (
    <section className={`pal-sec${fill ? ' fill' : ''}`} data-pal={id} aria-label={m.title()}>
      <PalHeader title={m.title()} count={count} onCollapse={() => togglePal(id)} pinned={pinned} onPin={() => pinPal(id, !pinned)} onClose={() => setPal(id, 'closed')} />
      <div className="pal-body rol-host"><m.Body /></div>
    </section>
  )
}

function Collapsed({ id }: { id: PalId }) {
  const m = META[id]
  const count = m.useCount()
  return <CollapsedRow title={m.title()} icon={m.icon} count={count} onOpen={() => openPal(id)} />
}

/** Pilha de paletas à esquerda: as abertas dividem a altura; as recolhidas viram linhas no pé; as fechadas têm aba lateral (ClosedTabs). */
export function PaletteStack() {
  const stack = useStack()
  const open = stack.filter((p) => p.state === 'open')
  const collapsed = stack.filter((p) => p.state === 'collapsed')
  return (
    <aside className="rx pal-col left" aria-label={t('pal.paletas')}>
      <div className="pal pal-stack">
        {open.map((p, i) => <OpenPalette key={p.id} id={p.id} fill={i === open.length - 1} />)}
        {collapsed.length > 0 && (
          <div className="pcs">
            {collapsed.map((p) => <Collapsed key={p.id} id={p.id} />)}
          </div>
        )}
      </div>
    </aside>
  )
}

/**
 * Abas de borda (.etb) que reabrem o que está fechado: a coluna da esquerda (Ctrl+1), cada paleta fechada pelo X,
 * Propriedades (Ctrl+3) e o Quantitativo (Ctrl+2).
 */
export function EdgeTabs({ showRight, showBottom, rightAllowed = true }: { showRight: boolean; showBottom: boolean; rightAllowed?: boolean }) {
  const stack = useStack()
  const panelLeft = useStore((s) => s.panels.left)
  const focus = useStore((s) => s.focus)
  const mode = useStore((s) => s.mode)
  const hasDoc = useStore((s) => s.sheets.length > 0)
  const set = useStore((s) => s.set)
  const closed = stack.filter((p) => p.state === 'closed')
  if (focus) return null
  const panels = () => useStore.getState().panels
  const bottomAllowed = hasDoc && !(mode === 'pages' || mode === 'compare')
  return (
    <div className="rx etb-layer">
      {(!panelLeft || (closed.length > 0 && hasDoc)) && (
        <div className="etb-col">
          {!panelLeft && <button type="button" className="etb" title={t('pal.mostrar_as_paletas_ctrl_1')} onClick={() => set({ panels: { ...panels(), left: true }, focus: false })}>{t('pal.paletas')}</button>}
          {panelLeft && closed.map((p) => <button key={p.id} type="button" className="etb" title={t('pal.abrir_a_paleta')} onClick={() => openPal(p.id)}>{META[p.id].title()}</button>)}
        </div>
      )}
      {!showRight && rightAllowed && <button type="button" className="etb dir" title={t('app.mostrar_marcadores_propriedades_e_claude')} onClick={() => set({ panels: { ...panels(), right: true }, focus: false })}>{t('rightpanel.propriedades')}</button>}
      {!showBottom && bottomAllowed && <button type="button" className="etb inf" title={t('app.mostrar_quantitativo_ctrl_2')} onClick={() => set({ panels: { ...panels(), bottom: true }, focus: false })}>{t('app.quantitativo')}</button>}
    </div>
  )
}
