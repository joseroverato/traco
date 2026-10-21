import { useEffect, useMemo, useRef, useState } from 'react'
import { Maximize, Trash2, ArrowUpToLine } from 'lucide-react'
import { useStore } from '../store'
import { DEFAULT_SOLID_HEIGHT } from '../geometry'
import { LAYER_LABEL, areaOf, buildSolids3D, layerTotals, volumeOf } from '../solids'
import type { LayerKind } from '../solids'
import { Scene3D } from '../scene3d'
import type { HoverInfo } from '../scene3d'
import { t } from '../i18n'
import { Rich } from './Rich'
import { keyOf } from '../hotkeys'
import { fmtQty, lenIn, lenOut, lenUnit } from '../units'

const LAYERS = Object.keys(LAYER_LABEL) as LayerKind[]
const VIEW_NAME = { get top() { return t('view3d.topo') }, get front() { return t('view3d.frente') }, get right() { return t('view3d.direita') } } as const
const KIND_NAME: Record<LayerKind, string> = { get solid() { return t('view3d.solido_2') }, get space() { return t('view3d.ambiente') }, get area() { return t('view3d.area_laje') }, get length() { return t('view3d.parede') }, get count() { return t('view3d.item') } }

/** Modo 3D: mostra os volumes das marcações da folha e deixa puxar/empurrar a altura dos sólidos. */
/** arredonda para não aparecer 9,180000000001 num campo depois da conversão de unidade */
const r3 = (x: number) => Math.round(x * 1000) / 1000

