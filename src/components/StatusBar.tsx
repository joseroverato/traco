import { curSheet, useStore } from '../store'
import { Glyph, Icon } from './Icon'
import { Rich } from './Rich'
import { TOOL_INFO } from '../toolInfo'
import { fitPage, fitWidth, nameOf, ribbonIcon, zoomIn, zoomOut } from '../ribbon'
import { useZoom } from '../liveZoom'
import { t, tp } from '../i18n'
import { usePagesSelected } from '../pagesUi'
import { ZOOM_MAX, ZOOM_MIN, compareZoomBy, regionsLabel, useCompareShare, useCompareUi } from '../compareShare'
import type { CompareView } from '../compareShare'
import { useView3dUi } from '../view3dUi'
import { fmtQty } from '../units'

/** Porcentagem do zoom. Componente próprio: é o único pedaço da barra que acompanha a animação de zoom quadro a quadro. */
function ZoomVal() {
  return <span className="n">{Math.round(useZoom() * 100)}%</span>
}

const VIEW_NAME: Record<CompareView, () => string> = {
  overlay: () => t('compareview.sobrepor'), diff: () => t('compareview.so_diferencas'), side: () => t('compareview.lado_a_lado'),
}

/** Instrução da ferramenta ativa (as mesmas descrições da dica rica) ou, no 3D, a dica de navegação. */
function Hint() {
  const tool = useStore((s) => s.tool)
  const mode = useStore((s) => s.mode)
  const aligning = useStore((s) => s.aligning)
  const has = useStore((s) => s.sheets.length > 0)
  if (!has) return null
  if (mode === '3d') return <><b>3D</b><span className="st-d">{t('view3d.roda_zoom_botao_do_meio')}</span></>
  if (mode === 'pages') return <><b>{t('topbar.pranchas')}</b><span className="st-d">{t('pagesview.arraste_para_reordenar_ctrl_shift')}</span></>
  if (mode === 'compare') return <CompareHint />
  if (mode !== 'review') return null
  if (aligning) {
    return (
      <span className="st-d">
        <Rich k="viewerhints.alinhar" vars={{ n: Math.floor(aligning.step / 2) + 1, alvo: aligning.step % 2 === 0 ? t('viewerhints.desenho_colorido_sobreposto') : t('viewerhints.desenho_base') }} />
      </span>
    )
  }
  const info = TOOL_INFO[tool]
  return <><b>{info.title}</b><span className="st-d">{info.desc}</span></>
}

function CompareHint() {
  const view = useCompareUi((u) => u.view)
  return <><b>{t('topbar.comparar')}</b><span className="st-d">{t('compareview.dica_status', { modo: VIEW_NAME[view]() })}</span></>
}

/** Pranchas: quantas folhas há e quantas estão marcadas. */
function PagesReadout() {
  const total = useStore((s) => s.sheets.length)
  const marked = usePagesSelected().length
  return (
    <>
      <span className="stx"><b className="n">{tp('pagesview.n_folhas', total)}</b></span>
      {marked > 0 && <span className="stx"><b className="n">{tp('pagesview.selecionadas', marked)}</b></span>}
    </>
  )
}

/** Comparar: regiões alteradas e o zoom da comparação. */
function CompareReadout() {
  const { regions, busy } = useCompareShare()
  const zoom = useCompareUi((u) => u.zoom)
  return (
    <>
      <span className="stx">{busy ? t('compareview.analisando') : <b className="n">{regionsLabel(regions.length)}</b>}</span>
      <div className="zm" role="group" aria-label={t('ribbon.g_zoom')}>
        <button type="button" className="ib" title={t('topbar.reduzir')} aria-label={nameOf(t('topbar.reduzir'))} disabled={zoom <= ZOOM_MIN + 1e-9} onClick={() => compareZoomBy(1 / 1.25)}><Icon name={ribbonIcon('zoomOut')} size={16} /></button>
        <span className="n">{Math.round(zoom * 100)}%</span>
        <button type="button" className="ib" title={t('topbar.ampliar')} aria-label={nameOf(t('topbar.ampliar'))} disabled={zoom >= ZOOM_MAX - 1e-9} onClick={() => compareZoomBy(1.25)}><Icon name={ribbonIcon('zoomIn')} size={16} /></button>
      </div>
    </>
  )
}