export function View3D({ compact = false }: { compact?: boolean }) {
  const s = useStore()
  const sheet = s.sheets[s.page]
  const scale = sheet ? s.scales[sheet.id] : undefined
  const host = useRef<HTMLDivElement>(null)
  const scene = useRef<Scene3D | null>(null)
  const [visible, setVisible] = useState<Record<LayerKind, boolean>>({ solid: true, space: true, area: true, length: true, count: true })
  const [hover, setHover] = useState<HoverInfo | null>(null)

  const solids = useMemo(
    () => (sheet ? buildSolids3D({ page: sheet.id, markups: s.markups, presets: s.presets, scales: s.scales }) : []),
    [sheet, s.markups, s.presets, s.scales],
  )
  const totals = useMemo(() => layerTotals(solids), [solids])
  const ringKey = useMemo(() => JSON.stringify(solids.map((x) => [x.id, x.ring, x.base])), [solids])
  const sel = s.markups.find((m) => m.id === s.selected[0] && m.kind === 'solid')

  useEffect(() => {
    const el = host.current
    if (!el) return
    const sc = new Scene3D(
      el,
      {
        onPick: (id, additive) => {
          const st = useStore.getState()
          st.set({ selected: id ? (additive ? (st.selected.includes(id) ? st.selected.filter((x) => x !== id) : [...st.selected, id]) : [id]) : [] })
        },
        onHover: setHover,
        onHeight: (id, h, phase) => {
          const st = useStore.getState()
          if (phase === 'start') st.checkpoint() // o arrasto inteiro vira um único passo de desfazer
          else if (phase === 'move') st.updateMarkup(id, { height: h }, false)
          else {
            const final = st.markups.find((m) => m.id === id)?.height ?? h
            st.rememberSolid({ height: final })
            st.notify(t('view3d.altura_m_o_proximo_solido', { v: fmtQty(final, 'm') }))
          }
        },
      },
      useStore.getState().theme === 'dark',
    )
    scene.current = sc
    ;(window as unknown as { __traco?: Record<string, unknown> }).__traco = { ...((window as unknown as { __traco?: Record<string, unknown> }).__traco ?? {}), view3d: () => sc.state() }
    return () => {
      sc.dispose()
      scene.current = null
    }
  }, [])

  useEffect(() => scene.current?.setDark(s.theme === 'dark'), [s.theme])

  useEffect(() => {
    const sc = scene.current
    if (!sc) return
    sc.setSolids(solids, s.selected, visible)
    // acompanha a montagem: enquadra quando a planta dos volumes muda, enquanto a câmera não foi mexida
    if (sheet && solids.length) sc.autoFrame(`${sheet.id}|${ringKey}`)
  }, [solids, s.selected, visible, sheet, ringKey])

  const goPlan = (id?: string) => {
    const m = id ? s.markups.find((x) => x.id === id) : undefined
    s.set({ mode: 'review', tool: 'select', selected: id ? [id] : [], ...(m ? { page: Math.max(0, s.sheets.findIndex((x) => x.id === m.page)) } : {}) })
  }
  const up = (patch: Partial<NonNullable<typeof sel>>) => sel && s.updateMarkup(sel.id, patch)
  const listed = solids.filter((x) => x.kind === 'solid')

  return (
    <div className={`view3d ${compact ? 'compact' : ''}`}>
      <div className="v3-host" ref={host} />
      <div className="v3-bar">
        {!compact && s.sheets.length > 1 && (
          <select value={s.page} onChange={(e) => s.set({ page: Number(e.target.value), selected: [] })} aria-label={t('view3d.folha')}>
            {s.sheets.map((x, i) => <option key={x.id} value={i}>{x.label}{x.level ? ` · ${x.level}` : ''}</option>)}
          </select>
        )}
        {LAYERS.map((k) => (
          <button key={k} className={`chip ${visible[k] ? 'on' : ''}`} onClick={() => setVisible({ ...visible, [k]: !visible[k] })} data-tip={`${visible[k] ? 'Ocultar' : 'Mostrar'} ${LAYER_LABEL[k].toLowerCase()}`}>
            {LAYER_LABEL[k]} <span className="count">{totals[k].n}</span>
          </button>
        ))}
        <div className="tb-sep" />
        {compact && <span className="v3-total">{solids.length ? t('view3d.m_em_solidos', { v: fmtQty(totals.solid.volume, 'm³') }) : t('view3d.sem_volumes_ainda')}</span>}
        <button className="btn sm" onClick={() => scene.current?.frame('iso')} data-tip={t('view3d.enquadrar_tudo_vista_isometrica')}><Maximize size={13} /> {t('view3d.enquadrar')}</button>
        {(['top', 'front', 'right'] as const).map((v) => (
          <button key={v} className="btn sm" onClick={() => scene.current?.frame(v)}>{v === 'top' ? <ArrowUpToLine size={13} /> : null}{VIEW_NAME[v]}</button>
        ))}
      </div>

      {!compact && (
      <aside className="v3-panel">
        <h4>{t('view3d.resumo_da_folha')}</h4>
        <div className="card">
          {LAYERS.filter((k) => totals[k].n > 0).map((k) => (
            <div key={k} className="kv"><span>{LAYER_LABEL[k]} ({totals[k].n})</span><b>{k === 'count' ? '—' : fmtQty(totals[k].volume, 'm³')}</b></div>
          ))}
          {!solids.length && <span className="muted small">{t('view3d.nada_para_mostrar_ainda')}</span>}
        </div>
        {listed.length > 0 && (
          <>
            <h4>{t('view3d.solidos')}</h4>
            <div className="v3-list">
              {listed.map((x) => (
                <button key={x.id} className={s.selected.includes(x.markupId) ? 'active' : ''} onClick={() => s.set({ selected: [x.markupId] })}>
                  <i style={{ background: x.color }} /> <span className="grow">{x.label}</span> <b>{fmtQty(volumeOf(x), 'm³')}</b>
                </button>
              ))}
            </div>
          </>
        )}
        {sel && (
          <>
            <h4>{t('view3d.solido_selecionado')}</h4>
            <label className="field"><span>{t('view3d.nome')}</span><input value={sel.text} onChange={(e) => s.updateMarkup(sel.id, { text: e.target.value }, false)} /></label>
            <div className="row">
              <label className="field"><span>{t('view3d.base_m', { u: lenUnit() })}</span><input type="number" step={r3(lenIn(0.05))} value={r3(lenIn(sel.base ?? 0))} onChange={(e) => up({ base: lenOut(Number(e.target.value)) })} /></label>
              <label className="field"><span>{t('view3d.altura_m', { u: lenUnit() })}</span><input type="number" min={r3(lenIn(0.05))} step={r3(lenIn(0.05))} value={r3(lenIn(sel.height ?? DEFAULT_SOLID_HEIGHT))} onChange={(e) => { const h = Math.max(0.05, lenOut(Number(e.target.value))); up({ height: h }); s.rememberSolid({ height: h }) }} /></label>
            </div>
            <div className="row">
              <label className="field"><span>{t('view3d.cor')}</span><input type="color" value={sel.color} onChange={(e) => { up({ color: e.target.value, fill: e.target.value }); s.rememberSolid({ color: e.target.value }) }} /></label>
              <button className="btn sm" onClick={() => goPlan(sel.id)}>{t('view3d.ver_na_planta')}</button>
              <button className="btn sm ghost danger" onClick={() => s.removeMarkups([sel.id])}><Trash2 size={13} /> {t('view3d.excluir')}</button>
            </div>
            <span className="muted small">{t('view3d.arraste_a_seta_laranja_para')}</span>
          </>
        )}
      </aside>
      )}

      {hover && (
        <div className="v3-tip" style={{ left: hover.x + 14, top: hover.y + 14 }}>
          <b>{hover.solid.label}</b> <span className="muted">· {KIND_NAME[hover.solid.kind]}</span>
          <div>{t('view3d.dica_base', { area: fmtQty(areaOf(hover.solid), 'm²'), h: fmtQty(hover.solid.height, 'm') })}{hover.solid.base ? t('view3d.dica_cota', { base: fmtQty(hover.solid.base, 'm') }) : ''}</div>
          <div>{fmtQty(volumeOf(hover.solid), 'm³')}</div>
        </div>
      )}

      {!scale && <div className="v3-empty">{t('view3d.sem_escala')}{!compact && <button className="btn sm primary" onClick={() => goPlan()}>{t('view3d.ir_para_a_planta')}</button>}</div>}
      {scale && !solids.length && (
        <div className="v3-empty"><Rich k="view3d.nada_para_mostrar" vars={{ key: keyOf('solid') }} />{!compact && <button className="btn sm primary" onClick={() => goPlan()}>{t('view3d.ir_para_a_planta')}</button>}</div>
      )}
      {!compact && <div className="hud v3-hint">{t('view3d.roda_zoom_botao_do_meio')}</div>}
    </div>
  )
}