/** 3D: volume dos sólidos da folha. */
function View3dReadout() {
  const totals = useView3dUi((u) => u.totals)
  if (!totals || !totals.solid.n) return null
  return <span className="stx"><b className="n">{t('view3d.m_em_solidos', { v: fmtQty(totals.solid.volume, 'm³') })}</b></span>
}

/** Barra de status de 24 px: instrução, escala da folha, Snap, Orto e zoom. (X e Y do cursor: o Viewer não os publica; ver ribbon.ts.) */
export function StatusBar() {
  const review = useStore((s) => s.mode === 'review')
  const mode = useStore((s) => s.mode)
  const sheet = useStore((s) => curSheet(s)?.id ?? null)
  const scaleLabel = useStore((s) => { const sh = curSheet(s); return sh ? s.scales[sh.id]?.label ?? null : null })
  const snap = useStore((s) => s.snap)
  const ortho = useStore((s) => s.ortho)
  const has = useStore((s) => s.sheets.length > 0)
  const set = useStore((s) => s.set)
  const toggleSnap = () => {
    const v = !snap
    set({ snap: v })
    try { localStorage.setItem('traco.snap', JSON.stringify(v)) } catch { /* sem storage */ }
  }
  const zb = (label: string, icon: string, run: () => void) => (
    <button type="button" className="ib" title={label} aria-label={nameOf(label)} disabled={!has} onClick={run}>
      <Icon name={ribbonIcon(icon)} size={16} />
    </button>
  )
  return (
    <div className="rx rx-bot">
      <footer className="st" aria-label={t('ribbon.barra_status')}>
        <div className="st-h"><Hint /></div>
        <span className="sp" />
        {has && mode === 'pages' && <PagesReadout />}
        {has && mode === 'compare' && <CompareReadout />}
        {has && mode === '3d' && <View3dReadout />}
        {review && sheet && (
          <button type="button" className="stb esc" data-warn={scaleLabel ? undefined : ''} title={t('topbar.escala_da_folha')} onClick={() => set({ calibrating: { page: sheet, length: 0 } })}>
            <span className="k">{t('topbar.escala_da_folha')}</span>
            <b>{scaleLabel ?? t('topbar.sem_escala')}</b>
            <Glyph name="down" size={10} />
          </button>
        )}
        {review && (
          <>
            <button type="button" className={`stb tg${snap ? ' on' : ''}`} aria-pressed={snap} title={t('viewer.snap_na_geometria_do_pdf')} onClick={toggleSnap}>
              <Icon name={ribbonIcon('snap')} size={16} />Snap <kbd>(F3)</kbd>
            </button>
            <button type="button" className={`stb tg${ortho ? ' on' : ''}`} aria-pressed={ortho} title={t('viewer.ortogonal_so_0_e_90')} onClick={() => set({ ortho: !ortho })}>
              <Icon name={ribbonIcon('ortho')} size={16} />{t('viewer.orto')} <kbd>(F8)</kbd>
            </button>
            <div className="zm" role="group" aria-label={t('ribbon.g_zoom')}>
              {zb(t('topbar.reduzir'), 'zoomOut', zoomOut)}
              <ZoomVal />
              {zb(t('topbar.ampliar'), 'zoomIn', zoomIn)}
              {zb(t('topbar.folha_inteira_0'), 'fitPage', fitPage)}
              {zb(t('topbar.largura_w'), 'fitWidth', fitWidth)}
            </div>
          </>
        )}
      </footer>
    </div>
  )
}
